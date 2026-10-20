import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { uploadProgressFetch } from "@/lib/upload-progress";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
    mutations: { retry: 0 },
  },
});

function readCsrfCookie() {
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("polina_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("polina_csrf=".length)) : "";
}

function csrfHeaders() {
  const token = readCsrfCookie();
  return token ? { "x-polina-csrf": token } : {};
}

const trpcClient = trpc.createClient({
  links: [splitLink({
    condition: (operation) => operation.path === "admin.uploadProductImage",
    true: httpLink({
      url: "/api/trpc",
      transformer: superjson,
      headers: csrfHeaders,
      fetch: uploadProgressFetch,
    }),
    false: httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers: csrfHeaders,
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
      },
    }),
  })],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
