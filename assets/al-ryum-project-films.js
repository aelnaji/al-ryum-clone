// Al Ryum — Project Films. Classic-script, section-local frame scrubbing.
(() => {
  "use strict";
  if (window.__alRyumProjectFilmsLoaded) return;
  window.__alRyumProjectFilmsLoaded = true;

  const FILMS = [
    {
      id: "abu-dhabi-corniche",
      index: "01",
      title: "Abu Dhabi Corniche",
      sub: "From Masterplan to Promenade",
      place: "Corniche · Abu Dhabi, UAE",
      category: "Public Beach · Landscaping & Irrigation",
      // AI-generated imagery, so it is labelled as an impression, not site footage.
      note: "Visualisation",
      // First 36 frames: the gold masterplan revealing into the finished promenade;
      // the rest: the lights coming on along the paths at blue hour.
      base: "/assets/projects/corniche/frames/frame_",
      ext: "webp",
      frames: 120,
    },
    {
      id: "warner-bros",
      index: "02",
      title: "Warner Bros. World Abu Dhabi",
      sub: "Rotating Entrance Dome",
      place: "Yas Island · Abu Dhabi, UAE",
      category: "Theme Park · Landscaping & External Works",
      base: "/assets/projects/warner-bros/rise/frame_",
      ext: "webp",
      frames: 120,
    },
    {
      id: "emirates-palace",
      index: "03",
      title: "Emirates Palace",
      sub: "Exterior Approach",
      place: "Corniche · Abu Dhabi, UAE",
      category: "Hospitality · External Works & Hardscape",
      base: "/assets/projects/emirates/frames/frame_",
      ext: "webp",
    },
    {
      id: "louvre-abu-dhabi",
      index: "04",
      title: "Louvre Abu Dhabi",
      sub: "Transition Through the Dome",
      place: "Saadiyat Island · Abu Dhabi, UAE",
      category: "Cultural District · Landscaping & Approach",
      base: "/assets/projects/louvre/frames/frame_",
      ext: "webp",
      frames: 120,
    },
    {
      id: "zayed-national-museum",
      index: "05",
      title: "Zayed National Museum",
      sub: "Architecture in the Landscape",
      place: "Saadiyat Island · Abu Dhabi, UAE",
      category: "Cultural District · Landscaping, Irrigation & Car Park",
      base: "/assets/projects/zayed/frames/frame_",
      ext: "webp",
      frames: 120,
    },
  ];

  // Frames per film; a film with a richer source can set its own `frames`.
  const FRAME_TOTAL = 80;
  const framesOf = (film) => film.frames || FRAME_TOTAL;
  // Scroll distance each film scrubs over, in viewports (scene = SCRUB_VH + 1 pinned viewport).
  // Phones get a shorter run: the same frames, less thumb travel.
  const SCRUB_VH = 2, SCRUB_VH_PHONE = 1;
  const scrubVh = () => (innerWidth < 768 ? SCRUB_VH_PHONE : SCRUB_VH);
  // Damped follow: the drawn frame eases toward the scroll target (0.14 per frame).
  const DAMPING = 0.14;
  // Share of the "cover" scale a frame may shrink to on wide screens (see draw()).
  const FIT = 0.88;
  const STAGE_BG = "#0a1416";
  const STAGE_BG_CLEAR = "rgba(10, 20, 22, 0)";
  // Gentle depth only: a 1° tilt needs ~3% zoom to keep the corners covered, so the
  // frame stays close to full (it was cropped by about a quarter at 4° / 1.16 / 80px).
  const SCALE_MIN = 1.035;
  const SCALE_MAX = 1.06;
  const ROTATE_MAX_DEG = 1;
  const Z_RANGE = 20;
  const clamp = (value) =>
    Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function mapHold(progress, hold) {
    return Math.min(1, clamp(progress) / (1 - Math.min(0.999, clamp(hold))));
  }

  function styles(element, values) {
    Object.entries(values).forEach(([name, value]) => {
      element.style.setProperty(name, value);
    });
  }

  function createSurface(film) {
    const canvas = document.createElement("canvas");
    canvas.className = "ar-pf-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${film.title} — scroll to move through the project`);
    styles(canvas, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });

    let context = null;
    try {
      context = canvas.getContext("2d", { alpha: false });
    } catch (_) {
      // CSS image fallback remains available when canvas is unavailable.
    }

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight : window.innerHeight;
      if (!w || !h) return false;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (width === w && height === h && dpr === ratio) return false;
      width = w;
      height = h;
      dpr = ratio;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      return true;
    }

    function draw(source, iw, ih) {
      if (!context || !iw || !ih || !width || !height) return false;
      const zoom = Math.max(1, Number(film.zoom) || 1);
      // Wide browser windows (~2:1) crop 16:9 and 3:2 footage hard when it fills the
      // width. Scale to at most FIT of "cover" (never below "contain"), so more of the
      // shot shows; any margin left at the sides fades into the stage colour.
      const cover = Math.max(width / iw, height / ih);
      const contain = Math.min(width / iw, height / ih);
      const scale = Math.max(contain, cover * FIT) * zoom;
      const dw = Math.min(width, iw * scale);
      const dh = Math.min(height, ih * scale);
      const sw = dw / scale;
      const sh = dh / scale;
      const fx = film.focusX == null ? 0.5 : clamp(film.focusX);
      const fy = film.focusY == null ? 0.5 : clamp(film.focusY);
      const sx = Math.max(0, Math.min(iw - sw, iw * fx - sw / 2));
      const sy = Math.max(0, Math.min(ih - sh, ih * fy - sh / 2));
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      try {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (dx > 0.5 || dy > 0.5) {
          context.fillStyle = STAGE_BG;
          context.fillRect(0, 0, width, height);
        }
        context.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
        if (dx > 0.5) feather(dx, dw, true);
        if (dy > 0.5) feather(dy, dh, false);
        return true;
      } catch (_) {
        return false;
      }
    }

    // Soft edges where the frame meets a side margin, so it reads as intentional.
    function feather(offset, size, horizontal) {
      const f = Math.min(90, size * 0.08);
      const ends = [[offset, offset + f], [offset + size, offset + size - f]];
      for (const [a, b] of ends) {
        const g = horizontal
          ? context.createLinearGradient(a, 0, b, 0)
          : context.createLinearGradient(0, a, 0, b);
        g.addColorStop(0, STAGE_BG);
        g.addColorStop(1, STAGE_BG_CLEAR);
        context.fillStyle = g;
        const lo = Math.min(a, b);
        if (horizontal) context.fillRect(lo, 0, f, height);
        else context.fillRect(0, lo, width, f);
      }
    }

    return { canvas, context, resize, draw };
  }

  function FrameScrubber(film) {
    const surface = createSurface(film);
    const { canvas } = surface;
    const total = framesOf(film);
    const images = new Array(total);
    const states = new Uint8Array(total);
    const hooks = { onLoadProgress: () => {} };
    let destroyed = false;
    let progress = 0;
    let motion = true;
    let active = false;
    let settled = 0;
    let inFlight = 0;
    let raf = 0;
    let lastDrawn = -1;
    let cur = null;
    let queue = [];
    let background = false;

    const url = (n) =>
      `${film.base}${String(n + 1).padStart(4, "0")}.${film.ext}`;
    const targetFrame = () =>
      Math.round(mapHold(progress, film.holdLast) * (total - 1));

    function draw() {
      raf = 0;
      if (destroyed) return;
      const goal = targetFrame();
      cur = cur === null || !motion ? goal : cur + (goal - cur) * DAMPING;
      if (Math.abs(goal - cur) < 0.05) cur = goal;
      if (cur !== goal) scheduleDraw();
      const target = Math.round(cur);
      let best = -1;
      for (let i = 0; i < total; i++) {
        if (states[i] === 2 &&
            (best < 0 || Math.abs(i - target) < Math.abs(best - target))) {
          best = i;
        }
      }
      if (best < 0 || best === lastDrawn) return;
      const image = images[best];
      if (surface.context) {
        if (!surface.draw(image, image.naturalWidth, image.naturalHeight)) return;
      } else {
        canvas.style.background = `center / cover no-repeat url("${url(best)}")`;
      }
      lastDrawn = best;
    }

    function scheduleDraw() {
      if (!destroyed && !raf) raf = requestAnimationFrame(draw);
    }

    function pump() {
      if (destroyed) return;
      while (inFlight < 4 && queue.length) {
        const n = queue.shift();
        if (states[n]) continue;
        states[n] = 1;
        inFlight++;
        const image = new Image();
        images[n] = image;
        image.decoding = "async";

        const finish = (success) => {
          image.onload = image.onerror = null;
          if (destroyed) return;
          inFlight--;
          settled++;
          states[n] = success && image.naturalWidth ? 2 : 3;
          if (states[n] === 3) images[n] = null;
          hooks.onLoadProgress(settled / total);
          scheduleDraw();

          // If a poster fails, find another still even in reduced-motion mode.
          if (!states.includes(2) && !queue.length && inFlight === 0) {
            const next = states.findIndex((state) => state === 0);
            if (next >= 0) queue.push(next);
            else canvas.dataset.frameError = "true";
          }
          pump();
        };

        // Decode before the frame counts as ready, so drawImage never has to
        // decode on the main thread mid-scroll (the visible hitch between shots).
        image.onload = () => {
          if (typeof image.decode !== "function") return finish(true);
          image.decode().then(() => finish(true), () => finish(true));
        };
        image.onerror = () => finish(false);
        image.src = url(n);
      }
    }

    function prioritize() {
      const center = targetFrame();
      const candidates = [center];
      const radius = motion ? 6 : 0;
      for (let i = 1; i <= radius; i++) {
        candidates.push(center + i, center - i);
      }
      if (background && motion) {
        for (let i = 0; i < total; i++) candidates.push(i);
      }
      queue = [...new Set(candidates)].filter(
        (n) => n >= 0 && n < total && states[n] === 0
      );
      pump();
    }

    function setProgress(value) {
      if (destroyed) return;
      const previous = targetFrame();
      progress = motion ? clamp(value) : 0;
      if (previous !== targetFrame()) prioritize();
      scheduleDraw();
    }

    function setMotion(enabled) {
      motion = enabled;
      if (!enabled) progress = 0;
      background = enabled && active;
      prioritize();
      scheduleDraw();
    }

    function activate(enabled) {
      active = enabled;
      background = enabled && motion;
      if (!enabled) release();
      prioritize();
    }

    // Far from the screen: let go of decoded frames so four films never hold
    // hundreds of full-HD bitmaps at once (the browser would evict and then
    // re-decode them mid-scroll). The canvas keeps its last picture, and the
    // frames come back from the HTTP cache when the film is near again.
    function release() {
      for (let i = 0; i < total; i++) {
        if (states[i] === 2 && i !== lastDrawn) {
          images[i] = null;
          states[i] = 0;
          settled--;
        }
      }
    }

    function resize() {
      if (destroyed) return;
      if (surface.resize()) lastDrawn = -1;
      // Draw synchronously after a backing-store resize to avoid a blank paint.
      if (raf) cancelAnimationFrame(raf);
      draw();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      queue.length = 0;
      images.forEach((image) => {
        if (image) image.onload = image.onerror = null;
      });
      images.fill(null);
      hooks.onLoadProgress = () => {};
    }

    queue = [0, 1];
    pump();
    return { canvas, hooks, setProgress, setMotion, activate, resize, destroy };
  }

  function VideoScrubber(film) {
    const surface = createSurface(film);
    const { canvas } = surface;
    const video = document.createElement("video");
    const hooks = { onLoadProgress: () => {} };
    const controller = new AbortController();
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.display = "none";
    video.setAttribute("aria-hidden", "true");

    let destroyed = false;
    let objectUrl = "";
    let target = 0;
    let motion = true;
    let raf = 0;
    let started = false;
    const listeners = [];

    function listen(type, callback) {
      video.addEventListener(type, callback);
      listeners.push(() => video.removeEventListener(type, callback));
    }

    function draw() {
      if (!destroyed && video.readyState >= 2) {
        surface.draw(video, video.videoWidth, video.videoHeight);
      }
    }

    function seek() {
      raf = 0;
      if (destroyed || video.seeking) return;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const time = mapHold(target, film.holdLast) * Math.max(0, duration - 0.04);
      if (Math.abs(video.currentTime - time) < 0.015) {
        draw();
        return;
      }
      try {
        video.currentTime = time;
      } catch (_) {
        canvas.dataset.videoError = "true";
      }
    }

    function schedule() {
      if (!destroyed && !raf) raf = requestAnimationFrame(seek);
    }

    function start() {
      if (started || destroyed) return;
      started = true;
      fetch(film.video, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Video HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (destroyed) return;
          objectUrl = URL.createObjectURL(blob);
          video.src = objectUrl;
          video.load();
        })
        .catch((error) => {
          if (!destroyed && error.name !== "AbortError") {
            canvas.dataset.videoError = "true";
            video.src = film.video;
            video.load();
          }
        });
    }

    listen("loadedmetadata", () => {
      surface.resize();
      schedule();
    });
    listen("loadeddata", () => {
      draw();
      hooks.onLoadProgress(1);
      schedule();
    });
    listen("seeked", () => {
      draw();
      schedule();
    });
    listen("error", () => {
      canvas.dataset.videoError = "true";
      hooks.onLoadProgress(1);
    });

    return {
      canvas,
      video,
      hooks,
      setProgress(value) {
        target = motion ? clamp(value) : 0;
        start();
        schedule();
      },
      setMotion(enabled) {
        motion = enabled;
        if (!enabled) target = 0;
        start();
        schedule();
      },
      activate(enabled) {
        if (enabled) start();
      },
      resize() {
        if (destroyed) return;
        surface.resize();
        draw();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        controller.abort();
        cancelAnimationFrame(raf);
        listeners.forEach((remove) => remove());
        video.pause();
        video.removeAttribute("src");
        video.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        hooks.onLoadProgress = () => {};
        video.remove();
      },
    };
  }

  function buildScene(film) {
    const scene = document.createElement("section");
    scene.className = "ar-pf-scene";
    scene.id = `ar-pf-scene-${film.id}`;
    scene.setAttribute("data-film", film.id);
    scene.setAttribute(
      "aria-label",
      `${film.title} — signature project ${film.index} of ${FILMS.length}`
    );

    const stage = document.createElement("div");
    stage.className = "ar-pf-stage";
    const plane = document.createElement("div");
    plane.className = "ar-pf-plane";
    const scrubber = film.video ? VideoScrubber(film) : FrameScrubber(film);

    const loader = document.createElement("div");
    loader.className = "ar-pf-loader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML = `
      <div class="ar-pf-loader__row">
        <span class="ar-pf-loader__label">LOADING</span>
        <span class="ar-pf-loader__pct" data-ar-pf-loader-pct>0%</span>
      </div>
      <div class="ar-pf-loader__rail">
        <div class="ar-pf-loader__fill" data-ar-pf-loader-fill></div>
      </div>`;
    const loaderFill = loader.querySelector("[data-ar-pf-loader-fill]");
    const loaderPct = loader.querySelector("[data-ar-pf-loader-pct]");
    const timers = [];
    let reduced = false;

    scrubber.hooks.onLoadProgress = (p) => {
      const percent = Math.round(clamp(p) * 100);
      loaderFill.style.width = `${percent}%`;
      loaderPct.textContent = `${percent}%`;
      if (percent === 100 && loader.dataset.done !== "true") {
        loader.dataset.done = "true";
        timers.push(setTimeout(() => { loader.style.opacity = "0"; }, 350));
        timers.push(setTimeout(() => { loader.style.display = "none"; }, 1200));
      }
    };

    const overlay = document.createElement("div");
    overlay.className = "ar-pf-overlay";
    overlay.innerHTML = `
      <div class="ar-pf-topbar">
        <div class="ar-pf-topbar__left">
          <span>PROJECT <b>${film.index}</b> / ${String(FILMS.length).padStart(2, "0")}</span>
          <span>${film.category}</span>
        </div>
        <div class="ar-pf-topbar__right">
          <span>FRAME <b data-ar-pf-frame>00</b> / ${framesOf(film)}</span>
        </div>
      </div>
      <div class="ar-pf-titleblock">
        <span class="ar-pf-eyebrow">${film.sub}</span>
        <h2 class="ar-pf-title">${film.title}</h2>
        <p class="ar-pf-place"><b>${film.place.split(" · ")[0]}</b> · ${film.place.split(" · ")[1] || ""}</p>
      </div>
      <div class="ar-pf-footbar">
        <div class="ar-pf-footbar__left"><span>SCROLL TO DESCEND</span></div>
        <div class="ar-pf-footbar__center">
          <span>— ${film.index} / ${String(FILMS.length).padStart(2, "0")} —</span>
        </div>
        <div class="ar-pf-footbar__right"><span data-ar-pf-pct>0%</span></div>
      </div>`;

    const progress = document.createElement("div");
    progress.className = "ar-pf-progress";
    progress.innerHTML = `
      <div class="ar-pf-progress__rail">
        <div class="ar-pf-progress__fill" data-ar-pf-fill></div>
      </div>`;

    // Each scene owns its footprint and clipping boundary; nothing is fixed.
    styles(scene, {
      position: "relative", inset: "auto", width: "100%",
      "min-height": "0", "max-height": "none", margin: "0",
      padding: "0", display: "block", opacity: "1", visibility: "visible",
      "pointer-events": "auto", transform: "none", isolation: "isolate",
      "z-index": "0", overflow: "clip", "box-sizing": "border-box",
    });
    styles(stage, {
      position: "sticky", top: "0", right: "auto", bottom: "auto", left: "0",
      width: "100%", "min-height": "0", "max-height": "none",
      margin: "0", overflow: "hidden", isolation: "isolate",
      transform: "none", opacity: "1", visibility: "visible",
      "z-index": "0", "box-sizing": "border-box",
      background: "#0a1416",
    });
    styles(plane, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      "z-index": "0", "transform-origin": "50% 50%",
      transform: "translateZ(var(--ar-pf-z)) rotate(var(--ar-pf-rotate)) scale(var(--ar-pf-scale))",
      transition: "none",
    });
    styles(overlay, { position: "absolute", inset: "0", "z-index": "2" });
    styles(progress, { position: "absolute", "z-index": "3" });
    loader.style.zIndex = "1";

    plane.appendChild(scrubber.canvas);
    if (scrubber.video) plane.appendChild(scrubber.video);
    plane.appendChild(loader);
    stage.append(plane, overlay, progress);
    if (film.note) {
      const note = document.createElement("span");
      note.className = "ar-pf-note";
      note.textContent = film.note;
      stage.appendChild(note);
    }
    scene.appendChild(stage);

    return {
      scene, stage, plane, loader, scrubber,
      __holdLast: film.holdLast || 0,
      __frames: framesOf(film),
      $fill: progress.querySelector("[data-ar-pf-fill]"),
      $frame: overlay.querySelector("[data-ar-pf-frame]"),
      $pct: overlay.querySelector("[data-ar-pf-pct]"),
      setReduced(value) {
        reduced = value;
        loader.style.display = reduced || loader.dataset.done === "true" ? "none" : "";
        scrubber.setMotion(!reduced);
      },
      destroy() {
        timers.forEach(clearTimeout);
        scrubber.destroy();
      },
    };
  }

  function buildTitle() {
    const title = document.createElement("div");
    title.className = "ar-pf-titlebar";
    title.innerHTML = '<h2 class="ar-pf-titlebar__heading">Our signature Projects</h2>';
    return title;
  }

  function buildNav() {
    const nav = document.createElement("nav");
    nav.className = "ar-pf-nav";
    nav.setAttribute("aria-label", "Jump to a signature project");
    FILMS.forEach((film, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ar-pf-nav__item";
      button.setAttribute("data-target", film.id);
      button.setAttribute("aria-current", i === 0 ? "true" : "false");
      button.innerHTML = `
        <span class="ar-pf-nav__index">${film.index} / ${String(FILMS.length).padStart(2, "0")}</span>
        <span class="ar-pf-nav__label">${film.title}</span>`;
      nav.appendChild(button);
    });
    return nav;
  }

  let waitingObserver = null;
  let mountObserver = null;
  let stopped = false;
  let mounted = false;
  let destroyMounted = null;

  function boot() {
    if (stopped || mounted) return mounted;
    if (document.getElementById("ar-pf-section")) return true;
    const cinematicHost = document.getElementById("arc-cinematic-host");
    const finale = cinematicHost && cinematicHost.querySelector(".arc-finale");
    if (!finale) return false;

    const originalAttributes = ["id", "class", "style", "aria-label"].map(
      (name) => [name, finale.getAttribute(name)]
    );
    const originalContent = document.createDocumentFragment();
    while (finale.firstChild) originalContent.appendChild(finale.firstChild);

    const title = buildTitle();
    const nav = buildNav();
    const host = document.createElement("div");
    host.className = "ar-pf-stage-host";
    finale.removeAttribute("style");
    finale.classList.add("ar-pf-section");
    finale.id = "ar-pf-section";
    finale.setAttribute("aria-label", "Al Ryum signature projects");

    [finale, host].forEach((element) => styles(element, {
      position: "relative", inset: "auto", height: "auto",
      "min-height": "0", "max-height": "none", width: "100%",
      display: "block", overflow: "visible", transform: "none",
      opacity: "1", visibility: "visible", isolation: "isolate",
      "z-index": "0",
    }));
    styles(host, { margin: "0", padding: "0" });
    [title].forEach((element) => styles(element, {
      position: "relative", inset: "auto", "z-index": "1",
    }));
    // The project index stays pinned just below the fixed site header (whose height
    // changes with its pill/bar state and the desktop UI scale), as a slim bar.
    styles(nav, { position: "sticky", top: "var(--ar-header-offset, 68px)", "z-index": "60" });
    finale.append(title, nav, host);

    const instances = FILMS.map(buildScene);
    instances.forEach((instance) => host.appendChild(instance.scene));
    const buttons = Array.from(nav.querySelectorAll(".ar-pf-nav__item"));
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cleanup = [];
    let dead = false;
    let reduced = window.alRyumMotion ? !window.alRyumMotion.enabled : media.matches;
    let viewportHeight = 0;
    let updateRaf = 0;
    let layoutRaf = 0;
    let settleRaf = 0;
    let triggerAPI = null;
    let triggers = [];
    let resizeObserver = null;
    let refreshing = false;
    let currentId = "";

    function listen(target, type, callback, options) {
      target.addEventListener(type, callback, options);
      cleanup.push(() => target.removeEventListener(type, callback, options));
    }

    function treatment(instance, progress) {
      const p = reduced ? 0 : clamp(progress);
      const mapped = mapHold(p, instance.__holdLast);
      const eased = easeInOut(mapped);
      instance.plane.style.setProperty(
        "--ar-pf-scale",
        reduced ? "1" : (SCALE_MIN + (SCALE_MAX - SCALE_MIN) * eased).toFixed(3)
      );
      instance.plane.style.setProperty(
        "--ar-pf-rotate",
        `${reduced ? 0 : ((eased - 0.5) * 2 * ROTATE_MAX_DEG).toFixed(2)}deg`
      );
      instance.plane.style.setProperty(
        "--ar-pf-z",
        `${reduced ? 0 : (Math.sin(mapped * Math.PI) * Z_RANGE).toFixed(1)}px`
      );
      instance.$fill.style.width = `${(mapped * 100).toFixed(1)}%`;
      instance.$frame.textContent = String(
        Math.round(mapped * (instance.__frames - 1)) + 1
      ).padStart(2, "0");
      instance.$pct.textContent = `${Math.round(mapped * 100)}%`;
      instance.scrubber.setProgress(p);
    }

    let headerOffset = -1;
    function syncHeaderOffset() {
      const header = document.querySelector("header");
      const bottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
      if (bottom !== headerOffset) {
        headerOffset = bottom;
        document.documentElement.style.setProperty("--ar-header-offset", `${bottom}px`);
      }
    }

    function update() {
      updateRaf = 0;
      if (dead) return;
      syncHeaderOffset();
      let activeIndex = 0;
      instances.forEach((instance, index) => {
        const rect = instance.scene.getBoundingClientRect();
        if (rect.top <= viewportHeight * 0.5) activeIndex = index;
        // Start loading a film well before it arrives, so a fast scroll
        // doesn't land on a scene whose frames are still in flight.
        const near = rect.bottom > -viewportHeight &&
          rect.top < viewportHeight * 4;
        if (instance.__near !== near) {
          instance.__near = near;
          instance.scrubber.activate(near);
        }
        const span = Math.max(1, instance.scene.offsetHeight - viewportHeight);
        // Geometry is also the no-GSAP fallback and handles restored scroll.
        treatment(instance, -rect.top / span);
      });

      const id = instances[activeIndex].scene.dataset.film;
      if (id !== currentId) {
        currentId = id;
        buttons.forEach((button) => {
          const active = button.dataset.target === id;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-current", active ? "true" : "false");
        });
      }
    }

    function scheduleUpdate() {
      if (!dead && !updateRaf) updateRaf = requestAnimationFrame(update);
    }

    function killTriggers() {
      triggers.forEach((trigger) => trigger.kill());
      triggers = [];
    }

    function connectTriggers() {
      const available = window.ScrollTrigger;
      if (reduced || !available || typeof available.create !== "function") return;
      if (triggerAPI === available && triggers.length) return;
      killTriggers();
      if (triggerAPI) triggerAPI.removeEventListener("refresh", onRefresh);
      triggerAPI = available;
      try {
        if (window.gsap && typeof window.gsap.registerPlugin === "function") {
          window.gsap.registerPlugin(available);
        }
        available.addEventListener("refresh", onRefresh);
        triggers = instances.map((instance) => available.create({
          trigger: instance.scene,
          start: "top top",
          end: () => `+=${Math.max(1, instance.scene.offsetHeight - viewportHeight)}`,
          invalidateOnRefresh: true,
          // Native section-local sticky owns pinning; never add a fixed layer,
          // pin spacer or reparented stage inside the cinematic host.
          pin: false,
          onUpdate: (self) => {
            if (!dead && !reduced) treatment(instance, self.progress);
            scheduleUpdate();
          },
          onRefresh: scheduleUpdate,
        }));
      } catch (error) {
        killTriggers();
        available.removeEventListener("refresh", onRefresh);
        triggerAPI = null;
        console.warn("[Al Ryum Project Films] Using native scroll fallback:", error);
      }
    }

    function onRefresh() {
      if (dead) return;
      instances.forEach((instance) => instance.scrubber.resize());
      scheduleUpdate();
    }

    function refresh() {
      if (dead || refreshing) return;
      refreshing = true;
      try {
        if (triggerAPI && typeof triggerAPI.refresh === "function") {
          triggerAPI.refresh();
        }
        if (window.lenis && typeof window.lenis.resize === "function") {
          window.lenis.resize();
        }
      } finally {
        refreshing = false;
      }
      onRefresh();
    }

    function layout() {
      layoutRaf = 0;
      if (dead) return;
      viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight);
      instances.forEach((instance) => {
        instance.scene.style.height = `${viewportHeight * (reduced ? 1 : 1 + scrubVh())}px`;
        instance.stage.style.height = `${viewportHeight}px`;
        instance.stage.style.position = reduced ? "relative" : "sticky";
        instance.setReduced(reduced);
        instance.scrubber.resize();
      });
      if (reduced) killTriggers();
      else connectTriggers();
      update();
      cancelAnimationFrame(settleRaf);
      settleRaf = requestAnimationFrame(() => {
        settleRaf = 0;
        refresh();
      });
    }

    function scheduleLayout() {
      if (!dead && !layoutRaf) layoutRaf = requestAnimationFrame(layout);
    }

    function onNavClick(event) {
      const button = event.target.closest(".ar-pf-nav__item");
      if (!button || !nav.contains(button)) return;
      const instance = instances.find(
        (item) => item.scene.dataset.film === button.dataset.target
      );
      if (!instance) return;
      const top = Math.max(
        0, instance.scene.getBoundingClientRect().top + window.scrollY - 4
      );
      if (window.lenis && typeof window.lenis.scrollTo === "function") {
        window.lenis.scrollTo(top, reduced
          ? { immediate: true, offset: 0 }
          : { duration: 1.2, offset: 0 });
      } else {
        window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
      }
    }

    function onMotionChange() {
      reduced = window.alRyumMotion ? !window.alRyumMotion.enabled : media.matches;
      scheduleLayout();
    }

    listen(nav, "click", onNavClick);
    listen(window, "alryum-motion-change", onMotionChange);
    // Only track scroll while the films are within three viewports of the screen.
    let filmsNear = true;
    if (window.IntersectionObserver) {
      const nearObserver = new IntersectionObserver((entries) => {
        filmsNear = entries[entries.length - 1].isIntersecting;
        scheduleUpdate(); // one last update parks the scenes when leaving
      }, { rootMargin: "300% 0px" });
      nearObserver.observe(finale);
      cleanup.push(() => nearObserver.disconnect());
    }
    listen(window, "scroll", () => { if (filmsNear) scheduleUpdate(); }, { passive: true });
    listen(window, "resize", scheduleLayout, { passive: true });
    listen(window, "orientationchange", scheduleLayout);
    listen(window, "load", scheduleLayout);
    listen(window, "pageshow", scheduleLayout);
    listen(document, "load", (event) => {
      if (!finale.contains(event.target)) scheduleLayout();
    }, true);
    if (media.addEventListener) listen(media, "change", onMotionChange);
    else {
      media.addListener(onMotionChange);
      cleanup.push(() => media.removeListener(onMotionChange));
    }

    if (document.fonts) {
      document.fonts.ready.then(() => { if (!dead) scheduleLayout(); });
      if (document.fonts.addEventListener) {
        listen(document.fonts, "loadingdone", scheduleLayout);
      }
    }

    if (window.ResizeObserver) {
      const sizes = new WeakMap();
      resizeObserver = new ResizeObserver((entries) => {
        if (dead || refreshing) return;
        let changed = false;
        entries.forEach((entry) => {
          const key = `${entry.contentRect.width}:${entry.contentRect.height}`;
          if (sizes.get(entry.target) !== key) {
            sizes.set(entry.target, key);
            changed = true;
          }
        });
        if (changed) scheduleLayout();
      });
      [document.body, cinematicHost, finale, ...instances.map((item) => item.stage)]
        .forEach((element) => resizeObserver.observe(element));
    }

    // Catch late sibling insertion and host removal without observing our UI text.
    mountObserver = new MutationObserver((records) => {
      if (dead) return;
      if (!finale.isConnected || !host.isConnected) {
        destroy();
        // The page was re-rendered (an in-app route change): mount again as
        // soon as a new films host appears, instead of staying stopped.
        stopped = false;
        mounted = false;
        waitingObserver = null;
        init();
        return;
      }
      // Ignore transient nodes (added and removed again before this callback),
      // e.g. ScrollTrigger's own 100vh measuring div: re-laying out for those
      // made every refresh trigger another refresh.
      const lasting = (record) =>
        [...record.addedNodes, ...record.removedNodes].some((node) => node.isConnected);
      if (records.some((record) => !finale.contains(record.target) && lasting(record))) {
        scheduleLayout();
      }
    });
    mountObserver.observe(document.body, { childList: true, subtree: true });

    function destroy() {
      if (dead) return;
      dead = true;
      stopped = true;
      cancelAnimationFrame(updateRaf);
      cancelAnimationFrame(layoutRaf);
      cancelAnimationFrame(settleRaf);
      killTriggers();
      if (triggerAPI) triggerAPI.removeEventListener("refresh", onRefresh);
      cleanup.forEach((remove) => remove());
      if (resizeObserver) resizeObserver.disconnect();
      if (mountObserver) mountObserver.disconnect();
      if (waitingObserver) waitingObserver.disconnect();
      instances.forEach((instance) => instance.destroy());

      finale.replaceChildren(originalContent);
      originalAttributes.forEach(([name, value]) => {
        if (value === null) finale.removeAttribute(name);
        else finale.setAttribute(name, value);
      });
      if (window.__alRyumProjectFilms === api) {
        delete window.__alRyumProjectFilms;
        window.__alRyumProjectFilmsLoaded = false;
      }
      if (triggerAPI && finale.isConnected) triggerAPI.refresh();
      destroyMounted = null;
    }

    const api = { instances, nav, refresh: scheduleLayout, destroy };
    window.__alRyumProjectFilms = api;
    destroyMounted = destroy;
    mounted = true;
    layout();
    return true;
  }

  function init() {
    if (stopped) return;
    if (boot()) {
      if (waitingObserver) waitingObserver.disconnect();
      return;
    }
    if (!waitingObserver) {
      waitingObserver = new MutationObserver(() => {
        if (boot()) waitingObserver.disconnect();
      });
      waitingObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  window.addEventListener("pagehide", function onPageHide(event) {
    if (event.persisted) return;
    stopped = true;
    if (waitingObserver) waitingObserver.disconnect();
    document.removeEventListener("DOMContentLoaded", init);
    if (destroyMounted) destroyMounted();
    window.removeEventListener("pagehide", onPageHide);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
