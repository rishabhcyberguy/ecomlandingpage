import express, { type ErrorRequestHandler } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { publicPlatformScript } from "./publicConfig";
import { registerSeoDocuments } from "./seo";
import { serveStatic } from "./static";
import { createContext } from "./context";
import { registerVercelManagedMediaRedirect } from "./managed-media";

const app = express();
const isVercel = process.env.VERCEL === "1";

app.disable("x-powered-by");
if (isVercel) {
  // Trust the Vercel edge proxy so rate limits and client-IP checks use the original request.
  app.set("trust proxy", 1);
}

const bodyLimit = isVercel ? "4.3mb" : "50mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

if (isVercel && process.env.VERCEL_ENV !== "production") {
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
}

// Manus owns this stable route in its own Preview/published gateway. Vercel needs an
// application route because its CDN does not implement Manus's /manus-storage namespace.
if (isVercel) registerVercelManagedMediaRedirect(app);

registerSeoDocuments(app);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/platform/config.js", (_req, res) => {
  res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

if (process.env.NODE_ENV !== "development" || isVercel) {
  serveStatic(app);
}

const requestErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const rawStatus = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 500;
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  if (status >= 500) console.error("[POLINA] Unhandled request failure.");
  const message = status === 413
    ? "Request body is too large."
    : status === 400
      ? "Invalid request body."
      : "Internal server error.";
  return res.status(status).json({ error: message });
};
app.use(requestErrorHandler);

export { app };
export default app;
