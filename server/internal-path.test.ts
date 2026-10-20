import { describe, expect, it } from "vitest";
import { normalizeInternalPath, safeInternalPath } from "@shared/internal-path";

describe("homepage internal path validation", () => {
  it("keeps a same-origin route, query, and fragment", () => {
    expect(normalizeInternalPath(" /collections?sort=recent#featured ")).toBe("/collections?sort=recent#featured");
  });

  it.each([
    "https://example.com/",
    "//example.com/",
    "/\\\\example.com/",
    "/../admin",
    "javascript:alert(1)",
    "/contact\nLocation:https://example.com",
  ])("rejects unsafe target %j", (value) => {
    expect(normalizeInternalPath(value)).toBeNull();
    expect(safeInternalPath(value)).toBe("/collections");
  });
});
