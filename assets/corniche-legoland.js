/* ============================================================================
   corniche-legoland.js — Corniche → Legoland first/last-shot scroll transition
   ----------------------------------------------------------------------------
   A pinned, scroll-scrubbed cinematic film built from the Corniche→Legoland
   transition video (generated in Google Flow, exported to WebP frames via
   ezgif.com/video-to-webp).

   WHERE TO DROP THE FRAMES:
     /assets/frames/corniche-legoland/frame_0001.webp … frame_00NN.webp

   The script auto-detects the frame count (binary probe, no hardcoded N), and
   stays dormant until at least frame_0001.webp exists — so you can drop the
   frames in whenever the transition is ready and it lights up.

   Same architecture as al-ryum-cinematic.js (injected before #projects, canvas
   frame-scrub, no bundle edit). Fully revertible by removing this script tag.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__cornicheLegolandLoaded) return;
  window.__cornicheLegolandLoaded = true;
  if (!window.gsap || !window.ScrollTrigger) return;

  var FRAME_BASE = "assets/frames/corniche-legoland/";
  var frameUrl = function (n) { return FRAME_BASE + "frame_" + String(n).padStart(4, "0") + ".webp"; };

  /* ---------- discover frame count (binary probe) ---------- */
  function frameExists(n) {
    try { return fetch(frameUrl(n), { method: "HEAD" }).then(function (r) { return r.ok; }); }
    catch (e) { return Promise.resolve(false); }
  }
  async function countFrames() {
    if (!(await frameExists(1))) return 0;
    var lo = 1, hi = 2;
    while (hi <= 600 && (await frameExists(hi))) { lo = hi; hi *= 2; }
    while (lo < hi) { var mid = Math.ceil((lo + hi) / 2); if (await frameExists(mid)) lo = mid; else hi = mid - 1; }
    return lo;
  }

  /* ---------- inject the film section ---------- */
  function sectionHTML() {
    return '<section class="cl-film" id="cl-film" style="position:relative;height:100vh;overflow:hidden;background:#05070a;">' +
      '<canvas id="cl-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:none;"></canvas>' +
      '<div style="position:absolute;left:0;right:0;bottom:9%;text-align:center;z-index:3;pointer-events:none;padding:0 1.5rem;">' +
        '<span style="display:block;font-size:.78rem;letter-spacing:.3em;text-transform:uppercase;color:#C8A86E;">First shot → last shot</span>' +
        '<h2 style="font-size:clamp(1.8rem,5vw,3.4rem);text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-top:.6rem;color:#f8fafa;">From the Corniche<br/>to Legoland</h2>' +
        '<p style="margin-top:.5rem;opacity:.85;color:#f8fafa;">One seamless cinematic flight across the projects we shape.</p>' +
      '</div>' +
    '</section>';
  }

  function coverCrop(iw, ih, W, H) { var s = Math.max(W / iw, H / ih); return { dx: (W - iw * s) / 2, dy: (H - ih * s) / 2, dw: iw * s, dh: ih * s }; }

  function bindFilm(total) {
    var canvas = document.getElementById("cl-canvas");
    if (!canvas) return;
    var section = document.getElementById("cl-film");
    var ctx = canvas.getContext("2d");
    var imgs = new Array(total), done = 0;
    new Promise(function (resolve) {
      for (var i = 0; i < total; i++) {
        (function (idx) {
          var im = new Image();
          im.decoding = "async";
          im.onload = function () { imgs[idx] = im; if (++done >= total) resolve(); };
          im.onerror = function () { imgs[idx] = null; if (++done >= total) resolve(); };
          im.src = frameUrl(idx + 1);
        })(i);
      }
      setTimeout(resolve, 30000);
    }).then(function () {
      var good = imgs.filter(Boolean);
      if (!good.length) return;
      var W = 0, H = 0, dpr = 1, current = -1;
      function sizeCanvas() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        var r = canvas.getBoundingClientRect();
        W = r.width || window.innerWidth; H = r.height || window.innerHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
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
        if (!rafPending) { rafPending = true; requestAnimationFrame(function () { rafPending = false; current = i; draw(i); }); }
      }
      ScrollTrigger.create({ trigger: section, start: "top top", end: "+=1800", pin: true, scrub: true, anticipatePin: 1,
        onUpdate: function (self) { scheduleDraw(Math.round(self.progress * (good.length - 1))); } });
      window.addEventListener("resize", function () { sizeCanvas(); if (current >= 0) draw(current); });
      gsap.fromTo(section.querySelectorAll("h2, p, span"), { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, stagger: 0.08, ease: "power2.out",
        scrollTrigger: { trigger: section, start: "25% top", end: "55% top", scrub: true }
      });
      gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "top top", scrub: true } });
      canvas.style.display = "block";
      sizeCanvas();
      scheduleDraw(0);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }

  /* ---------- boot: insert section + bind once frames exist ---------- */
  var HOST = "cl-host";
  function boot() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) { setTimeout(boot, 300); return; }
    var container = root.firstElementChild;
    var projects = document.getElementById("projects");
    if (!container || !projects) { setTimeout(boot, 300); return; }

    countFrames().then(function (total) {
      if (total < 2) { setTimeout(boot, 4000); return; } // frames not ready yet — keep waiting
      if (document.getElementById(HOST)) { bindFilm(total); return; }
      var wrap = document.createElement("div");
      wrap.id = HOST;
      wrap.setAttribute("data-cl", "1");
      wrap.innerHTML = sectionHTML();
      container.insertBefore(wrap, projects);
      bindFilm(total);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }
  function start() { var root = document.getElementById("root"); if (!root || !root.children.length) { setTimeout(start, 300); return; } setTimeout(boot, 1200); }
  start();
  window.addEventListener("load", function () { setTimeout(boot, 1200); });
})();
