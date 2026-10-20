# Visual Motion and Deployment Reference Notes

These notes support the POLINA motion pass and deployment review. Reference sites are design inspiration only; do not copy their branding, product photography, copy, or destinations.

## Motion sources

- [Serotoninn entry on Minimal Gallery](https://minimal.gallery/serotoninn/) — the gallery’s desktop capture supports the approved direction: a split portrait-led hero, oversized condensed wordmark, high-contrast neutral field, scarlet campaign callout, minimal navigation, and full-width editorial commerce content. [Live Serotoninn site](https://serotoninn.com/) was also opened; this browser capture exposed its campaign/category content but rendered a blank top viewport, so it did not provide reliable additional animation evidence.
- [Vengeance UI — Liquid Text](https://www.vengenceui.com/components/liquid-text) — the component page lists a preview, installation, usage, and props; its dynamic example did not load in text extraction. POLINA already contains a React/Three.js canvas-text shader with pointer displacement, reduced-motion/static fallback, viewport suspension, and cleanup. The code audit found that displacement is pointer-triggered rather than animated on entry, which makes the effect easy to miss.
- [Motion for React accessibility](https://motion.dev/docs/react-accessibility) — the official guide recommends respecting the operating-system reduced-motion preference, replacing large transform/parallax movement with gentler opacity changes where appropriate, and using `useReducedMotion` for bespoke behavior.
- [Let’s Build UI — Animated Social Share Links](https://www.letsbuildui.dev/articles/animated-social-share-links/) — a social-link pattern uses a user-triggered expansion and a restrained stagger. POLINA’s supplied design instead uses per-letter 3D flips; preserve that character, but do not use the sample `#` destinations as real links.

## Deployment source

- [Vercel — Express on Vercel](https://vercel.com/docs/frameworks/backend/express) — Express can run as one Vercel Function; default-exporting the Express app is supported. Static assets must be in `public/**`; `express.static()` is ignored by Vercel’s static asset serving. POLINA currently starts Express from `server/_core/index.ts` and calls a custom static server helper, so deployment needs a Vercel-compatible entry/static-routing review rather than relying on framework autodetection alone.
- [Vercel — Node.js Functions runtime](https://vercel.com/docs/functions/runtimes/node-js) — Vercel provides Node.js Functions for JavaScript/TypeScript handlers; keep routes consolidated where appropriate and validate function/runtime constraints before transferring the full-stack backend.
