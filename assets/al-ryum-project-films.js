// ════════════════════════════════════════════════════════════════
// Al Ryum — Project Films  (cinematic scroll-scrub frame sequence)
// Same look as "Our signature projects, in motion." — but with
// the three supplied project videos extracted as frame sequences
// and scrubbed by scroll onto a <canvas>. No <video> element,
// no autoplay, no autoload: frames load on demand and the canvas
// just draws the current frame.
//
// Replaces the "Built to last." finale inside the cinematic host.
// Hero, garden video and existing WebP project scrub untouched.
// ════════════════════════════════════════════════════════════════
(() => {
  "use strict";
  if (window.__alRyumProjectFilmsLoaded) return;
  window.__alRyumProjectFilmsLoaded = true;

  // ── PROJECT METADATA ─────────────────────────────────────────
  const FILMS = [
    {
      id: "warner-bros",
      index: "01",
      title: "Warner Bros. World Abu Dhabi",
      sub: "Rotating Entrance Dome",
      place: "Yas Island · Abu Dhabi, UAE",
      category: "Theme Park · Landscaping & External Works",
      base: "/assets/projects/warner-bros/frames/frame_",
      ext: "jpg",
    },
    {
      id: "emirates-palace",
      index: "02",
      title: "Emirates Palace",
      sub: "Exterior Approach",
      place: "Corniche · Abu Dhabi, UAE",
      category: "Hospitality · External Works & Hardscape",
      base: "/assets/projects/emirates/frames/frame_",
      ext: "jpg",
    },
    {
      id: "louvre-abu-dhabi",
      index: "03",
      title: "Louvre Abu Dhabi",
      sub: "Transition Through the Dome",
      place: "Saadiyat Island · Abu Dhabi, UAE",
      category: "Cultural District · Landscaping & Approach",
      base: "/assets/projects/louvre/frames/frame_",
      ext: "jpg",
    },
    {
      id: "zayed-national-museum",
      index: "04",
      title: "Zayed National Museum",
      sub: "Architecture in the Landscape",
      place: "Saadiyat Island · Abu Dhabi, UAE",
      category: "Cultural District · Landscaping, Irrigation & Car Park",
      base: "/assets/frames/zayed/frame_",
      ext: "webp",
    },
  ];

  // Per-film frame count (Zayed's existing source has 80, others 80)
  const FRAME_TOTAL = 80;
  // Tight zoom range — each film restarts at SCALE_MIN on entry, so a WIDE
  // range (old 1.04->1.18) made the incoming film look "small" and pop open
  // at every film boundary. Narrowing it hides that reset.
  const SCALE_MIN = 1.10;
  const SCALE_MAX = 1.16;
  const ROTATE_MAX_DEG = 4;
  const Z_RANGE = 80;
  const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // Optional per-film hold on the last frame: remap scroll progress so the
  // final `holdLast` fraction of the band stays pinned at the last frame.
  function mapHold(p, hold) {
    if (!hold || hold <= 0) return p;
    const life = 1 - hold;
    if (p <= life) return p / life;   // advances to last frame by `life`
    return 1;                          // holds on last frame for the tail
  }

  // ── CANVAS FRAME SCRUBBER (one per film) ───────────────────
  function FrameScrubber(film) {
    const canvas = document.createElement("canvas");
    canvas.className = "ar-pf-canvas";
    canvas.setAttribute("aria-label", `${film.title} — project film, scroll to scrub`);
    const ctx = canvas.getContext("2d", { alpha: false });

    const imgs = new Array(FRAME_TOTAL).fill(null);
    const requested = new Array(FRAME_TOTAL).fill(false);
    const loaded = new Array(FRAME_TOTAL).fill(false);
    let totalLoaded = 0;
    let dpr = 1;
    let W = 0, H = 0;
    let lastDrawn = -1;
    let rafPending = false;
    let currentProgress = 0;
    let destroyed = false;

    function frameUrl(n) {
      return `${film.base}${String(n + 1).padStart(4, "0")}.${film.ext}`;
    }

    function loadFrame(n) {
      if (n < 0 || n >= FRAME_TOTAL) return;
      if (requested[n]) return;
      requested[n] = true;
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = () => {
        if (destroyed) return;
        imgs[n] = img;
        loaded[n] = true;
        totalLoaded++;
        hooks.onLoadProgress(totalLoaded / FRAME_TOTAL);
        // Redraw immediately if this is the active frame
        if (Math.round(currentProgress * (FRAME_TOTAL - 1)) === n) {
          scheduleDraw(currentProgress);
        }
      };
      img.onerror = () => {
        if (destroyed) return;
        loaded[n] = true; // mark as "done" so we don't retry forever
        totalLoaded++;
        hooks.onLoadProgress(totalLoaded / FRAME_TOTAL);
      };
      img.src = frameUrl(n);
    }

    function preloadRange(center, radius = 6) {
      // Preload current frame ± radius, both directions, in priority order
      const order = [center];
      for (let r = 1; r <= radius; r++) {
        order.push(center + r, center - r);
      }
      order.forEach((n) => {
        if (n >= 0 && n < FRAME_TOTAL && !requested[n]) {
          loadFrame(n);
        }
      });
    }

    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width || canvas.clientWidth || window.innerWidth;
      H = r.height || canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
    }

    function coverCrop(iw, ih, w, h) {
      const s = Math.max(w / iw, h / ih);
      const dw = iw * s, dh = ih * s;
      return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
    }

    function drawFrame(n) {
      if (destroyed) return;
      if (n === lastDrawn) return;
      // Find nearest loaded frame
      let best = -1, bestDist = Infinity;
      for (let i = 0; i < FRAME_TOTAL; i++) {
        if (loaded[i] && imgs[i]) {
          const d = Math.abs(i - n);
          if (d < bestDist) { bestDist = d; best = i; }
        }
      }
      if (best < 0) return; // nothing loaded yet
      lastDrawn = n;
      const img = imgs[best];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a1416";
      ctx.fillRect(0, 0, W, H);
      const c = coverCrop(img.naturalWidth, img.naturalHeight, W, H);
      // Optional per-film zoom + focus: shrink the drawn rect around a focus
      // point so the subject fills the screen (defaults to no zoom).
      const zoom = film.zoom || 1;
      if (zoom <= 1.0001) {
        ctx.drawImage(img, c.dx, c.dy, c.dw, c.dh);
        return;
      }
      const fx = film.focusX != null ? film.focusX : 0.5;
      const fy = film.focusY != null ? film.focusY : 0.5;
      const zW = c.dw / zoom, zH = c.dh / zoom;
      // focus point in destination coords
      const cx = c.dx + c.dw * fx;
      const cy = c.dy + c.dh * fy;
      let zx = cx - zW / 2;
      let zy = cy - zH / 2;
      // clamp so we never draw outside the cover rect (avoids blank edges)
      zx = Math.min(c.dx + c.dw - zW, Math.max(c.dx, zx));
      zy = Math.min(c.dy + c.dh - zH, Math.max(c.dy, zy));
      ctx.drawImage(img, zx, zy, zW, zH);
    }

    function scheduleDraw(progress) {
      currentProgress = progress;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (destroyed) return;
        // Use the newest value received during this frame. Retaining the first
        // value can leave a rapid scroll on the penultimate frame.
        const n = Math.round(mapHold(currentProgress, film.holdLast) * (FRAME_TOTAL - 1));
        // Preload a window around the new frame
        preloadRange(n, 6);
        drawFrame(n);
      });
    }

    // ── Public API ────────────────────────────────────────
    const hooks = {
      onLoadProgress: () => {},
    };

    function setProgress(p) {
      if (destroyed) return;
      const clamped = Math.max(0, Math.min(1, p));
      scheduleDraw(clamped);
    }

    function resize() {
      if (destroyed) return;
      sizeCanvas();
      if (lastDrawn >= 0) drawFrame(lastDrawn);
    }

    function destroy() {
      destroyed = true;
      // imgs go out of scope; we don't manually abort Image() loads,
      // but destroyed flag short-circuits any future drawFrame / onload.
    }

    // Initial sizing — first draw will happen on first setProgress
    sizeCanvas();
    // Kick off a quick load of the first frame so the still appears fast
    loadFrame(0);
    loadFrame(1);

    return { canvas, setProgress, resize, destroy, hooks };
  }

  // ──────────────────────────────────────────────────────────
  // SCENE BUILDER (one scene per film)
  // ──────────────────────────────────────────────────────────
  function buildScene(film) {
    const scene = document.createElement("section");
    scene.className = "ar-pf-scene";
    scene.id = `ar-pf-scene-${film.id}`;
    scene.setAttribute("data-film", film.id);
    scene.setAttribute("aria-label", `${film.title} — project film ${film.index} of ${FILMS.length}`);

    const stage = document.createElement("div");
    stage.className = "ar-pf-stage";

    const plane = document.createElement("div");
    plane.className = "ar-pf-plane";
    plane.style.setProperty("--ar-pf-scale", "1");
    plane.style.setProperty("--ar-pf-rotate", "0deg");
    plane.style.setProperty("--ar-pf-z", "0px");

    const scrubber = film.video ? VideoScrubber(film) : FrameScrubber(film);
    const canvas = scrubber.canvas;
    canvas.classList.add("ar-pf-canvas");

    // Loading strip + percent
    const loader = document.createElement("div");
    loader.className = "ar-pf-loader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML = `
      <div class="ar-pf-loader__row">
        <span class="ar-pf-loader__label">LOADING FILM</span>
        <span class="ar-pf-loader__pct" data-ar-pf-loader-pct>0%</span>
      </div>
      <div class="ar-pf-loader__rail">
        <div class="ar-pf-loader__fill" data-ar-pf-loader-fill></div>
      </div>
    `;
    const $loaderFill = loader.querySelector("[data-ar-pf-loader-fill]");
    const $loaderPct = loader.querySelector("[data-ar-pf-loader-pct]");
    scrubber.hooks.onLoadProgress = (p) => {
      const pct = Math.round(p * 100);
      $loaderFill.style.width = `${pct}%`;
      $loaderPct.textContent = `${pct}%`;
      if (pct >= 100) {
        loader.dataset.done = "true";
        // keep visible briefly then fade
        setTimeout(() => { loader.style.opacity = "0"; }, 350);
        setTimeout(() => { loader.style.display = "none"; }, 1200);
      }
    };

    // Overlay UI (Apogee-style)
    const overlay = document.createElement("div");
    overlay.className = "ar-pf-overlay";
    overlay.innerHTML = `
      <div class="ar-pf-topbar">
        <div class="ar-pf-topbar__left">
          <span>PROJECT FILM <b>${film.index}</b> / ${String(FILMS.length).padStart(2, "0")}</span>
          <span>${film.category}</span>
        </div>
        <div class="ar-pf-topbar__right">
          <span>FRAME <b data-ar-pf-frame>00</b> / ${String(FRAME_TOTAL).padStart(2, "0")}</span>
        </div>
      </div>
      <div class="ar-pf-titleblock">
        <span class="ar-pf-eyebrow">${film.sub}</span>
        <h2 class="ar-pf-title">${film.title}</h2>
        <p class="ar-pf-place"><b>${film.place.split(" · ")[0]}</b> · ${film.place.split(" · ")[1] || ""}</p>
      </div>
      <div class="ar-pf-footbar">
        <div class="ar-pf-footbar__left">
          <span>SCROLL TO DESCEND</span>
        </div>
        <div class="ar-pf-footbar__center">
          <span>— ${film.index} / ${String(FILMS.length).padStart(2, "0")} —</span>
        </div>
        <div class="ar-pf-footbar__right">
          <span data-ar-pf-pct>0%</span>
        </div>
      </div>
    `;
    const $frame = overlay.querySelector("[data-ar-pf-frame]");
    const $pct = overlay.querySelector("[data-ar-pf-pct]");

    // Progress rail
    const progress = document.createElement("div");
    progress.className = "ar-pf-progress";
    progress.innerHTML = `
      <div class="ar-pf-progress__rail">
        <div class="ar-pf-progress__fill" data-ar-pf-fill></div>
      </div>
    `;
    const $fill = progress.querySelector("[data-ar-pf-fill]");

    plane.appendChild(canvas);
    if (scrubber.video) plane.appendChild(scrubber.video);
    plane.appendChild(loader);
    stage.appendChild(plane);
    stage.appendChild(overlay);
    stage.appendChild(progress);
    scene.appendChild(stage);

    return {
      scene, plane, stage, loader,
      scrubber, $fill, $frame, $pct,
    };
  }

  // ──────────────────────────────────────────────────────────
  // VIDEO SCRUBBER — Blob-backed so local/static servers seek reliably
  // ──────────────────────────────────────────────────────────
  function VideoScrubber(film) {
    const canvas = document.createElement("canvas");
    canvas.className = "ar-pf-canvas";
    canvas.setAttribute("aria-label", `${film.title} — project film, scroll to scrub`);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.display = "none";
    const ctx = canvas.getContext("2d", { alpha: false });
    let dpr = 1, W = 0, H = 0, duration = 0, pending = false, target = 0;
    let objectUrl = "";
    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width || window.innerWidth; H = r.height || window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
    }
    function draw() {
      if (!video.videoWidth || !video.videoHeight) return;
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a1416"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    function seek() {
      pending = false;
      if (!duration) return;
      try { video.currentTime = target * duration; } catch (e) { return; }
      draw();
    }
    video.addEventListener("loadedmetadata", () => { duration = video.duration || 0; sizeCanvas(); draw(); });
    video.addEventListener("seeked", draw);
    video.addEventListener("error", () => { canvas.dataset.videoError = "true"; });
    fetch(film.video).then((r) => { if (!r.ok) throw new Error(`video ${r.status}`); return r.blob(); })
      .then((blob) => { objectUrl = URL.createObjectURL(blob); video.src = objectUrl; video.load(); })
      .catch(() => { canvas.dataset.videoError = "true"; });
    sizeCanvas();
    function setProgress(p) {
      target = Math.max(0, Math.min(1, p));
      if (!pending) { pending = true; requestAnimationFrame(seek); }
    }
    function resize() { sizeCanvas(); draw(); }
    function destroy() { if (objectUrl) URL.revokeObjectURL(objectUrl); video.remove(); }
    return { canvas, video, setProgress, resize, destroy, hooks: { onLoadProgress: () => {} } };
  }

  // ──────────────────────────────────────────────────────────
  // SECTION TITLE + NAV (built as DOM fragments)
  // ──────────────────────────────────────────────────────────
  function buildTitle() {
    const title = document.createElement("div");
    title.className = "ar-pf-titlebar";
    title.innerHTML = `<h2 class="ar-pf-titlebar__heading">Our signature Projects</h2>`;
    return title;
  }

  function buildNav() {
    const nav = document.createElement("nav");
    nav.className = "ar-pf-nav";
    nav.setAttribute("aria-label", "Jump to project film");
    FILMS.forEach((film, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ar-pf-nav__item";
      btn.setAttribute("data-target", film.id);
      btn.setAttribute("aria-current", i === 0 ? "true" : "false");
      btn.innerHTML = `
        <span class="ar-pf-nav__index">FILM ${film.index} / ${String(FILMS.length).padStart(2, "0")}</span>
        <span class="ar-pf-nav__label">${film.title}</span>
      `;
      btn.addEventListener("click", () => {
        const target = document.getElementById(`ar-pf-scene-${film.id}`);
        if (!target) return;
        const top = target.getBoundingClientRect().top + window.scrollY - 4;
        const smooth = window.lenis && typeof window.lenis.scrollTo === "function"
          ? window.lenis.scrollTo(top, { duration: 1.2, offset: 0 })
          : window.scrollTo({ top, behavior: "smooth" });
      });
      nav.appendChild(btn);
    });
    return nav;
  }

  // ──────────────────────────────────────────────────────────
  // BOOT — replace the empty `.arc-finale` placeholder that
  // al-ryum-cinematic.js injects inside #arc-cinematic-host,
  // positioned RIGHT BEFORE #projects. The cinematic.js script
  // defers its injection by ~1200ms after React mounts, so this
  // script must wait for that placeholder to exist and replace
  // it IN PLACE. We never append to <body> — that would destroy
  // the scroll engine by pushing the section past the footer.
  // ──────────────────────────────────────────────────────────
  function boot() {
    // Idempotency: if we've already mounted, bail.
    if (document.getElementById("ar-pf-section")) return true;

    const title = buildTitle();
    const nav = buildNav();
    const host = document.createElement("div");
    host.className = "ar-pf-stage-host";

    // Wait for cinematic.js to inject its placeholder. It injects
    // `#arc-cinematic-host` (containing `.arc-finale`) before #projects.
    const hostEl = document.getElementById("arc-cinematic-host");
    const finale = hostEl ? hostEl.querySelector(".arc-finale") : null;
    if (!finale) {
      // Placeholder not ready — do NOT mount anywhere. Return false so the
      // polling loop keeps trying until it appears.
      return false;
    }

    // Replace the placeholder IN PLACE. The placeholder carries an inline
    // `height:85vh` + background that would clip the 400vh host, so clear
    // the height and let the host define the section's footprint.
    finale.removeAttribute("style");
    finale.classList.add("ar-pf-section");
    finale.id = "ar-pf-section";
    finale.setAttribute("aria-label", "Al Ryum project films");
    while (finale.firstChild) finale.removeChild(finale.firstChild);
    finale.appendChild(title);
    finale.appendChild(nav);
    finale.appendChild(host);

    // Build the three scenes
    const instances = [];
    FILMS.forEach((film) => {
      try {
        const inst = buildScene(film);
        inst.__holdLast = film.holdLast || 0;   // for applyFrameTreatment
        host.appendChild(inst.scene);
        instances.push(inst);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[Al Ryum Project Films] Failed to mount ${film.id}:`, e);
      }
    });

    // Unified cinematic timeline: one active scene, one scroll progress.
    // Recompute totalTimeline lazily so layout shifts (image load, font swap)
    // don't desync the scroll progress. Fall back to host.offsetHeight when
    // the host hasn't been laid out yet (offsetHeight === 0).
    function computeTimeline() {
      const h = host.offsetHeight || 0;
      return Math.max(1, h - window.innerHeight);
    }
    let totalTimeline = computeTimeline();
    let rafPending = false;

    function applyFrameTreatment(inst, progress) {
      const mp = mapHold(progress, inst.__holdLast || 0);
      const eased = easeInOut(mp);
      inst.plane.style.setProperty("--ar-pf-scale", (SCALE_MIN + (SCALE_MAX - SCALE_MIN) * eased).toFixed(3));
      inst.plane.style.setProperty("--ar-pf-rotate", ((eased - 0.5) * 2 * ROTATE_MAX_DEG).toFixed(2));
      inst.plane.style.setProperty("--ar-pf-z", `${(Math.sin(mp * Math.PI) * Z_RANGE).toFixed(1)}px`);
      inst.$fill.style.width = `${(mp * 100).toFixed(1)}%`;
      inst.$frame.textContent = String(Math.round(mp * (FRAME_TOTAL - 1)) + 1).padStart(2, "0");
      inst.$pct.textContent = `${Math.round(mp * 100)}%`;
    }

    function updateTimeline(raw) {
      const overall = Math.max(0, Math.min(1, raw));
      const isComplete = overall === 1;
      const scaled = isComplete ? instances.length : overall * instances.length;
      const index = isComplete
        ? instances.length - 1
        : Math.min(instances.length - 1, Math.floor(scaled));
      const local = isComplete ? 1 : scaled - index;
      instances.forEach((inst, i) => {
        const active = i === index;
        inst.scene.style.opacity = active ? "1" : "0";
        inst.scene.style.visibility = active ? "visible" : "hidden";
        inst.scene.style.pointerEvents = active ? "auto" : "none";
        const p = active ? local : (i < index ? 1 : 0);
        inst.scrubber.setProgress(p);
        applyFrameTreatment(inst, p);
      });
      const activeId = instances[index].scene.getAttribute("data-film");
      nav.querySelectorAll(".ar-pf-nav__item").forEach((b) => {
        const active = b.getAttribute("data-target") === activeId;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-current", active ? "true" : "false");
      });
    }

    function onScroll() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const rect = host.getBoundingClientRect();
        // progress = how far the host's top has scrolled above the viewport,
        // normalized by the host's full scrollable span (hostH - vh).
        // raw = -rect.top / totalTimeline  (0 at entry, 1 at host bottom == viewport bottom)
        let raw = -rect.top / totalTimeline;
        if (raw < 0) raw = 0;
        if (raw > 1) raw = 1;
        updateTimeline(raw);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      totalTimeline = computeTimeline();
      instances.forEach((inst) => inst.scrubber.resize());
      onScroll();
    });
    // Recompute once layout settles (images, fonts, late React renders).
    requestAnimationFrame(() => {
      totalTimeline = computeTimeline();
      onScroll();
    });
    window.addEventListener("load", () => {
      totalTimeline = computeTimeline();
      onScroll();
    });
    onScroll();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();

    window.__alRyumProjectFilms = { instances, nav };
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // INIT — wait for React to mount, then continually try to
  // mount the films section into the `.arc-finale` placeholder
  // (injected by al-ryum-cinematic.js ~1.2s after React mounts).
  // We keep polling until the placeholder exists; we never append
  // to <body> (that broke the scroll engine by pushing the
  // films past the footer).
  // ──────────────────────────────────────────────────────────
  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
      return;
    }
    let tries = 0;
    const tick = () => {
      if (boot()) return;              // mounted — done
      if (++tries > 100) {
        // ~30s. Cinematic host still absent — wait for React to render it.
        // Do NOT fall back to body-append. Keep trying on a MutationObserver
        // instead so we mount the instant the placeholder appears.
        const obs = new MutationObserver(() => {
          if (boot()) obs.disconnect();
        });
        obs.observe(document.body, { childList: true, subtree: true });
        return;
      }
      setTimeout(tick, 300);
    };
    tick();
  }
  init();
})();
