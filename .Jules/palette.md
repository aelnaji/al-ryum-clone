## 2025-09-03 - Accessible Anchor Link Focus Management
**Learning:** Smooth scroll libraries like Lenis intercept default jump navigation, which prevents screen readers and keyboard users from moving focus to the target section.
**Action:** In Lenis `scrollTo` callbacks, ensure the target element has `tabindex="-1"` if non-interactive, and call `t.focus({ preventScroll: true })` upon scroll completion.
