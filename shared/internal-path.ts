const INTERNAL_BASE = "https://polina.invalid";

/** Return a normalized same-origin path, or null when the value is not a safe internal URL. */
export function normalizeInternalPath(value: string): string | null {
  const target = value.trim();
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("..") || target.includes("\\") || /[\u0000-\u001f\u007f]/.test(target)) return null;
  try {
    const url = new URL(target, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE || url.username || url.password) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function safeInternalPath(value: string, fallback = "/collections") {
  return normalizeInternalPath(value) ?? fallback;
}
