/* ==== AL RYUM @astra ==== Services page, rebuilt as a cinematic 3D page.
   Template: the standalone "3D Cinematic Sample" the client supplied (WebGL particle hero + scroll scenes +
   tilt cards). Rebuilt here on the live site's own tokens, with all seven services, real links into
   /solutions/<id>, per-service imagery, and no unverifiable claims.

   Route-scoped exactly like al-ryum-projects-index.js: it only acts on /services, only toggles a class on
   <html>, and never touches React's markup for any other route. */
(function () {
  "use strict";
  if (window.__alryumServices3D) return;
  window.__alryumServices3D = true;

  var CLASS = "ar-services-3d";
  var MOUNT_ID = "ar-services-mount";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TOUCH = window.matchMedia && window.matchMedia("(hover: none)").matches;
  var SMALL = window.innerWidth < 820;
  // Documented override: /services?ar-hero=force runs the WebGL hero even where the touch / reduced-motion
  // guards would skip it. Used for verification on machines without a real pointer, and useful as an
  // escape hatch if a desktop browser ever misreports its pointer capability.
  var FORCE = /[?&]ar-hero=force/.test(location.search);

  var SERVICES = [
    { id: "engineering",  name: "Engineering & Design", n: "01",
      line: "Masterplanning, civil, structural, electrical, mechanical and landscape design under one roof.",
      body: "Our in-house engineers take a scheme from concept and feasibility through detailed design to " +
            "construction drawings and method statements — BIM models, coordinated services and landscape " +
            "architecture resolved together, so the drawing set and the site are never disagreeing." },
    { id: "nurseries",    name: "Nurseries & Plant Production", n: "02",
      line: "Plants propagated, hardened and acclimatised for the Gulf before they ever reach site.",
      body: "Large-scale nursery facilities produce the trees, palms, shrubs and groundcovers our contracts " +
            "need. Species are selected for arid conditions, raised under controlled irrigation and " +
            "acclimatised before delivery — which is why our planting establishes instead of failing." },
    { id: "operations",   name: "Operations & Maintenance", n: "03",
      line: "Landscapes kept alive and safe long after handover.",
      body: "Horticultural maintenance, irrigation management, sports turf care and asset inspection across " +
            "parks, golf courses, public realm and highways — scheduled programmes with the same crews, " +
            "spare parts and standards that built the scheme." },
    { id: "pmv",          name: "Plant, Machinery & Vehicles", n: "04",
      line: "Our own fleet, maintained in-house, on site when the programme says so.",
      body: "Excavators, loaders, telescopic handlers, tippers, water bowsers and specialist landscape plant " +
            "run from our own yard and workshop. Owning the fleet removes the hire chain from the critical " +
            "path and keeps earthworks, planting and maintenance on the dates promised." },
    { id: "procurement",  name: "Procurement", n: "05",
      line: "Materials sourced, qualified and delivered without stalling the programme.",
      body: "Supplier qualification, contract negotiation and logistics for everything from bulk aggregates " +
            "and paving to live plants and irrigation components — with warehousing and staged deliveries " +
            "matched to the construction sequence rather than the supplier's convenience." },
    { id: "project-mgmt", name: "Project & Construction Management", n: "06",
      line: "One accountable team from first survey to final handover.",
      body: "Planning, coordination, quality assurance, testing and commissioning across disciplines — " +
            "survey and stakeholder approvals, documentation, training and warranty support. All works " +
            "delivered to authority and contract requirements, with a single point of responsibility." },
    { id: "steel",        name: "Steel Fabrication", n: "07",
      line: "Structural steel and architectural metalwork, fabricated and installed by the same team.",
      body: "Custom structural steel, balustrades, pergolas, gates and architectural features fabricated in " +
            "our workshop and installed on our own sites — dimensional accuracy checked before it ships, " +
            "finishes applied in controlled conditions rather than on the scaffold." }
  ];

  function isServices() {
    return location.pathname === "/services" || location.pathname === "/services/";
  }

  function img(s) { return "/assets/services/" + s.id + ".webp"; }

  /* ---------- build ---------- */
  function sceneHTML(s, i) {
    var flip = i % 2 === 1;
    var media = '<figure class="ar-s3d-media" data-tilt>' +
                  '<img src="' + img(s) + '" alt="' + s.name + '" loading="lazy" decoding="async" />' +
                  '<figcaption>' + s.name + '</figcaption>' +
                '</figure>';
    var text = '<div class="ar-s3d-copy">' +
                 '<span class="ar-s3d-tag">' + s.n + ' · ' + s.name + '</span>' +
                 '<h2>' + s.line + '</h2>' +
                 '<p>' + s.body + '</p>' +
                 '<a class="ar-s3d-link" href="/solutions/' + s.id + '">See this capability &rarr;</a>' +
               '</div>';
    return '<section class="ar-s3d-scene' + (flip ? " is-flipped" : "") + '">' +
             '<div class="ar-s3d-scene-inner">' + (flip ? media + text : text + media) + '</div>' +
           '</section>';
  }

  function markHTML() {
    var cards = SERVICES.map(function (s) {
      return '<a class="ar-s3d-card" href="/solutions/' + s.id + '">' +
               '<span class="ar-s3d-num">' + s.n + '</span>' +
               '<span class="ar-s3d-card-title">' + s.name + '</span>' +
               '<span class="ar-s3d-card-line">' + s.line + '</span>' +
               '<span class="ar-s3d-card-cta">Explore &rarr;</span>' +
             '</a>';
    }).join("");
    return '<section class="ar-s3d-cards">' +
             '<span class="ar-s3d-tag">Explore</span>' +
             '<h2>Seven services, one accountable team</h2>' +
             '<div class="ar-s3d-grid">' + cards + '</div>' +
           '</section>';
  }

  /* React renders the page, the fixed header and the footer as siblings inside one container.
     We hide only the page sections — never the header or footer — and mount in their place. */
  function pageHost() {
    var header = document.querySelector("header");
    var box = header ? header.parentElement : null;
    if (!box) box = document.querySelector("#root > div > div") || document.querySelector(".app-ready");
    return box;
  }

  function hideReactPage(box) {
    if (!box) return;
    [].slice.call(box.children).forEach(function (c) {
      if (c.id === MOUNT_ID) return;
      var tag = c.tagName;
      if (tag === "HEADER" || tag === "FOOTER" || tag === "SCRIPT" || tag === "STYLE") return;
      if (c.hasAttribute("data-ar-s3d-was")) return;
      c.setAttribute("data-ar-s3d-was", c.style.display || "");
      c.style.display = "none";
    });
  }

  function restoreReactPage(box) {
    if (!box) return;
    box.querySelectorAll("[data-ar-s3d-was]").forEach(function (c) {
      c.style.display = c.getAttribute("data-ar-s3d-was") || "";
      c.removeAttribute("data-ar-s3d-was");
    });
  }

  function mount() {
    if (!isServices()) return;
    var host = pageHost();
    if (!host) return;
    var el = document.getElementById(MOUNT_ID);
    if (el) return;
    hideReactPage(host);

    el = document.createElement("div");
    el.id = MOUNT_ID;
    el.className = "ar-s3d";
    el.innerHTML =
      '<section class="ar-s3d-hero">' +
        '<canvas class="ar-s3d-canvas" aria-hidden="true"></canvas>' +
        '<div class="ar-s3d-vignette" aria-hidden="true"></div>' +
        '<div class="ar-s3d-hero-inner">' +
          '<span class="ar-s3d-eyebrow">Al Ryum Group</span>' +
          '<h1>Our Services</h1>' +
          '<p>Seven integrated divisions delivering the built environment across the GCC — from concept ' +
            'through to operation.</p>' +
        '</div>' +
        '<span class="ar-s3d-hint">Scroll</span>' +
      '</section>' +
      '<section class="ar-s3d-intro">' +
        '<span class="ar-s3d-tag">What we do</span>' +
        '<h2>One integrated group, seven disciplines</h2>' +
        '<p>Design, plants, plant, procurement, construction and maintenance held inside one company. ' +
          'That is what removes the coordination gaps between them.</p>' +
      '</section>' +
      SERVICES.map(sceneHTML).join("") +
      markHTML() +
      '<section class="ar-s3d-cta">' +
        '<h2>Have a project in mind?</h2>' +
        '<a class="ar-s3d-btn" href="/contact">Start the conversation &rarr;</a>' +
      '</section>';

    var foot = host.querySelector("footer");
    if (foot) host.insertBefore(el, foot); else host.appendChild(el);
    document.documentElement.classList.add(CLASS);

    // imagery may not be there yet — a missing service image must never show a torn frame
    el.querySelectorAll(".ar-s3d-media img").forEach(function (im) {
      im.addEventListener("error", function () { im.closest(".ar-s3d-media").classList.add("no-image"); });
    });
  }

  function unmount() {
    var el = document.getElementById(MOUNT_ID);
    var box = el ? el.parentElement : null;
    if (el) el.remove();
    restoreReactPage(box);
    document.documentElement.classList.remove(CLASS);
    if (hero) { hero.stop(); hero = null; }
  }

  /* ---------- WebGL particle terrain (skipped entirely for reduced motion) ---------- */
  var hero = null;
  var threeLoading = false;

  // The site does not ship three.js. Pull it in only for this page rather than on every route.
  function ensureThree(cb) {
    if (window.THREE) { cb(true); return; }
    if (threeLoading) return;
    threeLoading = true;
    var sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    sc.async = true;
    sc.onload = function () { threeLoading = false; cb(!!window.THREE); };
    sc.onerror = function () { threeLoading = false; cb(false); };
    document.head.appendChild(sc);
  }

  function startHero() {
    // reduced motion always wins; the force flag exists only to override the touch/pointer guard
    if (REDUCED) return;
    if (TOUCH && !FORCE) return;
    if (!window.THREE) {
      ensureThree(function (ok) { if (ok) startHero(); });
      return;
    }
    var canvas = document.querySelector(".ar-s3d-canvas");
    if (!canvas) return;
    var scene, camera, renderer;

    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
      camera.position.set(0, 0, 10);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !SMALL, alpha: true });
      renderer.setSize(innerWidth, innerHeight);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    } catch (e) { return; }

    // soft round sprite — the bokeh base for every mote
    function makeSprite(rgb) {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var x = c.getContext("2d");
      var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(" + rgb + ",1)");
      g.addColorStop(0.35, "rgba(" + rgb + ",0.55)");
      g.addColorStop(1, "rgba(" + rgb + ",0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }
    var GOLD = "200,168,110";   // site gold #C8A86E, not the sample's #C9A961
    var WARM = "247,242,233";   // the header's warm white, for a few brighter motes

    var spriteGold = makeSprite(GOLD);
    var spriteWarm = makeSprite(WARM);

    // The sample set ONE random size per layer, so every mote in a layer was identical.
    // A small shader gives each particle its own size, which is what makes dust read as dust.
    var VERT = [
      "attribute float aSize;",
      "attribute float aPhase;",
      "uniform float uTime;",
      "uniform float uPix;",
      "varying float vFade;",
      "void main() {",
      "  vec3 p = position;",
      "  p.y = mod(p.y + uTime * aSize * 0.35 + aPhase, 13.0) - 6.5;",
      "  p.x += sin(uTime * 0.3 + aPhase * 6.2831) * 0.35;",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  gl_PointSize = aSize * uPix * (1.0 / -mv.z);",
      "  vFade = clamp(1.0 - abs(p.y) / 7.0, 0.0, 1.0);",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n");
    var FRAG = [
      "uniform sampler2D uMap;",
      "uniform float uOpacity;",
      "varying float vFade;",
      "void main() {",
      "  vec4 t = texture2D(uMap, gl_PointCoord);",
      "  gl_FragColor = vec4(t.rgb, t.a * uOpacity * vFade);",
      "}"
    ].join("\n");

    // gl_PointSize is in device pixels and PointsMaterial's sizeAttenuation divides by half the
    // drawing-buffer height. Reusing that factor is what makes the motes the size the sample intended.
    function pointScale() {
      var size = renderer.getSize(new THREE.Vector2());
      return (size.y * renderer.getPixelRatio()) / 2;
    }

    function makeDust(count, sprite, sizeMin, sizeMax, opacity) {
      var pos = new Float32Array(count * 3);
      var size = new Float32Array(count);
      var phase = new Float32Array(count);
      for (var n = 0; n < count; n++) {
        pos[n * 3] = (Math.random() - 0.5) * 22;
        pos[n * 3 + 1] = (Math.random() - 0.5) * 13;
        pos[n * 3 + 2] = (Math.random() - 0.5) * 8;
        size[n] = sizeMin + Math.random() * (sizeMax - sizeMin);   // per particle, the whole point
        phase[n] = Math.random();
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
      var mat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: sprite },
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uPix: { value: pointScale() }
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      var pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return pts;
    }

    // far (small, dim) -> mid -> near (large, bright), plus a few warm motes for a highlight
    var layers = [
      makeDust(SMALL ? 90 : 220, spriteGold, 0.12, 0.30, 0.35),
      makeDust(SMALL ? 50 : 120, spriteGold, 0.30, 0.60, 0.55),
      makeDust(SMALL ? 18 : 45, spriteGold, 0.70, 1.30, 0.80),
      makeDust(SMALL ? 12 : 30, spriteWarm, 0.40, 0.90, 0.55)
    ];

    var mx = 0, my = 0, raf = 0, visible = true;
    function onMove(e) {
      mx = (e.clientX / innerWidth - 0.5) * 2;
      my = (e.clientY / innerHeight - 0.5) * 2;
    }
    function onResize() {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      layers.forEach(function (l) { l.material.uniforms.uPix.value = pointScale(); });
    }
    addEventListener("mousemove", onMove, { passive: true });
    addEventListener("resize", onResize);

    var clock = new THREE.Clock();
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      var t = clock.getElapsedTime();
      layers.forEach(function (layer, li) {
        layer.material.uniforms.uTime.value = t;
        var depth = (li + 1) * 0.25;
        layer.position.x += (mx * depth - layer.position.x) * 0.03;
        layer.position.y += (-my * depth * 0.6 - layer.position.y) * 0.03;
      });
      camera.position.x += (mx * 0.6 - camera.position.x) * 0.03;
      camera.position.y += (-my * 0.4 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        canvas.classList.toggle("is-paused", !visible);
      }, { threshold: 0 }).observe(canvas);
    }
    frame();

    hero = { stop: function () {
      cancelAnimationFrame(raf);
      removeEventListener("mousemove", onMove);
      removeEventListener("resize", onResize);
      layers.forEach(function (l) { l.geometry.dispose(); l.material.dispose(); });
      if (renderer && renderer.dispose) renderer.dispose();
      document.querySelectorAll(".ar-s3d-canvas").forEach(function (c) { c.remove(); });
    } };
  }

  /* ---------- tilt (pointer devices only, never for reduced motion) ---------- */
  function bindTilt() {
    if (REDUCED || TOUCH) return;
    document.querySelectorAll("#" + MOUNT_ID + " [data-tilt]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -8;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
        el.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transition = "transform .6s ease";
        el.style.transform = "";
        setTimeout(function () { el.style.transition = ""; }, 600);
      });
    });
  }

  /* ---------- reveal on scroll (fade once, no scroll-jacking) ---------- */
  function bindReveal() {
    var items = document.querySelectorAll("#" + MOUNT_ID + " .ar-s3d-scene, #" + MOUNT_ID + " .ar-s3d-card");
    if (REDUCED || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  function sync() {
    if (isServices()) {
      mount();
      if (!hero) startHero();
      bindTilt();
      bindReveal();
    } else if (document.getElementById(MOUNT_ID)) {
      unmount();
    }
  }

  // React owns the DOM inside #root; watch for its route swaps without touching its markup.
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var r = orig.apply(this, arguments); setTimeout(sync, 60); return r; };
  });
  addEventListener("popstate", function () { setTimeout(sync, 60); });

  // React mounts after this script runs (its bundle is fetched at runtime), so a single attempt loses the
  // race on a hard refresh. Retry until its container exists, then keep watching the whole subtree.
  // Any path that mounts the page fresh must also arm its reveal/tilt/hero; mounting alone left every
  // scene at opacity 0 whenever React rendered after the first attempt (empty dark gaps on /services).
  function ensureMounted() {
    if (!isServices() || document.getElementById(MOUNT_ID)) return;
    mount();
    if (!document.getElementById(MOUNT_ID)) return;
    if (!hero) startHero();
    bindTilt();
    bindReveal();
  }
  var mo = new MutationObserver(function () {
    if (isServices() && !document.getElementById(MOUNT_ID)) ensureMounted();
  });
  var tries = 0;
  function retryMount() {
    if (!isServices()) return;
    tries++;
    if (!document.getElementById(MOUNT_ID)) ensureMounted();
    if (tries < 60 && (!document.getElementById(MOUNT_ID))) setTimeout(retryMount, 250);
  }
  function begin() {
    sync();
    retryMount();
    // subtree:true — React renders inside #root, not as a direct child of <body>
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin);
  else begin();
})();
