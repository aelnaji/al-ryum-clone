/* ════════════════════════════════════════════════════════════════
   al-ryum-project-detail.js
   Project card detail overlay.
   The bundled React cards push a `/projects/:id` route that has NO
   handler on this static SPA → clicking a card did nothing (just
   changed the URL and jumped to top). This script intercepts the
   card click, loads the project from assets/projects-data.json, and
   opens a full-screen detail view with the project's info + gallery.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.__alryumProjectDetail) return;
  window.__alryumProjectDetail = true;

  var DATA = null;
  var overlay = null;
  var currentIndex = 0;
  var currentList = [];
  var lockedScrollY = 0;
  var savedLenisOptions = null;

  // Lenis (v1.1.x) hijacks wheel via an internal VirtualScroll that
  // preventDefaults even when .stop() is called — so .stop() never lets the
  // overlay content scroll. Reliable fix: destroy Lenis on open, rebuild it
  // with the same options on close.
  function lenisOff() {
    if (window.lenis && typeof window.lenis.destroy === "function") {
      if (!savedLenisOptions) savedLenisOptions = window.lenis.options || null;
      window.lenis.destroy();
      window.lenis = null;
    }
  }
  function lenisOn() {
    if (savedLenisOptions && window.Lenis) {
      try { window.lenis = new window.Lenis(savedLenisOptions); }
      catch (e) { /* noop */ }
    }
  }

  function loadData() {
    if (DATA) return Promise.resolve(DATA);
    return fetch("/assets/projects-data.json")
      .then(function (r) { if (!r.ok) throw new Error("data " + r.status); return r.json(); })
      .then(function (d) { DATA = d; return d; });
  }

  // Build the overlay DOM once.
  function buildOverlay() {
    if (overlay) return overlay;
    var o = document.createElement("div");
    o.className = "ar-pd-overlay";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.innerHTML = `
      <div class="ar-pd-backdrop" data-ar-pd-close></div>
      <div class="ar-pd-shell">
        <button class="ar-pd-close" type="button" data-ar-pd-close aria-label="Close project">✕</button>
        <div class="ar-pd-media">
          <div class="ar-pd-gallery">
            <img class="ar-pd-hero" data-ar-pd-hero src="" alt="" />
          </div>
          <div class="ar-pd-thumbs" data-ar-pd-thumbs></div>
        </div>
        <div class="ar-pd-content">
          <span class="ar-pd-eyebrow" data-ar-pd-industry></span>
          <h2 class="ar-pd-title" data-ar-pd-title></h2>
          <div class="ar-pd-meta">
            <div><span class="ar-pd-label">Location</span><strong data-ar-pd-location></strong></div>
            <div><span class="ar-pd-label">Client</span><strong data-ar-pd-client></strong></div>
            <div><span class="ar-pd-label">Value</span><strong class="ar-pd-accent" data-ar-pd-value></strong></div>
            <div><span class="ar-pd-label">Year</span><strong data-ar-pd-year></strong></div>
            <div><span class="ar-pd-label">Sector</span><strong data-ar-pd-sector></strong></div>
            <div><span class="ar-pd-label">Status</span><strong data-ar-pd-status></strong></div>
          </div>
          <p class="ar-pd-desc" data-ar-pd-desc></p>
          <div class="ar-pd-nav">
            <button class="ar-pd-prev" type="button" data-ar-pd-prev>← Previous</button>
            <span class="ar-pd-count" data-ar-pd-count></span>
            <button class="ar-pd-next" type="button" data-ar-pd-next>Next →</button>
          </div>
        </div>
      </div>
    `;
    o.addEventListener("click", function (e) {
      if (e.target.closest("[data-ar-pd-close]")) close();
    });
    o.querySelector("[data-ar-pd-prev]").addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
    o.querySelector("[data-ar-pd-next]").addEventListener("click", function (e) { e.stopPropagation(); step(1); });
    document.body.appendChild(o);
    return overlay = o;
  }

  function el(sel) { return overlay.querySelector(sel); }

  function render(p) {
    var images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    currentList = images;
    currentIndex = 0;
    el("[data-ar-pd-industry]").textContent = (p.industry || "").toUpperCase();
    el("[data-ar-pd-title]").textContent = p.name || "";
    el("[data-ar-pd-location]").textContent = p.location || "—";
    el("[data-ar-pd-client]").textContent = p.client || "Al Ryum Group";
    el("[data-ar-pd-value]").textContent = p.value && p.value !== "-" ? p.value : "—";
    el("[data-ar-pd-year]").textContent = p.year && p.year !== "-" ? p.year : "—";
    el("[data-ar-pd-sector]").textContent = p.sector || "—";
    el("[data-ar-pd-status]").textContent = p.status || "—";
    el("[data-ar-pd-desc]").textContent = p.description || "";
    renderHero(0);
    renderThumbs();
    updateCount();
  }

  function renderHero(i) {
    var hero = el("[data-ar-pd-hero]");
    hero.src = currentList[i] || "";
    hero.alt = "";
  }

  function renderThumbs() {
    var host = el("[data-ar-pd-thumbs]");
    host.innerHTML = "";
    currentList.forEach(function (src, i) {
      var b = document.createElement("button");
      b.className = "ar-pd-thumb" + (i === currentIndex ? " is-active" : "");
      b.type = "button";
      b.setAttribute("aria-label", "Image " + (i + 1));
      b.innerHTML = "<img src='" + src + "' alt='' loading='lazy' />";
      b.addEventListener("click", function (e) { e.stopPropagation(); currentIndex = i; renderHero(i); syncThumbs(); updateCount(); });
      host.appendChild(b);
    });
  }

  function syncThumbs() {
    overlay.querySelectorAll(".ar-pd-thumb").forEach(function (b, i) {
      b.classList.toggle("is-active", i === currentIndex);
    });
  }

  function updateCount() {
    el("[data-ar-pd-count]").textContent = (currentIndex + 1) + " / " + currentList.length;
  }

  function step(d) {
    if (!currentList.length) return;
    currentIndex = (currentIndex + d + currentList.length) % currentList.length;
    renderHero(currentIndex);
    syncThumbs();
    updateCount();
  }

  function open(project) {
    buildOverlay();
    render(project);
    overlay.classList.add("is-open");
    lockedScrollY = window.scrollY;
    document.documentElement.classList.add("ar-pd-html-locked");
    document.body.style.top = "-" + lockedScrollY + "px";
    document.body.classList.add("ar-pd-locked");
    lenisOff();
  }

  function openById(id, replaceUrl) {
    return loadData().then(function (data) {
      var project = data.find(function (item) { return item.id === Number(id); });
      if (!project) return false;
      if (replaceUrl) window.history.replaceState({}, "", "/projects/" + project.id);
      open(project);
      return true;
    });
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("ar-pd-html-locked");
    document.body.classList.remove("ar-pd-locked");
    document.body.style.top = "";
    lenisOn();
    window.scrollTo(0, lockedScrollY);
  }

  // Intercept card clicks. The card's <a> CTA also pushes the dead route, so
  // we intercept at capture phase and stop it, then open the detail instead.
  // The cards live in a drag-scroll rail: on a real mouse click the event
  // target sometimes resolves to the rail rather than the card, so if the
  // target isn't a card we fall back to hit-testing the click coordinates.
  function init() {
    document.addEventListener("click", function (e) {
      var card = e.target.closest ? e.target.closest(".icreon-card") : null;
      if (!card && typeof e.clientX === "number") {
        var hit = (typeof document.elementFromPoint === "function")
          ? document.elementFromPoint(e.clientX, e.clientY)
          : null;
        if (hit) card = hit.closest ? hit.closest(".icreon-card") : null;
      }
      if (!card) return;
      var href = card.querySelector("[href]");
      var match = href && href.getAttribute("href").match(/\/projects\/(\d+)$/);
      var titleEl = card.querySelector(".icreon-card__title");
      var name = titleEl ? titleEl.textContent.trim() : "";
      e.preventDefault();
      e.stopPropagation();
      loadData().then(function (data) {
        var p = match
          ? data.find(function (d) { return d.id === Number(match[1]); })
          : data.find(function (d) { return d.name === name; });
        if (p) {
          window.history.pushState({}, "", "/projects/" + p.id);
          open(p);
        }
      });
    }, true);

    window.addEventListener("popstate", function () {
      var match = location.pathname.match(/^\/projects\/(\d+)$/);
      if (match) openById(match[1], false);
      else close();
    });

    var initial = location.pathname.match(/^\/projects\/(\d+)$/);
    if (initial) openById(initial[1], false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
