/* ═══════ AL RYUM · @astra ═══════
   Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE — to disconnect:
   remove this file and revert the <script src> in index.html to the original.
   DO NOT hand-edit alongside the original; treat as a drop-in replacement. */

// Hero WebP scrub: finite pinned region, reversible progress, static fallback.
(() => {
  "use strict";
  if (window.__heroScrubLoaded) return;
  window.__heroScrubLoaded = true;

  const MAX_FRAMES = 3000;
  const SCRUB_DISTANCE = 1400;
  const frameUrl = (n) =>
    `/transitions/frame_${String(n).padStart(4, "0")}.webp`;
  const heroSel = () => document.getElementById("hero-scrub-canvas");
  const motionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  let active = null;
  let pollTimer = 0;
  let attempts = 0;

  function createSession(canvas) {
    const cleanups = [];
    const controller = new AbortController();
    const session = {
      canvas,
      signal: controller.signal,
      disposed: false,
      add(cleanup) {
        cleanups.push(cleanup);
      },
      listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        session.add(() => target.removeEventListener(type, handler, options));
      },
      dispose() {
        if (session.disposed) return;
        session.disposed = true;
        controller.abort();
        for (let i = cleanups.length - 1; i >= 0; i--) {
          try { cleanups[i](); } catch {}
        }
        cleanups.length = 0;
      },
    };
    return session;
  }

  function saveStyles(session, element, properties) {
    if (!element) return;
    const saved = properties.map((name) => [
      name,
      element.style.getPropertyValue(name),
      element.style.getPropertyPriority(name),
    ]);
    session.add(() => {
      saved.forEach(([name, value, priority]) => {
        if (value) element.style.setProperty(name, value, priority);
        else element.style.removeProperty(name);
      });
    });
  }

  // HEAD probes are bounded and support hosts that reject HEAD.
  async function frameExists(n, signal) {
    if (signal.aborted) return false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 4000);

    try {
      let response = await fetch(frameUrl(n), {
        method: "HEAD",
        signal: controller.signal,
      });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(frameUrl(n), {
          signal: controller.signal,
          headers: { Range: "bytes=0-0" },
        });
      }
      const exists = response.ok;
      if (response.body) {
        try { await response.body.cancel(); } catch {}
      }
      return exists;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  }

  async function countFrames(signal) {
    if (!(await frameExists(1, signal))) return 0;

    let lo = 1;
    let hi = 2;
    while (!signal.aborted) {
      hi = Math.min(hi, MAX_FRAMES);
      if (!(await frameExists(hi, signal))) break;
      lo = hi;
      if (lo === MAX_FRAMES) return lo;
      hi *= 2;
    }

    hi -= 1;
    while (lo < hi && !signal.aborted) {
      const mid = Math.ceil((lo + hi) / 2);
      if (await frameExists(mid, signal)) lo = mid;
      else hi = mid - 1;
    }
    return signal.aborted ? 0 : lo;
  }

  // Limit network concurrency; settle handlers and timers on every exit.
  function preloadFrames(total, onProgress, signal) {
    return new Promise((resolve) => {
      const images = new Array(total).fill(null);
      const pending = new Set();
      let next = 0;
      let done = 0;
      let settled = false;
      let timeout;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", finish);
        pending.forEach((img) => {
          img.onload = img.onerror = null;
          img.removeAttribute("src");
        });
        pending.clear();
        resolve(images);
      };

      const pump = () => {
        if (settled) return;
        while (pending.size < 8 && next < total) {
          const index = next++;
          const img = new Image();
          img.decoding = "async";
          pending.add(img);

          const complete = (loaded) => {
            if (settled || !pending.delete(img)) return;
            img.onload = img.onerror = null;
            if (loaded && img.naturalWidth && img.naturalHeight) {
              images[index] = img;
            }
            done++;
            onProgress(Math.round((done / total) * 100));
            if (done === total) finish();
            else pump();
          };

          img.onload = () => complete(true);
          img.onerror = () => complete(false);
          img.src = frameUrl(index + 1);
        }
      };

      timeout = setTimeout(finish, 30000);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted || total < 1) finish();
      else pump();
    });
  }

  function freezeFallback(session, fallback) {
    if (!fallback || typeof fallback.pause !== "function") return;

    const hadAutoplay = fallback.hasAttribute("autoplay");
    const autoplayValue = fallback.getAttribute("autoplay");
    const oldAutoplay = fallback.autoplay;
    session.add(() => {
      fallback.pause();
      fallback.autoplay = oldAutoplay;
      if (hadAutoplay) fallback.setAttribute("autoplay", autoplayValue || "");
      else fallback.removeAttribute("autoplay");
    });

    fallback.autoplay = false;
    fallback.removeAttribute("autoplay");

    const pause = () => {
      try { fallback.pause(); } catch {}
    };
    const reset = () => {
      pause();
      try {
        if (fallback.readyState >= 1) fallback.currentTime = 0.001;
      } catch {}
    };

    session.listen(fallback, "play", pause);
    session.listen(fallback, "loadedmetadata", reset);
    session.listen(fallback, "loadeddata", pause);
    reset();
  }

  function fallbackToVideo(canvas, loader, fallback) {
    canvas.style.display = "none";
    if (loader) loader.style.display = "none";
    if (fallback) {
      fallback.style.display = "block";
      fallback.style.opacity = "1";
      try { fallback.pause(); } catch {}
      try {
        if (fallback.readyState >= 1) fallback.currentTime = 0.001;
      } catch {}
    }
  }

  function bindScroll(session, images, reduced, loader, fallback) {
    const { canvas } = session;
    const hero = canvas.closest("section") || canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const valid = [];

    images.forEach((img, index) => {
      if (img && img.naturalWidth && img.naturalHeight) valid.push(index);
    });

    if (
      !hero ||
      hero === document.body ||
      hero === document.documentElement ||
      !ctx ||
      !valid.length ||
      (!reduced && (!gsap || !ScrollTrigger))
    ) {
      fallbackToVideo(canvas, loader, fallback);
      return;
    }

    // Preserve sequence timing when individual frames fail.
    const nearest = new Array(images.length);
    let cursor = 0;
    for (let i = 0; i < nearest.length; i++) {
      while (
        cursor + 1 < valid.length &&
        Math.abs(valid[cursor + 1] - i) < Math.abs(valid[cursor] - i)
      ) cursor++;
      nearest[i] = valid[cursor];
    }

    saveStyles(session, hero, ["position", "isolation"]);
    saveStyles(session, canvas, ["pointer-events"]);
    if (getComputedStyle(hero).position === "static") {
      hero.style.position = "relative";
    }
    hero.style.isolation = "isolate";

    // Canvas and fallback are mutually exclusive, inside the hero's stack.
    canvas.style.pointerEvents = "none";
    canvas.style.display = "block";
    canvas.style.opacity = "1";
    if (loader) loader.style.display = "none";
    if (fallback) fallback.style.display = "none";

    const oldWidth = canvas.getAttribute("width");
    const oldHeight = canvas.getAttribute("height");
    session.add(() => {
      if (oldWidth === null) canvas.removeAttribute("width");
      else canvas.setAttribute("width", oldWidth);
      if (oldHeight === null) canvas.removeAttribute("height");
      else canvas.setAttribute("height", oldHeight);
    });

    let width = 0;
    let height = 0;
    let dpr = 1;
    let current = -1;
    let requested = 0;
    let raf = 0;
    let forceDraw = true;
    let trigger = null;

    const draw = () => {
      raf = 0;
      if (session.disposed || !canvas.isConnected) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(rect.width * nextDpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * nextDpr));

      if (
        width !== rect.width ||
        height !== rect.height ||
        dpr !== nextDpr ||
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight
      ) {
        width = rect.width;
        height = rect.height;
        dpr = nextDpr;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        forceDraw = true;
      }

      const index = nearest[requested];
      if (!forceDraw && current === index) return;
      const img = images[index];
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;

      try {
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
        current = index;
        forceDraw = false;
      } catch {
        if (trigger) {
          trigger.kill(true);
          trigger = null;
        }
        fallbackToVideo(canvas, loader, fallback);
      }
    };

    const scheduleDraw = (index, force = false) => {
      requested = Math.max(0, Math.min(images.length - 1, Math.round(index)));
      forceDraw = forceDraw || force;
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const update = (self) => {
      scheduleDraw(self.progress * (images.length - 1));
    };
    const resize = () => scheduleDraw(requested, true);

    session.add(() => {
      if (raf) cancelAnimationFrame(raf);
      if (trigger) trigger.kill(true);
      images.fill(null);
    });
    session.listen(window, "resize", resize, { passive: true });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      session.add(() => observer.disconnect());
    }

    if (!reduced && images.length > 1) {
      gsap.registerPlugin(ScrollTrigger);
      trigger = ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: `+=${SCRUB_DISTANCE}`,
        pin: hero,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: update,
        onRefresh: update,
        onLeave: () => scheduleDraw(images.length - 1),
        onLeaveBack: () => scheduleDraw(0),
      });
      trigger.refresh();
      update(trigger);
    } else {
      scheduleDraw(0);
    }
  }

  async function boot(session) {
    const { canvas, signal } = session;
    const loader = document.getElementById("hero-scrub-loader");
    const loaderText = document.getElementById("hero-scrub-loader-text");
    const fallback = document.getElementById("hero-scrub-fallback");
    const reduced = Boolean(motionQuery && motionQuery.matches);

    saveStyles(session, canvas, ["display", "opacity"]);
    saveStyles(session, loader, ["display"]);
    saveStyles(session, fallback, ["display", "opacity"]);

    if (loaderText) {
      const originalText = loaderText.textContent;
      session.add(() => { loaderText.textContent = originalText; });
    }
    freezeFallback(session, fallback);
    canvas.style.display = "none";
    if (loader) loader.style.display = "flex";
    if (loaderText) loaderText.textContent = "Loading 0%";

    try {
      if (!reduced && (!window.gsap || !window.ScrollTrigger)) {
        fallbackToVideo(canvas, loader, fallback);
        return;
      }

      // Reduced motion uses a single still and never pins or autoplays.
      const total = reduced ? 1 : await countFrames(signal);
      if (signal.aborted) return;
      if (total < 1) {
        fallbackToVideo(canvas, loader, fallback);
        return;
      }

      const images = await preloadFrames(total, (percent) => {
        if (!signal.aborted && loaderText) {
          loaderText.textContent = `Loading ${percent}%`;
        }
      }, signal);

      if (signal.aborted || !canvas.isConnected) return;
      bindScroll(session, images, reduced, loader, fallback);
    } catch {
      if (!signal.aborted) {
        session.dispose();
        if (active === session) active = null;
        fallbackToVideo(canvas, loader, fallback);
      }
    }
  }

  function mount(canvas) {
    if (active) active.dispose();
    const session = createSession(canvas);
    active = session;

    // React may replace or remove the hero without unloading the page.
    const observer = new MutationObserver(() => {
      if (canvas.isConnected && heroSel() === canvas) return;
      session.dispose();
      if (active === session) active = null;
      startPolling();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    session.add(() => observer.disconnect());

    void boot(session);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = 0;
  }

  function startPolling() {
    stopPolling();
    attempts = 0;
    const check = () => {
      const canvas = heroSel();
      if (canvas) {
        stopPolling();
        if (!active || active.canvas !== canvas) mount(canvas);
      } else if (++attempts > 100) {
        stopPolling();
      }
    };
    pollTimer = setInterval(check, 200);
    check();
  }

  function onMotionChange() {
    const canvas = heroSel();
    if (canvas) mount(canvas);
  }

  if (motionQuery) {
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", onMotionChange);
    } else {
      motionQuery.addListener(onMotionChange);
    }
  }

  window.addEventListener("pagehide", () => {
    stopPolling();
    if (active) active.dispose();
    active = null;
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) startPolling();
  });

  startPolling();
})();
