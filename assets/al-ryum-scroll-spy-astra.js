/* ==== AL RYUM @astra ==== Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE - disconnect: remove file + revert index.html src. */

/* Al Ryum — full-page scroll-spy navigation.
   Keeps the route rail, progress line and scroll hint; chips stay disabled.
   Public guard: window.__alryumScrollSpyLoaded
   Cleanup: window.__alryumScrollSpy.destroy()
*/
(function () {
  "use strict";

  if (window.__alryumScrollSpyLoaded) return;
  window.__alryumScrollSpyLoaded = true;

  var ACCENT = "#C8A86E";
  var HOME = "/";
  var SECTIONS = [
    { label: "Home", sel: "section, div" },
    { label: "About", sel: "#about" },
    { label: "Services", sel: "#solutions" },
    { label: "GCC", sel: "#global-reach" },
    { label: "Journey", sel: "#journey" },
    { label: "Films", sel: "#arc-cinematic-host, #ar-pf-section" },
    { label: "Projects", sel: "#projects" },
    { label: "News", sel: "#news" },
    { label: "Contact", sel: "#contact" }
  ];

  var els = [], dots = [], navItems = [];
  var route = null, scrollbar = null, sb = null, hint = null;
  var active = -1, frame = 0, timer = 0;
  var started = false, destroyed = false, discoveryDirty = true;
  var mutationObserver = null, resizeObserver = null, observed = [];
  var lenis = null, lenisUnsubscribe = null, scrollTrigger = null;
  var refreshing = false, refreshFrame = 0;
  var removers = [];

  function el(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    removers.push(function () {
      target.removeEventListener(type, handler, options);
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finite(value) {
    return typeof value === "number" && isFinite(value);
  }

  function scrollY() {
    // Never use Lenis.targetScroll: it is the destination, not the viewport.
    return finite(window.scrollY) ? window.scrollY :
      (document.scrollingElement || document.documentElement).scrollTop;
  }

  function owned(node) {
    return !!node && (
      node === route || node === scrollbar || node === hint ||
      (route && route.contains(node)) ||
      (scrollbar && scrollbar.contains(node)) ||
      (hint && hint.contains(node))
    );
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(update);
  }

  function invalidate() {
    discoveryDirty = true;
    schedule();
  }

  function findSections() {
    var root = document.getElementById("root");
    var container = root && root.firstElementChild;
    var next = SECTIONS.map(function (section, index) {
      if (!container) return null;
      if (!index) return container.firstElementChild;

      // Preserve selector priority, rather than comma-selector document order.
      var selectors = section.sel.split(",");
      for (var i = 0; i < selectors.length; i++) {
        var node = root.querySelector(selectors[i].trim());
        if (node) return node;
      }
      return null;
    });

    els = next;
    discoveryDirty = false;
  }

  function unbindLenis() {
    if (lenisUnsubscribe) {
      try { lenisUnsubscribe(); } catch (_) {}
    } else if (lenis && typeof lenis.off === "function") {
      try { lenis.off("scroll", schedule); } catch (_) {}
    }
    lenisUnsubscribe = null;
    lenis = null;
  }

  function refreshStart() {
    refreshing = true;
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = 0;
  }

  function refreshEnd() {
    refreshing = false;
    invalidate();
    // Refresh callbacks may themselves change layout.
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(function () {
      refreshFrame = 0;
      invalidate();
    });
  }

  function bindIntegrations() {
    var nextLenis = window.lenis || null;
    if (nextLenis !== lenis) {
      unbindLenis();
      lenis = nextLenis;
      if (lenis && typeof lenis.on === "function") {
        var unsubscribe = lenis.on("scroll", schedule);
        if (typeof unsubscribe === "function") lenisUnsubscribe = unsubscribe;
      }
    }

    var nextTrigger = window.ScrollTrigger ||
      (window.gsap && window.gsap.core &&
       typeof window.gsap.core.globals === "function" &&
       window.gsap.core.globals().ScrollTrigger) || null;

    if (nextTrigger !== scrollTrigger) {
      if (scrollTrigger &&
          typeof scrollTrigger.removeEventListener === "function") {
        scrollTrigger.removeEventListener("refreshInit", refreshStart);
        scrollTrigger.removeEventListener("refresh", refreshEnd);
      }
      scrollTrigger = nextTrigger;
      refreshing = false;
      if (scrollTrigger &&
          typeof scrollTrigger.addEventListener === "function") {
        scrollTrigger.addEventListener("refreshInit", refreshStart);
        scrollTrigger.addEventListener("refresh", refreshEnd);
      }
      discoveryDirty = true;
    }
  }

  function getTriggers() {
    return scrollTrigger && typeof scrollTrigger.getAll === "function" ?
      scrollTrigger.getAll() : [];
  }

  function viewportTrigger(trigger) {
    var scroller = trigger.scroller;
    if (!scroller && trigger.vars) scroller = trigger.vars.scroller;
    return !scroller || scroller === window ||
      scroller === document || scroller === document.body ||
      scroller === document.documentElement;
  }

  function syncResizeObserver(triggers) {
    if (!resizeObserver) return;
    var next = [];

    function add(node) {
      if (node && node.nodeType === 1 && next.indexOf(node) === -1) {
        next.push(node);
      }
    }

    add(document.documentElement);
    add(document.body);
    add(document.getElementById("root"));
    els.forEach(function (node) {
      add(node);
      if (node) add(node.closest(".pin-spacer"));
    });
    triggers.forEach(function (trigger) { add(trigger.spacer); });

    if (next.length === observed.length &&
        next.every(function (node, i) { return node === observed[i]; })) return;

    resizeObserver.disconnect();
    observed = next;
    observed.forEach(function (node) { resizeObserver.observe(node); });
  }

  function measure(triggers) {
    var y = scrollY();
    var vh = window.innerHeight || document.documentElement.clientHeight || 1;
    var scrolling = document.scrollingElement || document.documentElement;
    var total = Math.max(0, scrolling.scrollHeight - scrolling.clientHeight);
    var offsets = els.map(function (node, index) {
      if (!node || !node.isConnected || !node.getClientRects().length) return null;

      var rect = node.getBoundingClientRect();
      if (rect.height <= 0) return null;

      // A pinned element's viewport rect is not its document-flow position.
      // Prefer its stable spacer; this also includes the pin's scroll distance.
      var spacer = node.closest(".pin-spacer");
      var exactPin = null;

      triggers.forEach(function (trigger) {
        if (trigger.pin === node && viewportTrigger(trigger) &&
            !(trigger.vars && trigger.vars.horizontal) &&
            !(trigger.vars && trigger.vars.containerAnimation) &&
            finite(trigger.start) && finite(trigger.end)) {
          if (!exactPin || trigger.start < exactPin.start) exactPin = trigger;
          if (trigger.spacer && trigger.spacer.isConnected) spacer = trigger.spacer;
        }
      });

      var start = rect.top + y;
      var end = start + rect.height;
      if (spacer && spacer.isConnected) {
        var spacerRect = spacer.getBoundingClientRect();
        if (spacerRect.height > 0) {
          start = spacerRect.top + y;
          end = start + spacerRect.height;
        }
      } else if (exactPin) {
        // Reparented/custom pins without an accessible spacer.
        start = exactPin.start;
        end = Math.max(start + rect.height, exactPin.end);
      }

      if (exactPin) end = Math.max(end, exactPin.end);
      if (!index) start = 0;
      return finite(start) && finite(end) ?
        { index: index, start: start, end: Math.max(start, end) } : null;
    });

    return { offsets: offsets, y: y, vh: vh, total: total };
  }

  function entriesFor(measurement) {
    return measurement.offsets.filter(function (entry) {
      return !!entry;
    }).sort(function (a, b) {
      return a.start - b.start || a.index - b.index;
    });
  }

  function build() {
    // Do not create another instance beside externally owned markup.
    if (document.querySelector(".sw-route")) return false;

    route = el("div", "sw-route");
    route.style.setProperty("--sw-accent", ACCENT);
    route.setAttribute("role", "navigation");
    route.setAttribute("aria-label", "Page sections");

    scrollbar = el("div", "sw-scrollbar");
    scrollbar.setAttribute("aria-hidden", "true");
    sb = el("span");
    scrollbar.appendChild(sb);

    hint = el("div", "sw-hint");
    hint.setAttribute("aria-hidden", "true");
    var text = el("span");
    text.textContent = "scroll to explore";
    hint.appendChild(text);
    hint.appendChild(el("i"));

    navItems = []; // Intentionally disabled: the site owns the header nav.
    dots = SECTIONS.map(function (section, index) {
      var dot = el("button", "sw-route__dot");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to " + section.label);
      var label = el("span", "sw-route__label");
      label.textContent = section.label;
      dot.appendChild(label);
      dot.appendChild(el("i"));
      dot.addEventListener("click", function () { jumpTo(index); });
      route.appendChild(dot);
      return dot;
    });

    document.body.appendChild(route);
    document.body.appendChild(scrollbar);
    document.body.appendChild(hint);
    active = -1;
    return true;
  }

  function removeUI() {
    [route, scrollbar, hint].forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    route = scrollbar = sb = hint = null;
    dots = [];
    navItems = [];
    active = -1;
  }

  function jumpTo(index) {
    if (destroyed || location.pathname !== HOME) return;
    bindIntegrations();
    if (refreshing || (scrollTrigger && scrollTrigger.isRefreshing)) return;
    findSections();

    var measurement = measure(getTriggers());
    var entry = measurement.offsets[index];
    if (!entry) return;

    var entries = entriesFor(measurement);
    var position = entries.indexOf(entry);
    var next = entries[position + 1];
    // Keep the original 45%-into-section jump, without landing in a later section.
    var end = next ? Math.min(entry.end, next.start) : entry.end;
    var target = index === 0 ? 0 :
      entry.start + Math.max(0, end - entry.start) * 0.45;

    if (next) {
      target = Math.min(target, Math.max(
        entry.start, next.start - measurement.vh * 0.35 - 1
      ));
    }
    target = clamp(target, 0, measurement.total);

    var reduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (lenis && typeof lenis.scrollTo === "function") {
      lenis.scrollTo(target, {
        duration: reduced ? 0 : 1.2,
        immediate: !!reduced,
        offset: 0
      });
    } else if (reduced) {
      // Override CSS scroll-behavior too, not merely the API's default behavior.
      var scrolling = document.scrollingElement || document.documentElement;
      var value = scrolling.style.getPropertyValue("scroll-behavior");
      var priority = scrolling.style.getPropertyPriority("scroll-behavior");
      scrolling.style.setProperty("scroll-behavior", "auto", "important");
      try {
        window.scrollTo({ top: target, behavior: "instant" });
      } finally {
        if (value) scrolling.style.setProperty("scroll-behavior", value, priority);
        else scrolling.style.removeProperty("scroll-behavior");
      }
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
    }
    // Active state follows the actual viewport, never an intended destination.
    schedule();
  }

  function update() {
    frame = 0;
    if (destroyed || !document.body) return;

    if (location.pathname !== HOME) {
      removeUI();
      els = [];
      discoveryDirty = true;
      if (resizeObserver) resizeObserver.disconnect();
      observed = [];
      return;
    }

    bindIntegrations();
    if (refreshing || (scrollTrigger && scrollTrigger.isRefreshing)) return;
    if (discoveryDirty || els.some(function (node) {
      return node && !node.isConnected;
    })) findSections();

    var triggers = getTriggers();
    syncResizeObserver(triggers);
    var measurement = measure(triggers);
    var entries = entriesFor(measurement);

    // Never turn missing, detached or hidden sections into offset-zero entries.
    if (!entries.length) {
      removeUI();
      return;
    }

    if (route && (!route.isConnected || !scrollbar.isConnected || !hint.isConnected)) {
      removeUI();
    }
    if (!route && !build()) return;

    var probe = measurement.y + measurement.vh * 0.35;
    var current = entries[0].index;
    entries.forEach(function (entry) {
      if (entry.start <= probe) current = entry.index;
    });

    if (measurement.y <= 1 && measurement.offsets[0]) current = 0;
    else if (measurement.total > 1 &&
             measurement.y >= measurement.total - 1) {
      current = entries[entries.length - 1].index;
    }

    dots.forEach(function (dot, index) {
      var disabled = !measurement.offsets[index];
      if (dot.disabled !== disabled) dot.disabled = disabled;
    });

    if (current !== active) {
      active = current;
      dots.concat(navItems).forEach(function (node, index) {
        var selected = index === current;
        node.classList.toggle("is-active", selected);
        if (selected) node.setAttribute("aria-current", "location");
        else node.removeAttribute("aria-current");
      });
    }

    var progress = measurement.total > 0 ?
      clamp(measurement.y / measurement.total, 0, 1) : 0;
    var transform = "scaleX(" + progress + ")";
    var opacity = String(clamp(1 - measurement.y / (measurement.vh * 0.5), 0, 1));
    if (sb.style.transform !== transform) sb.style.transform = transform;
    if (hint.style.opacity !== opacity) hint.style.opacity = opacity;
  }

  function boot() {
    if (started || destroyed) return;
    started = true;

    listen(window, "scroll", schedule, { passive: true });
    listen(window, "resize", invalidate, { passive: true });
    listen(window, "popstate", invalidate);
    listen(window, "hashchange", invalidate);
    listen(window, "pageshow", invalidate);
    listen(document, "load", invalidate, true);
    listen(document, "transitionend", invalidate, true);
    listen(document, "animationend", invalidate, true);
    listen(document, "visibilitychange", invalidate);

    if (window.visualViewport) {
      listen(window.visualViewport, "resize", invalidate, { passive: true });
      listen(window.visualViewport, "scroll", schedule, { passive: true });
    }

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(schedule);
    }
    if (window.MutationObserver) {
      mutationObserver = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (!owned(records[i].target)) {
            invalidate();
            break;
          }
        }
      });
      mutationObserver.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
    }

    if (document.fonts) {
      if (typeof document.fonts.addEventListener === "function") {
        listen(document.fonts, "loadingdone", invalidate);
        listen(document.fonts, "loadingerror", invalidate);
      }
      document.fonts.ready.then(function () {
        if (!destroyed) invalidate();
      }, function () {});
    }

    // Catches late integrations, silent pushState navigation and layout changes
    // not represented by DOM mutations, without patching SPA-owned history APIs.
    timer = window.setInterval(invalidate, 300);
    invalidate();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    if (timer) clearInterval(timer);
    document.removeEventListener("DOMContentLoaded", boot);
    removers.forEach(function (remove) { remove(); });
    removers = [];
    if (mutationObserver) mutationObserver.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    unbindLenis();
    if (scrollTrigger &&
        typeof scrollTrigger.removeEventListener === "function") {
      scrollTrigger.removeEventListener("refreshInit", refreshStart);
      scrollTrigger.removeEventListener("refresh", refreshEnd);
    }
    removeUI();
    els = [];
    observed = [];
    scrollTrigger = mutationObserver = resizeObserver = null;
    if (window.__alryumScrollSpy === api) {
      delete window.__alryumScrollSpy;
      delete window.__alryumScrollSpyLoaded;
    }
  }

  var api = { destroy: destroy };
  window.__alryumScrollSpy = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
