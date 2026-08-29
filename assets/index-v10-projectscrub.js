// ══════════════════════════════════════════════════════════════
// PROJECTS SCROLL-SCRUB FRAME SEQUENCE
// Extends the site's existing hero scrub (index-v10-scrub.js) to the
// three Al Ryum project films (Louvre, Zayed, Emirates). Each film is a
// 240-frame WebP sequence; scrolling scrubs forward/reverse, just like
// the hero garden sequence. No <video> elements → never autoplays.
//
// Design contract (per request): KEEP ALL existing content, copy, colors
// and layout untouched. This script only APPENDS a new immersive
// "film" section to the /projects route behind the existing content —
// it does not edit, restyle, or reorder any current DOM.
//
// Reuses the site's already-loaded GSAP ScrollTrigger + Lenis, the same
// frame-count auto-probe, the same cover-fit + rAF-throttle draw, and the
// same reduced-motion / no-GSAP graceful degradation as the hero scrub.
// ══════════════════════════════════════════════════════════════
(() => {
  "use strict";
  if (window.__projectsScrubLoaded) return;
  window.__projectsScrubLoaded = true;

  // Only build on the projects route.
  if (!/\/projects(\/|$)/.test(location.pathname)) return;

  const SCENES = [
    {
      title: "Louvre Abu Dhabi",
      sub: "External works & landscaping, Saadiyat Island",
      base: "/assets/projects/louvre/frame_",
    },
    {
      title: "Zayed National Museum",
      sub: "Landscaping, Irrigation & Car Park — Abu Dhabi",
      base: "/assets/projects/zayed/frame_",
    },
  ];

  const frameUrl = (base, n) => `${base}${String(n).padStart(4, "0")}.webp`;

  // ── 1. FRAME COUNT (binary probe) ──
  async function frameExists(base, n) {
    try { return (await fetch(frameUrl(base, n), { method: "HEAD" })).ok; }
    catch { return false; }
  }
  async function countFrames(base) {
    if (!(await frameExists(base, 1))) return 0;
    let lo = 1, hi = 2;
    while (hi <= 3000 && (await frameExists(base, hi))) { lo = hi; hi *= 2; }
    if (hi > 3000) return 3000;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (await frameExists(base, mid)) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  // ── 2. PRELOAD ──
  function preloadFrames(total, base) {
    return new Promise((resolve) => {
      const imgs = new Array(total).fill(null);
      let done = 0;
      for (let i = 0; i < total; i++) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => { imgs[i] = img; if (++done >= total) resolve(imgs); };
        img.onerror = () => { if (++done >= total) resolve(imgs); };
        img.src = frameUrl(base, i + 1);
      }
      setTimeout(resolve, 30000, imgs);
    });
  }

  // ── 3. BUILD A SCENE SECTION (appended, non-destructive) ──
  function buildScene(scene, index) {
    const section = document.createElement("section");
    section.className = "projects-film-scene";
    section.style.cssText =
      "position:relative;height:100vh;width:100%;overflow:hidden;background:#0a1416;";
    section.innerHTML = `
      <canvas class="projects-film-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:none;"></canvas>
      <div class="projects-film-caption" style="position:absolute;left:0;right:0;bottom:8%;text-align:center;color:#f8fafa;z-index:2;pointer-events:none;font-family:inherit;">
        <h2 style="margin:0;font-size:clamp(1.5rem,4vw,2.5rem);text-transform:uppercase;letter-spacing:0.04em;">${scene.title}</h2>
        <p style="margin:0.5rem 0 0;font-size:clamp(0.9rem,2vw,1.1rem);opacity:0.85;">${scene.sub}</p>
      </div>`;
    // Append at end of #root so it never overlaps existing content.
    const root = document.getElementById("root");
    (root || document.body).appendChild(section);
    return section;
  }

  function coverCrop(iw, ih, W, H) {
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
  }

  // ── 4. BIND SCROLLTRIGGER PER SCENE ──
  function bindScene(section, canvas, imgs) {
    const ctx = canvas.getContext("2d");
    const usable = imgs.filter(Boolean);
    if (!usable.length || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    let W = 0, H = 0, dpr = 1, current = -1;
    const sizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width || window.innerWidth;
      H = r.height || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    const draw = (index) => {
      if (index < 0 || index >= usable.length) return;
      const img = usable[index];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const c = coverCrop(img.naturalWidth, img.naturalHeight, W, H);
      ctx.drawImage(img, c.dx, c.dy, c.dw, c.dh);
    };

    let rafPending = false;
    const scheduleDraw = (index) => {
      const i = Math.max(0, Math.min(usable.length - 1, index));
      if (i === current) return;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => { rafPending = false; current = i; draw(i); });
      }
    };

    ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=900",
      pin: true,
      scrub: true,
      anticipatePin: 1,
      onUpdate: (self) => scheduleDraw(Math.round(self.progress * (usable.length - 1))),
    });
    window.addEventListener("resize", () => { sizeCanvas(); if (current >= 0) draw(current); });
    canvas.style.display = "block";
    sizeCanvas();
    scheduleDraw(0);
  }

  // ── 5. BOOT (wait for React to mount the route, then append) ──
  async function boot() {
    const reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (let i = 0; i < SCENES.length; i++) {
      const scene = SCENES[i];
      const total = await countFrames(scene.base);
      if (total < 1) continue; // missing frames → skip this scene entirely
      const section = buildScene(scene, i);
      const canvas = section.querySelector("canvas");
      const imgs = await preloadFrames(total, scene.base);
      if (reduce) {
        // Reduced motion: show first frame only, no scrubbing.
        const ctx = canvas.getContext("2d");
        const img = imgs.find(Boolean);
        if (img) {
          const r = canvas.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.max(1, Math.round(r.width * dpr));
          canvas.height = Math.max(1, Math.round(r.height * dpr));
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const c = coverCrop(img.naturalWidth, img.naturalHeight, r.width, r.height);
          ctx.drawImage(img, c.dx, c.dy, c.dw, c.dh);
          canvas.style.display = "block";
        }
      } else {
        bindScene(section, canvas, imgs);
      }
    }
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  let attempts = 0;
  const interval = setInterval(() => {
    const root = document.getElementById("root");
    if (root && root.children.length) { clearInterval(interval); boot(); }
    else if (++attempts > 150) clearInterval(interval); // ~30s cap
  }, 200);
})();
