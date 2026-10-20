import { createHash, randomBytes, scrypt as nodeScrypt, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import {
  clearAuthRateLimit,
  createAdminSession,
  findAdminByEmail,
  findAdminForSession,
  hitAuthRateLimit,
  revokeAdminSession,
  updateAdminLastSignedIn,
} from "../polina-db";
import { getSessionCookieOptions } from "./cookies";

export const ADMIN_SESSION_COOKIE = "polina_admin_session";
export const CSRF_COOKIE = "polina_csrf";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = Buffer.alloc(16, 71);
const DUMMY_HASH = `scrypt$${DUMMY_SALT.toString("base64url")}$${scryptSync("not-a-real-account", DUMMY_SALT, 64, SCRYPT_OPTIONS).toString("base64url")}`;

function derivePassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, 64, SCRYPT_OPTIONS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const digest = await derivePassword(password, salt);
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    const actual = await derivePassword(password, salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeHexEqual(a: string, b: string) {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function getCookies(req: Request) {
  return parseCookieHeader(req.headers.cookie ?? "");
}

export type AdminSession = {
  admin: NonNullable<Awaited<ReturnType<typeof findAdminByEmail>>>;
  sessionId: number;
  tokenHash: string;
  csrfHash: string;
};

export async function authenticateAdminRequest(req: Request): Promise<{ admin: AdminSession["admin"]; session: AdminSession; user: User } | null> {
  const token = getCookies(req)[ADMIN_SESSION_COOKIE];
  if (!token || token.length < 32 || token.length > 256) return null;
  const tokenHash = sha256(token);
  const row = await findAdminForSession(tokenHash);
  if (!row) return null;
  const session: AdminSession = {
    admin: row.admin,
    sessionId: row.sessionId,
    tokenHash: row.sessionTokenHash,
    csrfHash: row.csrfHash,
  };
  const user = {
    id: row.admin.id,
    openId: `polina-email-admin-${row.admin.id}`,
    name: row.admin.name,
    email: row.admin.email,
    loginMethod: "email_password",
    role: "admin" as const,
    createdAt: row.admin.createdAt,
    updatedAt: row.admin.updatedAt,
    lastSignedIn: row.admin.lastSignedIn ?? row.admin.createdAt,
  } as User;
  return { admin: row.admin, session, user };
}

export function requestHasValidCsrf(req: Request, expectedHash: string) {
  const cookies = getCookies(req);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.header("x-polina-csrf");
  if (!cookieToken || !headerToken || headerToken !== cookieToken) return false;
  return safeHexEqual(sha256(cookieToken), expectedHash);
}

function clientKey(req: Request, scope: string, email: string) {
  const ip = typeof req.ip === "string" ? req.ip.slice(0, 80) : "unknown";
  return sha256(`${scope}\u0000${email}\u0000${ip}`);
}

async function enforceLimit(req: Request, scope: string, email: string, maxAttempts: number) {
  const result = await hitAuthRateLimit({
    bucketKey: clientKey(req, scope, email),
    maxAttempts,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  return result;
}

export async function signInWithPassword(input: { email: string; password: string }, req: Request, res: Response) {
  const email = input.email.trim().toLowerCase();
  const rate = await enforceLimit(req, "login", email, 7);
  if (rate.limited) {
    const error = new Error("Too many sign-in attempts. Try again later.") as Error & { code?: string };
    error.code = "TOO_MANY_REQUESTS";
    throw error;
  }

  const admin = await findAdminByEmail(email);
  const valid = await verifyPassword(input.password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !admin.active || !valid) {
    throw new Error("Email or password was not accepted.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const rawCsrf = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  const tokenHash = sha256(rawToken);
  await createAdminSession({ adminId: admin.id, tokenHash, csrfHash: sha256(rawCsrf), expiresAt });
  await updateAdminLastSignedIn(admin.id);
  await clearAuthRateLimit(clientKey(req, "login", email));

  const baseCookieOptions = getSessionCookieOptions(req);
  res.cookie(ADMIN_SESSION_COOKIE, rawToken, {
    ...baseCookieOptions,
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  });
  res.cookie(CSRF_COOKIE, rawCsrf, {
    ...baseCookieOptions,
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  });

  return { id: admin.id, name: admin.name, email: admin.email, role: "admin" as const };
}

export async function signOut(req: Request, res: Response) {
  const token = getCookies(req)[ADMIN_SESSION_COOKIE];
  if (token) await revokeAdminSession(sha256(token));
  const baseCookieOptions = getSessionCookieOptions(req);
  res.clearCookie(ADMIN_SESSION_COOKIE, { ...baseCookieOptions, httpOnly: true, secure: true, sameSite: "none", path: "/" });
  res.clearCookie(CSRF_COOKIE, { ...baseCookieOptions, httpOnly: false, secure: true, sameSite: "none", path: "/" });
  return { success: true as const };
}

/**
 * Keep reset requests neutral and rate-limited. Delivery is intentionally not
 * enabled until a POLINA transactional email provider and sender address are
 * configured; the application must never return a reset token to the browser.
 */
export async function requestPasswordReset(emailInput: string, req: Request) {
  const email = emailInput.trim().toLowerCase();
  const rate = await enforceLimit(req, "reset", email, 4);
  if (rate.limited) return { success: true as const, message: "If an admin account exists, reset instructions can be sent after POLINA's secure email service is configured." };
  // A provider-specific delivery adapter is enabled after the owner selects a mail service.
  // Do not mint or expose a reset token while no sender is configured.
  return { success: true as const, message: "If an admin account exists, reset instructions can be sent after POLINA's secure email service is configured." };
}

export function validatePasswordRules(password: string) {
  return password.length >= 12 && password.length <= 128;
}
