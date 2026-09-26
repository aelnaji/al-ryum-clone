/* ═══════ AL RYUM · @astra ═══════
   Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE — to disconnect:
   remove this file and revert the <script src> in index.html to the original.
   DO NOT hand-edit alongside the original; treat as a drop-in replacement. */

/* ============================================================================
   al-ryum-cinematic.js
   Injects the cinematic host before #projects. Project Films owns the finale
   slot; this file intentionally defines no films.
   Remove via #arc-cinematic-host.dispatchEvent(new Event("arc:destroy")).
   ========================================================================== */
(function () {
  "use strict";

  if (window.__alryumCinematicLoaded) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return;

  try {
    gsap.registerPlugin(ScrollTrigger);
  } catch (_) {
    return;
  }

  window.__alryumCinematicLoaded = true;

  var CINEMATIC_ID = "arc-cinematic-host";
  var FILMS = [];
  var wrapper = null;
  var ownsWrapper = false;
  var destroyed = false;
  var bindings = [];
  var observer = null;
  var bootTimer = 0;
  var refreshFrame = 0;
  var initialDelayComplete = false;
  var motionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  function buildSections() {
    return '<section class="arc-finale" style="position:relative;height:85vh;background:#122023;"></section>';
  }

  function reducedMotion() {
    return !!(motionQuery && motionQuery.matches);
  }

  function requestRefresh() {
    if (destroyed || refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(function () {
      refreshFrame = 0;
      if (!destroyed) ScrollTrigger.refresh();
    });
  }

  function coverCrop(iw, ih, width, height) {
    var scale = Math.max(width / iw, height / ih);
    return {
      dx: (width - iw * scale) / 2,
      dy: (height - ih * scale) / 2,
      dw: iw * scale,
      dh: ih * scale
    };
  }

  function findCanvas(host, id) {
    var canvases = host.querySelectorAll("canvas[id]");
    for (var i = 0; i < canvases.length; i++) {
      if (canvases[i].id === id) return canvases[i];
    }
    return null;
  }

  function bindFilm(host, canvas, section, film) {
    var count = Number(film.n);
    if (!Number.isInteger(count) || count < 1 || typeof film.base !== "string") {
      return null;
    }

    var ctx;
    try {
      ctx = canvas.getContext("2d");
    } catch (_) {
      return null;
    }
    if (!ctx) return null;

    var dead = false;
    var images = new Array(count);
    var pendingImages = [];
    var settled = 0;
    var ready = false;
    var loadTimer = 0;
    var drawFrame = 0;
    var resizeObserver = null;
    var animationContext = null;
    var pin = null;
    var width = 0;
    var height = 0;
    var dpr = 1;
    var desired = 0;
    var current = -1;
    var captions = Array.prototype.filter.call(
      section.querySelectorAll("h2, p, span"),
      function (element) {
        return element.closest(".arc-film") === section;
      }
    );
    var originalDisplay = canvas.style.getPropertyValue("display");
    var originalDisplayPriority = canvas.style.getPropertyPriority("display");
    var originalWidth = canvas.getAttribute("width");
    var originalHeight = canvas.getAttribute("height");

    function active() {
      return !dead && !destroyed && wrapper === host &&
        host.isConnected && host.contains(section) && section.contains(canvas);
    }

    function nearestImage(index) {
      if (images[index]) return index;
      for (var distance = 1; distance < count; distance++) {
        if (index - distance >= 0 && images[index - distance]) {
          return index - distance;
        }
        if (index + distance < count && images[index + distance]) {
          return index + distance;
        }
      }
      return -1;
    }

    function render(force) {
      if (!active() || !width || !height) return;
      var index = nearestImage(desired);
      if (index < 0 || (!force && index === current)) return;

      var image = images[index];
      var crop = coverCrop(
        image.naturalWidth, image.naturalHeight, width, height
      );
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, crop.dx, crop.dy, crop.dw, crop.dh);
      current = index;
    }

    function scheduleDraw(index) {
      desired = Math.max(0, Math.min(count - 1, Math.round(index)));
      if (!active() || drawFrame) return;
      drawFrame = window.requestAnimationFrame(function () {
        drawFrame = 0;
        render(false);
      });
    }

    function sizeCanvas() {
      if (!active() || !ready) return;
      var rect = canvas.getBoundingClientRect();
      width = rect.width || section.clientWidth || window.innerWidth;
      height = rect.height || section.clientHeight || window.innerHeight;
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

      var pixelWidth = Math.max(1, Math.round(width * dpr));
      var pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      render(true);
    }

    function clearAnimations() {
      if (animationContext) {
        animationContext.revert();
        animationContext = null;
      }
      if (pin) {
        pin.kill(true);
        pin = null;
      }
    }

    function applyMotion() {
      if (!active() || !ready) return;
      clearAnimations();

      // Record all GSAP mutations for this film only.
      animationContext = gsap.context(function () {
        if (reducedMotion()) {
          gsap.set(canvas, { opacity: 1 });
          if (captions.length) gsap.set(captions, { opacity: 1, y: 0 });
          desired = 0;
          return;
        }

        pin = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "+=900",
          pin: true,
          scrub: true,
          anticipatePin: 1,
          onUpdate: function (self) {
            scheduleDraw(self.progress * (count - 1));
          },
          onRefresh: function (self) {
            sizeCanvas();
            scheduleDraw(self.progress * (count - 1));
          }
        });

        if (captions.length) {
          gsap.to(captions, {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "25% top",
              end: "55% top",
              scrub: true
            }
          });
        }

        gsap.fromTo(canvas, { opacity: 0 }, {
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top top",
            scrub: true
          }
        });
        desired = Math.round(pin.progress * (count - 1));
      }, section);

      sizeCanvas();
      scheduleDraw(desired);
      requestRefresh();
    }

    function activate() {
      if (!active() || ready || nearestImage(0) < 0) return;
      ready = true;
      canvas.style.setProperty("display", "block");
      window.addEventListener("resize", sizeCanvas, { passive: true });
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(sizeCanvas);
        resizeObserver.observe(canvas);
      }
      applyMotion();
    }

    function finishImage(index, image, success) {
      image.onload = image.onerror = null;
      if (!active()) return;
      if (success && image.naturalWidth && image.naturalHeight) {
        images[index] = image;
      }
      settled++;
      if (settled === count) {
        window.clearTimeout(loadTimer);
        loadTimer = 0;
        activate();
      } else if (!loadTimer) {
        activate();
      }
      if (ready) scheduleDraw(desired);
    }

    loadTimer = window.setTimeout(function () {
      loadTimer = 0;
      activate();
    }, 20000);

    for (var i = 0; i < count; i++) {
      (function (index) {
        var image = new Image();
        pendingImages.push(image);
        image.decoding = "async";
        image.onload = function () { finishImage(index, image, true); };
        image.onerror = function () { finishImage(index, image, false); };
        image.src = film.base + "frame_" +
          String(index + 1).padStart(4, "0") + ".webp";
      })(i);
    }

    function restoreAttribute(name, value) {
      if (value === null) canvas.removeAttribute(name);
      else canvas.setAttribute(name, value);
    }

    return {
      canvas: canvas,
      section: section,
      updateMotion: applyMotion,
      destroy: function () {
        if (dead) return;
        dead = true;
        window.clearTimeout(loadTimer);
        window.cancelAnimationFrame(drawFrame);
        window.removeEventListener("resize", sizeCanvas);
        if (resizeObserver) resizeObserver.disconnect();
        clearAnimations();

        pendingImages.forEach(function (image) {
          image.onload = image.onerror = null;
          if (!image.complete) image.removeAttribute("src");
        });
        pendingImages.length = 0;
        images.length = 0;

        if (originalDisplay) {
          canvas.style.setProperty(
            "display", originalDisplay, originalDisplayPriority
          );
        } else {
          canvas.style.removeProperty("display");
        }
        restoreAttribute("width", originalWidth);
        restoreAttribute("height", originalHeight);
      }
    };
  }

  function clearBindings() {
    bindings.forEach(function (binding) { binding.destroy(); });
    bindings.length = 0;
  }

  function releaseWrapper(remove) {
    clearBindings();
    if (!wrapper) return;
    wrapper.removeEventListener("arc:destroy", destroy);
    if (remove && ownsWrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
    wrapper = null;
    ownsWrapper = false;
  }

  function syncBindings() {
    bindings = bindings.filter(function (binding) {
      var valid = wrapper.contains(binding.canvas) &&
        wrapper.contains(binding.section) &&
        binding.canvas.closest(".arc-film") === binding.section;
      if (!valid) {
        binding.destroy();
        requestRefresh();
      }
      return valid;
    });

    FILMS.forEach(function (film) {
      var canvas = findCanvas(wrapper, film.canvas);
      if (!canvas || bindings.some(function (binding) {
        return binding.canvas === canvas;
      })) return;

      var section = canvas.closest(".arc-film");
      if (!section || !wrapper.contains(section)) return;
      var binding = bindFilm(wrapper, canvas, section, film);
      if (binding) bindings.push(binding);
    });
  }

  function scheduleBoot(delay) {
    if (destroyed || bootTimer) return;
    bootTimer = window.setTimeout(function () {
      bootTimer = 0;
      boot();
    }, delay);
  }

  function boot() {
    if (destroyed) return;

    var root = document.getElementById("root");
    var projects = document.getElementById("projects");
    if (!root || !root.children.length || !projects ||
        !root.contains(projects) || !projects.parentNode) {
      if (wrapper) {
        releaseWrapper(true);
        requestRefresh();
      }
      scheduleBoot(300);
      return;
    }

    if (!initialDelayComplete) {
      initialDelayComplete = true;
      scheduleBoot(1200);
      return;
    }

    var existing = document.getElementById(CINEMATIC_ID);
    if (wrapper && (wrapper !== existing || !root.contains(wrapper))) {
      releaseWrapper(true);
      existing = document.getElementById(CINEMATIC_ID);
      requestRefresh();
    }

    if (!wrapper) {
      if (existing) {
        // Do not adopt an unrelated host outside the live React root.
        if (!root.contains(existing)) return;
        wrapper = existing;
        ownsWrapper = false;
      } else {
        wrapper = document.createElement("div");
        wrapper.id = CINEMATIC_ID;
        wrapper.setAttribute("data-arc-injected", "1");
        wrapper.innerHTML = buildSections();
        projects.parentNode.insertBefore(wrapper, projects);
        ownsWrapper = true;
      }
      wrapper.addEventListener("arc:destroy", destroy);
      requestRefresh();
    }

    // Never rebuild the finale: another script may have replaced its contents.
    syncBindings();
  }

  function onMotionChange() {
    bindings.forEach(function (binding) { binding.updateMotion(); });
  }

  function onLoad() {
    scheduleBoot(1200);
  }

  function onPageHide(event) {
    if (!event.persisted) destroy();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    window.clearTimeout(bootTimer);
    window.cancelAnimationFrame(refreshFrame);
    if (observer) observer.disconnect();
    window.removeEventListener("load", onLoad);
    window.removeEventListener("pagehide", onPageHide);

    if (motionQuery) {
      if (motionQuery.removeEventListener) {
        motionQuery.removeEventListener("change", onMotionChange);
      } else if (motionQuery.removeListener) {
        motionQuery.removeListener(onMotionChange);
      }
    }

    releaseWrapper(true);
    window.__alryumCinematicLoaded = false;
    ScrollTrigger.refresh();
  }

  if (motionQuery) {
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", onMotionChange);
    } else if (motionQuery.addListener) {
      motionQuery.addListener(onMotionChange);
    }
  }

  // Observe above React so replacing the root or its container is recoverable.
  observer = new MutationObserver(function () { scheduleBoot(0); });
  observer.observe(document, { childList: true, subtree: true });

  window.addEventListener("load", onLoad, { once: true });
  window.addEventListener("pagehide", onPageHide);
  boot();
})();
