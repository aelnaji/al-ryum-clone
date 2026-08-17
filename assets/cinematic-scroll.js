/**
 * cinematic-scroll.js
 * Apple-style scroll-scrubbed frame-sequence animation.
 * Drop-in module — does not touch existing index-v10-*.js files.
 *
 * Requires: GSAP + ScrollTrigger already loaded on the page
 * (your repo's index-v10-timeline.js already bundles GSAP, so just
 * make sure gsap.registerPlugin(ScrollTrigger) has run before this loads).
 *
 * HTML you need in index.html (inside your hero section):
 *
 *   <section id="cinematic-hero" class="cinematic-hero">
 *     <canvas id="cinematic-canvas"></canvas>
 *   </section>
 *
 * CSS you need (adjust height to taste — more vh = slower/longer scrub):
 *
 *   .cinematic-hero { position: relative; height: 100vh; overflow: hidden; }
 *   .cinematic-hero canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
 *
 * Then initialize:
 *
 *   import { initCinematicScroll } from './cinematic-scroll.js';
 *   initCinematicScroll({
 *     canvasId: 'cinematic-canvas',
 *     sectionId: 'cinematic-hero',
 *     frameCount: 80,
 *     framePath: (i) => `/transitions/frame_${String(i).padStart(4, '0')}.webp`,
 *     scrollDistance: '+=3000', // total px of scroll the sequence plays over
 *   });
 */

export function initCinematicScroll({
  canvasId,
  sectionId,
  frameCount,
  framePath,
  scrollDistance = '+=3000',
  scrub = 0.6,
} = {}) {
  const canvas = document.getElementById(canvasId);
  const section = document.getElementById(sectionId);

  if (!canvas || !section) {
    console.warn('[cinematic-scroll] canvas or section not found — aborting init.');
    return null;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = canvas.getContext('2d', { alpha: false });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const state = { frame: 0 };
  const images = new Array(frameCount);
  let loadedCount = 0;
  let ready = false;
  let scrollTriggerInstance = null;

  function resizeCanvas() {
    const rect = section.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }

  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let drawWidth, drawHeight, offsetX, offsetY;
    if (imgRatio > canvasRatio) {
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  function preloadFrames(onDone) {
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        loadedCount++;
        if (loadedCount === frameCount) onDone();
      };
      img.src = framePath(i + 1);
      images[i] = img;
    }
  }

  function setupScrollTrigger() {
    resizeCanvas();
    drawFrame(0);

    if (prefersReducedMotion) {
      drawFrame(frameCount - 1);
      return;
    }

    scrollTriggerInstance = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: scrollDistance,
        scrub,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    }).to(state, {
      frame: frameCount - 1,
      ease: 'none',
      onUpdate: () => drawFrame(Math.round(state.frame)),
    });

    ready = true;
  }

  preloadFrames(setupScrollTrigger);

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resizeCanvas();
      if (ready) drawFrame(Math.round(state.frame));
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 150);
  });

  return {
    destroy() {
      scrollTriggerInstance?.scrollTrigger?.kill();
      scrollTriggerInstance?.kill();
    },
  };
}
