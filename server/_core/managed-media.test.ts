import { describe, expect, it } from "vitest";
import { normalizeProductMediaKey } from "./managed-media";

describe("normalizeProductMediaKey", () => {
  it("accepts generated POLINA product image keys", () => {
    expect(normalizeProductMediaKey("polina/products/42/1730000000000_a1b2c3d4.webp"))
      .toBe("polina/products/42/1730000000000_a1b2c3d4.webp");
    expect(normalizeProductMediaKey("polina/products/9/1730000000000_1234abcd.jpg"))
      .toBe("polina/products/9/1730000000000_1234abcd.jpg");
  });

  it.each([
    "",
    "/polina/products/42/1730000000000_a1b2c3d4.webp",
    "polina/products/0/1730000000000_a1b2c3d4.webp",
    "polina/products/42/../private.txt",
    "polina/products/42/%2e%2e/secret.webp",
    "polina/other/42/image.webp",
    "https://example.com/image.webp",
    "polina/products/42/image.svg",
  ])("rejects unsafe or unsupported key %s", (key) => {
    expect(normalizeProductMediaKey(key)).toBeNull();
  });
});
