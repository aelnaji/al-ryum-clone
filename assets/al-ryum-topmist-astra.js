/* ==== AL RYUM @astra ==== top-opening seamless mist loop. CANDIDATE - disconnect: remove script from index + delete file. */

/* al-ryum-hero-mist-astra.js
 *
 * Drop-in contract:
 *   Video:   #hero-mist
 *   Source:  /assets/seamless-mist-loop.mp4
 *   Guard:   window.__alryumMist
 *   Cleanup: window.__alryumMist.destroy()
 *
 * Optional, explicit integration hooks:
 *   [data-alryum-hero]            Hero root.
 *   [data-alryum-mist-host]       Existing background container inside hero.
 *   [data-alryum-hero-content]    Foreground content inside hero.
 *
 * The video starts loading/playing immediately upon attachment; scroll never
 * controls playback. Actual first-frame timing depends on fetching/decoding
 * and browser autoplay policy. A seamless source is required for a clean loop.
 */
(function () {
  "use strict";

  if (window.__alryumMist) return;

  var SOURCE = "/assets/seamless-mist-loop.mp4";
  var REDUCED_MOTION_MODE = "pause"; // Change to "play" to retain subtle motion.
  var MAX_PLAY_RETRIES = 12;

  var destroyed = false;
  var current = null;
  var observer = null;
  var scanTimer = null;
  var retryTimer = null;
  var playTimer = null;
  var playAttempts = 0;
  var playPending = false;
  var playGeneration = 0;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var globalCleanups = [];

  var api = { destroy: destroy };
  window.__alryumMist = api;

  function listen(target, type, handler, options, cleanups) {
    target.addEventListener(type, handler, options);
    (cleanups || globalCleanups).push(function () {
      target.removeEventListener(type, handler, options);
    });
  }

  function runCleanups(cleanups) {
    while (cleanups.length) {
      try {
        cleanups.pop()();
      } catch (_) {
        // One failed cleanup must not prevent the others.
      }
    }
  }

  /* Restore only properties this module still owns. */
  function patchStyle(element, property, value, cleanups) {
    var previous = element.style.getPropertyValue(property);
    var previousPriority = element.style.getPropertyPriority(property);

    element.style.setProperty(property, value);
    var applied = element.style.getPropertyValue(property);

    cleanups.push(function () {
      if (
        element.style.getPropertyValue(property) !== applied ||
        element.style.getPropertyPriority(property) !== ""
      ) return;

      if (previous) {
        element.style.setProperty(property, previous, previousPriority);
      } else {
        element.style.removeProperty(property);
      }
    });
  }

  function usable(element) {
    if (!element || !element.isConnected) return false;
    var style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function findHero() {
    var selectors = [
      "[data-alryum-hero]",
      "#al-ryum-3d-scroll-region",
      "[id*='al-ryum-3d']",
      "section.h-screen, section[class*='h-screen']",
      "section[id*='hero'], section[class*='hero'], div[class*='hero']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var candidates = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < candidates.length; j++) {
        if (usable(candidates[j])) return candidates[j];
      }
    }

    // Do not inject into an arbitrary section while React is still mounting.
    return null;
  }

  function isOverlayHost(element) {
    if (!element || !/^(DIV|SECTION|HEADER|ASIDE)$/.test(element.tagName)) {
      return false;
    }

    var position = window.getComputedStyle(element).position;
    return position !== "fixed" && position !== "sticky";
  }

  function findHost(hero) {
    var explicit = hero.querySelector("[data-alryum-mist-host]");
    if (isOverlayHost(explicit)) return explicit;

    // Only use a direct, noninteractive background container. Never append
    // video inside canvas: canvas children are fallback content, not overlays.
    for (var i = 0; i < hero.children.length; i++) {
      var child = hero.children[i];

      if (
        child.matches("div.absolute.inset-0, .absolute.inset-0") &&
        isOverlayHost(child) &&
        !child.querySelector(
          "h1,h2,p,a,button,input,nav,[role='button'],[data-alryum-hero-content]"
        )
      ) {
        return child;
      }
    }

    return hero;
  }

  function clearPlayTimer() {
    if (playTimer !== null) {
      window.clearTimeout(playTimer);
      playTimer = null;
    }
  }

  function shouldPlay(state) {
    return (
      !destroyed &&
      current === state &&
      state.video.isConnected &&
      !document.hidden &&
      !(motion.matches && REDUCED_MOTION_MODE === "pause")
    );
  }

  function pause(state) {
    clearPlayTimer();
    playGeneration++;
    playPending = false;
    state.video.pause();
  }

  function ensurePlay(reset) {
    var state = current;
    if (!state || destroyed) return;

    if (reset) {
      playAttempts = 0;
      clearPlayTimer();
    }

    if (!shouldPlay(state)) {
      pause(state);
      return;
    }

    if (!state.video.paused || playPending || playTimer !== null) return;
    if (playAttempts >= MAX_PLAY_RETRIES) return;

    playAttempts++;
    playPending = true;
    var generation = ++playGeneration;

    function failed() {
      if (destroyed || current !== state || generation !== playGeneration) return;
      playPending = false;

      if (!shouldPlay(state) || playAttempts >= MAX_PLAY_RETRIES) return;

      clearPlayTimer();
      playTimer = window.setTimeout(function () {
        playTimer = null;
        ensurePlay(false);
      }, Math.min(500 * playAttempts, 3000));
    }

    try {
      var result = state.video.play();

      if (result && typeof result.then === "function") {
        result.then(function () {
          if (destroyed || current !== state || generation !== playGeneration) {
            return;
          }
          playPending = false;
          playAttempts = 0;
          if (!shouldPlay(state)) pause(state);
        }, failed);
      } else {
        playPending = false;
      }
    } catch (_) {
      failed();
    }
  }

  function syncMotion() {
    if (!current) return;

    current.video.style.opacity = motion.matches ? "0.45" : "0.9";

    // Setting autoplay=false also prevents a late media load from starting
    // motion after the user has requested a static opening.
    current.video.autoplay = !(
      motion.matches && REDUCED_MOTION_MODE === "pause"
    );

    ensurePlay(true);
  }

  function foregroundBranch(element, host) {
    var branch = element;
    while (branch && branch.parentElement !== host) {
      branch = branch.parentElement;
    }
    return branch && branch.parentElement === host ? branch : null;
  }

  function refreshForeground(state) {
    var host = state.host;
    var targets = [];

    if (host === state.hero) {
      // Establish a background < mist < content ordering without changing
      // transforms, sticky/fixed positioning, or any scroll listeners.
      for (var i = 0; i < host.children.length; i++) {
        var child = host.children[i];
        if (child !== state.layer) targets.push(child);
      }
    }

    var marked = host.querySelectorAll("[data-alryum-hero-content]");
    for (var j = 0; j < marked.length; j++) {
      var branch = foregroundBranch(marked[j], host);
      if (branch && targets.indexOf(branch) === -1) targets.push(branch);
    }

    targets.forEach(function (element) {
      if (state.foregrounds.has(element)) return;
      state.foregrounds.add(element);

      if (/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(element.tagName)) return;

      var style = window.getComputedStyle(element);
      if (style.position === "fixed" || style.position === "sticky") return;

      var explicitlyForeground =
        element.matches("[data-alryum-hero-content]") ||
        !!element.querySelector("[data-alryum-hero-content]");

      var background =
        !explicitlyForeground &&
        (
          element.tagName === "CANVAS" ||
          element.matches("[data-alryum-mist-host]") ||
          (
            style.position === "absolute" &&
            !element.matches("h1,h2,p,a,button,nav") &&
            !element.querySelector("h1,h2,p,a,button,nav")
          )
        );

      if (background) {
        patchStyle(element, "z-index", "0", state.cleanups);
      } else {
        if (style.position === "static") {
          patchStyle(element, "position", "relative", state.cleanups);
        }

        var z = parseInt(style.zIndex, 10);
        if (!Number.isFinite(z) || z < 2) {
          patchStyle(element, "z-index", "2", state.cleanups);
        }
      }
    });
  }

  function attach(hero) {
    // Respect an existing instance using the drop-in DOM ID.
    if (document.getElementById("hero-mist")) return;

    var host = findHost(hero);
    var layer = document.createElement("div");
    var video = document.createElement("video");
    var state = {
      hero: hero,
      host: host,
      layer: layer,
      video: video,
      foregrounds: new WeakSet(),
      cleanups: []
    };

    current = state;

    /*
     * Isolation bounds our z-index to the hero, keeping an external fixed nav
     * above it. No transform/contain/overflow changes on the cinematic root:
     * those could alter its fixed/sticky behavior.
     */
    patchStyle(hero, "isolation", "isolate", state.cleanups);
    if (window.getComputedStyle(host).position === "static") {
      patchStyle(host, "position", "relative", state.cleanups);
    }

    layer.setAttribute("data-alryum-mist-layer", "");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "max-height:100vh;overflow:hidden;pointer-events:none;" +
      "z-index:1;isolation:isolate;";

    // Cap a tall scroll-region at its opening viewport, not its entire height.
    if (window.CSS && window.CSS.supports("height", "100svh")) {
      layer.style.maxHeight = "100svh";
    }

    video.id = "hero-mist";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = !(motion.matches && REDUCED_MOTION_MODE === "pause");
    video.playsInline = true;
    video.preload = "auto";
    video.controls = false;
    video.tabIndex = -1;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute("disableremoteplayback", "");
    video.style.cssText =
      "display:block;position:absolute;inset:0;width:100%;height:100%;" +
      "object-fit:cover;object-position:center;pointer-events:none;" +
      "opacity:" + (motion.matches ? "0.45" : "0.9") + ";";

    function ready() {
      ensurePlay(true);
    }

    listen(video, "loadeddata", ready, false, state.cleanups);
    listen(video, "canplay", ready, false, state.cleanups);
    listen(video, "pause", function () {
      if (shouldPlay(state)) ensurePlay(false);
    }, false, state.cleanups);

    layer.appendChild(video);
    host.appendChild(layer);
    refreshForeground(state);

    // Assign only after muted/inline settings and readiness listeners exist.
    video.src = SOURCE;
    video.load();
    ensurePlay(true);
  }

  function detach() {
    var state = current;
    if (!state) return;

    current = null;
    clearPlayTimer();
    playGeneration++;
    playPending = false;
    playAttempts = 0;

    runCleanups(state.cleanups);
    state.video.pause();
    state.video.removeAttribute("src");
    state.video.load(); // Release the decoder/network resource.
    state.layer.remove();
  }

  function scheduleScan() {
    if (destroyed || scanTimer !== null) return;
    scanTimer = window.setTimeout(function () {
      scanTimer = null;
      scan();
    }, 0);
  }

  function scan() {
    if (destroyed) return;

    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }

    if (
      current &&
      (
        !current.hero.isConnected ||
        !current.host.isConnected ||
        !current.layer.isConnected ||
        current.video.parentElement !== current.layer
      )
    ) {
      detach();
    }

    if (current) {
      refreshForeground(current);
      return;
    }

    var hero = findHero();
    if (hero) attach(hero);

    // No finite mount deadline: React may mount after a slow route/data load.
    if (!current) {
      retryTimer = window.setTimeout(scan, 400);
    }
  }

  function resume() {
    scan();
    ensurePlay(true);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;

    if (observer) observer.disconnect();
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    scanTimer = null;
    retryTimer = null;

    runCleanups(globalCleanups);
    detach();

    if (window.__alryumMist === api) delete window.__alryumMist;
  }

  listen(document, "visibilitychange", function () {
    if (document.hidden) {
      if (current) pause(current);
    } else {
      resume();
    }
  });

  listen(window, "focus", resume);
  listen(window, "pageshow", resume);
  listen(window, "pagehide", function () {
    // Preserve the instance for BFCache restoration.
    if (current) pause(current);
  });

  // Retry denied autoplay on subsequent user interaction without consuming it.
  listen(document, "pointerdown", function () {
    ensurePlay(true);
  }, { passive: true });

  listen(document, "keydown", function () {
    ensurePlay(true);
  });

  if (typeof motion.addEventListener === "function") {
    listen(motion, "change", syncMotion);
  } else {
    motion.addListener(syncMotion);
    globalCleanups.push(function () {
      motion.removeListener(syncMotion);
    });
  }

  if (typeof MutationObserver === "function") {
    observer = new MutationObserver(scheduleScan);
    observer.observe(document, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    listen(document, "DOMContentLoaded", scheduleScan, { once: true });
  }

  // Do not wait for DOMContentLoaded if the hero is already available.
  scan();
})();
