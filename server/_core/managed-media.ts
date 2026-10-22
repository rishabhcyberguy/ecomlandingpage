import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

const PRODUCT_MEDIA_KEY = /^polina\/products\/[1-9]\d*\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/i;

export function normalizeProductMediaKey(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || !PRODUCT_MEDIA_KEY.test(value)) return null;
  return value;
}

export function registerVercelManagedMediaRedirect(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const params = req.params as Record<string, string | undefined>;
    const key = normalizeProductMediaKey(params["0"]);
    if (!key) {
      return res.status(404).set("Cache-Control", "private, no-store").end();
    }

    try {
      const signedUrl = new URL(await storageGetSignedUrl(key));
      if (signedUrl.protocol !== "https:" || signedUrl.username || signedUrl.password) {
        return res.status(502).set("Cache-Control", "no-store").end();
      }
      return res
        .set("Cache-Control", "private, no-store")
        .redirect(307, signedUrl.toString());
    } catch {
      // Do not log the provider URL, signed address, or authorization details.
      return res.status(502).set("Cache-Control", "no-store").end();
    }
  });
}
