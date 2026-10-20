export type UploadProgress = { loaded: number; total: number };
export type UploadProgressHandler = (progress: UploadProgress) => void;

type ActiveUpload = { token: symbol; handler: UploadProgressHandler };
let activeUpload: ActiveUpload | undefined;

export function trackUploadProgress(handler: UploadProgressHandler) {
  const active: ActiveUpload = { token: Symbol("polina-upload"), handler };
  activeUpload = active;
  return () => {
    if (activeUpload?.token === active.token) activeUpload = undefined;
  };
}

function reportUploadProgress(progress: UploadProgress) {
  if (!activeUpload || !Number.isFinite(progress.loaded) || !Number.isFinite(progress.total)) return;
  activeUpload.handler(progress);
}

/**
 * `httpLink` fetch implementation used only for the product-image upload procedure.
 * XMLHttpRequest exposes request-body byte progress while retaining same-origin cookies.
 */
export const uploadProgressFetch: typeof fetch = (input, init) => {
  if (typeof XMLHttpRequest === "undefined") return globalThis.fetch(input, init);

  const request = input instanceof Request ? input : undefined;
  const url = request?.url ?? (input instanceof URL ? input.href : String(input));
  const method = init?.method ?? request?.method ?? "GET";
  const body = init?.body ?? null;
  const headers = new Headers(request?.headers);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  const signal = init?.signal ?? request?.signal;

  const supportedBody = body === null
    || typeof body === "string"
    || (typeof Blob !== "undefined" && body instanceof Blob)
    || (typeof FormData !== "undefined" && body instanceof FormData)
    || (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body);
  if (!supportedBody || (!init?.body && request)) return globalThis.fetch(input, init);
  if (signal?.aborted) return Promise.reject(new DOMException("The request was aborted.", "AbortError"));

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => xhr.abort();

    xhr.open(method, url, true);
    xhr.withCredentials = true;
    headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.addEventListener("progress", (event) => {
      reportUploadProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 });
    });
    xhr.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const responseHeaders = new Headers();
      for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
        const colon = line.indexOf(":");
        if (colon > 0) responseHeaders.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
      }
      resolve(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers: responseHeaders }));
    };
    xhr.onerror = () => fail(new TypeError("Network request failed."));
    xhr.ontimeout = () => fail(new TypeError("Network request timed out."));
    xhr.onabort = () => fail(new DOMException("The request was aborted.", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(body as XMLHttpRequestBodyInit | null);
  });
};
