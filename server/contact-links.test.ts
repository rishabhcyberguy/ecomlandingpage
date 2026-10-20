import { describe, expect, it } from "vitest";
import { normalizeContactHref } from "../shared/contact-link";

describe("normalizeContactHref", () => {
  it("normalizes public HTTPS links and rejects unsafe or credentialed URLs", () => {
    expect(normalizeContactHref(" https://Example.com/contact ")).toBe("https://example.com/contact");
    expect(normalizeContactHref("http://example.com/contact")).toBeNull();
    expect(normalizeContactHref("https://user:pass@example.com")).toBeNull();
    expect(normalizeContactHref("javascript:alert(1)")).toBeNull();
  });

  it("accepts a real email address and preserves optional mailto query fields", () => {
    expect(normalizeContactHref("mailto:hello@polina.example")).toBe("mailto:hello@polina.example");
    expect(normalizeContactHref("MAILTO:hello@polina.example?subject=POLINA")).toBe("mailto:hello@polina.example?subject=POLINA");
  });

  it("rejects empty and malformed mailto destinations", () => {
    expect(normalizeContactHref("mailto:")).toBeNull();
    expect(normalizeContactHref("mailto:@example.com")).toBeNull();
    expect(normalizeContactHref("mailto:hello@" )).toBeNull();
    expect(normalizeContactHref("mailto:hello@example.com,other@example.com")).toBeNull();
  });

  it("accepts real telephone numbers while rejecting empty, short, and overlong values", () => {
    expect(normalizeContactHref("tel:+1 (212) 555-0198")).toBe("tel:+1 (212) 555-0198");
    expect(normalizeContactHref("tel:5550198")).toBe("tel:5550198");
    expect(normalizeContactHref("tel:")).toBeNull();
    expect(normalizeContactHref("tel:12345")).toBeNull();
    expect(normalizeContactHref("tel:+1234567890123456")).toBeNull();
  });

  it("rejects control characters and oversized values", () => {
    expect(normalizeContactHref("https://example.com/\ncontact")).toBeNull();
    expect(normalizeContactHref(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
  });
});
