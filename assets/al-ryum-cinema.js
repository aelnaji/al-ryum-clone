/* ============================================================================
   AL RYUM — CINEMA ENGINE  (assets/al-ryum-cinema.js, ES module, three.js r182)
   ----------------------------------------------------------------------------
   Scroll-driven 3D layer for the home page. Three parts, one engine:

   1. FIELD  — a pinned chapter before the Project Films. Scroll flies the
               camera through a field of floating panels textured with the
               group's own project photography (assets/field/*.webp).
   2. HUD    — telemetry overlays on each Project Film scene: coordinates,
               site, scope and a status line that advances with the scrub.
   3. REVEAL — sections open from an inset rounded card to full bleed as they
               arrive; key media eases from a slight zoom to rest.

   Contract (same for every scrubbed piece):
   * progress = clamp(-rect.top / (rect.height - innerHeight), 0, 1) of the
     piece's own element, never of the document.
   * damped follow smooth += (target - smooth) * 0.14 per frame; the loop runs
     only while catching up and is re-kicked by every scroll event.
   * IntersectionObserver gating: nothing runs while a piece is off-screen.
   * prefers-reduced-motion / the site's "Cinematic motion" toggle: a single
     still frame, no scrub, no pinned scroll distance.

   Verification handle: window.__alRyumCinema
   ========================================================================= */
import * as THREE from "three";

const DAMPING = 0.14;
const SETTLE = 0.0004;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);
const isHome = () => (location.pathname.replace(/\/+$/, "") || "/") === "/";
const reducedMQ = matchMedia("(prefers-reduced-motion: reduce)");
const motionOn = () =>
  window.alRyumMotion && typeof window.alRyumMotion.enabled === "boolean"
    ? window.alRyumMotion.enabled
    : !reducedMQ.matches;

function sectionProgress(el) {
  const rect = el.getBoundingClientRect();
  return clamp(-rect.top / Math.max(1, el.offsetHeight - innerHeight));
}

/* =============================================================== 1. FIELD */

const FIELD = {
  scrubVh: 2.6, // scroll distance in viewports; scene = scrubVh + 1 pinned viewport
  textures: Array.from({ length: 28 }, (_, i) => `/assets/field/field-${String(i + 1).padStart(2, "0")}.webp?v=2`),
  depth: 150, // world units the camera travels
  beats: [
    { at: [0.02, 0.45], eyebrow: "Al Ryum Group · Since 1989", title: "Over 35 years in the landscape." },
    { at: [0.52, 1.01], eyebrow: "UAE · Saudi Arabia · Qatar · Iraq · Jordan", title: "Built across the region." },
  ],
};

