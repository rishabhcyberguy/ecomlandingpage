# POLINA Fashion Website — Implementation Plan

## Product and scope

Build the public POLINA fashion storefront and its protected content-admin application from the supplied PRD. Use the provided [Serotoninn design reference](https://minimal.gallery/serotoninn/) as a close visual guide, while keeping POLINA's own identity and original/user-authorized content. Keep the initial release to the public home, collection/category browsing, product details, safe Amazon/Flipkart outbound actions, and secure admin workflow. Do not reproduce the reference store's cart, favorites, customer accounts, or checkout. Search and advanced filtering remain optional. Until POLINA provides final products, copy, imagery, retailer destinations, and contact details, mark sample content clearly and do not present made-up retailer or social accounts as real.

## Design direction

**Design movement:** Stark editorial fashion art direction with neo-brutalist edge, closely matching the reference's bright split-tone portrait hero and torn vertical seam, oversized condensed type, minimal edge navigation, monochrome fields, vivid red emphasis, horizontal product imagery, and full-width campaign/editorial blocks.

**Core principles:** Bold but uncluttered; let photography and typography carry the brand; use sharp contrast and crisp edges instead of decorative UI; keep motion brief, intentional, accessible, and removable.

**Color philosophy:** Begin with the reference's black, white, and bright scarlet editorial contrast. Treat scarlet as a provisional POLINA accent until the brand supplies its final palette; retain accessible neutral surfaces and text/control contrast.

**Layout paradigm:** A viewport-led editorial composition rather than a conventional centered shop template: edge navigation, oversized split hero, horizontal product rail, campaign story blocks, compact category index, then a simple footer. Product listing/detail layouts remain responsive and easy to scan.

**Signature elements:** Split portrait/torn seam in the hero; condensed all-caps display type with dramatic scale shifts; red campaign/category callouts against monochrome images and page fields.

**Interaction philosophy and animation:** Tactile but restrained, with motion visible without requiring hover. Keep the supplied pointer-reactive Liquid Text effect on the hero headline and add one short, visible displacement sweep on entry when motion is allowed; do not run a perpetual idle render loop. Use one-time in-view reveals for public editorial blocks, a clipped-image reveal for the campaign panel, and short menu/product transitions. Keep content visible if JavaScript or `IntersectionObserver` is unavailable; retain semantic/selectable HTML text and static fallbacks. Preserve keyboard/touch use, visible focus, contrast, no layout shift, and useful hit targets. Honor `prefers-reduced-motion`; avoid pointer effects on touch. No cart/favorites.

**Typography:** Barlow Condensed for the wordmark, section numbers, and oversized headlines; DM Sans for product/body/navigation/forms; DM Mono for editorial labels and metadata. Fonts remain replaceable if POLINA supplies licensed brand fonts.

**Brand essence and voice:** Women's nightwear and clothing presented as expressive, contemporary fashion; confident, editorial, tactile. Keep launch copy marked as sample until approved. Example voice: “Made for your own kind of night.” “Find your own rhythm.”

**Wordmark/logo:** A distinctive spaced POLINA typographic wordmark in the site; use a provisional geometric P monogram with a scarlet terminal accent for favicon and project metadata. Do not use the Serotoninn name/logo. Replace the provisional mark when the POLINA logo is supplied.

**Signature brand color:** Provisional vivid scarlet inspired by the reference, pending POLINA's final brand color.

## Implementation approach

Build on the initialized `web-db-user` stack: React 19, TypeScript, Tailwind, Wouter, Express, tRPC, Drizzle, managed MySQL, and Manus durable object storage. React owns responsive pages and interaction; Express/tRPC and server-side Drizzle own public/admin reads, authentication, authorization, validation, and mutations. Public visitor routes receive server-rendered page content and per-route SEO metadata. React pages are lazy-loaded; Three.js is imported only for the homepage Liquid Text effect when motion preferences allow, so other routes do not pay its bundle cost. Keep server-only credentials private. A Vercel release was explicitly requested, but the connected account currently exposes no team or project and the app relies on Manus-managed MySQL and object storage. Before a safe Vercel release, verify a compatible Express/function entry and static-asset routing plus protected runtime settings; never copy hidden Manus credentials or publish a static-only build that breaks admin behavior. Keep Manus production publication disabled.

Use managed MySQL as the durable store for products, categories, page content, admin identity, sessions, reset-token state, and edit metadata. Keep schema changes as deterministic additive Drizzle migrations in `drizzle/`; the POLINA migration is applied without inserting sample product rows. Public queries filter to active published records, and unpublished products are excluded from both lists and direct slug lookups. Store an ordered page-level list of featured product IDs for the homepage, with existing product-level featured flags as the fallback when the page list is empty. Prevent category archive/slug changes while published products still use the category slug. Check the authenticated admin for every mutation and upload-authorization step. Validate normalized unique slugs, required fields, HTTPS retailer domains, and image type/size. Do not add price unless POLINA supplies and maintains it.

Follow the PRD's email/password admin model with no public registration. Use strong password hashes, opaque server-managed HttpOnly sessions, CSRF protection for every cookie-authenticated mutation including logout, sign-in/reset rate limits, a neutral reset response, hashed one-time reset tokens with expiry, and secure logout/reset session behavior. Preview HTTPS sessions use `SameSite=None; Secure` without deriving security from the server's internal request scheme. Provision the first admin through a private operator script, not a public endpoint or default password. **Password-reset delivery requires a transactional email provider, which is not yet connected.** Keep the neutral request flow and token consumption, but production reset email is pending provider and any required protected app-secret configuration.

Use platform durable storage for server-validated product image uploads, persisting stable `/manus-storage/<key>` paths and alt text. Do not put product uploads in Git or use browser-local storage as the production database or media store.

## Routes and project structure

- `client/src/pages/`: public Home, Collection, Category, Product, Contact, and not-found pages; protected admin login, dashboard, product editor/preview, page editor, and password-reset pages. Route modules load on demand.
- `client/src/components/`: POLINA header/footer, split hero, campaign/editorial blocks, product cards/rail, category index, Liquid Text, Contact flip button, and accessible form/state components.
- `client/src/lib/`: replaceable provisional site content, client helpers, and the progress-enabled XHR transport used only for image-upload bytes; it keeps the existing tRPC CSRF header and session cookies. `client/src/App.tsx` registers routes and gates the UI, but server authorization remains authoritative.
- `client/public/manus-routes.json`: complete static public/admin page route manifest, synchronized with route declarations; exclude APIs/assets and 404-only pages.
- `client/public/polina-mark.svg` and `client/index.html`: provisional favicon, fonts, initial metadata and app shell; root `app.config.ts` stores the actual durable HTTPS project-logo URL required before checkpointing.
- `server/routers.ts` and `server/polina-db.ts`: public published-only reads, protected admin CRUD, dashboard counts/warnings, ordered homepage featured-product selection, preview, publish/unpublish/archive, and persistence.
- `server/_core/`: email/password auth/session/reset/context and server-rendered SEO/page responses including route metadata, robots, and sitemap. `server/storage.ts` uses managed storage for media.
- `shared/retailer.ts`, `shared/contact-link.ts`, `shared/internal-path.ts`, and `shared/seo.ts`: strict Amazon/Flipkart URL validation, shared HTTPS/email/phone destination validation, normalized same-origin CTA path validation, and shared metadata normalization. `drizzle/schema.ts`, `drizzle/*.sql`, `drizzle/meta/`: schema and additive database migrations.
- `scripts/provision-admin.ts` and `docs/admin-operations.md`: private first-admin setup and operator instructions for migration, reset, media backup, and recovery.
- `docs/visual-motion-research.md`: source URLs and verified motion/deployment findings used to guide the final visual pass.

Public routes: `/`, `/collections`, `/category/:slug`, `/products/:slug`, `/contact`. Admin routes: `/admin/login`, `/admin/reset`, `/admin/reset-password`, `/admin`, `/admin/products/new`, `/admin/products/:id`, `/admin/products/:id/preview`, `/admin/pages`. Admin/draft routes are private/noindex, and draft previews require server authorization. The `/manus-routes.json` declaration is separate from server routing.

## Liquid Text integration

Use the supplied [Vengeance UI Liquid Text component](https://www.vengenceui.com/components/liquid-text) as the source/inspiration for a fluid displacement effect on the POLINA hero headline. Adapt its Three.js texture/shader/pointer behavior to Vite/React, not Next.js-only directives or a `cn` helper. Import Three.js on demand, only when the homepage is active and reduced motion is not requested. Limit the effect to one headline; run a single brief sweep on entry so the effect is visible without pointer movement, then remain event-driven. Retain semantic/selectable text, a static fallback for reduced motion or unavailable WebGL, capped render resolution, off-screen suspension, resize handling, and GPU/event cleanup. Product browsing and server-rendered public content must not depend on the effect.

## Contact details

Adapt the user's supplied animated flip-button source to the Contact section; reuse it in the footer only when genuine links are published. Always show the seven front letters spelling “CONTACT” in the Contact section; reveal matching icons with a short label for configured real links on hover/focus, retaining keyboard and touch usability. Additional published links use `+` tiles rather than being silently dropped. With no official links, show a non-link setup state rather than hiding the component or inventing destinations. Validate HTTPS URLs, nonempty email addresses, and plausible phone numbers consistently in the admin, public button, and server-rendered Contact page. The provided code's GitHub, Twitter, LinkedIn, Instagram, Facebook, Email, and Discord destinations use `#` placeholders; never publish them as POLINA accounts. Display only contact methods/URLs the user actually supplies. Framer Motion and React Icons are already available in the project.

## Motion visibility pass

Give public hero and editorial content short, one-time reveal transitions, including a clipped reveal for the campaign visual; retain existing product/button hover feedback. Use viewport observation to avoid off-screen work. If reduced motion is requested or observation is unavailable, show content without motion. Respect touch input and do not add decorative loops that continue rendering while idle.

## Content, imagery, and launch configuration

Use explicit replaceable sample labels until final POLINA copy, products, retailer URLs, categories, palette/logo/fonts, and contact details arrive. Never use scraped reference-site product photography as POLINA catalog content. The homepage is wired to a separate original campaign image at `client/public/images/polina-hero.jpg`; its image-generation request remains pending, and an intentional CSS editorial fallback stays visible if no asset is available. Replace the visual with POLINA-owned/authorized photography when supplied. Give public routes meaningful server-rendered titles, descriptions, canonicals and social metadata; keep admin/draft pages noindex. Robots and sitemap output depend on the final public origin/domain configuration.

The managed server and database are enabled on port 3000 with health route `/api/health`. Keep this architecture and use Preview for implementation review. Do not publish a production version or invent a launch domain unless explicitly requested. Before launch, confirm final domain/indexing, approved catalog/contact/brand assets, retailer tracking/affiliate disclosure, reset-email provider, recovery contact, backup policy, and first-admin provisioning. Local storage is not suitable for production administration or publishing.
