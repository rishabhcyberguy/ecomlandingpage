const EMAIL_ADDRESS = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Return a safe, normalized contact destination or null when it is not a real channel. */
export function normalizeContactHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || href.length > 2048 || CONTROL_CHARACTERS.test(href)) return null;

  const schemeMatch = /^([a-z][a-z\d+.-]*):/i.exec(href);
  if (!schemeMatch) return null;
  const scheme = schemeMatch[1].toLowerCase();
  const remainder = href.slice(schemeMatch[0].length);

  if (scheme === "mailto") {
    const address = remainder.split("?")[0];
    if (!address || address.includes(",") || address.length > 254 || !EMAIL_ADDRESS.test(address)) return null;
    const separator = address.lastIndexOf("@");
    if (separator > 64 || separator < 1 || separator === address.length - 1) return null;
    return `mailto:${remainder}`;
  }

  if (scheme === "tel") {
    const number = remainder.split(/[?#;]/)[0];
    const digits = number.replace(/[\s().-]/g, "");
    if (!/^\+?\d{7,15}$/.test(digits)) return null;
    return `tel:${remainder}`;
  }

  if (scheme !== "https") return null;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
