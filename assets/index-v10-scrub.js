// ══════════════════════════════════════════════════════════════
// HERO SCROLL-SCRUB FRAME SEQUENCE  (drone descent → landing)
// Replaces the hero background video with a scroll-controlled
// WebP frame sequence drawn on a <canvas>.
// Frames: /transitions/frame_0001.webp … frame_00NN.webp
// NN is detected automatically at runtime (no hardcoded count).
// Falls back to the original hero video if no frames exist.
// ══════════════════════════════════════════════════════════════
(() => {
  "use strict";
  if (window.__heroScrubLoaded) return;
  window.__heroScrubLoaded = true;

  const frameUrl = (n) => `/transitions/frame_${String(n).padStart(4, "0")}.webp`;
  const heroSel = () => document.getElementById("hero-scrub-canvas");

  // ── 1. DISCOVER FRAME COUNT WITHOUT HARDCODING NN ──
  // Binary-probe /transitions/frame_0001.webp … until a 404.
  async function frameExists(n) {
    try { return (await fetch(frameUrl(n), { method: "HEAD" })).ok; }
    catch { return false; }
  }
  async function countFrames() {
    if (!(await frameExists(1))) return 0;      // no frames at all
    let lo = 1, hi = 2;
    while (hi <= 3000 && (await frameExists(hi))) { lo = hi; hi *= 2; }
    if (hi > 3000) return 3000;                  // safety cap
    while (lo < hi) {                            // lo exists, hi missing
      const mid = Math.ceil((lo + hi) / 2);
      if (await frameExists(mid)) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  // ── 2. PRELOAD ALL FRAMES INTO MEMORY ──
  function preloadFrames(total, onProgress) {
    return new Promise((resolve) => {
      const imgs = new Array(total).fill(null);
      let done = 0;
      const tick = () => {
        done++;
        onProgress(Math.round((done / total) * 100));
        if (done >= total) resolve(imgs);
      };
      for (let i = 0; i < total; i++) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => { imgs[i] = img; tick(); };
        img.onerror = tick;                       // missing frame → null slot
        img.src = frameUrl(i + 1);
      }
      setTimeout(resolve, 30000, imgs);           // never hang the loader
    });
  }

  // ── 3. DRAW CURRENT FRAME (cover-fit, rAF-throttled) ──
  function coverCrop(iw, ih, W, H) {
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
  }

  // ── 4. BIND SCROLL SCRUB ONCE FRAMES ARE READY ──
  function bindScroll(canvas, imgs) {
    const ctx = canvas.getContext("2d");
    const loader = document.getElementById("hero-scrub-loader");
    const loaderText = document.getElementById("hero-scrub-loader-text");
    const fallback = document.getElementById("hero-scrub-fallback");
    const hero = canvas.closest("section") || canvas.parentElement;
    const usable = imgs.filter(Boolean);
    if (!usable.length) return fallbackToVideo(canvas, loader, fallback);

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
    const setFrame = (index) => {
      const i = Math.max(0, Math.min(usable.length - 1, index));
      if (i !== current) { current = i; draw(i); }
    };

    if (!window.gsap || !window.ScrollTrigger) return fallbackToVideo(canvas, loader, fallback);
    gsap.registerPlugin(ScrollTrigger);
    let rafPending = false;
    const scheduleDraw = (index) => {
      const i = Math.max(0, Math.min(usable.length - 1, index));
      if (i === current) return;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => { rafPending = false; current = i; draw(i); });
      }
    };

    const scrub = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "+=6000",
      pin: true,
      scrub: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        scheduleDraw(Math.round(self.progress * (usable.length - 1)));
        // Fade the original hero video in once the drone has fully landed
        // (last ~15% of the pinned scroll), then back out on reverse.
        const land = self.progress > 0.85;
        if (fallback) {
          const shown = fallback.style.opacity === "1";
          if (land && !shown) {
            if (fallback.paused || fallback.readyState < 2) {
              const p = fallback.play();
              if (p && typeof p.catch === "function") p.catch(() => {});
            }
            fallback.style.transition = "opacity 0.6s ease";
            fallback.style.opacity = "1";
          } else if (!land && shown) {
            fallback.style.transition = "opacity 0.6s ease";
            fallback.style.opacity = "0";
          }
        }
      },
    });
    window.addEventListener("resize", () => { sizeCanvas(); if (current >= 0) draw(current); });

    // Reveal canvas once frames are preloaded
    canvas.style.display = "block";
    if (loader) loader.style.display = "none";
    if (fallback) fallback.style.display = "none";
    sizeCanvas();
    setFrame(0);
  }

  // ── 5. GRACEFUL DEGRADATION (no frames / no GSAP) ──
  function fallbackToVideo(canvas, loader, fallback) {
    canvas.style.display = "none";
    if (loader) loader.style.display = "none";
    if (fallback) {
      fallback.style.display = "block";
      fallback.style.opacity = "1";       // no frame sequence → show video immediately
      const p = fallback.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }

  // ── 6. BOOT ──
  async function boot() {
    const canvas = heroSel();
    if (!canvas) return;                          // hero not on this route
    const loader = document.getElementById("hero-scrub-loader");
    const loaderText = document.getElementById("hero-scrub-loader-text");
    const fallback = document.getElementById("hero-scrub-fallback");
    if (loader) loader.style.display = "flex";
    let total = 0;
    try { total = await countFrames(); } catch {}
    if (total < 1) return fallbackToVideo(canvas, loader, fallback);
    const imgs = await preloadFrames(total, (pct) => { if (loaderText) loaderText.textContent = `Loading ${pct}%`; });
    if (window.gsap && window.ScrollTrigger) bindScroll(canvas, imgs);
    else fallbackToVideo(canvas, loader, fallback);
  }

  // Script runs in <head>, before React mounts the hero — poll for it.
  let attempts = 0;
  const interval = setInterval(() => {
    if (heroSel()) { clearInterval(interval); boot(); }
    else if (++attempts > 100) clearInterval(interval); // ~20s cap
  }, 200);
})();
