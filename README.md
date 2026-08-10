# Al Ryum Group — Local Clone

Exact, offline-renderable mirror of `https://arc.cloudis.ai/` for asset replacement before sending to the dev team. No external network requests when served locally.

## Quick Start

```bash
cd /Users/admin/al-ryum-clone
python3 /tmp/spa_server.py   # SPA-aware: serves index.html for any non-file route
# open http://127.0.0.1:8765/
```

**Why a custom server, not `python3 -m http.server`?** The site is a React Router SPA. `/projects/5`, `/about`, `/services`, `/solutions/2` are all client-side routes — the built-in `http.server` returns 404 for them. The SPA server at `/tmp/spa_server.py` falls back to `index.html` for any path that has no extension and no matching file, so client-side routing works.

**Asset paths use absolute URLs (`/assets/...`).** When you're on `/projects/5`, a relative URL like `assets/real/foo.jpg` would resolve to `/projects/assets/real/foo.jpg` and 404. The JS bundle has been patched so all asset references start with `/`, so they always resolve from the clone root regardless of which SPA route you're on. **If the dev team moves a file under a different base path (e.g., `alryum.com/clone/assets/...`), they'll need to re-patch the JS or add `<base href="/clone/">` to `index.html`.**

## Site Routes

| Path | Page | Notes |
|---|---|---|
| `/` | Home | Hero video, services, regions, journey timeline, project gallery (8 featured), stats |
| `/about` | About Al Ryum | Mission/vision, core values, capabilities, operational objectives |
| `/services` | Services overview | 6 service categories (Construction, Real Estate, Technology, Export Finance, Procurement, Investment) |
| `/solutions/:id` | Service detail | Per-service capability page |
| `/projects` | All Projects | Filterable (Industry/Sector/Status), grouped by Sector |
| `/projects/:id` | Single project detail | The big one — see structure below |
| `/contact` | Contact form | Form + office locations |

### Project Detail Page (`/projects/:id`)

1. Hero banner — project photo + title + Industry/Sector/Status chips + Location/Year/Value chips
2. Project Overview — long-form description
3. Key Achievements — 4 quantified bullets (industry-templated)
4. Project Details card — Year, Location, Client, Contract Value, Industry, Sector, Status, Region, Standards (ISO 9001, ISO 14001, OHSAS 18001, LEED Aligned)
5. Project Gallery — interactive carousel with Feature / Detail / Wide view modes + thumbnail strip
6. Scope of Works — 6 deliverables
7. Al Ryum's Objectives — 4 commitments (On-Time, Quality, Environment, H&S)
8. Our Process — 5-phase timeline (Design → Mobilisation → Construction → Testing → Handover)
9. Testimonial quote
10. About Al Ryum Group recap (4 stat tiles: 35+ years, 5,000+ pros, 9 countries, 500+ projects)
11. Capabilities — 3 cards

## Directory Layout

```
/Users/admin/al-ryum-clone/
├── index.html                          # Vite/React entry shell
├── assets/
│   ├── index-C_Eh4YoK.js               # Bundled JS (URLs rewritten to local paths)
│   ├── index-DKJEREcW.css              # Bundled CSS (fonts imported from local fonts/)
│   ├── arc-logo.png                    # Al Ryum logo (1.1 MB, 768x657)
│   ├── hero-garden.mp4                 # Hero video loop (416 MB, autoplay muted)
│   ├── projects/                       # Supplied project photo sets used by the app
│   │   ├── Dubai_Hills_-_Golf_Grove/
│   │   ├── Damac_Hills_-_Akoya/
│   │   └── ...
│   ├── unsplash/                       # Generic non-project assets
│   └── fonts/                          # Manrope + Montserrat WOFF2 + CSS
│       ├── manrope.css
│       ├── montserrat.css
│       └── *.woff2
└── _meta/
    ├── manifest.json                   # All asset entries with original URLs
    └── projects.json                   # Project gallery: id → name → image mapping
```

## Total Size: 435 MB
- `hero-garden.mp4` — 416 MB (dominant)
- `unsplash/` — 17 MB (117 files)
- `arc-logo.png` — 1.1 MB
- `fonts/` — 272 KB
- Bundles + index.html — ~700 KB

## Asset Replacements Already Done

The following project gallery photos have been replaced with **real Al Ryum project photos** extracted from `Downloads/AL RYUM PROFILE _Full-[01]_compressed.pdf`. The deck is bundled as `_meta/pdf-source/` (114 images extracted, 83 page renders).

### Project Heroes (12 projects)

