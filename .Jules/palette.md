## 2025-05-18 - Smooth Scroll Focus Management & Dynamic Anchor Navigation
**Learning:** Programmatic smooth scrolling (e.g. via Lenis) without focus management leaves keyboard users and screen reader focus trapped at the trigger link. Furthermore, attaching static click listeners on page load misses anchor links dynamically rendered by React.
**Action:** Use document-level event delegation for `a[href^="#"]` and transfer programmatic focus to the target section using `target.focus({ preventScroll: true })` (setting `tabindex="-1"` if necessary) upon scroll completion.
