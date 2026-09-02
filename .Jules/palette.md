# Palette's UX & Accessibility Journal

## 2025-09-02 - Anchor Navigation Accessibility with Lenis Smooth Scroll
**Learning:** When using Lenis (or any programmatic smooth scroll library), clicking anchor links scrolls the view smoothly to target sections, but keyboard and screen reader focus remains stuck on the trigger link. Programmatically transferring focus to the target section (`target.focus({ preventScroll: true })`) upon scroll completion is essential for logical focus flow and screen reader user context.
**Action:** Always add an `onComplete` hook to smooth scroll transitions that ensures target sections receive focus with `preventScroll: true` and `tabindex="-1"` if necessary.
