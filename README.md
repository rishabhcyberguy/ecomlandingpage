# POLINA Fashion

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm build:vercel`: build the app and stage CDN assets in Vercel's root `public/` directory; the SSR shell remains bundled with the root Express Function.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. Manus Preview and Manus publication resolve stable `/manus-storage/` assets at the platform edge. The Vercel-only Function instead redirects safe product keys to temporary signed HTTPS media URLs without persisting or caching them.

## Vercel Preview

The root `index.ts` exports the shared Express application for Vercel. Vercel serves Vite's hashed assets from its CDN, while the Function handles APIs, route-aware HTML, and stable managed-media redirects. Preview deployments are marked `noindex`; a 3 MiB upload cap keeps base64 image requests below Vercel Functions' 4.5 MB request limit.

To enable full Preview database, admin, and media behavior, configure the existing backend values in the Vercel project's **Preview** environment through protected settings: `DATABASE_URL`, `MANUS_JWT_SECRET`, `MANUS_API_URL`, and `MANUS_API_KEY`. Do not commit them or add them to this README. Vercel and Manus share the same project database/storage, so Preview writes affect the same data. Transfer these credentials only with the account owner's explicit authorization. Set `PUBLIC_APP_ORIGIN` for a production custom domain; Vercel's production deployment URL is used as a fallback.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Open and run in VS Code

Open the project root (the folder containing `package.json`) in VS Code. Use Node.js 22.12 or newer (or 20.19 or newer) and Corepack's pinned package manager:

```powershell
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
```

Accept the recommended Tailwind CSS and Prettier extensions when prompted. The Run and Debug view includes **POLINA: Debug server**; the Command Palette's **Tasks: Run Task** menu includes **POLINA: Start development server**, **POLINA: Type check**, **POLINA: Run tests**, and **POLINA: Production build**. The same commands are available from a terminal as `pnpm dev`, `pnpm check`, `pnpm test`, and `pnpm build`.

The server uses Manus-managed MySQL, authentication, and object storage. Those runtime values are intentionally not stored in this repository. A local copy can edit and build in VS Code, but full admin, database, and media behavior requires the authorized Manus Preview environment or separately provisioned Vercel runtime settings. Local `.env` files are ignored; never commit secrets. Database migration and admin-provisioning commands can change the shared database and should only be run in an authorized environment.