| ID | Project | File in Clone |
|---|---|---|---|
| 1 | Golf Grove & Club Villas | `assets/projects/Dubai_Hills_-_Golf_Grove/` |
| 2 | Dubai Production City | `assets/projects/Pearl_Jumeirah/` |
| 3 | Akoya by Damac | `assets/projects/Damac_Hills_-_Akoya/` |
| 4 | Ruwais Golf Course | `assets/projects/named/YAS LINKS GOLF COURSE - ABU DHABI(2).jpg` |
| 5 | Central Park – Ruwais City | `assets/projects/La_Mer_Water_Park/` |
| 6 | Louvre Abu Dhabi | `assets/projects/Louvre_Abu_Dhabi/` |
| 7 | Central Park – MASDAR | `assets/projects/Masdar_Central_Park/` |
| 8 | Dubai Parks and Resort | `assets/projects/Dubai_Parks_-_Legoland/` |
| 9 | Yas Island Public Realm | `assets/projects/named/WARNER BROS. - YAS ISLAND ABU DHABI(1).jpg` |
| 10 | Saadiyat Cultural District | `assets/projects/Yas_Saadiyat_Island_Streetscapes/` |
| 11 | Dubai Expo 2020 Legacy | `assets/projects/Dubai_Parks_-_Motiongate/` |
| 12 | Al Ain Zoo & Wildlife Landscaping | `assets/projects/named/AQQABA GOLF COURSE - JORDAN(1).jpg` |

### Service Cards (6/6 swapped)

The "What We Do" service cards on the home page now use real deck photos:

