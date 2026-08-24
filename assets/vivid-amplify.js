/* ============================================================================
   vivid-amplify.js — REMIX of the Al Ryum scroll experience (vivid-test)
   ----------------------------------------------------------------------------
   Amplifies the existing scroll with techniques borrowed from vividsites free
   templates:
     - HERO PUSH-ZOOM   : hero scrub canvas scales 1 -> 1.18 as you scroll
                          (a camera push on top of the existing frame scrub)
     - LIQUID-GLASS UI  : nav + CTA buttons get backdrop-blur + glowing
                          gradient border (cinematic template)
     - BLUR-FADE-UP     : hero + section headlines reveal with blur->focus
                          and a rise, staggered (cinematic template)
     - CINEMATIC BOTTOM : fixed backdrop-blur mask at the bottom of the
                          viewport for a premium film-grade feel
     - SCROLL DEPTH     : every major section gets a subtle y-parallax so the
                          page feels deeper and more cinematic while scrolling

   Injected as a standalone script — no edits to the React bundle. Guarded by
   a window flag + MutationObserver re-inject, same pattern as al-ryum-motion.js.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__vividAmplifyLoaded) return;
  window.__vividAmplifyLoaded = true;

  var VERSION = "vivid-remix-v1";

  /* ---------- inject CSS once ---------- */
  var STYLE_ID = "vivid-amplify-css";
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var css = "\
/* liquid glass surface (cinematic template) */\n\
.liquid-glass {\n\
  background: rgba(255,255,255,0.03);\n\
  background-blend-mode: luminosity;\n\
  -webkit-backdrop-filter: blur(10px);\n\
  backdrop-filter: blur(10px);\n\
  border: none;\n\
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.12);\n\
  position: relative;\n\
  overflow: hidden;\n\
  transition: background .3s ease;\n\
}\n\
.liquid-glass::before {\n\
  content: ''; position: absolute; inset: 0; border-radius: inherit;\n\
  padding: 1.4px; pointer-events: none;\n\
  background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.18) 80%, rgba(255,255,255,0.5) 100%);\n\
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);\n\
  -webkit-mask-composite: xor;\n\
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);\n\
  mask-composite: exclude;\n\
}\n\
.liquid-glass:hover { background: rgba(255,255,255,0.08); }\n\
/* force the glass nav over the site's solid nav.bg-white !important */\n\
nav.liquid-glass {\n\
  background: rgba(255,255,255,0.06) !important;\n\
  -webkit-backdrop-filter: blur(14px) !important;\n\
  backdrop-filter: blur(14px) !important;\n\
  border-radius: 14px !important;\n\
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.12) !important;\n\
  border: none !important;\n\
}\n\
nav.liquid-glass a, nav.liquid-glass button { color: #0a1416 !important; }\n\
/* blur-fade-up reveal (cinematic template) */\n\
@keyframes vividBlurFadeUp {\n\
  from { opacity: 0; filter: blur(20px); transform: translateY(40px); }\n\
  to   { opacity: 1; filter: blur(0); transform: translateY(0); }\n\
}\n\
.vivid-blur-fade {\n\
  opacity: 0; filter: blur(20px); transform: translateY(40px);\n\
  animation: vividBlurFadeUp 1s ease-out forwards;\n\
}\n\
/* cinematic bottom blur mask (cinematic template) */\n\
#vivid-bottom-blur {\n\
  position: fixed; left: 0; right: 0; bottom: 0; height: 34vh; z-index: 9996;\n\
  pointer-events: none;\n\
  -webkit-backdrop-filter: blur(14px);\n\
  backdrop-filter: blur(14px);\n\
  -webkit-mask-image: linear-gradient(to top, black 0%, transparent 62%);\n\
  mask-image: linear-gradient(to top, black 0%, transparent 62%);\n\
  opacity: 0;\n\
  transition: opacity .8s ease;\n\
}\n\
/* hero push-zoom transform origin */\n\
#hero-scrub-canvas { transform-origin: center center; will-change: transform; }\n\
";
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- apply liquid-glass to nav + hero CTAs ---------- */
  function applyLiquidGlass() {
    var nav = document.querySelector("nav");
    if (nav && !nav.dataset.vividGlass) {
      nav.classList.add("liquid-glass");
      // force transparent blur over the solid bg-white so the glass reads
      nav.style.background = "rgba(255,255,255,0.06)";
      nav.style.backdropFilter = "blur(14px)";
      nav.style.webkitBackdropFilter = "blur(14px)";
      nav.style.borderRadius = "14px";
      nav.style.boxShadow = "inset 0 1px 1px rgba(255,255,255,0.12)";
      nav.style.margin = "0.75rem 1rem";
      nav.dataset.vividGlass = "1";
    }
    var hero = heroSection();
    if (hero) {
      hero.querySelectorAll("a, button").forEach(function (el) {
        var t = (el.innerText || "").trim();
        if (!el.dataset.vividGlass && (t === "Scroll down" || t === "Read more" || /learn more/i.test(t))) {
          el.classList.add("liquid-glass");
          el.dataset.vividGlass = "1";
        }
      });
    }
  }

  function heroSection() {
    var c = document.getElementById("hero-scrub-canvas");
    return c ? c.closest("section") : null;
  }

  /* ---------- blur-fade-up on hero text (cinematic template) ---------- */
  function applyBlurFade() {
    var hero = heroSection();
    if (hero) {
      var textHost = null;
      hero.querySelectorAll("div").forEach(function (d) {
        var t = (d.innerText || "");
        if (/shape the future|don.t just build/i.test(t) && !textHost) textHost = d;
      });
      if (textHost) {
        textHost.querySelectorAll("h1, p, a, button, span").forEach(function (el, i) {
          if (el.dataset.vividBf) return;
          el.dataset.vividBf = "1";
          el.classList.add("vivid-blur-fade");
          el.style.animationDelay = (0.1 + i * 0.15) + "s";
        });
      }
    }
  }

  /* ---------- hero push-zoom (amplify the scrub) ---------- */
  function applyHeroZoom() {
    var canvas = document.getElementById("hero-scrub-canvas");
    if (!canvas || !window.gsap || !window.ScrollTrigger) return;
    var hero = canvas.closest("section");
    if (!hero || canvas.dataset.vividZoom) return;
    canvas.dataset.vividZoom = "1";
    gsap.fromTo(canvas, { scale: 1 }, {
      scale: 1.18, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "+=1400", scrub: true }
    });
  }

  /* ---------- cinematic bottom blur (fade in after load) ---------- */
  function addBottomBlur() {
    if (document.getElementById("vivid-bottom-blur")) return;
    var d = document.createElement("div");
    d.id = "vivid-bottom-blur";
    document.body.appendChild(d);
    setTimeout(function () { d.style.opacity = "1"; }, 1200);
  }

  /* ---------- scroll-depth parallax on major sections ---------- */
  function applyDepth() {
    if (!window.gsap || !window.ScrollTrigger) return;
    var ids = ["about", "solutions", "global-reach", "journey", "projects", "news"];
    ids.forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec || sec.dataset.vividDepth) return;
      sec.dataset.vividDepth = "1";
      // subtle y parallax + slight scale so the whole page breathes while scrolling
      gsap.fromTo(sec, { y: 0 }, {
        y: -40, ease: "none",
        scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 1 }
      });
    });
  }

  /* ---------- boot ---------- */
  var HOST_ID = "vivid-amplify-host";
  function boot() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) { setTimeout(boot, 300); return; }
    injectCss();
    applyLiquidGlass();
    applyBlurFade();
    addBottomBlur();
    applyHeroZoom();
    applyDepth();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function start() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) { setTimeout(start, 300); return; }
    setTimeout(boot, 900);
  }
  start();
  window.addEventListener("load", function () { setTimeout(boot, 900); });
  // re-apply if React ever re-renders and drops our styling hooks
  var obs = new MutationObserver(function () {
    if (!document.getElementById(STYLE_ID)) { injectCss(); applyLiquidGlass(); applyBlurFade(); }
  });
  setTimeout(function () {
    var root = document.getElementById("root");
    if (root && root.firstElementChild) obs.observe(root.firstElementChild, { childList: true, subtree: true });
  }, 1500);
})();
