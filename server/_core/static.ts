import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { createPublicSeoMiddleware } from "./seo";

export function shouldServeSpaShell(method: string, originalUrl: string) {
  if (method !== "GET" && method !== "HEAD") return false;
  const pathname = originalUrl.split("?", 1)[0] || "/";
  return !(
    /^\/api(?:\/|$)/.test(pathname)
    || pathname === "/manus-storage"
    || pathname.startsWith("/manus-storage/")
    || pathname.startsWith("/__")
    || pathname === "/favicon.ico"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || pathname.split("/").pop()?.includes(".")
  );
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const indexPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}; build the client first.`);
  }

  app.use(createPublicSeoMiddleware(() => fs.promises.readFile(indexPath, "utf-8")));
  app.use(express.static(distPath));

  // Fall through to the SSR shell for client-side routes. Missing shells become a
  // generic server error through the shared handler rather than a false SPA 200.
  app.use("*", (req, res, next) => {
    if (!shouldServeSpaShell(req.method, req.originalUrl)) return next();
    res.sendFile(indexPath, (error) => {
      if (error) next(error);
    });
  });
}
