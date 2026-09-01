# Palette's UX & Accessibility Journal

## 2025-05-14 - Smooth Scroll Focus Transfer
**Learning:** Smooth scrolling libraries like Lenis move visual viewport without transferring focus, leaving keyboard and screen reader focus on the clicked link.
**Action:** Always set `tabindex="-1"` on non-interactive anchor targets (if missing) and call `target.focus({ preventScroll: true })` on scroll completion.
