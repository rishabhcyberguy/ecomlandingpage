# POLINA operator notes

## First administrator

There is no public registration or default admin credential. After the managed database schema is migrated in the intended environment, an authorized operator should run `pnpm admin:provision` from a private interactive terminal with the project server/database environment available. The command prompts for the administrator email and optional display name; password entry is hidden. It validates a 12–128 character password, stores only a scrypt hash, and refuses a duplicate account. Do not paste the password into a shell command, chat, source file, or Git commit. Sign in at `/admin/login` after the command reports that provisioning succeeded.

## Database schema

Review the generated Drizzle migration before applying it. Apply the migration once to the intended POLINA project database with `pnpm db:migrate`; do not seed test or sample product records into the shared managed database. Product and page content is persistent, and the development, testing, and production environments share this database.

## Password recovery

Password reset is deliberately neutral and rate-limited, but it does not mint or display tokens while no mail sender is configured. The recovery screen states this limitation without revealing whether an email is registered. Before launch, choose a transactional email provider, configure a verified sender and secrets through the protected project-secret flow, implement the provider-specific delivery adapter, and confirm expiry/single-use behavior without exposing tokens in logs. Until then, recover an account through the authorized server/operator process rather than the reset form.

## Product images and backups

Uploads accept JPEG, PNG, or WebP up to 5 MB, check file signatures and require descriptive alt text. Images are stored in durable project storage and referenced from the database. Back up the managed database and the associated stored media on a schedule appropriate to the launch; test a restore procedure before relying on production publishing. Never store uploaded media or admin credentials in Git.

## Launch choices still needed

Provide approved catalog items and imagery, final copy/palette/wordmark, real contact destinations, retailer URLs and any affiliate disclosure, a verified public domain and `PUBLIC_APP_ORIGIN` for canonical/social URLs, recovery email service, and an owner-controlled admin provisioning/recovery contact. Sample content is a design scaffold, not launch-ready brand data.
