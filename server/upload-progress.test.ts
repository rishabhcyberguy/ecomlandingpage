import { afterEach, describe, expect, it, vi } from "vitest";
import { trackUploadProgress, uploadProgressFetch } from "../client/src/lib/upload-progress";

afterEach(() => vi.unstubAllGlobals());

describe("image upload progress transport", () => {
  it("reports determinate request bytes and preserves CSRF and cookie credentials", async () => {
    let progressListener: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | undefined;
    let loadHandler: (() => void) | null = null;
    const sentHeaders: Array<[string, string]> = [];
    const xhr = {
      upload: { addEventListener: (_type: string, listener: typeof progressListener) => { progressListener = listener; } },
      withCredentials: false,
      status: 200,
      statusText: "OK",
      responseText: '{"result":{"data":{"json":{"ok":true}}}}',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      ontimeout: null as (() => void) | null,
      onabort: null as (() => void) | null,
      open: vi.fn(),
      setRequestHeader: (name: string, value: string) => sentHeaders.push([name, value]),
      getAllResponseHeaders: () => "content-type: application/json\r\n",
      send: vi.fn(() => {
        progressListener?.({ loaded: 50, total: 100, lengthComputable: true });
        loadHandler?.();
      }),
    };
    Object.defineProperty(xhr, "onload", { get: () => loadHandler, set: (handler: (() => void) | null) => { loadHandler = handler; } });
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => xhr));
    const progress = vi.fn();
    const stopTracking = trackUploadProgress(progress);

    try {
      const response = await uploadProgressFetch("/api/trpc/admin.uploadProductImage", {
        method: "POST",
        headers: { "content-type": "application/json", "x-polina-csrf": "csrf-token" },
        body: '{"json":{"productId":1,"base64":"abc"}}',
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ result: { data: { json: { ok: true } } } });
      expect(progress).toHaveBeenCalledWith({ loaded: 50, total: 100 });
      expect(xhr.withCredentials).toBe(true);
      expect(sentHeaders).toContainEqual(["x-polina-csrf", "csrf-token"]);
    } finally {
      stopTracking();
    }
  });
});
