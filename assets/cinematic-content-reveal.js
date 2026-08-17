/**
 * cinematic-content-reveal.js
 * Applies scroll-driven parallax + cinematic reveal to EXISTING images —
 * no new assets, no redesign. Works alongside your current hero frame-scrub
 * (index-v10-scrub.js) and cinematic-scroll.js.
 *
 * Requires: GSAP + ScrollTrigger (already bundled in your index-v10-timeline.js)
 * Optional: Lenis for smooth scroll (npm i lenis, or <script src="https://unpkg.com/lenis@1/dist/lenis.min.js">)
 *
 * HTML — just add data attributes to images you ALREADY have. No markup restructuring needed:
 *
 *   <div class="parallax-wrap">
 *     <img src="/assets/real/gallery-17.jpg" data-parallax="0.15" alt="">
 *   </div>
 *
 *   <img src="/assets/real/journey-1989-founded.png" data-reveal alt="">
 *   <img src="/assets/real/journey-2011-international-expansion.png" data-reveal alt="">
 *   <img src="/assets/real/journey-2020-expo-dubai.png" data-reveal alt="">
 *
 * Then just call initCinematicContentReveal() once, after DOM is ready.
 */

export function initLenisSmoothScroll() {
  if (typeof Lenis === 'undefined') {
    console.warn('[cinematic-content-reveal] Lenis not loaded — skipping smooth scroll init.');
    return null;
  }

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  return lenis;
}

export function initCinematicContentReveal() {
  if (!window.gsap || !window.ScrollTrigger) {
    console.warn('[cinematic-content-reveal] GSAP/ScrollTrigger not found — aborting.');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-parallax]').forEach((img) => {
    const strength = parseFloat(img.dataset.parallax) || 0.15;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      img,
      { yPercent: -strength * 100 },
      {
        yPercent: strength * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.parallax-wrap') || img.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  });

  document.querySelectorAll('[data-reveal]').forEach((img) => {
    if (prefersReducedMotion) {
      img.style.clipPath = 'inset(0 0 0 0)';
      return;
    }

    gsap.set(img, {
      clipPath: 'inset(0 0 100% 0)',
      scale: 1.08,
      transformOrigin: 'center center',
    });

    gsap.to(img, {
      clipPath: 'inset(0 0 0% 0)',
      scale: 1,
      duration: 1.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: img,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
  });

  document.querySelectorAll('[data-reveal-text]').forEach((el) => {
    if (prefersReducedMotion) return;

    gsap.from(el, {
      y: 30,
      opacity: 0,
      duration: 0.9,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}

export function initCinematic() {
  initLenisSmoothScroll();
  initCinematicContentReveal();

  window.addEventListener('resize', () => {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
}
