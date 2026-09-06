## 2026-09-06 - Smooth Scroll Focus Management
**Learning:** When using smooth scroll libraries like Lenis for in-page anchor links, keyboard focus and screen reader context remain stuck at the trigger link unless focus is explicitly transferred to the target element upon scroll completion.
**Action:** Always set `tabindex="-1"` (if the element is not natively focusable) on the target element and programmatically call `target.focus({ preventScroll: true })` inside the smooth scroll `onComplete` callback.
