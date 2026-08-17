# Al Ryum Group — Website Clone (v10 Enhanced)

Offline-renderable clone of `https://arc.cloudis.ai/` — the corporate site for
Al Ryum Group (Abu Dhabi). This is the **v10 enhanced** build with scroll-scrub
hero, GSAP ScrollTrigger, Lenis smooth scroll, and custom cursor/noise/transition
effects.

## Quick Start

```bash
python3 /tmp/serve_alryum_pkg.py 8765
# SPA-aware: serves index.html for any non-file route (React Router works)
open http://127.0.0.1:8765/
```

A plain `python3 -m http.server` returns 404 for client-side routes
(`/projects/5`, `/about`, ...). The SPA server falls back to `index.html` for
any extension-less path that has no matching file, so routing works.

**Asset paths are absolute (`/assets/...`).** If you host under a sub-path,
re-patch the JS or add `<base href="/subpath/">` to `index.html`.

## Build / Asset Layout

`index.html` loads:

1. `/assets/index-v10-safe-loader.js` — fetches `index-v10-timeline.js`,
   patches a `story.quote/author` null-safety bug, imports it via blob URL
2. `/assets/index-DKJEREcW.css`
3. Lenis (unpkg CDN) + GSAP + ScrollTrigger (cdnjs CDN)
4. `/assets/index-v10-scrub.js` — hero scroll-scrub frame sequence

**Cache-buster:** after editing `index-v10-timeline.js`, bump `?v=N` inside
`index-v10-safe-loader.js`.

## Hero

The hero is a scroll-scrubbed WebP frame sequence drawn on a `<canvas>`.
Frames live in `/transitions/frame_0001.webp … frame_0080.webp` (count is
auto-detected at runtime). Falls back to `/assets/hero-garden.mp4` (Git LFS)
if frames or GSAP are unavailable.

## Git LFS

`assets/hero-garden.mp4` is tracked via Git LFS (see `.gitattributes`).

## Project Photos

Per-project galleries live under `/assets/real/<Folder>/`. The project arrays
(`Wr` compact + `Vn` full) in `index-v10-timeline.js` reference these.
