/**
 * Implementation Notes: assets/cinematic-scroll.js
 * -----------------------------------------------------------------------------
 * 1. Easing Curves Choice:
 *    - 3D Reel Zoom Transition: Uses `expo.out` (or `power2.inOut` with scrub) for a smooth, high-impact expansion as the user scrolls into the section.
 *    - Parallax Depth Cards: Uses linear scrubbing (`ease: "none"`) with ScrollTrigger so card movement tracks 1:1 with scroll position.
 *    - Card Tilt Motion: Uses cubic-bezier (`cubic-bezier(0.25, 1, 0.5, 1)`) CSS transitions for fluid 3D hover response.
 *
 * 2. Scrub Values:
 *    - `data-reel-cover` Zoom: Uses `scrub: 1` to give a subtle momentum/lag while scrubbing through the zoom beat.
 *    - Project Multi-speed Parallax: Uses `scrub: 0.8` to smooth out scroll variations while maintaining depth distinction.
 *
 * 3. Mobile Behavior (`isDesktop` guard):
 *    - Desktop threshold is defined as `window.innerWidth >= 768`.
 *    - On mobile (< 768px), heavy 3D zoom pinning, z-axis transforms, and multi-speed y-parallax offsets are disabled.
 *    - Cards layout gracefully into standard responsive grid columns without scroll distortion.
 *
 * 4. Hook System Integration:
 *    - `data-reel-cover`: Targets the featured zoom container element, scaling it up smoothly on scroll to achieve 3D cinematic depth.
 *    - Interactive elements in Projects, Services, Journey, and Contact sections are enhanced with GSAP ScrollTriggers.
 */

(function () {
  "use strict";

  if (window.__cinematicScrollLoaded) return;
  window.__cinematicScrollLoaded = true;

  const isDesktop = () => window.innerWidth >= 768;

  function initCinematicScroll() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    // ── 1. 3D ZOOM TRANSITION (data-reel-cover) ──
    const reelCover = document.querySelector("[data-reel-cover]");
    if (reelCover) {
      if (isDesktop()) {
        gsap.fromTo(
          reelCover,
          { scale: 0.88, borderRadius: "24px" },
          {
            scale: 1.05,
            borderRadius: "0px",
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: reelCover.closest("section") || reelCover,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }
    }

    // ── 2. MULTI-SPEED PARALLAX DEPTH (Projects Section) ──
    const projectCards = document.querySelectorAll(".project-card");
    if (projectCards.length > 0 && isDesktop()) {
      projectCards.forEach((card) => {
        const speed = parseFloat(card.getAttribute("data-speed")) || 1.0;
        const yOffset = (1 - speed) * 150;

        gsap.fromTo(
          card,
          { y: yOffset },
          {
            y: -yOffset,
            ease: "none",
            scrollTrigger: {
              trigger: card.closest("section") || card,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          }
        );
      });
    }

    // ── 3. 3D TILT EFFECT ON MOUSEMOVE (Project Cards) ──
    if (isDesktop()) {
      projectCards.forEach((card) => {
        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const rx = ((y / rect.height) - 0.5) * -14;
          const ry = ((x / rect.width) - 0.5) * 14;
          card.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener("mouseleave", () => {
          card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
        });
      });
    }

    // ── 4. STAGGERED REVEAL FOR SERVICES & JOURNEY ──
    const serviceCards = document.querySelectorAll(".service-card");
    if (serviceCards.length > 0) {
      gsap.fromTo(
        serviceCards,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: "#services",
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    const timelineItems = document.querySelectorAll(".timeline-item");
    if (timelineItems.length > 0) {
      timelineItems.forEach((item, index) => {
        gsap.fromTo(
          item,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: item,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }

    // Refresh ScrollTrigger after layout
    ScrollTrigger.refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCinematicScroll);
  } else {
    initCinematicScroll();
  }
})();
