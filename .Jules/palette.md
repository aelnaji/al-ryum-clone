## 2026-08-27 - Focus Management for Smooth Scroll Anchor Navigation
**Learning:** Programmatic smooth scroll libraries (like Lenis) obscure browser native focus positioning when intercepting internal anchor clicks (`a[href^="#"]`). Screen reader and keyboard users lose their focus state, remaining stuck on the triggering link after the scroll finishes.
**Action:** In scroll completion callbacks (`onComplete`), set `tabindex="-1"` on target elements if not already focusable, and transfer focus using `target.focus({ preventScroll: true })`.
