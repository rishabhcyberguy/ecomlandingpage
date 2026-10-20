export type Retailer = "amazon" | "flipkart";

const AMAZON_DOMAINS = [
  "amazon.com",
  "amazon.in",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.es",
  "amazon.it",
  "amazon.ca",
  "amazon.com.au",
  "amazon.ae",
  "amazon.nl",
  "amazon.sg",
  "amazon.co.jp",
  "amazon.com.mx",
  "amazon.com.br",
] as const;

export function normalizeRetailerUrl(raw: string | null | undefined, retailer: Retailer): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    const hostname = url.hostname.toLowerCase();
    const allowed = retailer === "flipkart"
      ? hostname === "flipkart.com" || hostname.endsWith(".flipkart.com")
      : AMAZON_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}
