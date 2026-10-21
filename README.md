# POLINA Fashion

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Open and run in VS Code

Open the project root (the folder containing `package.json`) in VS Code. Use Node.js 22.12 or newer (or 20.19 or newer) and Corepack's pinned package manager:

```powershell
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
```

Accept the recommended Tailwind CSS and Prettier extensions when prompted. The Run and Debug view includes **POLINA: Debug server**; the Command Palette's **Tasks: Run Task** menu includes **POLINA: Start development server**, **POLINA: Type check**, **POLINA: Run tests**, and **POLINA: Production build**. The same commands are available from a terminal as `pnpm dev`, `pnpm check`, `pnpm test`, and `pnpm build`.

The server uses Manus-managed MySQL, authentication, and object storage. Those runtime values are intentionally not stored in this repository. A local copy can edit and build in VS Code, but full admin, database, and media behavior requires the authorized Manus Preview environment or separately provisioned runtime settings. Local `.env` files are ignored; never commit secrets. Database migration and admin-provisioning commands can change the shared database and should only be run in an authorized environment.
