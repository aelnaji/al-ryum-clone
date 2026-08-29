/* ============================================================================
   al-ryum-cinematic.js — injects the scroll-scrub project-films cinematic
   into the LIVE Al Ryum site, positioned BEFORE the projects section.
   ----------------------------------------------------------------------------
   Reuses the video-scroll-cinematic pattern (canvas frame-sequence scrub):
   three pinned full-viewport film sections (Louvre, Zayed, Emirates) where the
   camera moves through pre-rendered WebP frames as the user scrolls.
   Frames live at /assets/frames/{louvre,zayed,emirates}/frame_XXXX.webp

   Injects after React mounts (the site is a minified React bundle). The film
   sections are inserted into the DOM immediately before #projects, then each
   canvas is bound to a pinned scrubbed ScrollTrigger. No bundle edit needed —
   fully revertible by removing this script tag.

   Reduced-motion: this desktop runs with prefers-reduced-motion ON and the
   user wants the effect visible, so films are shown regardless (only a
   no-GSAP bail).
   ========================================================================== */
(function () {
  "use strict";
  if (window.__alryumCinematicLoaded) return;
  window.__alryumCinematicLoaded = true;
  if (!window.gsap || !window.ScrollTrigger) return;

  var FILMS = [
    { id: "film-louvre",   canvas: "canvas-louvre",   base: "assets/frames/louvre/",   n: 80,
      eyebrow: "Cultural Heritage · Saadiyat Island", title: "Louvre Abu Dhabi",
      body: "The dome approach — external works and landscaping." },
    { id: "film-zayed",    canvas: "canvas-zayed",    base: "assets/frames/zayed/",    n: 80,
      eyebrow: "Landscaping · Abu Dhabi", title: "Zayed National Museum",
      body: "Architecture in the landscape — irrigation & car park." },
    { id: "film-emirates", canvas: "canvas-emirates", base: "assets/frames/emirates/", n: 80,
      eyebrow: "Hospitality · Abu Dhabi", title: "Emirates Palace",
      body: "Grand gardens, palace grounds & beachfront landscaping." },
  ];

  function buildSections() {
    var html = "";
    // Intro bridge before the first film — quick, no eyebrow
    html +=
      '<section class="arc-bridge arc-bridge-intro" data-intro="true" style="position:relative;height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;background:#122023;">' +
        '<div style="opacity:0;transform:translateY(30px);">' +
          '<h2 style="font-size:clamp(2rem,6vw,3.6rem);font-weight:600;text-transform:uppercase;letter-spacing:.02em;color:#f8fafa;">Our signature projects,<br/>in motion.</h2>' +
        '</div>' +
      '</section>';
    FILMS.forEach(function (f, i) {
      html +=
        '<section class="arc-film" id="' + f.id + '" style="position:relative;height:100vh;overflow:hidden;background:#0a1416;">' +
          '<canvas id="' + f.canvas + '" style="position:absolute;inset:0;width:100%;height:100%;display:none;"></canvas>' +
          '<div style="position:absolute;left:0;right:0;bottom:9%;text-align:center;z-index:3;pointer-events:none;padding:0 1.5rem;">' +
            '<span style="display:block;font-size:.78rem;letter-spacing:.28em;text-transform:uppercase;color:#C8A86E;">' + f.eyebrow + '</span>' +
            '<h2 style="font-size:clamp(1.7rem,5vw,3.2rem);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-top:.6rem;color:#f8fafa;">' + f.title + '</h2>' +
            '<p style="margin-top:.5rem;opacity:.85;font-size:clamp(.9rem,2vw,1.05rem);color:#f8fafa;">' + f.body + '</p>' +
          '</div>' +
        '</section>';
    });

    // Finale — "Built to last." closing statement after the last film
    html +=
      '<section class="arc-finale" style="position:relative;height:85vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;gap:1.6rem;background:#122023;">' +
        '<h2 style="font-size:clamp(2rem,6vw,3.4rem);font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:#f8fafa;">Built to last.</h2>' +
        '<div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">' +
          '<a href="#projects" style="color:#0a1416;background:#C8A86E;text-decoration:none;font-weight:600;font-size:.95rem;padding:.9rem 1.8rem;border-radius:999px;">View all projects</a>' +
        '</div>' +
      '</section>';
    return html;
  }

  function coverCrop(iw, ih, W, H) {
    var s = Math.max(W / iw, H / ih);
    return { dx: (W - iw * s) / 2, dy: (H - ih * s) / 2, dw: iw * s, dh: ih * s };
  }

  function bindFilm(canvasId, frameBase, frameCount) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var section = canvas.closest(".arc-film");
    var ctx = canvas.getContext("2d");

    var imgs = new Array(frameCount), done = 0;
    var loaded = new Promise(function (resolve) {
      for (var i = 0; i < frameCount; i++) {
        (function (idx) {
          var im = new Image();
          im.decoding = "async";
          im.onload = function () { imgs[idx] = im; if (++done >= frameCount) resolve(imgs); };
          im.onerror = function () { imgs[idx] = null; if (++done >= frameCount) resolve(imgs); };
          im.src = frameBase + "frame_" + String(idx + 1).padStart(4, "0") + ".webp";
        })(i);
      }
      setTimeout(function () { resolve(imgs); }, 20000);
    });

    loaded.then(function (usable) {
      var good = usable.filter(Boolean);
      if (!good.length) return;
      var W = 0, H = 0, dpr = 1, current = -1;

      function sizeCanvas() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        var r = canvas.getBoundingClientRect();
        W = r.width || window.innerWidth;
        H = r.height || window.innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      function draw(index) {
        if (index < 0 || index >= good.length) return;
        var img = good[index];
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        var c = coverCrop(img.naturalWidth, img.naturalHeight, W, H);
        ctx.drawImage(img, c.dx, c.dy, c.dw, c.dh);
      }
      var rafPending = false;
      function scheduleDraw(index) {
        var i = Math.max(0, Math.min(good.length - 1, index));
        if (i === current) return;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(function () { rafPending = false; current = i; draw(i); });
        }
      }

      ScrollTrigger.create({
        trigger: section, start: "top top", end: "+=900",
        pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (self) { scheduleDraw(Math.round(self.progress * (good.length - 1))); },
      });
      window.addEventListener("resize", function () { sizeCanvas(); if (current >= 0) draw(current); });

      // caption reveal mid-scrub
      gsap.to(section.querySelectorAll("h2, p, span"), {
        opacity: 1, y: 0, stagger: 0.08, ease: "power2.out",
        scrollTrigger: { trigger: section, start: "25% top", end: "55% top", scrub: true, invalidateOnRefresh: true },
      });

      canvas.style.display = "block";
      sizeCanvas();
      scheduleDraw(0);

      // Crossfade the incoming film in over the previous one so the hard cut
      // between two similar dark architectural shots doesn't read as a repeat.
      // Start at opacity 0 and fade to 1 as this film's pin begins.
      gsap.fromTo(canvas, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true },
      });
    });
    return loaded;
  }

  /* ---------- boot: inject cinematic into the React root container ----------
     The React root is a single DIV.min-h-screen whose direct children are all
     sections (header, hero, about, solutions, global-reach, journey, projects,
     news, footer). We insert our wrapper right before #projects, so the natural
     scroll order becomes: ... journey → [cinematic] → projects → news → footer.
     React does not re-render the whole container on our DOM insert (we add a
     node it doesn't own); we guard with a MutationObserver to re-inject if it
     is ever removed. */
  var CINEMATIC_ID = "arc-cinematic-host";

  function boot() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) return setTimeout(boot, 300);
    var container = root.firstElementChild; // DIV.min-h-screen holding all sections
    var projects = document.getElementById("projects");
    if (!container || !projects) return setTimeout(boot, 300);
    if (document.getElementById(CINEMATIC_ID)) return;

    // Build wrapper and insert it right before #projects
    var wrapper = document.createElement("div");
    wrapper.id = CINEMATIC_ID;
    wrapper.setAttribute("data-arc-injected", "1");
    wrapper.innerHTML = buildSections();
    container.insertBefore(wrapper, projects);

    // The Projects section keeps ALL its cards — films are an intro, the grid
    // shows every project including Louvre/Zayed/Emirates.

    // Bind film scroll triggers, then refresh ScrollTrigger once everything
    // has actually loaded (fixes stale start/end offsets from layout shifts
    // that happen while images are still downloading).
    var filmLoads = FILMS.map(function (f) { return bindFilm(f.canvas, f.base, f.n); });
    Promise.all(filmLoads).then(function () {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });

    // Intro bridge: fade in on scroll into view
    var intro = document.querySelector(".arc-bridge-intro");
    if (intro) {
      var introContent = intro.firstElementChild;
      ScrollTrigger.create({
        trigger: intro, start: "top 80%", end: "top 30%", scrub: true,
        onUpdate: function (self) {
          if (introContent) {
            introContent.style.opacity = Math.min(1, self.progress * 1.6);
            introContent.style.transform = "translateY(" + (30 - 30 * Math.min(1, self.progress * 1.6)) + "px)";
          }
        },
      });
    }

    // MutationObserver: re-inject if anyone wipes the wrapper
    var obs = new MutationObserver(function () {
      if (!document.getElementById(CINEMATIC_ID)) {
        obs.disconnect();
        boot();
      }
    });
    obs.observe(container, { childList: true });

    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  // Wait for React mount + a paint cycle before injecting
  function start() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) return setTimeout(start, 300);
    setTimeout(boot, 1200);
  }
  start();
  window.addEventListener("load", function () { setTimeout(boot, 1200); });
})();
