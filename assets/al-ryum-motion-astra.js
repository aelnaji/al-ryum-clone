/* ═══════ AL RYUM · @astra ═══════
   Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE — to disconnect:
   remove this file and revert the <script src> in index.html to the original.
   DO NOT hand-edit alongside the original; treat as a drop-in replacement. */

/* ============================================================================
   al-ryum-motion.js — section-scoped choreography for the live Al Ryum site.
   Requires GSAP + ScrollTrigger. Existing navigation and Lenis remain untouched.
   ========================================================================== */
(function () {
  "use strict";

  if (window.__alryumMotionLoaded) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || typeof gsap.context !== "function") return;

  gsap.registerPlugin(ScrollTrigger);
  window.__alryumMotionLoaded = true;

  var ids = [
    "about", "solutions", "global-reach", "journey",
    "projects", "news", "contact"
  ];
  var records = new Map();
  var media = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  var reduced = !!(media && media.matches);
  var observer = null;
  var frame = 0;
  var refreshFrame = 0;
  var active = false;
  var ready = false;
  var epoch = 0;
  var globalCleanups = [];

  function listen(target, type, handler, options, cleanups) {
    target.addEventListener(type, handler, options);
    cleanups.push(function () {
      target.removeEventListener(type, handler, options);
    });
  }

  function drain(cleanups) {
    while (cleanups.length) {
      try {
        cleanups.pop()();
      } catch (error) {
        // Continue releasing the remaining resources.
      }
    }
  }

  function refresh() {
    if (!active || reduced || refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(function () {
      refreshFrame = 0;
      if (active && !reduced) ScrollTrigger.refresh();
    });
  }

  function findStatement(section) {
    var result = null;
    section.querySelectorAll("h1,h2,h3,h4").forEach(function (heading) {
      if (/footprint|operating/i.test(heading.textContent || "")) {
        result = heading;
      }
    });
    return result;
  }

  /*
   * Split text nodes rather than replacing innerHTML: inline markup, listeners,
   * and original text-node identities survive setup and teardown.
   */
  function splitText(element, characters, record) {
    var selector = characters ? ".cr-char" : ".sw-word";
    var existing = element.querySelectorAll(selector);
    if (existing.length) return existing;

    if (
      !element.textContent.trim() ||
      element.querySelector("img,svg,canvas,video") ||
      element.isContentEditable
    ) return [];

    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;

    while ((node = walker.nextNode())) {
      if (
        node.nodeValue.trim() &&
        !node.parentElement.closest(
          "script,style,textarea,.sw-word,.cr-char,[aria-hidden='true']"
        )
      ) nodes.push(node);
    }

    nodes.forEach(function (original) {
      var parent = original.parentNode;
      var fragment = document.createDocumentFragment();
      var inserted = [];
      var pieces;

      if (characters) {
        if (window.Intl && typeof window.Intl.Segmenter === "function") {
          var segmenter = new window.Intl.Segmenter(undefined, {
            granularity: "grapheme"
          });
          pieces = Array.from(
            segmenter.segment(original.nodeValue),
            function (entry) { return entry.segment; }
          );
        } else {
          pieces = Array.from(original.nodeValue);
        }
      } else {
        pieces = original.nodeValue.split(/(\s+)/);
      }

      pieces.forEach(function (piece) {
        if (!piece) return;
        var wrapper;

        if (/^\s+$/.test(piece)) {
          wrapper = document.createTextNode(piece);
        } else if (characters) {
          wrapper = document.createElement("span");
          wrapper.className = "cr-char";
          wrapper.style.display = "inline-block";
          wrapper.textContent = piece;
        } else {
          wrapper = document.createElement("span");
          wrapper.className = "sw-mask";
          wrapper.style.cssText =
            "display:inline-block;overflow:hidden;vertical-align:top;";

          var word = document.createElement("span");
          word.className = "sw-word";
          word.style.display = "inline-block";
          word.textContent = piece;
          wrapper.appendChild(word);
        }

        inserted.push(wrapper);
        fragment.appendChild(wrapper);
      });

      parent.replaceChild(fragment, original);
      record.cleanups.push(function () {
        // Do not resurrect text removed by a React render.
        if (!inserted.length || inserted[0].parentNode !== parent) return;
        parent.insertBefore(original, inserted[0]);
        inserted.forEach(function (part) {
          if (part.parentNode === parent) parent.removeChild(part);
        });
      });
    });

    return element.querySelectorAll(selector);
  }

  function once(trigger, start) {
    return {
      trigger: trigger,
      start: start,
      once: true,
      toggleActions: "play none none none",
      invalidateOnRefresh: true
    };
  }

  function projectCards(section) {
    var candidates = Array.from(section.querySelectorAll("div")).filter(
      function (element) {
        return element.children.length >= 2 &&
          element.querySelector("img") &&
          element.querySelector("h3,h4,h5");
      }
    );

    // Prefer individual cards, not grids or other card-containing ancestors.
    return candidates.filter(function (candidate) {
      return !candidates.some(function (other) {
        return candidate !== other && candidate.contains(other);
      });
    });
  }

  function addTilt(card, record) {
    var pending = 0;
    var point = null;
    var tween = null;
    var disposed = false;
    var initial = {
      x: gsap.getProperty(card, "rotationX"),
      y: gsap.getProperty(card, "rotationY")
    };

    gsap.set(card, {
      transformPerspective: 1000,
      transformStyle: "preserve-3d"
    });

    // Record dynamically-created hover tweens in this section's context.
    record.context.add("tilt", function (x, y) {
      if (tween) tween.kill();
      tween = gsap.to(card, {
        rotationX: x,
        rotationY: y,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto"
      });
    });

    function move(event) {
      if (disposed || reduced || event.pointerType === "touch") return;
      point = { x: event.clientX, y: event.clientY };
      if (pending) return;

      pending = window.requestAnimationFrame(function () {
        pending = 0;
        if (disposed || !point || !card.isConnected) return;
        var rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        var x = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width));
        var y = Math.max(0, Math.min(1, (point.y - rect.top) / rect.height));
        record.context.tilt((y - 0.5) * -10, (x - 0.5) * 10);
      });
    }

    function leave() {
      point = null;
      if (pending) window.cancelAnimationFrame(pending);
      pending = 0;
      if (!disposed) record.context.tilt(initial.x, initial.y);
    }

    var pointer = !!window.PointerEvent;
    listen(card, pointer ? "pointermove" : "mousemove", move,
      { passive: true }, record.cleanups);
    listen(card, pointer ? "pointerleave" : "mouseleave", leave,
      false, record.cleanups);
    if (pointer) {
      listen(card, "pointercancel", leave, false, record.cleanups);
    }

    record.cleanups.push(function () {
      disposed = true;
      if (pending) window.cancelAnimationFrame(pending);
      if (tween) tween.kill();
    });
  }

  function setupSection(section, record) {
    var id = section.id;
    var statement = id === "global-reach" ? findStatement(section) : null;

    section.querySelectorAll("h1,h2,h3").forEach(function (heading) {
      // The scrubbed statement owns its text; never double-split it.
      if (heading === statement) return;
      var words = splitText(heading, false, record);
      if (!words.length) return;

      gsap.fromTo(words, { yPercent: 115 }, {
        yPercent: 0,
        duration: 1,
        stagger: 0.02,
        ease: "power2.out",
        scrollTrigger: once(heading, "top 88%")
      });
    });

    if (["solutions", "global-reach", "journey", "news"].indexOf(id) !== -1) {
      var animated = new Set();
      section.querySelectorAll('[class*="grid"]').forEach(function (grid) {
        var cards = Array.from(grid.children).filter(function (card) {
          if (!card.children.length || animated.has(card)) return false;
          // Avoid animating a nested grid and its cards simultaneously.
          var ancestor = card.parentElement;
          while (ancestor && ancestor !== section) {
            if (animated.has(ancestor)) return false;
            ancestor = ancestor.parentElement;
          }
          return true;
        });
        if (!cards.length) return;
        cards.forEach(function (card) { animated.add(card); });

        gsap.from(cards, {
          y: 80,
          opacity: 0,
          duration: 1.1,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: once(grid, "top 82%")
        });
      });
    }

    if (id === "projects") {
      projectCards(section).forEach(function (card) {
        gsap.fromTo(card, { y: 40, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: once(card, "top 92%")
        });
        addTilt(card, record);
      });
    }

    if (id === "about") {
      var video = section.querySelector("video");
      if (video && video.parentElement) {
        gsap.to(video.parentElement, {
          padding: "0rem",
          borderRadius: 0,
          duration: 2.5,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: section,
            start: "top 70%",
            end: "top 5%",
            scrub: 1,
            invalidateOnRefresh: true
          }
        });
      }
    }

    if (statement) {
      var chars = splitText(statement, true, record);
      if (chars.length) {
        gsap.fromTo(chars, { opacity: 0.12 }, {
          opacity: 1,
          stagger: 0.04,
          ease: "power1.out",
          scrollTrigger: {
            trigger: statement,
            start: "top 85%",
            end: "bottom 40%",
            scrub: true,
            invalidateOnRefresh: true
          }
        });
      }
    }
  }

  function setupFooter(footer, record) {
    var marquee = Array.from(footer.querySelectorAll("div")).find(
      function (element) {
        return element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth * 1.3;
      }
    );
    record.hasMarquee = !!marquee;
    if (!marquee) return;

    var tween = gsap.to(marquee, {
      xPercent: -50,
      duration: 35,
      ease: "none",
      repeat: -1,
      onReverseComplete: function () {
        // Supply more timeline when reversing past the initial cycle.
        this.totalTime(this.duration() * 100, true);
      }
    });
    var lastY = window.scrollY || 0;
    var pending = 0;

    listen(window, "scroll", function () {
      if (pending) return;
      pending = window.requestAnimationFrame(function () {
        pending = 0;
        var current = window.scrollY || 0;
        if (current > lastY) {
          tween.play();
        } else if (current < lastY) {
          if (tween.totalTime() <= 0) {
            tween.totalTime(tween.duration() * 100, true);
          }
          tween.reverse();
        }
        lastY = current;
      });
    }, { passive: true }, record.cleanups);

    record.cleanups.push(function () {
      if (pending) window.cancelAnimationFrame(pending);
    });
  }

  function destroy(record) {
    // Stop input first, restore GSAP-owned styles, then restore original text.
    if (record.context) {
      try {
        record.context.revert();
      } catch (error) {
        // Still release listeners and restore text if a plugin fails.
      }
    }
    drain(record.cleanups);
  }

  function create(element, footer) {
    var record = {
      element: element,
      footer: footer,
      context: null,
      cleanups: [],
      dirty: false,
      hasMarquee: false,
      failed: false
    };

    try {
      record.context = gsap.context(function () {}, element);
      record.context.add(function () {
        if (footer) setupFooter(element, record);
        else setupSection(element, record);
      });
    } catch (error) {
      destroy(record);
      record.context = null;
      record.failed = true;
      if (window.console && window.console.warn) {
        window.console.warn("Al Ryum motion: section setup skipped.", error);
      }
    }
    return record;
  }

  function observe() {
    if (observer && document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  function reconcile() {
    frame = 0;
    if (!active) return;
    if (observer) observer.disconnect();

    try {
      var root = document.getElementById("root");
      if (!ready && root && root.children.length &&
          document.getElementById("about")) {
        ready = true;
      }

      var desired = new Map();
      if (ready && !reduced) {
        ids.forEach(function (id) {
          var section = document.getElementById(id);
          if (section) desired.set(section, false);
        });
        var footer = document.querySelector("footer");
        if (footer) desired.set(footer, true);
      }

      var changed = false;
      records.forEach(function (record, element) {
        if (!desired.has(element) || record.dirty) {
          destroy(record);
          records.delete(element);
          changed = true;
        }
      });

      desired.forEach(function (footer, element) {
        if (!records.has(element)) {
          records.set(element, create(element, footer));
          changed = true;
        }
      });
      if (changed) refresh();
    } finally {
      observe();
    }
  }

  function schedule() {
    if (active && !frame) frame = window.requestAnimationFrame(reconcile);
  }

  function layoutChanged() {
    records.forEach(function (record) {
      if (record.footer && !record.hasMarquee && !record.failed) {
        record.dirty = true;
      }
    });
    schedule();
    refresh();
  }

  function preferenceChanged() {
    reduced = !!(media && media.matches);
    // Revert immediately so reduced motion never leaves hidden reveal content.
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    reconcile();
  }

  function start() {
    if (active) return;
    active = true;
    reduced = !!(media && media.matches);
    var currentEpoch = ++epoch;

    if (window.MutationObserver) {
      observer = new MutationObserver(function (mutations) {
        records.forEach(function (record) {
          record.dirty = record.dirty || mutations.some(function (mutation) {
            return record.element === mutation.target ||
              record.element.contains(mutation.target);
          });
        });
        schedule();
      });
      observe();
    }

    listen(window, "load", layoutChanged, false, globalCleanups);
    listen(window, "resize", layoutChanged, { passive: true }, globalCleanups);
    listen(document, "load", layoutChanged, true, globalCleanups);
    listen(document, "loadedmetadata", layoutChanged, true, globalCleanups);
    listen(document, "DOMContentLoaded", schedule, false, globalCleanups);
    listen(window, "pagehide", stop, false, globalCleanups);

    if (media) {
      if (media.addEventListener) {
        listen(media, "change", preferenceChanged, false, globalCleanups);
      } else if (media.addListener) {
        media.addListener(preferenceChanged);
        globalCleanups.push(function () {
          media.removeListener(preferenceChanged);
        });
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (active && currentEpoch === epoch) layoutChanged();
      }, function () {});
    }

    reconcile();
  }

  function stop() {
    if (!active) return;
    active = false;
    epoch++;
    if (observer) observer.disconnect();
    observer = null;
    if (frame) window.cancelAnimationFrame(frame);
    if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
    frame = 0;
    refreshFrame = 0;
    drain(globalCleanups);
    records.forEach(destroy);
    records.clear();
  }

  // This single lifecycle listener survives suspension for back/forward cache.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) start();
  });

  start();
})();
