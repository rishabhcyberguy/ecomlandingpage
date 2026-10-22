# POLINA on Vercel: runtime and storage notes

## Verified platform behavior

Vercel's current Express guide supports a default-exported Express application from a root `index.ts` entry. The Express application becomes one Vercel Function. Vercel serves static assets from the deployment's root `public/` directory through its CDN; `express.static()` does not serve those assets there. A function can include additional files using `includeFiles` in `vercel.json`.

Vercel Functions currently impose a 4.5 MB maximum request-body and response-body size. A 3 MiB image becomes about 4 MiB when encoded as base64, leaving room for the surrounding JSON and tRPC envelope. POLINA therefore enforces a 3 MiB image limit and uses an Express parser ceiling of 4.3 MB for the Vercel runtime. The regular local/Manus listener remains a separate entrypoint.

## POLINA-specific serving behavior

The Manus platform owns the stable `/manus-storage/<key>` route in Manus Preview and Manus deployments. A Vercel deployment does not inherit that gateway route. The Vercel Express app must therefore accept only POLINA product-media keys, request a short-lived HTTPS download URL from Manus storage, and issue a non-cacheable redirect while retaining the stable URL in product data. Never persist or publish the temporary signed URL.

Vite's hashed assets are copied to Vercel's root `public/` output after the normal build. The built HTML shell remains in the Function bundle for route-aware server rendering; the generated mutable platform configuration script is served by the app and excluded from the static CDN copy. Preview responses are marked `noindex`, Preview robots rules disallow crawling, and production canonical metadata uses `PUBLIC_APP_ORIGIN` or the Vercel production deployment origin.

POLINA continues to use the existing Manus-managed MySQL, admin sessions, and object storage to avoid a schema/data migration. Any Vercel Preview that receives those runtime settings will use the same project database as Manus development/production, so test writes are real shared data changes. The runtime credentials must be entered through Vercel's protected environment-variable controls only after the user explicitly authorizes that transfer. Never place credential values in source, this document, Git, or chat. The private Vercel account is authorized, but a POLINA Vercel project and its Preview environment are not yet configured.

## Official sources

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express) — Express exports, single-function behavior, static assets, and `express.static()` limitation. Consulted 2026-10-22.
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) — request/response payload ceiling, memory/duration, regions, and function bundle limits. Consulted 2026-10-22.
- [Advanced Function configuration](https://vercel.com/docs/functions/configuring-functions/advanced-configuration) — `vercel.json` function configuration and bundling. Consulted 2026-10-22.
