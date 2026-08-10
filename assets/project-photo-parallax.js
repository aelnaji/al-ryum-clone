const selector = 'img[src*="/assets/projects/"]';
const photos = new Set();
let frame = 0;

const style = document.createElement("style");
style.textContent = `
  img.ar-project-photo {
    transform: translate3d(0, var(--ar-project-y, 0px), 0) scale(var(--ar-project-scale, 1));
    transform-origin: center;
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    img.ar-project-photo {
      transform: none !important;
      will-change: auto;
    }
  }
`;
document.head.appendChild(style);

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

function collect(root = document) {
  root.querySelectorAll(selector).forEach((photo) => {
    if (!photos.has(photo)) {
      photos.add(photo);
      photo.classList.add("ar-project-photo");
    }
  });
  schedule();
}

function update() {
  frame = 0;
  const viewportHeight = window.innerHeight;

  for (const photo of photos) {
    if (!photo.isConnected) {
      photos.delete(photo);
      continue;
    }

    const rect = photo.getBoundingClientRect();
    if (rect.bottom < -120 || rect.top > viewportHeight + 120) continue;

    const distance = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
    const focus = Math.max(0, 1 - Math.min(1, Math.abs(distance)));

    photo.style.setProperty("--ar-project-scale", (1.04 + focus * 0.08).toFixed(3));
    photo.style.setProperty("--ar-project-y", `${(-distance * 18).toFixed(1)}px`);
  }
}

// ponytail: reuse the existing gallery; no second carousel or animation dependency.
const observer = new MutationObserver(() => collect());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", schedule);
collect();
