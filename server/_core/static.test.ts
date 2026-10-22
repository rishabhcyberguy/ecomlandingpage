import { describe, expect, it } from "vitest";
import { shouldServeSpaShell } from "./static";

describe("shouldServeSpaShell", () => {
  it("serves the app document for client routes and ignores query strings", () => {
    expect(shouldServeSpaShell("GET", "/")).toBe(true);
    expect(shouldServeSpaShell("GET", "/admin/login?next=%2Fadmin")).toBe(true);
    expect(shouldServeSpaShell("GET", "/category/nightwear")).toBe(true);
    expect(shouldServeSpaShell("HEAD", "/products/satin-nightdress")).toBe(true);
  });

  it("does not mask unknown API or managed-media paths", () => {
    expect(shouldServeSpaShell("GET", "/api/not-a-route")).toBe(false);
    expect(shouldServeSpaShell("GET", "/api")).toBe(false);
    expect(shouldServeSpaShell("GET", "/manus-storage/invalid-key")).toBe(false);
  });

  it("does not mask missing static or system files", () => {
    expect(shouldServeSpaShell("GET", "/assets/not-found.js")).toBe(false);
    expect(shouldServeSpaShell("GET", "/images/not-found.webp")).toBe(false);
    expect(shouldServeSpaShell("GET", "/robots.txt")).toBe(false);
    expect(shouldServeSpaShell("GET", "/sitemap.xml")).toBe(false);
    expect(shouldServeSpaShell("GET", "/__system__/missing")).toBe(false);
    expect(shouldServeSpaShell("GET", "/favicon.ico")).toBe(false);
  });

  it("does not send the HTML shell for non-read methods", () => {
    expect(shouldServeSpaShell("POST", "/contact")).toBe(false);
  });
});
