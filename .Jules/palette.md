## 2026-08-25 - Skip Link Focus Management
**Learning:** Single page apps with smooth custom scrolling (like Lenis) break native anchor jumping and focus placement. Transferring focus (`target.focus({ preventScroll: true })`) on smooth scroll completion restores keyboard and screen reader accessibility without interfering with Lenis animations.
**Action:** Always complement custom JS smooth scrolling on anchor links with programmatic focus management to ensure screen reader focus moves with visual scroll.