| Service | Source | File |
|---|---|---|
| Construction | PDF p21 rendered (fleet yard, Bobcats) | `assets/real/service-construction.jpg` |
| Real Estate Development | PDF p38 (Corniche Beach aerial) | `assets/real/service-real-estate.jpg` |
| Technology Solutions | PDF p64 (Louvre Museum) | `assets/real/service-technology.jpg` |
| Export Finance | PDF p40 (AD Int'l Shooting Club) | `assets/real/service-export-finance.jpg` |
| Procurement & Distribution | PDF p15 (Al Ryum Nursery) | `assets/real/service-procurement.jpg` |
| Investment & Venture Capital | PDF p28 (Marfa Hotel aerial) | `assets/real/service-investment.jpg` |

### Project Detail Galleries

Project detail galleries now use the supplied files under `assets/projects/`; the old project Unsplash and generated gallery references are no longer used by the active bundle.

`_meta/final-asset-manifest.json` documents every replacement.

The `_meta/final-mapping.json` and `_meta/swap-plan-final.json` files document every replacement and the original PDF source.

## How to Replace Assets

The clone uses **relative paths** throughout. To swap an asset:

1. Drop your new file at the same path with the same filename (recommended for in-place replacement).
2. OR edit `assets/index-C_Eh4YoK.js` to point at a different local path.
3. Restart the server (Python's `http.server` doesn't cache, but browsers do — hard-refresh with Cmd+Shift+R).

### Required replacements (placeholder → real project data)

The 12 projects in the gallery each have a current Unsplash placeholder. Replace these files:

| Project ID | Name | Location | Industry | Sector | Current Image File |
|---|---|---|---|---|---|
| 1 | Golf Grove & Club Villas Community Facilities | Dubai, UAE | Community | Residential | `assets/unsplash/photo-1735320865438-2dda05da6d04-w1080-q80.jpg` |
| 2 | Dubai Production City – Landscaping Works | Dubai, UAE | Landscaping | Commercial | `assets/unsplash/photo-1759702132757-3f6dc69e5189-w1080-q80.jpg` |
| 3 | Public Realm Landscaping at Akoya by Damac | Dubai, UAE | Landscaping | Residential | `assets/unsplash/photo-1666718770634-47506ed7b5ba-w1080-q80.jpg` |
| 4 | Ruwais Golf Course Club House & Access Road | Ruwais – Abu Dhabi, UAE | Sports & Leisure | Recreation | `assets/unsplash/photo-1722081290281-57a3152839b2-w1080-q80.jpg` |
| 5 | Central Park & Villas Community Facilities at Ruwais City | Ruwais – Abu Dhabi, UAE | Community | Residential | `assets/unsplash/photo-1702569111348-ed1c25197766-w1080-q80.jpg` |
| 6 | Louvre Abu Dhabi External Works | Saadiyat Island – Abu Dhabi, UAE | Cultural | Heritage | `assets/unsplash/photo-1708058929482-2c297c6f642a-w1080-q80.jpg` |
| 7 | Central Park – MASDAR | Masdar City – Abu Dhabi, UAE | Sustainable | Eco Development | `assets/unsplash/photo-1761662826910-3a2480223933-w1080-q80.jpg` |
| 8 | Dubai Parks and Resort | Dubai, UAE | Hospitality | Entertainment | `assets/unsplash/photo-1640765865471-0c5a8a5f96e2-w1080-q80.jpg` |
| 9 | Yas Island Public Realm Enhancement | Abu Dhabi, UAE | Hospitality | Entertainment | `assets/unsplash/photo-1582268611958-ebfd161ef9cf-w800.jpg` |
| 10 | Saadiyat Cultural District Streetscaping | Saadiyat Island – Abu Dhabi, UAE | Cultural | Heritage | `assets/unsplash/photo-1594563703937-fdc640497dcd-w800.jpg` |
| 11 | Dubai Expo 2020 Legacy Park | Dubai, UAE | Sustainable | Eco Development | `assets/unsplash/photo-1518531933037-91b2f5f229cc-w800.jpg` |
| 12 | Al Ain Zoo & Wildlife Landscaping | Al Ain, UAE | Sports & Leisure | Recreation | `assets/unsplash/photo-1575362682049-e7c267c1cd53-w800.jpg` ⚠️ MISSING |

**Recommended aspect ratio for project gallery images: 16:9, min width 1080px.** The current placeholders use width=1080 (full-width gallery) or width=800 (smaller cards); replace both sizes if available, otherwise the higher-resolution version is sufficient.

### Hero video
- `assets/hero-garden.mp4` — replace with your own loop. MP4 H.264, autoplay muted, ideally ≤30 MB, 1920×1080 max. The original is 416 MB; you can drop a smaller optimized version.

### Logo
- `assets/arc-logo.png` — replace if logo has changed. Keep PNG with transparency if possible.

## Other Sections (also use placeholder images)

The site has more placeholder images in these areas — see `_meta/manifest.json` for the full list:

- **What We Do** service cards (6 images, 1 per service)
- **Operating Across 9 Countries** — region/country hero images (4 images, one per region tab)
- **Our Journey** — timeline milestone image (1 image, currently set to "1989 — Established")
- **Partner / generic backgrounds** — ~80 images used in section backgrounds, decorative tiles, and hover states

For the regions/backgrounds, the original design uses images like "Buildings Focus", "Facility Specialists", "Nursery Operations" — generic landscaping/construction visuals. Replace these with your own real photos if you have them, or leave the Unsplash placeholders for v1.

## What Changed vs. Live Site

The clone is **byte-identical in structure** to live, but with these substitutions:

| Live URL | Local File |
|---|---|
| `https://cloudis.ai/wp-content/uploads/2026/03/arc-logo-...png` | `assets/arc-logo.png` |
| `https://cloudis.ai/wp-content/uploads/2026/03/garden-01_draft-02-color-graded.mp4` | `assets/hero-garden.mp4` |
| `https://images.unsplash.com/photo-XXX?...` (124 occurrences) | `assets/unsplash/photo-XXX-...jpg` |
| `https://fonts.googleapis.com/css2?family=Manrope...` | `assets/fonts/manrope.css` |
| `https://fonts.googleapis.com/css2?family=Montserrat...` | `assets/fonts/montserrat.css` |
| `https://fonts.gstatic.com/...woff2` (11 files) | `assets/fonts/*.woff2` |

**Zero external HTTP requests** when the page is served from this directory.

## What Did NOT Get Replaced

These remain in the JS bundle but don't affect offline rendering (they are identifiers, not fetches):

- `https://reactjs.org/docs/error-decoder.html?invariant=...` — React error decoder (only used if the app throws; never on healthy load)
- `http://www.w3.org/...` (xlink, svg, XML namespaces) — XML namespace identifiers
- `https://tailwindcss.com` — comment in the CSS license header

## Notes for the Dev Team

- The site is a **Vite/React SPA**. The `index.html` shell is intentionally minimal — the entire UI is rendered client-side from `assets/index-C_Eh4YoK.js`.
- Image filenames include the source width/quality as a suffix (e.g., `-w1080-q80.jpg`). When you commit replacements upstream, you can rename to your CDN's scheme — just update the corresponding references in `index-C_Eh4YoK.js` (search for `assets/unsplash/...`).
- The hero video path is referenced as `assets/hero-garden.mp4` in the JS — change that path if your CDN path differs.
- All Unsplash URLs have been **inlined** into the JS bundle (no JSON manifest at runtime). If the dev team prefers a config-driven approach, the asset references can be extracted into a JSON and `import`ed — but for a static asset swap, direct file replacement is simplest.

## Verification

After any change, hard-refresh the browser (Cmd+Shift+R) and:

1. Hero video plays muted on load
2. Logo visible top-left
3. "What We Do" cards all show images
4. Project gallery shows your replaced photos
5. Browser DevTools → Network tab shows **zero requests** to `cloudis.ai`, `unsplash.com`, `fonts.googleapis.com`, or `fonts.gstatic.com`
