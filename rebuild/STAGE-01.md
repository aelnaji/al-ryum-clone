# Al Ryum rebuild: Stage 01

This stage establishes an independent, working opening experience and a migration baseline. At the user's request, this checkpoint is saved to the separate `rebuild/clean-scroll-stage-1` branch on GitHub. It does not replace the complete website, change `main`, or alter the live site.

## What was built

- **Clean application:** a separate Next.js 16 / TypeScript source tree in `rebuild/`, using fresh package-managed Three.js and GSAP. No legacy application or animation engine is imported.
- **Actual 3D:** four extruded, bevelled meshes traced from the existing ARC mark, with physical materials and studio lighting. Scroll controls rotation, separation and reassembly; pointer motion adds a small tilt. This is a brand study, not a reconstructed building or a claim to possess the original vector logo.
- **Three chapters:** the opening statement, innovation statement, and company introduction. The existing business sentences are retained; the original logo bitmap remains in the header.
- **Clear stage boundary:** services, projects and contact navigation show an explicit preview notice. They are not represented as finished pages.
- **Accessible alternatives:** normal scrolling, a skip link, keyboard-accessible controls, an Escape-dismissable dialog, a motion toggle, OS reduced-motion support, server-rendered copy, and a static brand fallback if WebGL is unavailable.
- **Controlled runtime:** one WebGL canvas and one scroll timeline. Geometry renders on updates instead of running an independent perpetual animation loop.

The structural inspiration is the persistent scene and coordinated scroll choreography observed on [Ciao Energy](https://www.ciaoenergy.com/). Its code, models, textures, copy and audio were not copied.

## Repository baseline and findings

The baseline is commit `7af5f16` of [aelnaji/al-ryum-clone](https://github.com/aelnaji/al-ryum-clone). The audit inventories and hashes 915 original files, roughly 934 MB on disk, and captures seven representative route templates; this is not a claim that every project detail or every business statement has been independently verified.

- **Deployment output rather than maintainable application source:** the original root contains compiled assets and two HTML entry points, without a package manifest or the original component source. A clean source tree avoids rebuilding on a patched minified bundle.
- **Mixed runtime modules:** the primary entry loads both standard and “astra” scripts, and its loader patches JavaScript text before importing a Blob URL.
- **Duplicate DOM identifier:** the rendered homepage contains two `global-reach` IDs. This can make anchor and DOM queries ambiguous.
- **Large media:** `hero-garden-full.mp4` is 435,950,374 bytes and is referenced by an autoplay, preload-auto video in the compiled app. `hero-mist.mp4` is 39,807,195 bytes. Some Emirates frames exceed 1.3 MB each. These are file sizes, not measured network transfers.
- **Bundled Three.js nuance:** `three.module.js` and `three.core.js` are not automatically redundant; a module build can legitimately need both. A separate legacy minified build and bundled copies need dependency-graph review before deletion. The earlier blanket suggestion to delete “duplicate Three.js” files should not be followed without that check.
- **Content needs approval, not silent editing:** the hero says “over 35 years” while the introduction says “over 30 years”; regional copy refers to four regions while another section presents five locations. The introduction also includes “development and infrastructure financing.” These strings are retained for now and should be reconciled with the content owner.
- **Route coverage limitation:** the sampled `/projects/1` visit returned portfolio-like content. The intended project-detail routing needs a dedicated Stage 02 check; this audit does not certify all detail pages.

These observations come from the [repository baseline](https://github.com/aelnaji/al-ryum-clone) and local rendering of that checkout. Complete asset hashes, module-reference summaries and route snapshots are retained under `rebuild/audit/`.

## Content preservation

All original files remain untouched. A regression test compares their hashes against the baseline, and migrated business paragraphs are checked against the original compiled text.

Only the opening has been migrated. Photography, video, project data, services, history, contact details and remaining pages have not been deleted or rewritten; they remain in the original application pending the next stage.

## Verification

The verification suite covers a real WebGL canvas and mesh draw calls, absence of legacy asset requests, paragraph parity, desktop copy bounds, forward/reverse scrolling, chapter navigation, dialog behavior, motion toggling, reduced-motion preference, mobile overflow and menu interaction, unavailable WebGL, readable no-JavaScript copy, runtime errors, duplicate IDs and unchanged original-file hashes.

Automated checks are accompanied by desktop and mobile screenshots. These are Chromium checks, including software WebGL in the test environment, not a substitute for Safari/iOS testing or proof of production frame rate on physical phones.

## Next checkpoints

- **Review this opening:** confirm whether the brand-object approach, depth, scale and pacing are the right direction. The lighting and traced geometry remain adjustable.
- **Migrate the full site:** preserve all content and routes in clean components; resolve approved editorial issues; carry a consistent scene system into services and projects rather than layering more engines.
- **Prepare the cutover:** validate links, forms, filters, details, media budgets, Safari/iOS and accessibility, then review the diff and deployment plan before merging into `main` or making a live replacement.

Stage 01 deliberately stops here. No prediction is made about Computer credit usage.
