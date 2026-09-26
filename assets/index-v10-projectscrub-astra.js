/* ═══════ AL RYUM · @astra ═══════
   Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE — to disconnect:
   remove this file and revert the <script src> in index.html to the original.
   DO NOT hand-edit alongside the original; treat as a drop-in replacement. */

// Project sequences now live in al-ryum-project-films.js.
// Keep this legacy entry point and its load guard; do not duplicate those films.
(() => {
  "use strict";

  if (window.__projectsScrubLoaded) return;
  window.__projectsScrubLoaded = true;

  const isProjectsRoute = () => /\/projects(\/|$)/.test(location.pathname);
  if (!isProjectsRoute()) return;

  const SCENES = [];
  if (!SCENES.length) return;

  const MAX_FRAMES = 3000;
  const LOAD_TIMEOUT = 30000;
  const controller = new AbortController();
  const { signal } = controller;
  const disposers = new Set();
  const sections = new Set();
  const motionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  let disposed = false;
  let bootStarted = false;
  let pollTimer = 0;
  let refreshRaf = 0;
  let observer = null;

  const frameUrl = (base, n) =>
    `${base}${String(n).padStart(4, "0")}.webp`;

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(pollTimer);
    cancelAnimationFrame(refreshRaf);
    controller.abort();
    observer?.disconnect();
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("popstate", checkLifecycle);

    for (const cleanup of disposers) {
      try {
        cleanup();
      } catch (error) {
        console.warn("[projects-scrub] Cleanup failed:", error);
      }
    }
    disposers.clear();
    for (const section of sections) section.remove();
    sections.clear();
    queueRefresh();
  }

  function queueRefresh() {
    if (refreshRaf) return;
    refreshRaf = requestAnimationFrame(() => {
      refreshRaf = 0;
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  function checkLifecycle() {
    if (
      !isProjectsRoute() ||
      [...sections].some((section) => !section.isConnected)
    ) {
      dispose();
    }
  }

  function onPageHide(event) {
    if (!event.persisted) dispose();
  }

  function onPageShow(event) {
    if (event.persisted && !disposed) {
      checkLifecycle();
      if (!disposed) queueRefresh();
    }
  }

  async function frameExists(base, n) {
    if (signal.aborted) return false;
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, LOAD_TIMEOUT);

    try {
      const response = await fetch(frameUrl(base, n), {
        method: "HEAD",
        signal: request.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  }

  async function countFrames(base) {
    if (!(await frameExists(base, 1))) return 0;

    let lo = 1;
    let hi = 2;
    while (!signal.aborted && hi < MAX_FRAMES) {
      if (!(await frameExists(base, hi))) break;
      lo = hi;
      hi = Math.min(MAX_FRAMES, hi * 2);
    }

    while (!signal.aborted && lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (await frameExists(base, mid)) lo = mid;
      else hi = mid - 1;
    }
    return signal.aborted ? 0 : lo;
  }

  function preloadFrames(total, base) {
    return new Promise((resolve) => {
      const imgs = new Array(total).fill(null);
      const pending = new Set();
      let next = 0;
      let completed = 0;
      let settled = false;
      let timeout = 0;

      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", finish);
        for (const img of pending) {
          img.onload = img.onerror = null;
          img.removeAttribute("src");
        }
        pending.clear();
        resolve(imgs);
      }

      function pump() {
        while (!settled && pending.size < 8 && next < total) {
          const index = next++;
          const img = new Image();
          img.decoding = "async";
          pending.add(img);

          const complete = (loaded) => {
            if (settled) return;
            img.onload = img.onerror = null;
            pending.delete(img);
            if (loaded && img.naturalWidth && img.naturalHeight) {
              imgs[index] = img;
            }
            completed++;
            if (completed === total) finish();
            else pump();
          };

          img.onload = () => complete(true);
          img.onerror = () => complete(false);
          img.src = frameUrl(base, index + 1);
        }
      }

      if (signal.aborted || !total) {
        finish();
        return;
      }
      signal.addEventListener("abort", finish, { once: true });
      timeout = setTimeout(finish, LOAD_TIMEOUT);
      pump();
    });
  }

  function buildScene(scene) {
    const section = document.createElement("section");
    section.className = "projects-film-scene";
    section.style.cssText =
      "position:relative;height:100vh;width:100%;overflow:hidden;background:#0a1416;isolation:isolate;";
    section.innerHTML = `
      <canvas class="projects-film-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:none;"></canvas>
      <div class="projects-film-caption" style="position:absolute;left:0;right:0;bottom:8%;text-align:center;color:#f8fafa;z-index:2;pointer-events:none;font-family:inherit;">
        <h2 style="margin:0;font-size:clamp(1.5rem,4vw,2.5rem);text-transform:uppercase;letter-spacing:0.04em;"></h2>
        <p style="margin:0.5rem 0 0;font-size:clamp(0.9rem,2vw,1.1rem);opacity:0.85;"></p>
      </div>`;

    section.querySelector("h2").textContent = scene.title ?? "";
    section.querySelector("p").textContent = scene.sub ?? "";
    (document.getElementById("root") || document.body).appendChild(section);
    sections.add(section);
    return section;
  }

  function coverCrop(iw, ih, width, height) {
    const scale = Math.max(width / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    return {
      dx: (width - dw) / 2,
      dy: (height - dh) / 2,
      dw,
      dh,
    };
  }

  function bindScene(section, canvas, imgs) {
    const ctx = canvas.getContext("2d");
    const first = imgs.findIndex(Boolean);
    if (!ctx || first < 0) return;

    // Preserve sequence timing even when individual frames are missing.
    const nearest = new Array(imgs.length);
    let previous = -1;
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i]) previous = i;
      nearest[i] = previous;
    }
    let following = -1;
    for (let i = imgs.length - 1; i >= 0; i--) {
      if (imgs[i]) following = i;
      if (
        following >= 0 &&
        (nearest[i] < 0 || following - i < i - nearest[i])
      ) {
        nearest[i] = following;
      }
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let target = first;
    let current = -1;
    let drawRaf = 0;
    let resizeRaf = 0;
    let trigger = null;
    let dead = false;
    let resizeObserver = null;

    function draw(force = false) {
      if (dead || !width || !height) return;
      const index = nearest[target];
      if (!force && current === index) return;
      const img = imgs[index];
      if (!img) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const crop = coverCrop(
        img.naturalWidth,
        img.naturalHeight,
        width,
        height
      );
      ctx.drawImage(img, crop.dx, crop.dy, crop.dw, crop.dh);
      current = index;
    }

    function scheduleDraw(index, immediate = false) {
      target = Math.max(0, Math.min(imgs.length - 1, Math.round(index)));
      if (immediate) {
        cancelAnimationFrame(drawRaf);
        drawRaf = 0;
        draw();
      } else if (!drawRaf) {
        drawRaf = requestAnimationFrame(() => {
          drawRaf = 0;
          draw();
        });
      }
    }

    function sizeCanvas() {
      if (dead) return false;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = rect.width;
      const nextHeight = rect.height;
      const nextDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      if (
        nextWidth <= 0 ||
        nextHeight <= 0 ||
        (width === nextWidth && height === nextHeight && dpr === nextDpr)
      ) {
        return false;
      }

      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      current = -1;
      draw(true);
      return true;
    }

    function sync(self) {
      scheduleDraw(self.progress * (imgs.length - 1), true);
    }

    function configureMotion() {
      if (dead) return;
      if (trigger) {
        trigger.kill(true);
        trigger = null;
      }

      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      if (!motionQuery?.matches && gsap && ScrollTrigger) {
        try {
          gsap.registerPlugin(ScrollTrigger);
          trigger = ScrollTrigger.create({
            trigger: section,
            pin: section,
            pinSpacing: true,
            pinReparent: false,
            start: "top top",
            end: "+=900",
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) =>
              scheduleDraw(self.progress * (imgs.length - 1)),
            onLeave: () => scheduleDraw(imgs.length - 1, true),
            onLeaveBack: () => scheduleDraw(0, true),
            onRefresh: (self) => {
              sizeCanvas();
              sync(self);
            },
          });
          sync(trigger);
        } catch (error) {
          console.warn("[projects-scrub] Using static frame:", error);
          scheduleDraw(first, true);
        }
      } else {
        scheduleDraw(first, true);
      }
      sizeCanvas();
      queueRefresh();
    }

    function onResize() {
      if (dead || resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        if (sizeCanvas()) queueRefresh();
      });
    }

    function cleanup() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(drawRaf);
      cancelAnimationFrame(resizeRaf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener("change", configureMotion);
      } else if (motionQuery?.removeListener) {
        motionQuery.removeListener(configureMotion);
      }
      if (trigger) trigger.kill(true);
      trigger = null;
      imgs.fill(null);
      canvas.width = canvas.height = 1;
    }

    disposers.add(cleanup);
    canvas.style.display = "block";
    sizeCanvas();
    window.addEventListener("resize", onResize, { passive: true });
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(section);
    }
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener("change", configureMotion);
    } else if (motionQuery?.addListener) {
      motionQuery.addListener(configureMotion);
    }
    configureMotion();
  }

  async function boot() {
    if (bootStarted || disposed) return;
    bootStarted = true;

    observer = new MutationObserver(checkLifecycle);
    observer.observe(document.body, { childList: true, subtree: true });

    try {
      for (const scene of SCENES) {
        checkLifecycle();
        if (disposed) return;

        const total = await countFrames(scene.base);
        checkLifecycle();
        if (disposed) return;
        if (!total) continue;

        const section = buildScene(scene);
        const imgs = await preloadFrames(total, scene.base);
        checkLifecycle();
        if (disposed) return;

        bindScene(section, section.querySelector(".projects-film-canvas"), imgs);
      }
      queueRefresh();
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => {
          if (!disposed) queueRefresh();
        }).catch(() => {});
      }
    } catch (error) {
      console.warn("[projects-scrub] Initialization failed:", error);
      dispose();
    }
  }

  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("popstate", checkLifecycle);

  let attempts = 0;
  pollTimer = setInterval(() => {
    checkLifecycle();
    if (disposed) return;

    const root = document.getElementById("root");
    if (root && root.children.length) {
      clearInterval(pollTimer);
      void boot();
    } else if (++attempts > 150) {
      dispose();
    }
  }, 200);
})();
