## 2025-02-18 - Lenis Smooth Scroll Focus Management
**Learning:** Smooth scroll libraries (like Lenis) scroll the viewport to anchor link targets (e.g. `#about`, `#projects`), but leave keyboard/screen-reader focus on the clicked link in the header. When keyboard or screen reader users press Tab after smooth scrolling, they are bounced back to top navigation.
**Action:** In Lenis `onComplete` scroll callback, set `tabindex="-1"` on target section (if not focusable) and call `target.focus({ preventScroll: true })` to transfer focus smoothly.
