/* AL RYUM — Header theme switcher.
   Adds one small control to the floating nav that flips the header strip between the ink-and-gold
   (default) and the light ivory variant. The choice is remembered per browser, and a matching inline
   snippet in <head> applies it before first paint so there is no flash of the wrong theme.

   It only touches the header: it appends one button and toggles one class on <html>. No React markup
   is modified, and every route gets the same control. */
(function () {
  "use strict";
  if (window.__alryumThemeToggle) return;
  window.__alryumThemeToggle = true;

  var KEY = "alryum-header-theme-v2"; // v2: ink became the default
  var CLASS = "ar-theme-dark";

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function isDark() {
    return document.documentElement.classList.contains(CLASS);
  }
  function apply(dark) {
    document.documentElement.classList.toggle(CLASS, dark);
    remember(dark ? "dark" : "light");
    syncLabel();
  }

  var btn = null;
  function syncLabel() {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(isDark()));
    btn.setAttribute("title", isDark() ? "Switch the header to the light theme" : "Switch the header to the dark theme");
    // icon-only: the moon means "go dark", the sun means "go light"
    btn.setAttribute("data-mode", isDark() ? "dark" : "light");
  }

  function build() {
    var nav = document.querySelector("header nav");
    if (!nav) return false;
    if (nav.querySelector(".ar-theme-toggle")) { btn = nav.querySelector(".ar-theme-toggle"); syncLabel(); return true; }

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ar-theme-toggle";
    btn.setAttribute("aria-label", "Toggle the header theme");
    btn.innerHTML =
      '<svg class="ar-tt-moon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>' +
      '</svg>' +
      '<svg class="ar-tt-sun" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4.2"/>' +
        '<path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/>' +
      '</svg>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      apply(!isDark());
    });

    // Append to the nav itself. The old parent was the link row, which is "hidden xl:flex",
    // so below that breakpoint the control sat inside a display:none box — invisible and unclickable.
    nav.appendChild(btn);
    syncLabel();
    return true;
  }

  function sync() {
    if (!build()) return;
    syncLabel();
  }

  // React re-renders the header on navigation; keep the control present without touching its markup.
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var r = orig.apply(this, arguments); setTimeout(sync, 80); return r; };
  });
  addEventListener("popstate", function () { setTimeout(sync, 80); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync);
  else sync();

  var mo = new MutationObserver(function () {
    if (!document.querySelector(".ar-theme-toggle")) sync();
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
})();
