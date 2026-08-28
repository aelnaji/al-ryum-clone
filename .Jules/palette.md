# Palette's UX & Accessibility Journal

## 2026-08-28 - Lenis Smooth Scroll Focus Management
**Learning:** When using smooth scroll libraries like Lenis for anchor navigation, DOM focus remains on the clicked anchor link instead of moving to the target section. This leaves screen reader users and keyboard navigators trapped at the top of the page.
**Action:** In `onComplete` callbacks for smooth scroll navigations, check if the target element is focusable (adding `tabindex="-1"` if necessary) and call `target.focus({ preventScroll: true })`.
