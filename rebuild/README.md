# Al Ryum clean scroll rebuild

Stage 01 is a reviewable opening experience, not a replacement for the complete website. This checkpoint is saved on the user-approved `rebuild/clean-scroll-stage-1` branch. The original application and `main` remain untouched; pushing this branch does not publish an interactive preview or replace the live site.

## Scope and separation

- Fresh Next.js 16 and TypeScript source.
- Fresh package-managed Three.js and GSAP dependencies, recorded in `package-lock.json`.
- No imports, copying or runtime injection of the repository's legacy engines, CSS, compiled React bundle or loaders.
- One canvas, one scene controller, one scroll timeline. Normal browser scrolling remains in control; no new smooth-scroll engine.
- A newly traced, extruded treatment of the supplied brand mark. It is real mesh geometry with materials and lighting, not a video or a transformed image plane. The trace is a study, not the original vector master.
- Original business copy in `src/content/opening.ts`. Only the opening and introduction have been migrated.
- Existing logo bitmap retained for the header and existing Manrope font reused as content assets.
- Explicit review notices for navigation destinations not yet migrated. These are not finished pages.

## Local development

```sh
cd rebuild
npm ci
npm run dev
```

The app is at the root route. No database or server-side API is needed for this stage.

## Verification and export

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:preview
```

`next build` produces the static `out/` directory. `test:preview` starts and stops its own local static server, checks desktop/mobile behavior and writes screenshots and results to `test-results/`.

To test an already deployed static preview:

```sh
PREVIEW_URL=https://your-preview.example npm run test:preview
```

No credentials, telemetry SDK or outbound forms are embedded in the preview.

## Structure

```text
src/app/                       Root route, layout, styles
src/content/opening.ts         Verbatim migrated business copy
src/components/                React-owned page structure and choreography
src/lib/create-scene.ts        Renderer lifecycle, lighting and scroll state
src/lib/logo-model.ts          Newly authored extruded brand geometry
public/media/                  Small, self-hosted brand/font assets
audit/                         Original inventory, hashes and route snapshots
tools/                         Reproducible audit and preview checks
```

The source audit requires the original repository to be served at port 3100. It intercepts route documents for SPA fallback and blocks heavy video/frame requests during content snapshots; it is not a loading-performance benchmark. The seven route snapshots are representative route-template checks, not complete verification of every project, interaction or data claim.

## Review checkpoints

- Stage 01: approve or revise the opening's scale, pacing, material treatment and typography.
- Stage 02: migrate the remaining content and routes into clean components; reconcile conflicting content only with approval.
- Stage 03: validate all routes, interactions and media loading; complete accessibility, device and performance testing; review the diff before merging into `main` or making a live cutover.

The optional fullstack starter script was blocked before execution. This project was instead scaffolded directly with standard package-managed dependencies; no external installer script was executed.
