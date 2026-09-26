/* ==== AL RYUM @astra ==== hero mist/clouds overlay. Restored from junk/assets/al-ryum-mist.js.
   GPT-6 Astra reviewed + labelled. Injects /assets/hero-mist.mp4 as a continuously-drifting
   cloud/mist layer over the hero so the first shot stays ALIVE with no scroll.
   Disconnect: remove this <script> from index + delete file. */
(function () {
  "use strict";
  if (window.__alryumMist) return;
  window.__alryumMist = true;

  function boot(tries) {
    tries = tries || 0;
    var hero = document.querySelector(
      "section.h-screen, section[class*='h-screen'], #al-ryum-3d-scroll-region, [id*='al-ryum-3d']"
    );
    // fall back to any full-viewport hero-ish section
    if (!hero) hero = document.querySelector("section, div[class*='hero']");
    if (!hero) { if (tries < 80) setTimeout(function () { boot(tries + 1); }, 400); return; }
    if (document.getElementById("hero-mist")) return;

    /* background layer = first absolute inset-0 layer, or the hero itself */
    var bg = hero.querySelector("div.absolute.inset-0, .absolute.inset-0, canvas, [class*='h-screen'] > *") || hero.firstElementChild || hero;

    var v = document.createElement("video");
    v.id = "hero-mist";
    v.src = "/assets/hero-mist.mp4";
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("aria-hidden", "true");
    v.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
      "opacity:0.9;mix-blend-mode:screen;pointer-events:none;z-index:3;";
    bg.appendChild(v);

    function ensurePlay(tries) {
      tries = tries || 0;
      if (tries > 12) return;
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        setTimeout(function () { ensurePlay(tries + 1); }, 500);
      });
    }
    v.addEventListener("canplay", function () { ensurePlay(); });
    v.addEventListener("loadeddata", function () { ensurePlay(); });
    ensurePlay();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) ensurePlay();
    });
    window.addEventListener("focus", function () { ensurePlay(); });
    console.log("[Al Ryum @astra] hero mist/clouds injected");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { boot(); });
  } else {
    boot();
  }
})();
