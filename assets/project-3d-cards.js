/**
 * project-3d-cards.js
 * Mouse-tracked 3D tilt cards for project listings — uses your EXISTING
 * project photos (assets/real/*.jpg). No new images, no WebGL, no redesign.
 *
 * HTML — wrap each existing project photo + its info like this:
 *
 *   <div class="project-card-3d">
 *     <div class="project-card-3d__inner">
 *       <div class="project-card-3d__image">
 *         <img src="/assets/real/Louvre_Abu_Dhabi/cover.jpg" alt="Louvre Abu Dhabi">
 *       </div>
 *       <div class="project-card-3d__info">
 *         <h3>Louvre Abu Dhabi</h3>
 *         <p>Landscaping & softscape works</p>
 *       </div>
 *     </div>
 *     <div class="project-card-3d__glare"></div>
 *   </div>
 *
 * CSS (required — the 3D effect depends on perspective + transform-style):
 *
 *   .project-card-3d {
 *     position: relative;
 *     perspective: 1000px;
 *     border-radius: 16px;
 *     overflow: hidden;
 *   }
 *   .project-card-3d__inner {
 *     display: flex;
 *     align-items: stretch;
 *     gap: 1.5rem;
 *     transform-style: preserve-3d;
 *     transition: transform 0.1s ease-out;
 *     will-change: transform;
 *     background: #fff;
 *     border-radius: 16px;
 *   }
 *   .project-card-3d__image { flex: 1 1 55%; overflow: hidden; border-radius: 16px 0 0 16px; }
 *   .project-card-3d__image img { width: 100%; height: 100%; object-fit: cover; display: block; transform: translateZ(20px); }
 *   .project-card-3d__info { flex: 1 1 45%; padding: 1.5rem; transform: translateZ(10px); }
 *   .project-card-3d__glare {
 *     position: absolute; inset: 0; pointer-events: none;
 *     background: radial-gradient(circle at var(--glare-x,50%) var(--glare-y,50%), rgba(255,255,255,0.25), transparent 60%);
 *     opacity: 0; transition: opacity 0.2s ease;
 *   }
 *   .project-card-3d:hover .project-card-3d__glare { opacity: 1; }
 *
 * Then call initProject3DCards() once after DOM is ready.
 */

export function initProject3DCards({
  selector = '.project-card-3d',
  maxTilt = 10,
  perspective = 1000,
  scaleOnHover = 1.03,
} = {}) {
  const cards = document.querySelectorAll(selector);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  cards.forEach((card) => {
    const inner = card.querySelector('.project-card-3d__inner');
    const glare = card.querySelector('.project-card-3d__glare');
    if (!inner) return;

    if (prefersReducedMotion) return;

    let rafId = null;

    function handleMove(e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const percentX = (x / rect.width - 0.5) * 2;
      const percentY = (y / rect.height - 0.5) * 2;

      const rotateY = percentX * maxTilt;
      const rotateX = -percentY * maxTilt;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        inner.style.transform =
          `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scaleOnHover}, ${scaleOnHover}, ${scaleOnHover})`;

        if (glare) {
          glare.style.setProperty('--glare-x', `${(x / rect.width) * 100}%`);
          glare.style.setProperty('--glare-y', `${(y / rect.height) * 100}%`);
        }
      });
    }

    function handleLeave() {
      if (rafId) cancelAnimationFrame(rafId);
      inner.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    }

    card.addEventListener('mousemove', handleMove);
    card.addEventListener('mouseleave', handleLeave);
  });

  return {
    destroy() {
      cards.forEach((card) => {
        card.replaceWith(card.cloneNode(true));
      });
    },
  };
}
