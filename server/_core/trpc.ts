import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { requestHasValidCsrf } from "./polina-auth";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(t.middleware(async ({ ctx, next, type }) => {
  if (!ctx.admin || !ctx.user || ctx.user.role !== "admin" || !ctx.adminSession) {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  if (type === "mutation" && !requestHasValidCsrf(ctx.req, ctx.adminSession.csrfHash)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your session verification expired. Refresh and try again." });
  }
  return next({ ctx: { ...ctx, user: ctx.user, admin: ctx.admin, adminSession: ctx.adminSession } });
}));
