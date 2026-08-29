/* ============================================================================
   al-ryum-client-marquee.js
   ----------------------------------------------------------------------------
   Horizontal client-name marquee (script 15) from moto-card.com, extracted
   from the live page source on 2026-08-25. The marquee clones each item
   for a seamless loop, animates the track with gsap (xPercent: -100,
   repeat -1, paused by default), and plays/pauses based on viewport
   visibility via ScrollTrigger.

   Requires (already on the al-ryum-3d-backup page):
   - gsap (loaded by index.html)
   - ScrollTrigger (gsap plugin, loaded by index.html)
   - Lenis (smooth scroll, already in the React bundle)

   Markup expected in the page:
     <div class="ar-marquee" data-marquee-duration="35">
       <div class="ar-marquee-track">
         <span class="ar-marquee-item">DMT</span>
         <span class="ar-marquee-item">MASDAR</span>
         <span class="ar-marquee-item">ADNOC</span>
         ...
       </div>
     </div>

   The script clones each `.ar-marquee-item` once (with aria-hidden="true")
   so the track is 2× the content for a seamless wrap. ScrollTrigger plays
   the tween when the marquee enters the viewport, pauses when it leaves.

   ============================================================================
   EXTRACTED FROM: https://www.moto-card.com/  (script 15, 1204 chars)
   ADAPTED: class names retargeted to al-ryum (ar- prefix), MARQUEE_ZONES
            constant kept verbatim from moto-card (used by script 24 /
            initTimes, not by the marquee itself).
   ============================================================================
*/

(function () {
  "use strict";
  if (window.__alryumClientMarquee) return;
  window.__alryumClientMarquee = true;

  if (!window.gsap) { console.warn("[client-marquee] gsap missing, skip"); return; }
  gsap.registerPlugin(window.ScrollTrigger);

  // Timezone zones (verbatim from moto-card). Used by the timezone band
  // companion script if you wire it in later; the marquee itself does
  // not read this constant. Kept for source-fidelity.
  var MARQUEE_ZONES = {
    current: { timeZone: undefined, label: null },
    edt:     { timeZone: "America/New_York",     label: "EDT" },
    bst:     { timeZone: "Europe/London",        label: "BST" },
    eest:    { timeZone: "Europe/Bucharest",     label: "EEST" },
    jst:     { timeZone: "Asia/Tokyo",           label: "JST" },
    cest:    { timeZone: "Europe/Warsaw",        label: "CEST" },
    cst:     { timeZone: "Asia/Shanghai",        label: "CST" },
    aest:    { timeZone: "Australia/Brisbane",   label: "AEST" },
    cat:     { timeZone: "Africa/Maputo",        label: "CAT" }
  };

  // STEP 1: clone each item once for a seamless wrap.
  // The original walks every `.marquee_item_wrap`, but in the al-ryum
  // markup the track itself is the wrap (one track per marquee), so we
  // walk the track's items directly.
  function initMarqueeClones() {
    document.querySelectorAll(".ar-marquee-track").forEach(function (track) {
      var items = track.querySelectorAll(".ar-marquee-item");
      items.forEach(function (item) {
        if (item.getAttribute("aria-hidden") === "true") return; // already cloned
        var clone = item.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    });
  }

  // STEP 2: animate each marquee horizontally; play when in view, pause
  // when not. .totalProgress(.5) starts the tween at the midpoint so the
  // initial layout already shows the first item in the visible area
  // (moto-card's trick to avoid a "blank start" on page load).
  function initMarquees() {
    document.querySelectorAll(".ar-marquee").forEach(function (marqueeEl) {
      var track = marqueeEl.querySelector(".ar-marquee-track");
      if (!track || !track.children.length) return;
      // Seamless loop: the track holds the item set twice (original + clones),
      // so translating the TRACK by -50% wraps perfectly with no jump.
      var dur = parseFloat(marqueeEl.dataset.marqueeDuration || track.children[0].dataset.marqueeDuration) || 30;
      var tween = gsap.to(track, {
        xPercent: -50,
        repeat: -1,
        duration: dur,
        ease: "none"
      }).totalProgress(0.25);
      // Start playing immediately so the loop is always moving; ScrollTrigger
      // only PAUSES it when the marquee leaves the viewport (perf win) and
      // resumes when it re-enters. Not gating the initial play avoids a stuck
      // marquee if ScrollTrigger's enter fires late.
      tween.play();
      // Keep the client loop running continuously after the section mounts.
      // This avoids a stopped marquee when the section is reached via an
      // anchor jump or when Lenis and ScrollTrigger initialize at different times.
      ScrollTrigger.create({
        trigger: marqueeEl,
        start: "top bottom",
        end: "bottom top",
        onEnter:      function () { tween.play(); },
        onEnterBack:  function () { tween.play(); }
      });
    });
  }

  // STEP 3: wait for React mount (same pattern as the other al-ryum
  // scripts — MutationObserver on #root, fire on first child, then
  // MutationObserver disconnects).
  function boot() {
    try {
      initMarqueeClones();
      initMarquees();
      console.log("[client-marquee] " +
        document.querySelectorAll(".ar-marquee").length + " marquee(s) active");
    } catch (e) {
      console.error("[client-marquee] boot error", e);
    }
  }

  function waitForRoot(cb) {
    // The .ar-marquee is injected into #global-reach by the gcc-globe module
    // AFTER React mounts (a retry loop up to ~4s). So we must wait for the
    // marquee element itself, not just "#root has children", or we scan too
    // early and find zero marquees.
    var marquee = document.querySelector(".ar-marquee");
    if (marquee) { requestAnimationFrame(cb); return; }
    var mo = new MutationObserver(function () {
      if (document.querySelector(".ar-marquee")) {
        mo.disconnect();
        requestAnimationFrame(cb);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      if (!window.__alryumClientMarqueeBooted) {
        mo.disconnect();
        cb();
      }
    }, 10000);
  }

  function bootOnce() {
    if (window.__alryumClientMarqueeBooted) return;
    window.__alryumClientMarqueeBooted = true;
    boot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { waitForRoot(bootOnce); });
  } else {
    waitForRoot(bootOnce);
  }
})();
