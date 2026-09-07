## 2025-09-07 - Programmatic Focus Transfer on Lenis Smooth Scroll Navigation
**Learning:** In Lenis smooth-scroll single-page sites, anchor link navigation moves the viewport visually to target sections, but leaves keyboard/screen reader focus on the origin link. Without programmatic focus transfer, tab navigation jumps back to the top navigation.
**Action:** Set `tabindex="-1"` on non-focusable target elements and call `target.focus({ preventScroll: true })` inside the `lenis.scrollTo` `onComplete` callback, using event delegation to handle dynamic components.
