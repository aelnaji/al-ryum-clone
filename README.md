# Al Ryum Group — Website Clone (v10 Enhanced)

Offline-renderable clone of the Al Ryum Group corporate site (Abu Dhabi).
Scroll-scrub hero (WebP frame sequence), React SPA, Lenis + GSAP/ScrollTrigger.

## Quick Start
```bash
python3 /tmp/serve_alryum_pkg.py 8765   # SPA-aware server
# open http://127.0.0.1:8765/
```

## Build
`index.html` loads `index-v10-safe-loader.js` -> `index-v10-timeline.js` + CSS
+ Lenis/GSAP + `index-v10-scrub.js` (hero scroll-scrub).

**Cache-buster:** after editing `index-v10-timeline.js`, bump `?v=N` in
`index-v10-safe-loader.js`.

## Git LFS
`assets/hero-garden.mp4` and `assets/hero-garden-full.mp4` are Git LFS.
