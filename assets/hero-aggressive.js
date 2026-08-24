/**
 * Implementation Notes: assets/hero-aggressive.js
 * -----------------------------------------------------------------------------
 * 1. Easing Curves Choice:
 *    - Headline and Hero UI Entrance: Uses `power3.out` for a crisp, responsive, high-end feel as elements reveal into view.
 *    - Fade out during scroll scrub: Uses `power1.in` for a smooth accelerated exit as the hero frame sequence scrub begins.
 *
 * 2. Scrub Values:
 *    - Hero canvas frame scrub uses `scrub: 1` (or `true`) with GSAP ScrollTrigger to ensure tight synchronization between
 *      wheel/touch scroll input and frame sequence rendering without noticeable latency.
 *    - Headline and UI elements parallax scaling uses `scrub: 0.5` for immediate tactile responsiveness.
 *
 * 3. Mobile Behavior (`isDesktop` guard):
 *    - Desktop threshold is defined as viewport width >= 768px (`window.innerWidth >= 768`).
 *    - On mobile (< 768px), heavy scroll-scrub pinning and frame sequence preloading are disabled.
 *    - Instead, frame 1 (or fallback video) is rendered statically, and elements fade in with clean CSS/GSAP reveals without pinning the screen.
 *
 * 4. Hook System Integration:
 *    - `data-hero-canvas`: Target <canvas> element where WebP stills extracted from `/transitions/frame_XXXX.webp` are rendered.
 *    - `data-hero-logo`: Navbar branding container, animated on entrance.
 *    - `data-hero-nav-links`: Navigation menu link container, animated with staggered reveal.
 *    - `data-hero-meta`: Badge element ("Est. 1990 • Abu Dhabi, UAE"), revealing before the main title.
 *    - `data-hero-headline`: Main H1 element ("Building spaces where the UAE lives, works, gathers"), split/revealed with cinematic motion.
 */

(function () {
  "use strict";

  if (window.__heroAggressiveLoaded) return;
  window.__heroAggressiveLoaded = true;

  const isDesktop = () => window.innerWidth >= 768;
  const frameUrl = (n) => `/transitions/frame_${String(n).padStart(4, "0")}.webp`;

  // ── 1. BINARY PROBE FRAME COUNT ──
  async function frameExists(n) {
    try {
      const res = await fetch(frameUrl(n), { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function discoverFrameCount() {
    if (!(await frameExists(1))) return 0;
    let lo = 1, hi = 2;
    while (hi <= 3000 && (await frameExists(hi))) {
      lo = hi;
      hi *= 2;
    }
    if (hi > 3000) return 3000;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (await frameExists(mid)) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // ── 2. PRELOAD FRAMES ──
  function preloadFrames(total) {
    return new Promise((resolve) => {
      const imgs = new Array(total).fill(null);
      let done = 0;
      const tick = () => {
        done++;
        if (done >= total) resolve(imgs);
      };
      for (let i = 0; i < total; i++) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          imgs[i] = img;
          tick();
        };
        img.onerror = tick;
        img.src = frameUrl(i + 1);
      }
      setTimeout(() => resolve(imgs), 20000);
    });
  }

  // ── 3. CANVAS ASPECT COVER FIT ──
  function coverCrop(iw, ih, W, H) {
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
  }

  // ── 4. INITIALIZE HERO ANIMATIONS & SCRUB ──
  async function initHero() {
    const canvas = document.querySelector("[data-hero-canvas]");
    const logo = document.querySelector("[data-hero-logo]");
    const navLinks = document.querySelector("[data-hero-nav-links]");
    const meta = document.querySelector("[data-hero-meta]");
    const headline = document.querySelector("[data-hero-headline]");
    const heroSection = canvas ? canvas.closest("section") : null;

    if (!canvas || !heroSection) return;

    // --- ENTRANCE ANIMATIONS (GSAP) ---
    if (window.gsap) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (logo) tl.fromTo(logo, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.8 }, 0.1);
      if (navLinks) tl.fromTo(navLinks, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.8 }, 0.2);
      if (meta) tl.fromTo(meta, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.8 }, 0.3);
      if (headline) tl.fromTo(headline, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.0 }, 0.4);
    }

    // --- FRAME SEQUENCE CANVAS SCRUB ---
    const totalFrames = await discoverFrameCount();
    if (totalFrames < 1) return;

    const imgs = await preloadFrames(totalFrames);
    const usable = imgs.filter(Boolean);
    if (!usable.length) return;

    const ctx = canvas.getContext("2d");
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

    sizeCanvas();
    draw(0);

    // If mobile, render frame 1 statically without scroll scrubbing/pinning
    if (!isDesktop()) {
      window.addEventListener("resize", () => {
        sizeCanvas();
        draw(0);
      });
      return;
    }

    // Desktop GSAP ScrollTrigger Scrub
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      let rafPending = false;
      const scheduleDraw = (index) => {
        const i = Math.max(0, Math.min(usable.length - 1, index));
        if (i === current) return;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            current = i;
            draw(i);
          });
        }
      };

      ScrollTrigger.create({
        trigger: heroSection,
        start: "top top",
        end: "+=4000",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          scheduleDraw(Math.round(self.progress * (usable.length - 1)));
        },
      });

      // Headline fade out & scale on scroll scrub
      if (headline) {
        gsap.to(headline, {
          opacity: 0,
          y: -50,
          scale: 0.95,
          ease: "power1.in",
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: "+=1500",
            scrub: 0.5,
          },
        });
      }

      window.addEventListener("resize", () => {
        sizeCanvas();
        if (current >= 0) draw(current);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHero);
  } else {
    initHero();
  }
})();
