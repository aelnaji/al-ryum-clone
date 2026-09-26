/* ==== AL RYUM @astra ==== Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE - disconnect: remove file + revert index.html src. */

/* ============================================================================
   al-ryum-client-marquee.js
   Drop-in client logo marquee. Uses existing GSAP when available; otherwise
   displays the original items. No ScrollTrigger or Lenis coupling required.
   Copies are presentation-only and rebuilt, never accumulated.
   ============================================================================ */
(function () {
  "use strict";

  if (window.__alryumClientMarquee) return;
  window.__alryumClientMarquee = true;

  // Retained for source compatibility with the companion timezone script.
  var MARQUEE_ZONES = {
    current: { timeZone: undefined, label: null },
    edt:  { timeZone: "America/New_York", label: "EDT" },
    bst:  { timeZone: "Europe/London", label: "BST" },
    eest: { timeZone: "Europe/Bucharest", label: "EEST" },
    jst:  { timeZone: "Asia/Tokyo", label: "JST" },
    cest: { timeZone: "Europe/Warsaw", label: "CEST" },
    cst:  { timeZone: "Asia/Shanghai", label: "CST" },
    aest: { timeZone: "Australia/Brisbane", label: "AEST" },
    cat:  { timeZone: "Africa/Maputo", label: "CAT" }
  };

  var CLIENT_LOGOS = {
    "MASDAR": { src: "/assets/clients/masdar_nobg.png" },
    "ADNOC": { src: "/assets/clients/adnoc_nobg.png" },
    "TDIC": { src: "/assets/clients/tdic_nobg.png" },
    "ALDAR": { src: "/assets/clients/aldar_nobg.png" },
    "MUBADALA": { src: "/assets/clients/mubadala_nobg.png" },
    "ABU DHABI MUNICIPALITY": {
      src: "/assets/clients/abudhabi-municipality_nobg.png", real: true
    },
    "DAMAC": { src: "/assets/clients/damac_nobg.png" },
    "MERAAS": { src: "/assets/clients/meraas_nobg.png" },
    "EMAAR": { src: "/assets/clients/emaar_nobg.png" },
    "NAKHEEL": { src: "/assets/clients/nakheel_nobg.png" },
    "TECOM": { src: "/assets/clients/tecom_nobg.png" },
    "FEWA": { src: "/assets/clients/fewa_clean.png", real: true }
  };

  var states = new Map();
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var observer;
  var frame = 0;
  var warned = false;
  var COPY = "data-ar-marquee-copy";
  var gsap;

  function removeCopies(track) {
    Array.from(track.children).forEach(function (item) {
      if (item.hasAttribute(COPY) ||
          (item.matches(".ar-marquee-item") &&
           item.getAttribute("aria-hidden") === "true")) {
        item.remove();
      }
    });
  }

  function originals(track) {
    return Array.from(track.children).filter(function (item) {
      return item.matches(".ar-marquee-item") && !item.hasAttribute(COPY);
    });
  }

  function applyLogo(item) {
    if (item.querySelector("img")) return;
    var name = (item.textContent || "").trim();
    if (!Object.prototype.hasOwnProperty.call(CLIENT_LOGOS, name)) return;

    var entry = CLIENT_LOGOS[name];
    var img = document.createElement("img");
    img.className = "ar-marquee-logo";
    img.alt = name;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", function () {
      if (!img.parentNode) return;
      item.classList.remove("is-logo", "is-real");
      item.textContent = name;
      schedule(true);
    }, { once: true });

    item.textContent = "";
    item.classList.add("is-logo");
    item.classList.toggle("is-real", !!entry.real);
    item.appendChild(img);
    img.src = entry.src;
  }

  function copyItem(item) {
    var clone = item.cloneNode(true);
    clone.setAttribute(COPY, "");
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("inert", "");
    clone.style.pointerEvents = "none";

    [clone].concat(Array.from(clone.querySelectorAll("*"))).forEach(function (el) {
      el.removeAttribute("id");
      el.removeAttribute("autofocus");
      if (el.matches("a,button,input,select,textarea,[tabindex],[contenteditable]")) {
        el.setAttribute("tabindex", "-1");
        el.removeAttribute("contenteditable");
      }
      if (el.matches("img")) {
        el.loading = "eager";
        el.alt = "";
      }
    });
    return clone;
  }

  function inViewport(el) {
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.top < window.innerHeight &&
      rect.right > 0 && rect.left < window.innerWidth;
  }

  function syncPlayback(state) {
    if (!state.tween) return;
    var focused = state.el.contains(document.activeElement);
    if (motion.matches || document.hidden || focused || !inViewport(state.el)) {
      state.tween.pause();
    } else {
      state.tween.play();
    }
  }

  function resetTween(state) {
    if (state.tween) {
      state.progress = state.tween.progress();
      state.tween.kill();
      state.tween = null;
    }
    if (gsap) gsap.set(state.track, { x: 0, xPercent: 0 });
    else state.track.style.transform = "none";
  }

  function build(state) {
    resetTween(state);
    removeCopies(state.track);

    var track = state.track;
    var items = originals(track);
    items.forEach(applyLogo);

    // Explicit geometry prevents inherited wrapping, shrinkage, or CSS motion
    // from changing the measured cycle or overflowing a flex/grid parent.
    Object.assign(state.el.style, {
      minWidth: "0",
      maxWidth: "100%",
      boxSizing: "border-box",
      overflow: "hidden"
    });
    Object.assign(track.style, {
      display: "flex",
      flexDirection: "row",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      direction: "ltr",
      width: "max-content",
      minWidth: "0",
      maxWidth: "none",
      animation: "none",
      transition: "none"
    });
    items.forEach(function (item) {
      item.style.flex = "0 0 auto";
    });

    // Static/reduced-motion presentation exposes every original without copies.
    if (motion.matches || !gsap) {
      Object.assign(track.style, {
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        flexWrap: "wrap",
        justifyContent: "center",
        willChange: "auto"
      });
      items.forEach(function (item) {
        item.style.flex = "0 1 auto";
        item.style.minWidth = "0";
        item.style.maxWidth = "100%";
        item.style.overflowWrap = "anywhere";
        item.querySelectorAll("img").forEach(function (img) {
          img.style.maxWidth = "100%";
          img.style.objectFit = "contain";
        });
      });
      state.progress = 0;
      return;
    }

    if (!items.length || !state.el.clientWidth) return;

    // The first repeated item's offset includes the real inter-item gap.
    // Percentage-of-track movement is incorrect when gaps or padding exist.
    var fragment = document.createDocumentFragment();
    items.forEach(function (item) { fragment.appendChild(copyItem(item)); });
    var firstCopy = fragment.firstElementChild;
    track.appendChild(fragment);

    var firstRect = items[0].getBoundingClientRect();
    var distance = firstCopy.getBoundingClientRect().left - firstRect.left;
    if (!Number.isFinite(distance) || distance <= 0) {
      removeCopies(track);
      return;
    }

    // Cover a full viewport beyond the moving cycle even for short item lists.
    var last = items[items.length - 1].getBoundingClientRect();
    var contentEnd = last.right - firstRect.left;
    var needed = state.el.clientWidth + distance;
    var sets = Math.max(2, Math.ceil((needed - contentEnd) / distance) + 1);

    for (var set = 2; set < sets; set++) {
      var extra = document.createDocumentFragment();
      items.forEach(function (item) { extra.appendChild(copyItem(item)); });
      track.appendChild(extra);
    }

    var duration = parseFloat(
      state.el.dataset.marqueeDuration ||
      items[0].dataset.marqueeDuration || "30"
    );
    if (!Number.isFinite(duration) || duration <= 0) duration = 30;

    track.style.willChange = "transform";
    state.tween = gsap.fromTo(track, { x: 0, xPercent: 0 }, {
      x: -distance,
      xPercent: 0,
      duration: duration,
      repeat: -1,
      ease: "none",
      paused: true
    });
    state.tween.progress(state.progress);
    syncPlayback(state);
  }

  function observeSizes(state) {
    if (!state.resize) return;
    state.resize.disconnect();
    state.resize.observe(state.el);
    originals(state.track).forEach(function (item) {
      state.resize.observe(item);
    });
  }

  function createState(el, track) {
    var state = {
      el: el,
      track: track,
      tween: null,
      progress: 0.25,
      dirty: true,
      resize: null,
      sizes: new WeakMap(),
      elStyle: el.getAttribute("style"),
      trackStyle: track.getAttribute("style")
    };

    state.onImage = function (event) {
      if (!event.target.closest("[" + COPY + "]")) schedule(true);
    };
    state.onFocus = function () { schedule(false); };

    track.addEventListener("load", state.onImage, true);
    track.addEventListener("error", state.onImage, true);
    el.addEventListener("focusin", state.onFocus);
    el.addEventListener("focusout", state.onFocus);

    if (window.ResizeObserver) {
      state.resize = new ResizeObserver(function (entries) {
        var changed = entries.some(function (entry) {
          var key = entry.contentRect.width + ":" + entry.contentRect.height;
          var previous = state.sizes.get(entry.target);
          state.sizes.set(entry.target, key);
          return previous !== key;
        });
        if (changed) {
          state.dirty = true;
          schedule(false);
        }
      });
    }
    return state;
  }

  function restoreStyle(el, value) {
    if (value === null) el.removeAttribute("style");
    else el.setAttribute("style", value);
  }

  function dispose(state) {
    if (state.tween) state.tween.kill();
    if (state.resize) state.resize.disconnect();
    state.track.removeEventListener("load", state.onImage, true);
    state.track.removeEventListener("error", state.onImage, true);
    state.el.removeEventListener("focusin", state.onFocus);
    state.el.removeEventListener("focusout", state.onFocus);
    removeCopies(state.track);
    if (gsap) gsap.set(state.track, { clearProps: "transform" });
    restoreStyle(state.el, state.elStyle);
    restoreStyle(state.track, state.trackStyle);
  }

  function observeDOM() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-marquee-duration"]
    });
  }

  function flush() {
    frame = 0;
    // Ignore our own logo replacement/copy mutations.
    observer.disconnect();
    try {
      var available = window.gsap;
      if (available && available !== gsap) {
        gsap = available;
        states.forEach(function (state) { state.dirty = true; });
      }

      states.forEach(function (state, el) {
        if (!el.isConnected ||
            el.querySelector(".ar-marquee-track") !== state.track) {
          dispose(state);
          states.delete(el);
        }
      });

      document.querySelectorAll(".ar-marquee").forEach(function (el) {
        var track = el.querySelector(".ar-marquee-track");
        if (!track || track.closest(".ar-marquee") !== el) return;
        if (!states.has(el)) states.set(el, createState(el, track));
      });

      states.forEach(function (state) {
        try {
          if (state.dirty) {
            state.dirty = false;
            build(state);
            observeSizes(state);
          }
          syncPlayback(state);
        } catch (error) {
          resetTween(state);
          removeCopies(state.track);
          console.error("[client-marquee] initialization failed", error);
        }
      });

      if (states.size) {
        window.__alryumClientMarqueeBooted = true;
        if (!gsap && !warned) {
          warned = true;
          console.warn("[client-marquee] gsap missing; showing static clients");
        }
      }
    } finally {
      observeDOM();
    }
  }

  function schedule(rebuild) {
    if (rebuild) states.forEach(function (state) { state.dirty = true; });
    if (!frame) frame = window.requestAnimationFrame(flush);
  }

  function start() {
    observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        var target = record.target.nodeType === 1 ?
          record.target : record.target.parentElement;
        var el = target && target.closest(".ar-marquee");
        if (el && states.has(el)) states.get(el).dirty = true;
      });
      schedule(false);
    });
    observeDOM();

    window.addEventListener("resize", function () { schedule(true); }, { passive: true });
    window.addEventListener("scroll", function () { schedule(false); }, {
      passive: true, capture: true
    });
    window.addEventListener("load", function () { schedule(true); });
    window.addEventListener("pageshow", function () { schedule(true); });
    document.addEventListener("visibilitychange", function () {
      states.forEach(syncPlayback);
      schedule(false);
    });

    function motionChanged() {
      states.forEach(function (state) {
        if (state.tween) state.tween.pause();
      });
      schedule(true);
    }
    if (motion.addEventListener) motion.addEventListener("change", motionChanged);
    else motion.addListener(motionChanged);

    if (document.fonts) {
      document.fonts.ready.then(function () { schedule(true); });
      if (document.fonts.addEventListener) {
        document.fonts.addEventListener("loadingdone", function () { schedule(true); });
      }
    }

    // A single shared visibility observer handles viewport changes independently
    // of ScrollTrigger initialization and smooth-scroll timing.
    if (window.IntersectionObserver) {
      var visibility = new IntersectionObserver(function () {
        states.forEach(syncPlayback);
      });
      var originalCreate = createState;
      createState = function (el, track) {
        var state = originalCreate(el, track);
        visibility.observe(el);
        return state;
      };
      var originalDispose = dispose;
      dispose = function (state) {
        visibility.unobserve(state.el);
        originalDispose(state);
      };
    }

    schedule(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
