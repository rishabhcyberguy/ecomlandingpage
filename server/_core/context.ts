import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User, AdminAccount } from "../../drizzle/schema";
import { authenticateAdminRequest, type AdminSession } from "./polina-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  admin: AdminAccount | null;
  adminSession: AdminSession | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  try {
    const identity = await authenticateAdminRequest(opts.req);
    return {
      req: opts.req,
      res: opts.res,
      user: identity?.user ?? null,
      admin: identity?.admin ?? null,
      adminSession: identity?.session ?? null,
    };
  } catch (error) {
    console.error("[Auth] Session lookup failed:", error instanceof Error ? error.message : "unknown error");
    return { req: opts.req, res: opts.res, user: null, admin: null, adminSession: null };
  }
}
