# Al Ryum Group — Website Clone (vivid-test)

Offline-renderable clone of the Al Ryum Group corporate site (Abu Dhabi).
Scroll-scrub hero (WebP frame sequence), React SPA, Lenis + GSAP/ScrollTrigger.

## Quick Start

```bash
python3 /tmp/serve_alryum_pkg.py 8765   # SPA-aware server
# open http://127.0.0.1:8765/
```

## Effect scripts

Loaded by `index.html` after the React bundle mounts:

| Script | Purpose |
|---|---|
| `assets/index-v10-scrub.js` | hero scrub (WebP frame sequence over the hero canvas) |
| `assets/index-v10-projectscrub.js` | per-project scrub effects |
| `assets/al-ryum-motion.js` | applied motion: word reveals, card rises, 3D tilts, marquee |
| `assets/al-ryum-cinematic.js` | 3 pinned scroll-scrubbed cinematic project films (Louvre / Zayed / Emirates) |
| `assets/al-ryum-meamap.js` | interactive MENA map (D3, self-healing retry) |
| `assets/vivid-amplify.js` | nav liquid-glass + hero push-zoom + scroll-depth + cinematic bottom-blur |
| `assets/corniche-legoland.js` | Corniche → Legoland first/last-shot transition (dormant until frames drop in) |

## Corniche → Legoland transition

Drop WebP frames (extracted via https://ezgif.com/video-to-webp from a Google Flow
Veo 3.1 first/last-shot transition) into `assets/frames/corniche-legoland/` as
`frame_0001.webp ... frame_00NN.webp`. A pinned scroll-scrubbed film appears
automatically before the Projects section. Start/end frames are in `flow-frames/`.

## Git LFS

`assets/hero-garden.mp4` and `assets/hero-garden-full.mp4` are Git LFS.
