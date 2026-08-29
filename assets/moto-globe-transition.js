(() => {
  "use strict";

  if (window.__motoGlobeTransitionLoaded) return;
  window.__motoGlobeTransitionLoaded = true;

  let initialized = false;

  function init() {
    if (initialized) return;
    const section = document.getElementById("global-reach");
    const stage = section?.querySelector(".globe-stage");
    if (!section || !stage || !window.gsap || !window.ScrollTrigger) {
      return;
    }
    initialized = true;

    gsap.registerPlugin(ScrollTrigger);

    const canvas = stage.querySelector(".gcc-globe-canvas");
    const copy = stage.querySelector(".stage-copy");
    const cityIndex = stage.querySelector(".city-index");
    const markers = stage.querySelector(".marker-labels");
    const readout = stage.querySelector(".network-readout");
    const cue = stage.querySelector(".scroll-cue");

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${Math.max(window.innerHeight * 1.5, 720)}`,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    if (canvas) {
      timeline
        .to(canvas, { scale: 1.08, yPercent: 4, ease: "none" }, 0)
        .to(canvas, { opacity: 0.78, ease: "none" }, 0.55);
    }
    if (copy) {
      timeline.to(copy, { yPercent: -24, opacity: 0, ease: "none" }, 0.5);
    }
    if (markers) {
      timeline.to(markers, { scale: 1.14, ease: "none" }, 0.58);
    }
    if (readout) {
      timeline.to(readout, { opacity: 0, ease: "none" }, 0.64);
    }
    if (cue) {
      timeline.to(cue, { opacity: 0, ease: "none" }, 0.42);
    }

    requestAnimationFrame(() => ScrollTrigger.refresh());
    setTimeout(() => ScrollTrigger.refresh(), 250);
  }

  function observeMount() {
    const mountRoot = document.getElementById("root") || document.body;
    if (!mountRoot) return;
    const observer = new MutationObserver(init);
    observer.observe(mountRoot, { childList: true, subtree: true });
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeMount, { once: true });
  } else {
    observeMount();
  }
})();
