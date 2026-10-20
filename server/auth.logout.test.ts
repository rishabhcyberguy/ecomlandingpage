import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { ADMIN_SESSION_COOKIE, CSRF_COOKIE, sha256 } from "./_core/polina-auth";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(headerToken: string = "csrf-test-token"): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const csrfToken = "csrf-test-token";
  const admin = { id: 1, email: "admin@example.test", name: "Admin" } as NonNullable<TrpcContext["admin"]>;
  const user = {
    id: 1,
    openId: "polina-email-admin-1",
    email: admin.email,
    name: admin.name,
    loginMethod: "email_password",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as AuthenticatedUser;
  const ctx: TrpcContext = {
    user,
    admin,
    adminSession: { admin, sessionId: 1, tokenHash: "unused-in-test", csrfHash: sha256(csrfToken) },
    req: {
      protocol: "https",
      headers: { cookie: `${CSRF_COOKIE}=${csrfToken}` },
      header: (name: string) => name.toLowerCase() === "x-polina-csrf" ? headerToken : undefined,
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears both secure session cookies after CSRF verification", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(2);
    const adminSession = clearedCookies.find(cookie => cookie.name === ADMIN_SESSION_COOKIE);
    const csrf = clearedCookies.find(cookie => cookie.name === CSRF_COOKIE);
    expect(adminSession?.options).toMatchObject({ secure: true, sameSite: "none", httpOnly: true, path: "/" });
    expect(csrf?.options).toMatchObject({ secure: true, sameSite: "none", httpOnly: false, path: "/" });
  });

  it("rejects logout when the CSRF header does not match its cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext("cross-site-token");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.logout()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(clearedCookies).toHaveLength(0);
  });
});