let webglOK = null;
function buildField(anchor) {
  if (webglOK === null) {
    const probe = document.createElement("canvas");
    webglOK = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  }
  if (!webglOK) return null;

  const section = document.createElement("section");
  section.className = "arc-field";
  section.id = "arc-field";
  section.setAttribute("aria-label", "Al Ryum Group — project archive");
  section.innerHTML = `
    <div class="arc-field__stage">
      <canvas class="arc-field__canvas" aria-hidden="true"></canvas>
      <div class="arc-field__hud arc-field__hud--tl" aria-hidden="true">
        <span>ARCHIVE SCAN</span><span data-f-count>PANEL 00 / ${FIELD.textures.length}</span>
      </div>
      <div class="arc-field__hud arc-field__hud--tr" aria-hidden="true">
        <span>ABU DHABI</span><span>24.45°N / 54.38°E</span>
      </div>
      <div class="arc-field__copy">
        ${FIELD.beats
          .map(
            (b, i) => `<div class="arc-field__beat" data-beat="${i}">
              <p class="arc-field__eyebrow">${b.eyebrow}</p>
              <h2 class="arc-field__title">${b.title
                .split(" ")
                .map((w) => `<span class="arc-field__w"><span>${w}</span></span>`)
                .join(" ")}</h2>
            </div>`
          )
          .join("")}
      </div>
      <div class="arc-field__rail" aria-hidden="true"><i></i></div>
    </div>`;
  anchor.parentNode.insertBefore(section, anchor);

  const stage = section.querySelector(".arc-field__stage");
  const canvas = section.querySelector("canvas");
  const beats = [...section.querySelectorAll(".arc-field__beat")];
  const rail = section.querySelector(".arc-field__rail i");
  // Text is updated through the text node's .data (a characterData mutation),
  // never textContent, so page-wide childList observers stay quiet.
  const counter = section.querySelector("[data-f-count]").firstChild;

  const small = matchMedia("(max-width: 820px)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    webglOK = false; // don't retry on every page mutation
    section.remove();
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const BG = new THREE.Color(0x0a1416);
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 18, 70);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

  /* Panels: a loose spiral corridor. Deterministic layout (seeded) so every
     visit flies the same path. */
  let seed = 1989;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const count = small ? 18 : FIELD.textures.length;
  const geo = new THREE.PlaneGeometry(1, 1);
  const loader = new THREE.TextureLoader();
  const panels = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const angle = i * 2.35 + rand() * 0.6;
    const radius = 3.4 + rand() * 2.6;
    const w = 3.4 + rand() * 1.8;
    const mat = new THREE.MeshBasicMaterial({ color: 0x1d3436, transparent: true, opacity: 0, fog: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(w, w * 0.5625, 1);
    mesh.position.set(Math.cos(angle) * radius * 1.35, Math.sin(angle) * radius * 0.7, -6 - t * FIELD.depth);
    mesh.rotation.y = -Math.cos(angle) * 0.42;
    mesh.rotation.x = Math.sin(angle) * 0.12;
    mesh.userData = { src: FIELD.textures[i % FIELD.textures.length], loaded: false, baseY: mesh.position.y, phase: rand() * 6.28 };
    scene.add(mesh);
    panels.push(mesh);
  }

  /* Progressive texture load, nearest-first, 4 at a time; starts only when the
     chapter is within two viewports. */
  let loadStarted = false;
  function startLoading() {
    if (loadStarted) return;
    loadStarted = true;
    const queue = panels.slice();
    let active = 0;
    const pump = () => {
      while (active < 4 && queue.length) {
        const mesh = queue.shift();
        active++;
        loader.load(
          mesh.userData.src,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            mesh.material.map = tex;
            mesh.material.color.set(0xffffff);
            mesh.material.needsUpdate = true;
            mesh.userData.loaded = true;
            active--;
            dirty = true;
            kick();
            pump();
          },
          undefined,
          () => {
            active--;
            pump();
          }
        );
      }
    };
    pump();
  }

  let width = 0, height = 0, dirty = true;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Narrow screens keep the horizontal framing of a 1:1 view instead of cropping it.
      camera.fov = w / h < 1 ? (360 / Math.PI) * Math.atan(Math.tan((50 * Math.PI) / 360) / (w / h)) : 50;
      camera.updateProjectionMatrix();
      dirty = true;
    }
  }

  function layout() {
    const on = motionOn();
    section.classList.toggle("is-still", !on);
    section.style.height = on ? `${(FIELD.scrubVh + 1) * innerHeight}px` : `${innerHeight}px`;
    resize();
    kick();
  }

  let smooth = null, lastDrawn = -1, raf = 0, inView = false, beatOn = -1;
  function frame() {
    raf = 0;
    if (!inView || !section.isConnected) return;
    resize();
    const on = motionOn();
    const goal = on ? sectionProgress(section) : 0.5;
    smooth = smooth === null || !on ? goal : smooth + (goal - smooth) * DAMPING;
    if (Math.abs(goal - smooth) < SETTLE) smooth = goal;
    const p = smooth;

    if (p !== lastDrawn || dirty) {
      const z = 4 - ease(p) * FIELD.depth * 0.97;
      camera.position.set(Math.sin(p * Math.PI * 2) * 1.1, Math.cos(p * Math.PI * 1.5) * 0.45, z);
      camera.lookAt(Math.sin((p + 0.04) * Math.PI * 2) * 0.6, 0, z - 10);
      camera.rotation.z += Math.sin(p * Math.PI * 3) * 0.035;
      let nearest = 0, nd = 1e9;
      for (let i = 0; i < panels.length; i++) {
        const m = panels[i];
        const d = m.position.z - z; // negative = ahead of camera
        const ahead = -d;
        // Fade in from the fog, fade out as the panel slides past the lens.
        m.material.opacity = (m.userData.loaded ? 1 : 0.35) * clamp((60 - ahead) / 20) * clamp((ahead + 1.5) / 3);
        m.position.y = m.userData.baseY + Math.sin(p * 6 + m.userData.phase) * 0.18;
        if (ahead > 0 && ahead < nd) { nd = ahead; nearest = i; }
      }
      renderer.render(scene, camera);
      lastDrawn = p;
      dirty = false;
      const label = `PANEL ${String(nearest + 1).padStart(2, "0")} / ${panels.length}`;
      if (counter.data !== label) counter.data = label;
      rail.style.transform = `scaleX(${p.toFixed(4)})`;
      let b = -1;
      FIELD.beats.forEach((beat, i) => { if (p >= beat.at[0] && p < beat.at[1]) b = i; });
      if (!on) b = 0;
      if (b !== beatOn) {
        beatOn = b;
        beats.forEach((el, i) => el.classList.toggle("is-on", i === b));
      }
    }
    if (smooth !== goal) kick();
  }
  function kick() {
    if (!raf && inView) raf = requestAnimationFrame(frame);
  }

  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) startLoading(); }, { rootMargin: "200% 0px" });
  near.observe(section);
  const vis = new IntersectionObserver((entries) => {
    inView = entries[entries.length - 1].isIntersecting;
    if (inView) { smooth = null; kick(); } else { cancelAnimationFrame(raf); raf = 0; }
  });
  vis.observe(section);
  const ro = new ResizeObserver(() => { dirty = true; kick(); });
  ro.observe(stage);

  layout();
  return {
    el: section,
    kick,
    layout,
    get progress() { return smooth; },
    get target() { return sectionProgress(section); },
    get drawn() { return lastDrawn; },
    destroy() {
      cancelAnimationFrame(raf);
      near.disconnect(); vis.disconnect(); ro.disconnect();
      panels.forEach((m) => { m.material.map && m.material.map.dispose(); m.material.dispose(); });
      geo.dispose();
      renderer.dispose();
      section.remove();
    },
  };
}

