/* al-ryum-project-detail.js — singleton project viewer.
   Single-screen cinematic layout: the image IS the page. Nothing scrolls except the
   filmstrip (horizontal) and the optional details sheet (which owns its own scroll).
   The React route /projects/:id renders the projects index underneath; this overlay is
   the one and only project presentation. */
(function () {
  "use strict";
  if (window.__alryumProjectDetail) return;
  window.__alryumProjectDetail = true;

  var DATA_URL = new URL("/assets/projects-data.json", location.origin).href;
  var PROFILES_URL = new URL("/assets/project-profiles.json", location.origin).href;
  var HISTORY_KEY = "__alryumProjectDetailEntry";
  var HISTORY_SHEET = "__alryumSheetOpen";
  var lastHref = location.href;
  var sheetBackGuard = false;
  var dataPromise = null;
  var profilesPromise = null;
  var profiles = null;
  var allProjects = [];
  var overlay = null;
  var overlayEl = null;
  var currentList = [];
  var currentIndex = 0;
  var project = null;
  var projectName = "";
  var requestVersion = 0;
  var heroToken = 0;
  var activeLayer = 0;
  var layers = [];
  var active = false;
  var panelOpen = false;
  var fullView = false;
  var panelBeforeFull = true;   // restore the details sheet when full view ends
  var hovering = false;
  var autoplayTimer = null;
  var AUTOPLAY_MS = 5000;   // matches the reference site's data-autoplaytime
  // Below this natural width an image is shown framed at native scale instead of being
  // stretched full-bleed (archive photographs are often only 520-1100px wide).
  var HERO_MIN_WIDTH = 1400;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var lock = null;
  var lenisSnapshot = null;
  var returnFocus = null;
  var background = [];
  var backgroundObserver = null;
  var originalPush = history.pushState;
  var originalReplace = history.replaceState;

  function text(value, fallback) {
    return value === null || value === undefined || value === ""
      ? (fallback || "") : String(value);
  }

  function routeId(url) {
    var match = url.pathname.match(/^\/projects\/(\d+)\/?$/);
    return match ? match[1] : null;
  }

  function currentRouteId() {
    return routeId(new URL(location.href));
  }

  function sameId(a, b) {
    return /^\d+$/.test(String(a)) && /^\d+$/.test(String(b)) &&
      String(a).replace(/^0+(?=\d)/, "") === String(b).replace(/^0+(?=\d)/, "");
  }

  function findProject(data, id) {
    return data.find(function (item) { return sameId(item.id, id); });
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL, { credentials: "same-origin" })
        .then(function (response) {
          if (!response.ok) throw new Error("Project data: HTTP " + response.status);
          return response.json();
        })
        .then(function (data) {
          if (!Array.isArray(data)) throw new Error("Invalid project data");
          allProjects = data.filter(function (item) {
            return item && typeof item === "object" && /^\d+$/.test(String(item.id));
          });
          return allProjects;
        })
        .catch(function (error) {
          dataPromise = null;
          throw error;
        });
    }
    return dataPromise;
  }

  function loadProfiles() {
    if (!profilesPromise) {
      profilesPromise = fetch(PROFILES_URL, { credentials: "same-origin" })
        .then(function (response) {
          if (!response.ok) throw new Error("Profiles: HTTP " + response.status);
          return response.json();
        })
        .then(function (json) { profiles = json; return json; })
        .catch(function () { profiles = null; return null; });
    }
    return profilesPromise;
  }

  function profileFor(project) {
    if (!profiles) return null;
    var key = text(project && project.industry, "");
    return (profiles.industries && profiles.industries[key]) || profiles.default || null;
  }

  function assetUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      var url = new URL(value.trim(), location.origin + "/");
      return /^(https?:)$/.test(url.protocol) ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function lenisOff() {
    var instance = window.lenis;
    if (!instance || typeof instance.destroy !== "function") return;
    var snapshot = {
      options: Object.assign({}, instance.options || {}),
      Constructor: typeof window.Lenis === "function" ? window.Lenis : instance.constructor,
      stopped: !!instance.isStopped
    };
    try {
      instance.destroy();
      lenisSnapshot = snapshot;
      if (window.lenis === instance) window.lenis = null;
    } catch (error) {
      lenisSnapshot = null;
    }
  }

  function lenisOn() {
    var saved = lenisSnapshot;
    lenisSnapshot = null;
    if (!saved || window.lenis || typeof saved.Constructor !== "function") return;
    try {
      window.lenis = new saved.Constructor(saved.options);
      if (saved.stopped && typeof window.lenis.stop === "function") window.lenis.stop();
    } catch (error) {
      // Native scrolling remains usable if Lenis cannot be recreated.
    }
  }

  function focusElement(node) {
    if (!node || typeof node.focus !== "function") return;
    try { node.focus({ preventScroll: true }); }
    catch (error) { node.focus(); }
  }

  function isolateBackground() {
    Array.prototype.forEach.call(document.body.children, function (node) {
      if (node === overlayEl || /^(SCRIPT|STYLE|LINK)$/.test(node.tagName)) return;
      if (background.some(function (entry) { return entry.node === node; })) return;
      background.push({
        node: node,
        inert: node.getAttribute("inert"),
        hidden: node.getAttribute("aria-hidden")
      });
      node.setAttribute("inert", "");
      node.setAttribute("aria-hidden", "true");
    });
  }

  function restoreBackground() {
    if (backgroundObserver) backgroundObserver.disconnect();
    backgroundObserver = null;
    background.forEach(function (entry) {
      ["inert", "aria-hidden"].forEach(function (attribute) {
        var value = attribute === "inert" ? entry.inert : entry.hidden;
        if (value === null) entry.node.removeAttribute(attribute);
        else entry.node.setAttribute(attribute, value);
      });
    });
    background = [];
  }

  function el(selector) { return overlay ? overlay.querySelector(selector) : null; }

  function template() {
    return ''
      + '<div class="ar-pd-backdrop" data-ar-pd-close></div>'
      + '<figure class="ar-pd-stage">'
      + '  <img class="ar-pd-hero ar-pd-hero--a is-active" data-ar-pd-hero-a alt="" decoding="async" />'
      + '  <img class="ar-pd-hero ar-pd-hero--b" data-ar-pd-hero-b alt="" decoding="async" />'
      + '  <div class="ar-pd-vignette"></div>'
      + '  <div class="ar-pd-scrim"></div>'
      + '  <div class="ar-pd-frame-line"></div>'
      + '  <button class="ar-pd-expand" type="button" data-ar-pd-expand aria-label="Enlarge the photograph">'
      + '    <span class="ar-pd-expand-arrows" aria-hidden="true"><i class="ar-pd-expand-tr">\u2197</i><i class="ar-pd-expand-bl">\u2199</i></span>'
      + '    <span class="ar-pd-expand-label">Enlarge</span>'
      + '  </button>'
      + '</figure>'
      + '<header class="ar-pd-top">'
      + '  <span class="ar-pd-eyebrow" data-ar-pd-eyebrow></span>'
      + '  <h2 class="ar-pd-title" data-ar-pd-title></h2>'
      + '</header>'
      + '<button class="ar-pd-side ar-pd-side--prev" type="button" data-ar-pd-prev aria-label="Previous project">'
      + '  <span class="ar-pd-side-arrow">\u2190</span>'
      + '  <span class="ar-pd-side-name" data-ar-pd-prev-name></span>'
      + '</button>'
      + '<button class="ar-pd-side ar-pd-side--next" type="button" data-ar-pd-next aria-label="Next project">'
      + '  <span class="ar-pd-side-name" data-ar-pd-next-name></span>'
      + '  <span class="ar-pd-side-arrow">\u2192</span>'
      + '</button>'
      + '<div class="ar-pd-dock">'
      + '  <div class="ar-pd-brief">'
      + '    <div class="ar-pd-line"><span data-ar-pd-location></span><i></i><span data-ar-pd-year></span><i></i><span data-ar-pd-status></span></div>'
      + '    <p class="ar-pd-note" data-ar-pd-note></p>'
      + '    <button class="ar-pd-more" type="button" data-ar-pd-more>Full details</button>'
      + '  </div>'
      + '  <div class="ar-pd-film">'
      + '    <div class="ar-pd-film-strip" data-ar-pd-thumbs></div>'
      + '    <div class="ar-pd-film-meta"><span class="ar-pd-count" data-ar-pd-count aria-live="polite"></span><span class="ar-pd-pos"><i data-ar-pd-pos></i></span></div>'
      + '  </div>'
      + '</div>'
      + '<aside class="ar-pd-sheet" data-ar-pd-sheet aria-hidden="true">'
      + '  <button class="ar-pd-sheet-close" type="button" data-ar-pd-sheet-close aria-label="Close details">\u2715</button>'
      + '  <span class="ar-pd-eyebrow" data-ar-pd-sheet-eyebrow></span>'
      + '  <h3 class="ar-pd-sheet-title" data-ar-pd-sheet-title></h3>'
      + '  <p class="ar-pd-sheet-body" data-ar-pd-sheet-body></p>'
      + '  <dl class="ar-pd-sheet-facts" data-ar-pd-sheet-facts></dl>'
      + '  <section class="ar-pd-block" data-ar-pd-block-scope>'
      + '    <h4 class="ar-pd-block-title" data-ar-pd-scope-title>Scope of works</h4>'
      + '    <p class="ar-pd-block-sub" data-ar-pd-scope-sub></p>'
      + '    <ul class="ar-pd-list" data-ar-pd-scope-list></ul>'
      + '  </section>'
      + '  <section class="ar-pd-block ar-pd-block-concepts" data-ar-pd-block-concepts style="display:none">'
      + '    <h4 class="ar-pd-block-title">Architectural visualisation</h4>'
      + '    <p class="ar-pd-block-sub" data-ar-pd-concepts-sub></p>'
      + '    <div class="ar-pd-concept-grid" data-ar-pd-concepts></div>'
      + '  </section>'
      + '  <section class="ar-pd-block" data-ar-pd-block-approach>'
      + '    <h4 class="ar-pd-block-title">Our approach</h4>'
      + '    <p class="ar-pd-block-body" data-ar-pd-approach></p>'
      + '  </section>'
      + '  <section class="ar-pd-block">'
      + '    <h4 class="ar-pd-block-title">Standards &amp; compliance</h4>'
      + '    <ul class="ar-pd-chips" data-ar-pd-standards></ul>'
      + '  </section>'
      + '</aside>'
      + '<button class="ar-pd-full" type="button" data-ar-pd-full aria-pressed="false" aria-label="Show the photograph full view">'
      + '  <span class="ar-pd-full-arrows" aria-hidden="true">\u2303\u2304</span>'
      + '  <span class="ar-pd-full-label" data-ar-pd-full-label>Full view</span>'
      + '</button>'
      + '<button class="ar-pd-close" type="button" data-ar-pd-close aria-label="Close project">\u2715</button>';
  }

  function buildOverlay() {
    if (overlay && overlay.isConnected) return;
    document.querySelectorAll(".ar-pd-overlay").forEach(function (node) { node.remove(); });
    overlayEl = document.createElement("div");
    overlayEl.className = "ar-pd-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.setAttribute("aria-label", "Project details");
    overlayEl.setAttribute("tabindex", "-1");
    overlayEl.setAttribute("data-lenis-prevent", "");
    overlayEl.innerHTML = template();
    overlay = overlayEl;

    layers = [el("[data-ar-pd-hero-a]"), el("[data-ar-pd-hero-b]")];

    overlay.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      // With the details sheet open, a click on the photograph or backdrop closes the sheet —
      // and only the sheet. The overlay's own controls still act on the first click.
      if (panelOpen) {
        var control = target.closest(
          "[data-ar-pd-sheet], .ar-pd-close, [data-ar-pd-full], [data-ar-pd-prev], [data-ar-pd-next], [data-ar-pd-more], [data-ar-pd-image-index]"
        );
        if (!control) {
          setPanel(false);
          return;
        }
      }
      if (target.closest("[data-ar-pd-sheet-close]")) { setPanel(false); return; }
      if (target.closest("[data-ar-pd-more]")) { setPanel(!panelOpen); return; }
      if (target.closest("[data-ar-pd-full]")) { setFullView(!fullView); return; }
      if (target.closest("[data-ar-pd-close]")) { close(); return; }
      if (target.closest("[data-ar-pd-prev]")) { if (fullView) stepImage(-1); else stepProject(-1); return; }
      if (target.closest("[data-ar-pd-next]")) { if (fullView) stepImage(1); else stepProject(1); return; }
      var tile = target.closest("[data-ar-pd-image-index]");
      if (tile) selectImage(Number(tile.getAttribute("data-ar-pd-image-index")));
    });

    var stage = el(".ar-pd-stage");
    if (stage) {
      stage.addEventListener("mouseenter", function () {
        overlay.classList.add("is-hot");
        hovering = true;
      });
      stage.addEventListener("mouseleave", function () {
        overlay.classList.remove("is-hot");
        hovering = false;
      });
      stage.addEventListener("click", function (event) {
        // while the details sheet is open this click belongs to the sheet's close guard
        if (panelOpen) return;
        var t = event.target instanceof Element ? event.target : null;
        if (t && t.closest("[data-ar-pd-expand]")) {
          event.preventDefault();
          event.stopPropagation();
          setFullView(!fullView);
          return;
        }
        // clicking the bare photograph also enlarges, then restores
        setFullView(!fullView);
      });
    }

    document.body.appendChild(overlay);
  }

  function setFullView(on) {
    var next = !!on;
    // Full view is the photograph alone: tuck the details away, and bring them back after.
    if (next && !fullView) { panelBeforeFull = panelOpen; if (panelOpen) setPanel(false); }
    else if (!next && fullView && panelBeforeFull) applyPanel(true);
    fullView = next;
    if (!overlay) return;
    overlay.classList.toggle("is-full", fullView);
    syncSideControls();
    var button = el("[data-ar-pd-full]");
    var label = el("[data-ar-pd-full-label]");
    if (button) button.setAttribute("aria-pressed", String(fullView));
    if (label) label.textContent = fullView ? "Exit full view" : "Full view";
  }

  // UI only — never touches history. Used by render()/dispose().
  function applyPanel(open) {
    panelOpen = !!open;
    if (panelOpen) stopAutoplay(); else startAutoplay();
    if (!overlay) return;
    overlay.classList.toggle("is-panel-open", panelOpen);
    var sheet = el("[data-ar-pd-sheet]");
    if (sheet) sheet.setAttribute("aria-hidden", String(!panelOpen));
    var more = el("[data-ar-pd-more]");
    if (more) more.textContent = panelOpen ? "Hide details" : "Full details";
  }

  function stateWithSheet(open) {
    var state = history.state && typeof history.state === "object" && !Array.isArray(history.state)
      ? Object.assign({}, history.state) : {};
    if (open) state[HISTORY_SHEET] = true;
    else delete state[HISTORY_SHEET];
    return state;
  }

  // User-driven toggle: the sheet gets its own history step so Back closes it.
  function setPanel(open) {
    var next = !!open;
    if (next === panelOpen) return;
    applyPanel(next);
    if (next) {
      sheetBackGuard = true;
      originalPush.call(history, stateWithSheet(true), "", location.href);
      sheetBackGuard = false;
      lastHref = location.href;
    } else if (history.state && history.state[HISTORY_SHEET]) {
      sheetBackGuard = true;          // our own step back; popstate must ignore it
      history.back();
      sheetBackGuard = false;
    }
  }

  function activate() {
    buildOverlay();
    if (!active) {
      active = true;
      returnFocus = document.activeElement;
      lock = {
        x: window.scrollX,
        y: window.scrollY,
        top: document.body.style.getPropertyValue("top"),
        topPriority: document.body.style.getPropertyPriority("top"),
        htmlLocked: document.documentElement.classList.contains("ar-pd-html-locked"),
        bodyLocked: document.body.classList.contains("ar-pd-locked")
      };
      lenisOff();
      document.documentElement.classList.add("ar-pd-html-locked");
      document.body.style.setProperty("top", "-" + lock.y + "px");
      document.body.classList.add("ar-pd-locked");
      focusElement(el("[data-ar-pd-close]"));
      isolateBackground();
      backgroundObserver = new MutationObserver(function () {
        if (!overlayEl.isConnected) document.body.appendChild(overlayEl);
        isolateBackground();
      });
      backgroundObserver.observe(document.body, { childList: true });
    }
    overlayEl.classList.add("is-open");
  }

  function dispose(restoreScroll, restoreFocus) {
    stopAutoplay();
    heroToken++;
    currentList = [];
    currentIndex = 0;
    project = null;
    panelOpen = false;
    layers = [];
    restoreBackground();
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
      overlay = null;
    }
    if (!active) return;
    active = false;
    document.documentElement.classList.toggle("ar-pd-html-locked", lock.htmlLocked);
    document.body.classList.toggle("ar-pd-locked", lock.bodyLocked);
    if (lock.top) document.body.style.setProperty("top", lock.top, lock.topPriority);
    else document.body.style.removeProperty("top");
    lenisOn();
    if (restoreScroll) {
      var rootStyle = document.documentElement.style;
      var behavior = rootStyle.getPropertyValue("scroll-behavior");
      var priority = rootStyle.getPropertyPriority("scroll-behavior");
      rootStyle.setProperty("scroll-behavior", "auto", "important");
      window.scrollTo(lock.x, lock.y);
      if (behavior) rootStyle.setProperty("scroll-behavior", behavior, priority);
      else rootStyle.removeProperty("scroll-behavior");
    }
    if (restoreFocus && returnFocus && returnFocus.isConnected) focusElement(returnFocus);
    returnFocus = null;
    lock = null;
  }

  function updateGalleryState() {
    var count = el("[data-ar-pd-count]");
    if (count) count.textContent = (currentList.length ? currentIndex + 1 : 0) + " / " + currentList.length;
    if (fullView) syncSideControls();
    var pos = el("[data-ar-pd-pos]");
    if (pos) {
      var ratio = currentList.length > 1 ? currentIndex / (currentList.length - 1) : 1;
      pos.style.transform = "scaleX(" + Math.max(0.06, ratio).toFixed(3) + ")";
    }
    if (!overlay) return;
    overlay.querySelectorAll("[data-ar-pd-image-index]").forEach(function (button, index) {
      var on = index === currentIndex;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-current", on ? "true" : "false");
      if (on) {
        // Scroll ONLY the filmstrip. scrollIntoView() also walks every scrollable
        // ancestor and was shifting the whole overlay sideways.
        var strip = button.parentElement;
        if (strip && typeof strip.scrollTo === "function") {
          var target = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2;
          try { strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" }); }
          catch (error) { strip.scrollLeft = Math.max(0, target); }
        }
      }
    });
  }

  // Crossfade between two stacked layers so swapping images never flashes.
  function showImage(src) {
    if (!src || !layers.length) return;
    var token = ++heroToken;
    var next = layers[1 - activeLayer];
    var prev = layers[activeLayer];
    if (!next || !prev) return;
    var loader = new Image();
    loader.decoding = "async";
    loader.onload = function () {
      if (token !== heroToken || !overlay) return;
      next.src = src;
      next.alt = projectName ? projectName + " — image " + (currentIndex + 1) : "";
      // small archive images keep their own scale; the blurred plate carries the frame
      var framed = loader.naturalWidth < HERO_MIN_WIDTH;
      overlay.classList.toggle("is-framed", framed);
      var stage = el(".ar-pd-stage");
      if (stage) stage.style.backgroundImage = framed ? 'url("' + src + '")' : "";
      requestAnimationFrame(function () {
        next.classList.add("is-active");
        prev.classList.remove("is-active");
        activeLayer = 1 - activeLayer;
      });
    };
    loader.onerror = function () {
      if (token !== heroToken || !overlay) return;
      currentList.splice(currentIndex, 1);
      currentIndex = Math.min(currentIndex, Math.max(0, currentList.length - 1));
      renderFilm();
      showImage(currentList[currentIndex]);
      updateGalleryState();
    };
    loader.src = src;
  }

  function renderFilm() {
    var host = el("[data-ar-pd-thumbs]");
    if (!host) return;
    host.textContent = "";
    currentList.forEach(function (src, index) {
      var button = document.createElement("button");
      button.className = "ar-pd-frame";
      button.type = "button";
      button.setAttribute("data-ar-pd-image-index", String(index));
      button.setAttribute("aria-label", "Show image " + (index + 1));
      var image = document.createElement("img");
      image.alt = "";
      image.loading = index < 10 ? "eager" : "lazy";
      image.decoding = "async";
      image.onerror = function () { image.style.visibility = "hidden"; };
      image.src = src;
      button.appendChild(image);
      host.appendChild(button);
    });
  }

  function stopAutoplay() {
    if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
  }

  function startAutoplay() {
    stopAutoplay();
    if (motion.matches || currentList.length < 2) return;
    autoplayTimer = setInterval(function () {
      if (!active || panelOpen || hovering || !overlay) return;
      stepImage(1);
    }, AUTOPLAY_MS);
  }

  function selectImage(index) {
    if (!currentList[index]) return;
    currentIndex = index;
    showImage(currentList[currentIndex]);
    updateGalleryState();
    startAutoplay();
  }

  function stepImage(direction) {
    if (currentList.length < 2) return;
    selectImage((currentIndex + direction + currentList.length) % currentList.length);
  }

  function neighbour(offset) {
    if (!project || allProjects.length < 2) return null;
    var ordered = allProjects.slice().sort(function (a, b) { return Number(a.id) - Number(b.id); });
    var i = ordered.findIndex(function (p) { return sameId(p.id, project.id); });
    if (i === -1) return null;
    return ordered[(i + offset + ordered.length) % ordered.length];
  }

  function renderNeighbours() {
    [[-1, "[data-ar-pd-prev]", "[data-ar-pd-prev-name]"],
     [1, "[data-ar-pd-next]", "[data-ar-pd-next-name]"]].forEach(function (spec) {
      var button = el(spec[1]);
      var label = el(spec[2]);
      var other = neighbour(spec[0]);
      if (!button || !label) return;
      if (!other) { button.style.display = "none"; return; }
      button.style.display = "";
      label.textContent = text(other.name, "Project");
      button.setAttribute("data-ar-pd-target", String(other.id));
      button.setAttribute("aria-label", spec[0] === -1 ? "Previous project" : "Next project");
    });
  }

  // Enlarged = lightbox semantics: the arrows walk the gallery. Otherwise they walk projects.
  function syncSideControls() {
    var prev = el("[data-ar-pd-prev]");
    var next = el("[data-ar-pd-next]");
    if (!prev || !next) return;
    var prevLabel = el("[data-ar-pd-prev-name]");
    var nextLabel = el("[data-ar-pd-next-name]");
    if (fullView) {
      var counter = "Image " + (currentList.length ? currentIndex + 1 : 0) + " / " + currentList.length;
      if (prevLabel) prevLabel.textContent = counter;
      if (nextLabel) nextLabel.textContent = counter;
      prev.setAttribute("aria-label", "Previous image");
      next.setAttribute("aria-label", "Next image");
      var many = currentList.length > 1;
      prev.style.display = many ? "" : "none";
      next.style.display = many ? "" : "none";
    } else {
      renderNeighbours();
    }
  }

  function stepProject(direction) {
    var other = neighbour(direction);
    if (!other) return;
    navigateToProject(other.id);
  }

  function factsFor(next) {
    var list = [
      ["Location", text(next.location, "—")],
      ["Client", text(next.client, "Al Ryum Group")],
      ["Year completed", text(next.year, "—")],
      ["Contract value", text(next.value, "—") === "-" ? "On request" : text(next.value, "On request")],
      ["Industry", text(next.industry, "—")],
      ["Sector", text(next.sector, "—")],
      ["Status", text(next.status, "—")]
    ];
    // only shown when the company profile records them
    var consultant = text(next.consultant, "");
    if (consultant) list.splice(3, 0, ["Consultant", consultant]);
    var programme = text(next.programme, "");
    if (programme) list.push(["Programme", programme]);
    return list;
  }

  function render(next) {
    project = next;
    projectName = text(next.name);
    overlayEl.setAttribute("aria-label", projectName || "Project details");
    var eyebrow = [text(next.industry), text(next.sector)].filter(Boolean).join(" \u00b7 ");
    el("[data-ar-pd-eyebrow]").textContent = eyebrow.toUpperCase();
    el("[data-ar-pd-sheet-eyebrow]").textContent = eyebrow.toUpperCase();
    el("[data-ar-pd-title]").textContent = projectName;
    el("[data-ar-pd-sheet-title]").textContent = projectName;
    el("[data-ar-pd-location]").textContent = text(next.location, "—");
    el("[data-ar-pd-year]").textContent = text(next.year, "") === "-" ? "" : text(next.year, "");
    el("[data-ar-pd-status]").textContent = text(next.status, "");
    var desc = text(next.description, "");
    el("[data-ar-pd-note]").textContent = desc;
    el("[data-ar-pd-sheet-body]").textContent = desc;

    var list = el("[data-ar-pd-sheet-facts]");
    list.textContent = "";
    factsFor(next).forEach(function (pair) {
      // each fact is one cell so the sheet can lay them out side by side
      var cell = document.createElement("div");
      cell.className = "ar-pd-fact-cell";
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      cell.appendChild(dt);
      cell.appendChild(dd);
      list.appendChild(cell);
    });

    renderSheetExtras(next);

    currentList = [];
    var images = Array.isArray(next.images) ? next.images : [];
    images.forEach(function (value) {
      var src = assetUrl(value);
      if (src && currentList.indexOf(src) === -1) currentList.push(src);
    });
    if (!currentList.length) {
      var fallback = assetUrl(next.image);
      if (fallback) currentList.push(fallback);
    }
    currentIndex = 0;
    // Every project opens with its full details showing (no history step of its own,
    // so Back still leaves the project in one press).
    fullView = false;
    setFullView(false);
    applyPanel(true);
    renderFilm();
    showImage(currentList[0]);
    updateGalleryState();
    renderNeighbours();
    startAutoplay();
  }

  function fillList(host, items, className) {
    if (!host) return;
    host.textContent = "";
    (items || []).forEach(function (value) {
      var li = document.createElement("li");
      if (className) li.className = className;
      li.textContent = value;
      host.appendChild(li);
    });
  }

  function renderSheetExtras(next) {
    var profile = profileFor(next);
    var scopeBlock = el("[data-ar-pd-block-scope]");
    var scopeList = el("[data-ar-pd-scope-list]");
    var scopeSub = el("[data-ar-pd-scope-sub]");
    var title = el("[data-ar-pd-scope-title]");
    // the project's own scope (company profile) always wins over the sector capability list
    var own = (next && Object.prototype.toString.call(next.scope) === "[object Array]" && next.scope.length)
      ? next.scope : null;
    var scope = own || (profile && profile.scope ? profile.scope : []);
    if (scopeList && scope.length) {
      fillList(scopeList, scope);
      if (title) title.textContent = own ? "Scope of works" : "Capability in this sector";
      if (scopeSub) {
        scopeSub.textContent = own
          ? "As recorded in the Al Ryum company profile for this project."
          : "Capability applied across our " + text(next.industry, "built environment") +
            " portfolio — detailed scope on request.";
      }
      if (scopeBlock) scopeBlock.style.display = "";
    } else if (scopeBlock) {
      scopeBlock.style.display = "none";
    }

    var approachBlock = el("[data-ar-pd-block-approach]");
    var approach = el("[data-ar-pd-approach]");
    var approachText = profile && profile.approach ? profile.approach : "";
    if (approach) approach.textContent = approachText;
    if (approachBlock) approachBlock.style.display = approachText ? "" : "none";

    fillList(el("[data-ar-pd-standards]"), (profiles && profiles.standards) || [], "ar-pd-chip");

    // Architectural visualisations: AI-generated concepts, kept visibly separate from site photography.
    var cBlock = el("[data-ar-pd-block-concepts]");
    var cHost = el("[data-ar-pd-concepts]");
    var cSub = el("[data-ar-pd-concepts-sub]");
    // When the project's own images ARE the visualisations (image swap applied), the separate block is
    // redundant — showing it would put the same picture on screen twice, captioned against itself.
    var swapped = !!(next && next.imagesAreConcept);
    var concepts = (!swapped && next && Object.prototype.toString.call(next.concepts) === "[object Array]") ? next.concepts : [];
    if (cBlock && cHost) {
      cHost.textContent = "";
      if (concepts.length) {
        concepts.forEach(function (c) {
          var fig = document.createElement("figure");
          fig.className = "ar-pd-concept";
          var img = document.createElement("img");
          img.src = assetUrl(c.src);
          img.alt = text(c.label, projectName) + " \u2014 concept visualisation";
          img.loading = "lazy";
          img.decoding = "async";
          var cap = document.createElement("figcaption");
          var strong = document.createElement("strong");
          strong.textContent = text(c.label, projectName);
          var em = document.createElement("em");
          em.textContent = "Concept visualisation \u00b7 AI-generated \u00b7 not site photography";
          cap.appendChild(strong);
          cap.appendChild(em);
          fig.appendChild(img);
          fig.appendChild(cap);
          cHost.appendChild(fig);
        });
        if (cSub) cSub.textContent = "Design-intent images generated from this project's own site photographs. These are not photographs of the built works.";
        cBlock.style.display = "";
      } else {
        cBlock.style.display = "none";
      }
    }

  }

  function showMessage(title, description, busy) {
    activate();
    render({ name: title, description: description, images: [] });
    overlayEl.setAttribute("aria-busy", String(!!busy));
  }

  function syncRoute(restoreScroll) {
    var version = ++requestVersion;
    var id = currentRouteId();
    if (id === null) {
      dispose(restoreScroll !== false, restoreScroll !== false);
      return;
    }
    showMessage("Loading project…", "", true);
    Promise.all([loadData(), loadProfiles()]).then(function (results) {
      var data = results[0];
      if (version !== requestVersion || currentRouteId() !== id) return;
      var found = findProject(data, id);
      if (!found) {
        showMessage("Project not found", "This project is unavailable. Close this view to return to projects.", false);
        return;
      }
      render(found);
      overlayEl.setAttribute("aria-busy", "false");
    }).catch(function () {
      if (version !== requestVersion || currentRouteId() !== id) return;
      showMessage("Unable to load project", "Please check your connection and try again.", false);
    });
  }

  function stateWithEntry(entry) {
    var state = history.state;
    var result = state && typeof state === "object" && !Array.isArray(state)
      ? Object.assign({}, state) : {};
    delete result[HISTORY_KEY];
    delete result[HISTORY_SHEET];
    if (entry) result[HISTORY_KEY] = entry;
    return result;
  }

  function navigateToProject(id) {
    var path = "/projects/" + encodeURIComponent(String(id));
    if (currentRouteId() !== null && sameId(currentRouteId(), id)) {
      syncRoute();
      return;
    }
    var entry = history.state && history.state[HISTORY_KEY];
    if (currentRouteId() === null) {
      entry = { returnUrl: location.pathname + location.search + location.hash };
    }
    originalPush.call(history, stateWithEntry(entry), "", path);
    // Record the new URL: without this, Back to the previous project looked like a
    // same-URL (details-sheet) step and the old project stayed on screen.
    lastHref = location.href;
    syncRoute();
  }

  function close() {
    ++requestVersion;
    var entry = history.state && history.state[HISTORY_KEY];
    var destination = "/projects";
    if (entry && typeof entry.returnUrl === "string") {
      try {
        var url = new URL(entry.returnUrl, location.origin);
        if (url.origin === location.origin && routeId(url) === null) {
          destination = url.pathname + url.search + url.hash;
        }
      } catch (error) { /* Use the projects index. */ }
    }
    if (currentRouteId() !== null) {
      history.replaceState(stateWithEntry(null), "", destination);
    } else {
      dispose(true, true);
    }
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var target = event.target instanceof Element ? event.target : null;
    if (!target || (overlayEl && overlayEl.contains(target))) return;
    var card = target.closest(".ar-showcase-card");
    if (!card && event.detail > 0 && document.elementFromPoint) {
      var hit = document.elementFromPoint(event.clientX, event.clientY);
      card = hit && hit.closest(".ar-showcase-card");
    }
    var link = target.closest("a[href]");
    if (link && (link.hasAttribute("download") ||
        (link.target && link.target.toLowerCase() !== "_self"))) return;
    if (!link && card) link = card.querySelector("a[href]");
    if (link && (link.hasAttribute("download") ||
        (link.target && link.target.toLowerCase() !== "_self"))) return;
    var id = null;
    if (link) {
      try {
        var url = new URL(link.getAttribute("href"), document.baseURI);
        if (url.origin !== location.origin) return;
        id = routeId(url);
      } catch (error) { return; }
    }
    if (id === null && !card) return;
    if (id === null && target.closest("button,input,select,textarea,[contenteditable]")) return;
    var title = card && card.querySelector(".ar-showcase-card__title");
    var name = title ? title.textContent.trim() : "";
    if (id === null && !name) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (id !== null) {
      navigateToProject(id);
      return;
    }
    var version = ++requestVersion;
    var sourceUrl = location.href;
    loadData().then(function (data) {
      if (version !== requestVersion || sourceUrl !== location.href) return;
      var found = data.find(function (item) { return text(item.name).trim() === name; });
      if (found) navigateToProject(found.id);
    }).catch(function () {
      if (version === requestVersion && sourceUrl === location.href) {
        showMessage("Unable to load project", "Please check your connection and try again.", false);
      }
    });
  }

  function onKeydown(event) {
    if (!active || !overlayEl) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (panelOpen) setPanel(false);
      else close();
      return;
    }
    if (event.key === "ArrowLeft") { event.preventDefault(); stepImage(-1); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); stepImage(1); return; }
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      stepProject(event.key === "ArrowUp" || event.key === "PageUp" ? -1 : 1);
      return;
    }
    if (event.key === "i" || event.key === "I") { event.preventDefault(); setPanel(!panelOpen); return; }
    if (event.key === "f" || event.key === "F") { event.preventDefault(); setFullView(!fullView); return; }
    if (event.key !== "Tab") return;
    var focusable = Array.prototype.filter.call(
      overlayEl.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]'),
      function (node) { return node.getClientRects().length > 0; }
    );
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (!first) {
      event.preventDefault();
      focusElement(overlayEl);
    } else if (!overlayEl.contains(document.activeElement) ||
        (event.shiftKey && (document.activeElement === first || document.activeElement === overlayEl))) {
      event.preventDefault();
      focusElement(event.shiftKey ? last : first);
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      focusElement(first);
    }
  }

  function init() {
    history.pushState = function () {
      var before = location.href;
      var result = originalPush.apply(this, arguments);
      lastHref = location.href;
      if (location.href !== before) syncRoute(false);
      return result;
    };
    history.replaceState = function () {
      var before = location.href;
      var result = originalReplace.apply(this, arguments);
      lastHref = location.href;
      if (location.href !== before) syncRoute(currentRouteId() === null);
      return result;
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("focusin", function (event) {
      if (active && overlayEl && !overlayEl.contains(event.target)) {
        focusElement(el("[data-ar-pd-close]"));
      }
    });
    window.addEventListener("popstate", function () {
      if (sheetBackGuard) return;
      var state = history.state && typeof history.state === "object" ? history.state : {};
      var sameUrl = location.href === lastHref;   // same URL = this step was about the sheet
      lastHref = location.href;
      if (sameUrl) {
        if (panelOpen && !state[HISTORY_SHEET]) applyPanel(false);
        else if (!panelOpen && state[HISTORY_SHEET]) applyPanel(true);
        return;
      }
      applyPanel(false);
      syncRoute(true);
    });
    window.addEventListener("pagehide", function () {
      ++requestVersion;
      dispose(true, false);
    });
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) syncRoute(true);
    });
    document.querySelectorAll(".ar-pd-overlay").forEach(function (node) { node.remove(); });
    syncRoute(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
