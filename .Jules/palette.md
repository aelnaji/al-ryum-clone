## 2026-08-30 - Focus Transfer on Smooth Scroll Anchor Navigation
**Learning:** Smooth scroll libraries like Lenis move the scroll position visually, but focus remains on the clicked anchor link. For keyboard and screen reader users, tabbing after a smooth scroll jump unexpectedly jumps back to elements following the original anchor link instead of continuing through the scrolled target section.
**Action:** Always set `tabindex="-1"` on non-interactive target elements if necessary and call `target.focus({ preventScroll: true })` in the scroll library's `onComplete` callback.