/* ================================================================= 2. HUD */

const FILM_SITES = {
  "warner-bros": { coord: "24.49°N / 54.60°E", site: "Yas Island · Abu Dhabi", scope: "Landscaping & External Works" },
  "emirates-palace": { coord: "24.46°N / 54.32°E", site: "Corniche · Abu Dhabi", scope: "External Works & Hardscape" },
  "louvre-abu-dhabi": { coord: "24.53°N / 54.40°E", site: "Saadiyat Island · Abu Dhabi", scope: "Landscaping & Approach" },
  "zayed-national-museum": { coord: "24.53°N / 54.40°E", site: "Saadiyat Island · Abu Dhabi", scope: "Landscaping, Irrigation & Car Park" },
};
const HUD_STEPS = [
  [0.0, "APPROACH"],
  [0.35, "ON SITE"],
  [0.7, "OVERVIEW"],
];

function buildHud(films) {
  const items = [];
  for (const inst of films.instances || []) {
    const id = inst.scene.dataset.film;
    const meta = FILM_SITES[id];
    if (!meta || inst.stage.querySelector(".arc-hud")) continue;
    const hud = document.createElement("div");
    hud.className = "arc-hud";
    hud.setAttribute("aria-hidden", "true");
    hud.innerHTML = `
      <span class="arc-hud__row"><b>COORD</b>${meta.coord}</span>
      <span class="arc-hud__row"><b>SITE</b>${meta.site}</span>
      <span class="arc-hud__row"><b>SCOPE</b>${meta.scope}</span>
      <span class="arc-hud__row arc-hud__status"><b>STATUS</b><em>${HUD_STEPS[0][1]}</em></span>
      <span class="arc-hud__bar"><i></i></span>`;
    inst.stage.appendChild(hud);
    items.push({ scene: inst.scene, hud, status: hud.querySelector("em").firstChild, bar: hud.querySelector("i"), step: -1, visible: false });
  }
  if (!items.length) return null;

  let raf = 0;
  const tick = () => {
    raf = 0;
    for (const it of items) {
      if (!it.visible) continue;
      const p = motionOn() ? sectionProgress(it.scene) : 0;
      let s = 0;
      HUD_STEPS.forEach(([at], i) => { if (p >= at) s = i; });
      if (s !== it.step) { it.step = s; it.status.data = HUD_STEPS[s][1]; }
      it.bar.style.transform = `scaleX(${p.toFixed(3)})`;
      it.hud.classList.toggle("is-on", p > 0.02 && p < 0.98);
    }
  };
  const kick = () => { if (!raf && items.some((i) => i.visible)) raf = requestAnimationFrame(tick); };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const it = items.find((i) => i.scene === e.target);
      if (it) it.visible = e.isIntersecting;
    }
    kick();
  });
  items.forEach((it) => io.observe(it.scene));
  return {
    kick,
    get connected() { return items.every((i) => i.scene.isConnected); },
    destroy() { io.disconnect(); cancelAnimationFrame(raf); items.forEach((i) => i.hud.remove()); },
  };
}

