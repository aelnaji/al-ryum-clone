/* ════════════════════════════════════════════════════════════════
   Al Ryum — full-page scroll-spy navigation
   Right route rail (one dot per section), top chips nav, top progress
   line, bottom scroll hint. Adapted to the React SPA home page:
   sections are detected live after React mounts, offsets are measured
   at runtime (pin-spacers + huge film sections included), and jumps
   use Lenis when available, native scrollTo otherwise.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.__alryumScrollSpyLoaded) return;
  window.__alryumScrollSpyLoaded = true;

  var ACCENT = "#C8A86E";

  // Sections in page order: label + how to find the element.
  // `sel` is a selector; the first match is used. Offsets are measured
  // live so pin-spacers and huge sections don't break the math.
  var SECTIONS = [
    { label: "Home",       sel: "section, div" },          // hero (first big block)
    { label: "About",      sel: "#about" },
    { label: "Services",   sel: "#solutions" },
    { label: "GCC",        sel: "#global-reach" },
    { label: "Journey",    sel: "#journey" },
    { label: "Films",      sel: "#arc-cinematic-host, #ar-pf-section" },
    { label: "Projects",   sel: "#projects" },
    { label: "News",       sel: "#news" },
    { label: "Contact",    sel: "#contact" }
  ];

  // Hero detection: first element inside the React container.
  var HOME = "/";

  var dots = [], navItems = [], els = [];
  var route, scrollbar, sb, hint, hintText;
  var active = -1;
  var rafPending = false;

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function findSections() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) return false;
    var container = root.firstElementChild;

    // Hero = first direct child of the container (the pin-spacer / hero block)
    var hero = container ? container.firstElementChild : null;

    els = [];
    SECTIONS.forEach(function (s, i) {
      var node = null;
      if (i === 0) {
        node = hero;
      } else {
        try { node = document.querySelector(s.sel.split(",")[0]); }
        catch (e) { node = null; }
        if (!node) {
          // try the secondary selector (e.g. ar-pf-section fallback)
          var parts = s.sel.split(",");
          for (var p = 1; p < parts.length; p++) {
            try { node = document.querySelector(parts[p].trim()); } catch (e2) { node = null; }
            if (node) break;
          }
        }
      }
      els.push(node);
    });
    // Tolerate sections that are not mounted yet (React re-renders on SPA
    // route changes). The hero must exist; missing ones simply get no dot.
    return !!els[0];
  }

  function measure() {
    var vh = window.innerHeight;
    var offsets = els.map(function (n) {
      if (!n) return { start: 0, end: 0 };
      var r = n.getBoundingClientRect();
      return {
        start: r.top + window.scrollY,
        end: r.top + window.scrollY + r.height
      };
    });
    return { offsets: offsets, vh: vh, total: document.body.scrollHeight - vh };
  }

  function build() {
    // rail
    route = el("div", "sw-route");
    route.style.setProperty("--sw-accent", ACCENT);

    // scrollbar
    scrollbar = el("div", "sw-scrollbar");
    sb = el("span");
    scrollbar.appendChild(sb);

    // hint
    hint = el("div", "sw-hint");
    hintText = el("span");
    hintText.textContent = "scroll to explore";
    hint.appendChild(hintText);
    hint.appendChild(el("i"));

    // nav chips — DISABLED. The site has its own fixed header nav, and this
    // white top-center pill (.sw-nav) rendered as a duplicate white panel
    // floating above the hero. The right route rail, progress line and scroll
    // hint are kept.
    var nav = null; // chips nav disabled (see note above)
    navItems = [];  // empty — no nav chips to track

    dots = [];
    SECTIONS.forEach(function (s, i) {
      // dot — hidden when that section is not currently in the DOM
      var dot = el("button", "sw-route__dot");
      dot.type = "button";
      if (!els[i]) dot.style.display = "none";
      dot.setAttribute("aria-label", "Go to " + s.label);
      var lbl = el("span", "sw-route__label");
      lbl.textContent = s.label;
      dot.appendChild(lbl);
      dot.appendChild(el("i"));
      dot.addEventListener("click", function () { jumpTo(i); });
      route.appendChild(dot);
      dots.push(dot);
    });

    document.body.appendChild(route);
    document.body.appendChild(scrollbar);
    document.body.appendChild(hint);

    onScroll();
  }

  function jumpTo(i) {
    if (!els[i]) return;
    var m = measure();
    var target;
    if (i === 0) {
      // Home = very top of the page
      target = 0;
    } else {
      var start = m.offsets[i].start;
      var end = m.offsets[i].end;
      target = start + (end - start) * 0.45;
    }
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.lenis && typeof window.lenis.scrollTo === "function") {
      window.lenis.scrollTo(target, { duration: 1.2, offset: 0 });
    } else {
      window.scrollTo({ top: target, behavior: reduced ? "auto" : "smooth" });
    }
  }

  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      if (!route) return;
      var y = window.scrollY;
      var m = measure();
      var vh = m.vh;

      // active section = last section whose start we have passed (or 60% into it)
      var ci = 0;
      for (var i = 0; i < els.length; i++) {
        if (y >= m.offsets[i].start - vh * 0.35) ci = i;
      }

      if (ci !== active) {
        active = ci;
        dots.forEach(function (d, k) { d.classList.toggle("is-active", k === ci); });
        navItems.forEach(function (n, k) { n.classList.toggle("is-active", k === ci); });
      }

      // progress bar
      var p = m.total > 0 ? Math.max(0, Math.min(1, y / m.total)) : 0;
      sb.style.transform = "scaleX(" + p + ")";

      // hint fades after you start scrolling
      hint.style.opacity = Math.max(0, Math.min(1, 1 - y / (vh * 0.5)));
    });
  }

  // Remove every node this script owns. Needed because the site is an SPA:
  // leaving "/" via client-side routing never reloads the page, so a built
  // rail would otherwise stay stuck on top of every other route.
  function teardown() {
    [".sw-route", ".sw-scrollbar", ".sw-hint"].forEach(function (sel) {
      var nodes = document.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
    });
    route = scrollbar = hint = hintText = sb = null;
    dots = []; navItems = []; els = []; active = -1;
  }

  function isHome() {
    return location.pathname === HOME || location.pathname === "" || location.pathname === "/index.html";
  }

  function sync() {
    if (!isHome()) { teardown(); return; }   // landing page ONLY
    if (document.querySelector(".sw-route")) { onScroll(); return; }
    if (findSections()) build(); else setTimeout(sync, 300);
  }

  function boot() {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // React router navigates with the History API — catch it so the rail is
    // torn down the moment you leave the landing page (and rebuilt if you return).
    ["pushState", "replaceState"].forEach(function (k) {
      var orig = history[k];
      if (typeof orig !== "function") return;
      history[k] = function () {
        var r = orig.apply(this, arguments);
        sync();
        return r;
      };
    });
    window.addEventListener("popstate", sync);

    sync();
    setInterval(sync, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
