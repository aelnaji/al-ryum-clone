## 2025-05-18 - Lenis Smooth Scroll Focus Transfer
**Learning:** Programmatic smooth scroll with Lenis leaves keyboard focus on the origin link, breaking tab order and screen reader orientation for target sections.
**Action:** Transfer programmatic focus to the target element using `target.focus({ preventScroll: true })` upon Lenis scroll completion, setting `tabindex="-1"` if non-focusable.