/* ============================================================== 3. REVEAL */

const REVEAL_SECTIONS = ["#about", "#solutions", "#journey", "#projects", "#news"];

function buildReveals() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST || !motionOn()) return null;
  const triggers = [];
  const els = [];
  const zoomed = [];
  for (const sel of REVEAL_SECTIONS) {
    const el = document.querySelector(sel);
    if (!el || el.dataset.arcReveal) continue;
    el.dataset.arcReveal = "1";
    els.push(el);
    const tw = gsap.fromTo(
      el,
      { clipPath: "inset(36px 2.5% 0px 2.5% round 36px)" },
      {
        clipPath: "inset(0px 0% 0px 0% round 0px)",
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "top 35%", scrub: 0.6 },
      }
    );
    triggers.push(tw);
    // The Solutions cards animate their own images (framer-motion): leave them be.
    const media = sel === "#solutions" ? null : el.querySelector("video, img");
    if (media && media.closest(".overflow-hidden")) {
      zoomed.push(media);
      triggers.push(
        gsap.fromTo(media, { scale: 1.12 }, {
          scale: 1, ease: "none",
          scrollTrigger: { trigger: media, start: "top bottom", end: "center center", scrub: 0.6 },
        })
      );
    }
  }
  return {
    get connected() { return els.every((el) => el.isConnected); },
    destroy() {
      triggers.forEach((t) => { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
      // Killing a tween leaves its last inline transform behind: reset the media.
      zoomed.forEach((m) => gsap.set(m, { clearProps: "transform" }));
      for (const sel of REVEAL_SECTIONS) {
        const el = document.querySelector(sel);
        if (el) { el.style.clipPath = ""; delete el.dataset.arcReveal; }
      }
    },
  };
}

/* ================================================================= BOOT */

const api = (window.__alRyumCinema = { field: null, hud: null, reveal: null });

function onScroll() {
  api.field && api.field.kick();
  api.hud && api.hud.kick();
}

function boot() {
  if (!isHome()) {
    ["field", "hud", "reveal"].forEach((k) => { if (api[k]) { api[k].destroy(); api[k] = null; } });
    return;
  }
  // React replaces the page on route changes: rebuild anything that was detached.
  if (api.field && !api.field.el.isConnected) { api.field.destroy(); api.field = null; }
  if (api.hud && !api.hud.connected) { api.hud.destroy(); api.hud = null; }
  if (api.reveal && !api.reveal.connected) { api.reveal.destroy(); api.reveal = null; }
  const filmsHost = document.getElementById("arc-cinematic-host");
  if (!api.field) {
    const anchor = filmsHost || document.getElementById("projects");
    // Wait for the films host when the cinematic script is going to create it.
    if (anchor && (filmsHost || !window.gsap) && webglOK !== false) {
      api.field = buildField(anchor);
      if (api.field) refreshLayout();
    }
  }
  if (!api.hud && window.__alRyumProjectFilms) api.hud = buildHud(window.__alRyumProjectFilms);
  if (!api.reveal && document.getElementById("about")) api.reveal = buildReveals();
}

function refreshLayout() {
  try { window.lenis && window.lenis.resize(); } catch (e) {}
  try { window.ScrollTrigger && window.ScrollTrigger.refresh(); } catch (e) {}
}

addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", () => { api.field && api.field.layout(); });
addEventListener("alryum-motion-change", () => {
  api.field && api.field.layout();
  if (api.reveal) { api.reveal.destroy(); api.reveal = null; }
  boot();
  refreshLayout();
});
addEventListener("popstate", boot);

// The React app and the films mount after this module runs, and React rebuilds
// the page on route changes (pushState, no popstate): watch for both. boot() is
// coalesced to one call per frame and is a few lookups when nothing changed.
let bootQueued = 0;
const mo = new MutationObserver(() => {
  if (!bootQueued) bootQueued = requestAnimationFrame(() => { bootQueued = 0; boot(); });
});
mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
addEventListener("load", boot);
boot();
