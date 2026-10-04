/* ============================================================================
   AL RYUM GROUP — SCROLL-DRIVEN 3D CINEMATIC SEQUENCE  (WebGL / three.js r182)
   ----------------------------------------------------------------------------
   Module : al-ryum-scroll-3d
   Author : OS3 worker, 2026-10-01
   Role   : Adds two pinned, scroll-driven WebGL chapters to the home page.
            Scroll position — not a clock — drives the camera through one
            continuous procedural world, in the spirit of the reference
            scroll-driven 3D sites (quadplex80). Nothing existing is replaced:
            the chapters are inserted as new siblings and are fully removable.

   Design contract
   ---------------
   * Camera position AND orientation are deterministic functions of scroll:
     pose = f(local scroll progress). There is no time-based idle animation and
     no self-scheduling animation loop — rendering is demand-driven and the
     loop self-terminates once the damped progress reaches its target.
   * One WebGLRenderer, one canvas per chapter, one shared scene graph. The
     renderer is moved between canvases is NOT used: each chapter owns its own
     canvas so an offscreen chapter costs nothing.
   * Intel integrated graphics: no shadows, no post-processing, no textures,
     instanced geometry, pixel ratio capped, automatic quality step-down, and
     a hard WebGL-availability guard that leaves the site exactly as it was.
   * Reduced motion: follows the site's own cinematic toggle
     (window.alRyumMotion) when present; otherwise prefers-reduced-motion
     starts the chapters paused with a visible "play" affordance.

   Public side effect
   ------------------
   window.__alRyum3D = { state, build, destroy, chapters }   (verification handle)
   ========================================================================= */
import * as THREE from "three";

(function () {
  "use strict";

  /* ---------------------------------------------------------------- config */

  var CONFIG = {
    homeRoute: "/",
    // Chapter geometry: [selector to insert BEFORE, height, u-range of the
    // master camera path, beat list]
    quality: {
      maxPixelRatio: 1.5,
      degradePixelRatio: 1.0,
      floorPixelRatio: 0.85,
      sampleFrames: 45,
      degradeMs: 15,
      floorMs: 24,
      disableMs: 34
    },
    damping: 0.14,
    settleEpsilon: 0.0004,
    /* Optional: also ask the site's ScrollTrigger to recompute. Left off —
       the chapters are plain sticky sections and need no ScrollTrigger, and a
       global refresh touches machinery other site scripts own. */
    refreshScrollTrigger: false
  };

  /* ------------------------------------------------------- shared handles */

  var state = {
    route: null,
    motionEnabled: true,
    quality: "high",
    built: false,
    webglOK: null,
    lastFrameMs: 0,
    frameSamples: [],
    renderer: null,
    scene: null,
    camera: null,
    chapters: [],
    progress: { master: 0, damped: 0, camera: 0 }
  };

  var built = false;
  var pollTimer = 0;
  var observer = null;
  var onResizeBound = null;
  var onMotionBound = null;
  var scrollHooked = false;

  /* -------------------------------------------------------- small helpers */

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function webglAvailable() {
    if (state.webglOK !== null) return state.webglOK;
    try {
      var c = document.createElement("canvas");
      state.webglOK = !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl"))
      );
    } catch (e) {
      state.webglOK = false;
    }
    return state.webglOK;
  }

  /* ------------------------------------------------------------ the beats */
  /* Each beat: camera position, look-at target, and the copy shown while the
     camera is in that beat's stretch of the path.
     Path rule: the skyline occupies r <= 210 around the origin, so any beat
     below y = 130 keeps its radius >= 280. The camera therefore never enters
     the tower cluster — it circles it, climbs over it, and lands on the
     island and the globe. */

  var BEATS = [
    {
      pos: [0, 18, 640],
      look: [0, 95, -30],
      eyebrow: "Al Ryum Group",
      title: "We shape the terrain",
      text: "Scroll to fly the masterplan — landscape, infrastructure, buildings and MEP."
    },
    {
      pos: [-230, 96, 520],
      look: [0, 78, -70],
      eyebrow: "Chapter 01",
      title: "The build line",
      text: "Thirty-five years of delivery across the UAE and the GCC."
    },
    {
      pos: [180, 175, 380],
      look: [0, 45, -140],
      eyebrow: "Engineering",
      title: "Working the grid",
      text: "BIM design, real-time site tracking, smarter at every stage."
    },
    {
      pos: [0, 235, 150],
      look: [0, 30, -320],
      eyebrow: "Masterplan",
      title: "From plot to horizon",
      text: "Landscape, nurseries, steel, procurement, operations and PMV."
    },
    {
      pos: [-150, 165, -110],
      look: [-60, 40, -320],
      eyebrow: "Reach",
      title: "Nine markets, one standard",
      text: "UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Jordan, Iraq, Egypt."
    },
    {
      pos: [-252, 150, -168],
      look: [-240, 132, -190],
      eyebrow: "GCC",
      title: "The network",
      text: "Projects delivered where the group operates."
    },
    {
      pos: [-300, 130, -40],
      look: [-120, 50, -280],
      eyebrow: "Waterfront",
      title: "Back to the coast",
      text: "Islands, marinas and public realm."
    },
    {
      pos: [-40, 118, 300],
      look: [40, 25, -330],
      eyebrow: "Delivery",
      title: "Built to be lived in",
      text: "Handover is the only measure that matters."
    },
    {
      pos: [330, 108, -60],
      look: [0, 30, -280],
      eyebrow: "Continuity",
      title: "Every trade, one team",
      text: "Self-performed capability keeps the programme honest."
    },
    {
      pos: [70, 140, 570],
      look: [0, 60, -120],
      eyebrow: "Al Ryum Group",
      title: "We shape the future",
      text: "Continue scrolling."
    }
  ];

  /* Chapter definitions. `before` = the element the chapter is inserted in
     front of. uRange = the slice of the master path (BEATS index space). */
  var CHAPTERS = [
    {
      id: "ar3d-chapter-masterplan",
      before: "#about",
      heightVh: 460,
      /* The path is parameterised so that waypoint i sits at t = i/9; the
         chapters therefore split the flight cleanly at beats 0-5 and 6-9. */
      uStart: 0,
      uEnd: 5 / 9,
      beats: [0, 1, 2, 3, 4, 5]
    },
    {
      id: "ar3d-chapter-horizon",
      before: "#projects",
      heightVh: 360,
      uStart: 6 / 9,
      uEnd: 1,
      beats: [6, 7, 8, 9]
    }
  ];

  /* --------------------------------------------------------------- route */

  function route() {
    return location.pathname.replace(/\/+$/, "") || "/";
  }

  /* ================================================================ BUILD */

  function build() {
    if (built) return;
    if (!webglAvailable()) {
      console.warn("[ar3d] WebGL unavailable — 3D chapters skipped, site unchanged.");
      return;
    }
    var host = document.querySelector("#root");
    if (!host) return;

    // Resolve every insertion anchor first: if one is missing we do nothing.
    var anchors = [];
    for (var i = 0; i < CHAPTERS.length; i++) {
      var node = document.querySelector(CHAPTERS[i].before);
      if (!node) return;
      anchors.push(node);
    }

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x16333a, 0.00105);

    var camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.5, 6000);
    scene.add(camera);
    addLights(scene);
    addWorld(scene);

    state.scene = scene;
    state.camera = camera;

    for (var c = 0; c < CHAPTERS.length; c++) {
      mountChapter(CHAPTERS[c], anchors[c], scene, camera);
    }

    state.built = true;
    built = true;
    notifyLayout();
  }

  function addLights(scene) {
    var hemi = new THREE.HemisphereLight(0x4d8f9c, 0x2a1c10, 1.5);
    scene.add(hemi);

    var key = new THREE.DirectionalLight(0xffd9a0, 1.5);
    key.position.set(-320, 150, 300);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x6fe0ee, 0.65);
    fill.position.set(340, 90, -320);
    scene.add(fill);
  }

  /* ------------------------------------------------------------ the world */

  /* A vertex-coloured dusk sky on the inside of a big sphere. This is what
     makes the dark tower silhouettes read: a warm horizon band behind them and
     a cool zenith above. One draw call, no texture, no fog. */
  function addSky(scene) {
    var geo = new THREE.SphereGeometry(2600, 24, 14);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);

    var zenith = new THREE.Color(0x0a1b25);
    var mid = new THREE.Color(0x1d4a55);
    var horizon = new THREE.Color(0x8a7a52);
    var below = new THREE.Color(0x050b0a);
    var c = new THREE.Color();

    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 2600;
      var t;
      if (y >= 0.34) {
        t = clamp((y - 0.34) / 0.66, 0, 1);
        c.copy(mid).lerp(zenith, t);
      } else if (y >= 0) {
        t = clamp(y / 0.34, 0, 1);
        c.copy(horizon).lerp(mid, Math.pow(t, 0.7));
      } else {
        t = clamp(-y / 0.3, 0, 1);
        c.copy(horizon).lerp(below, Math.pow(t, 0.6));
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    var sky = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    state.sky = sky;
  }

  function addWorld(scene) {
    var rand = mulberry32(20261001);

    addSky(scene);

    /* Ground plane — flat, cheap, hides the horizon seam. */
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshLambertMaterial({ color: 0x0d1f22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    scene.add(ground);

    /* Masterplan grid — one draw call, gives the "surveyed site" read. */
    var grid = new THREE.GridHelper(1800, 60, 0xc8a86e, 0x2b5f66);
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.position.y = 0.05;
    scene.add(grid);

    addSkyline(scene, rand);
    addCranes(scene);
    addIsland(scene);
    addGlobe(scene);
    addCoast(scene, rand);
  }

  function addSkyline(scene, rand) {
    var N = 132;
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var inst = new THREE.InstancedMesh(geo, mat, N);
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var pos = new THREE.Vector3();
    var scl = new THREE.Vector3();
    var col = new THREE.Color();

    var i,
      ring,
      angle,
      radius,
      h,
      w,
      x,
      z;
    for (i = 0; i < N; i++) {
      ring = i < 34 ? 0 : i < 86 ? 1 : 2;
      angle = rand() * Math.PI * 2;
      radius = 42 + ring * 105 + rand() * 78;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius * 0.78;
      h = ring === 0 ? 46 + rand() * 74 : ring === 1 ? 22 + rand() * 58 : 9 + rand() * 34;
      w = 9 + rand() * 15;

      pos.set(x, h / 2, z);
      scl.set(w, h, w * (0.75 + rand() * 0.6));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i, m);

      var t = rand();
      col.setRGB(
        0.085 * (0.6 + t * 0.9),
        0.21 * (0.55 + t * 0.85),
        0.235 * (0.6 + t * 0.9)
      );
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);

    /* Warm window strips — a second, small instanced batch with an additive
       basic material. This is what sells "dusk city" at almost no cost. */
    var W = 46;
    var wgeo = new THREE.BoxGeometry(1, 1, 1);
    var wmat = new THREE.MeshBasicMaterial({
      color: 0xc8a86e,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var win = new THREE.InstancedMesh(wgeo, wmat, W);
    for (i = 0; i < W; i++) {
      angle = rand() * Math.PI * 2;
      radius = 44 + rand() * 190;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius * 0.78;
      h = 12 + rand() * 70;
      pos.set(x, h * (0.35 + rand() * 0.5), z);
      scl.set(6 + rand() * 8, 1.4 + rand() * 3.2, 1.1);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m.compose(pos, q, scl);
      win.setMatrixAt(i, m);
    }
    win.instanceMatrix.needsUpdate = true;
    scene.add(win);
  }

  function addCranes(scene) {
    var gold = new THREE.MeshLambertMaterial({ color: 0xc8a86e });
    var dark = new THREE.MeshLambertMaterial({ color: 0x8a7350 });

    function crane(x, z, mast, jib, rot) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;

      var m = new THREE.Mesh(new THREE.BoxGeometry(2.6, mast, 2.6), gold);
      m.position.y = mast / 2;
      g.add(m);

      var j = new THREE.Mesh(new THREE.BoxGeometry(jib, 2.1, 2.1), gold);
      j.position.set(jib / 2 - jib * 0.22, mast + 1.6, 0);
      g.add(j);

      var cj = new THREE.Mesh(new THREE.BoxGeometry(jib * 0.34, 1.8, 1.8), gold);
      cj.position.set(-jib * 0.22, mast + 1.4, 0);
      g.add(cj);

      var cw = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 6), dark);
      cw.position.set(-jib * 0.34, mast + 0.2, 0);
      g.add(cw);

      var tie = new THREE.Mesh(new THREE.BoxGeometry(jib * 0.62, 1.1, 1.1), dark);
      tie.position.set(jib * 0.16, mast + mast * 0.13, 0);
      tie.rotation.z = -0.2;
      g.add(tie);

      var apex = new THREE.Mesh(new THREE.BoxGeometry(1.6, mast * 0.26, 1.6), gold);
      apex.position.set(0, mast + mast * 0.13, 0);
      g.add(apex);

      var line = new THREE.Mesh(new THREE.BoxGeometry(0.5, mast * 0.72, 0.5), dark);
      line.position.set(jib * 0.62, mast - mast * 0.3, 0);
      g.add(line);

      var hook = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3.4), dark);
      hook.position.set(jib * 0.62, mast * 0.58, 0);
      g.add(hook);

      scene.add(g);
      return g;
    }

    crane(-108, 74, 96, 92, 0.5);
    crane(96, -64, 78, 76, -0.9);
    crane(26, 132, 64, 62, 2.2);
  }

  function addIsland(scene) {
    /* Low-poly landmass — a flattened hexagonal prism, the "island" the site
       already photographs. One geometry, one material. */
    var shape = new THREE.CylinderGeometry(196, 226, 26, 6, 1, false);
    var island = new THREE.Mesh(
      shape,
      new THREE.MeshLambertMaterial({ color: 0x24544a, flatShading: true })
    );
    island.position.set(0, 3, -300);
    island.rotation.y = Math.PI / 7;
    scene.add(island);

    var rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(196, 226, 26, 6, 1, false)),
      new THREE.LineBasicMaterial({ color: 0xc8a86e, transparent: true, opacity: 0.5 })
    );
    rim.position.copy(island.position);
    rim.rotation.copy(island.rotation);
    scene.add(rim);

    /* Water sheen under the island. */
    var water = new THREE.Mesh(
      new THREE.CircleGeometry(560, 48),
      new THREE.MeshLambertMaterial({ color: 0x123c46 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.6, -300);
    scene.add(water);
  }

  function addGlobe(scene) {
    var g = new THREE.Group();
    g.position.set(-240, 132, -190);

    var globe = new THREE.Mesh(
      new THREE.SphereGeometry(38, 26, 18),
      new THREE.MeshBasicMaterial({
        color: 0x2f9ea8,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      })
    );
    g.add(globe);

    var core = new THREE.Mesh(
      new THREE.SphereGeometry(34, 20, 14),
      new THREE.MeshLambertMaterial({ color: 0x0d2422 })
    );
    g.add(core);

    /* GCC pins — the same nine markets the site's own globe lists. */
    var pins = [
      [24.47, 54.37],
      [24.71, 46.68],
      [25.29, 51.53],
      [29.37, 47.98],
      [26.23, 50.59],
      [23.59, 58.41],
      [31.95, 35.93],
      [33.31, 44.36],
      [30.04, 31.24]
    ];
    var pinMat = new THREE.MeshBasicMaterial({ color: 0xc8a86e });
    var pinGeo = new THREE.SphereGeometry(1.9, 8, 6);
    for (var i = 0; i < pins.length; i++) {
      var lat = (pins[i][0] * Math.PI) / 180;
      var lon = (pins[i][1] * Math.PI) / 180 - Math.PI / 2;
      var r = 39;
      var p = new THREE.Mesh(pinGeo, pinMat);
      p.position.set(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon)
      );
      g.add(p);
    }
    scene.add(g);
    state.globe = g;
  }

  function addCoast(scene, rand) {
    /* A scattered band of low blocks along the far waterfront. */
    var N = 40;
    var inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x1c4a45 }),
      N
    );
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var pos = new THREE.Vector3();
    var scl = new THREE.Vector3();
    for (var i = 0; i < N; i++) {
      var t = i / N;
      var x = -520 + t * 1040 + (rand() - 0.5) * 40;
      var z = -430 - rand() * 120;
      var h = 6 + rand() * 26;
      pos.set(x, h / 2, z);
      scl.set(10 + rand() * 22, h, 10 + rand() * 18);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }

  /* --------------------------------------------------------- chapter mount */

  function mountChapter(def, anchor, scene, camera) {
    var chapter = document.createElement("div");
    chapter.className = "ar3d-chapter";
    chapter.id = def.id;
    chapter.style.height = def.heightVh + "vh";

    var stage = document.createElement("div");
    stage.className = "ar3d-stage";

    var canvas = document.createElement("canvas");
    canvas.className = "ar3d-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Scroll-driven 3D sequence — Al Ryum Group");
    stage.appendChild(canvas);

    var copy = document.createElement("div");
    copy.className = "ar3d-copy";
    copy.innerHTML =
      '<p class="ar3d-eyebrow"></p>' +
      '<h2 class="ar3d-title"></h2>' +
      '<p class="ar3d-text"></p>';
    stage.appendChild(copy);

    var hud = document.createElement("div");
    hud.className = "ar3d-hud";
    hud.innerHTML = '<span class="ar3d-hud__bar"><i></i></span>';
    stage.appendChild(hud);

    chapter.appendChild(stage);
    anchor.parentNode.insertBefore(chapter, anchor);

    var handle = {
      def: def,
      el: chapter,
      canvas: canvas,
      copy: copy,
      eyebrow: copy.querySelector(".ar3d-eyebrow"),
      title: copy.querySelector(".ar3d-title"),
      text: copy.querySelector(".ar3d-text"),
      bar: hud.querySelector("i"),
      ctx: null,
      renderer: null,
      visible: false,
      camera: camera,
      scene: scene,
      lastBeat: -1
    };

    try {
      handle.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
      });
      handle.renderer.outputColorSpace = THREE.SRGBColorSpace;
      handle.renderer.setClearColor(0x000000, 0);
    } catch (e) {
      console.warn("[ar3d] renderer creation failed; removing chapter.", e);
      chapter.remove();
      return;
    }

    state.chapters = state.chapters || [];
    state.chapters.push(handle);

    if (observer) observer.observe(chapter, { threshold: 0 });
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(function () {
        resizeChapter(handle);
      });
      ro.observe(stage);
      handle.ro = ro;
    }
    resizeChapter(handle);
  }

  function resizeChapter(handle) {
    if (!handle.renderer) return;
    var w = handle.canvas.clientWidth || window.innerWidth;
    var h = handle.canvas.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    var pr = Math.min(window.devicePixelRatio || 1, CONFIG.quality.maxPixelRatio);
    if (state.quality === "medium") pr = Math.min(pr, CONFIG.quality.degradePixelRatio);
    if (state.quality === "low") pr = Math.min(pr, CONFIG.quality.floorPixelRatio);
    handle.renderer.setPixelRatio(pr);
    handle.renderer.setSize(w, h, false);
    handle.camera.aspect = w / h;
    handle.camera.updateProjectionMatrix();
    handle.dirty = true;
    requestTick();
  }

  /* --------------------------------------------------------- master path */

  var pathCache = { posCurve: null, lookCurve: null };

  function curves() {
    if (pathCache.posCurve) return pathCache;
    var pos = [];
    var look = [];
    for (var i = 0; i < BEATS.length; i++) {
      pos.push(new THREE.Vector3(BEATS[i].pos[0], BEATS[i].pos[1], BEATS[i].pos[2]));
      look.push(new THREE.Vector3(BEATS[i].look[0], BEATS[i].look[1], BEATS[i].look[2]));
    }
    pathCache.posCurve = new THREE.CatmullRomCurve3(pos, false, "catmullrom", 0.5);
    pathCache.lookCurve = new THREE.CatmullRomCurve3(look, false, "catmullrom", 0.5);
    return pathCache;
  }

  function poseAt(u, camera) {
    var c = curves();
    u = clamp(u, 0, 1);
    /* getPoint (not getPointAt): uniform segment parameterisation, so path
       parameter t = i/9 lands exactly on waypoint i. */
    camera.position.copy(c.posCurve.getPoint(u));
    camera.lookAt(c.lookCurve.getPoint(u));
    camera.rotation.z = Math.sin(u * Math.PI * 1.5) * 0.012;
  }

  function beatIndexFor(def, u) {
    var idx = Math.round(clamp(u, 0, 1) * (BEATS.length - 1));
    idx = clamp(idx, def.beats[0], def.beats[def.beats.length - 1]);
    return idx;
  }

  function paintCopy(handle, u) {
    var idx = beatIndexFor(handle.def, u);
    if (idx === handle.lastBeat) return;
    handle.lastBeat = idx;
    var b = BEATS[idx];
    handle.eyebrow.textContent = b.eyebrow;
    handle.title.textContent = b.title;
    handle.text.textContent = b.text;
    /* restart the CSS fade */
    handle.copy.classList.remove("is-in");
    void handle.copy.offsetWidth;
    handle.copy.classList.add("is-in");
  }

  /* ------------------------------------------------- scroll → progress */

  function chapterProgress(def, el) {
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var span = el.offsetHeight - vh;
    if (span <= 1) return 0;
    return clamp(-rect.top / span, 0, 1);
  }

  function scrollState() {
    var list = state.chapters || [];
    var m = 0;
    var activeIndex = -1;
    var activeLocal = 0;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var rect = h.el.getBoundingClientRect();
      var vh = window.innerHeight;
      if (rect.top <= vh && rect.bottom >= 0) {
        activeLocal = chapterProgress(h.def, h.el);
        activeIndex = i;
        m = h.def.uStart + activeLocal * (h.def.uEnd - h.def.uStart);
        return { master: m, activeIndex: activeIndex, activeLocal: activeLocal };
      }
      /* Above the viewport → hold this chapter's end pose. */
      if (rect.bottom < 0) {
        m = Math.max(m, h.def.uEnd);
      } else if (rect.top > vh) {
        m = Math.max(m, h.def.uStart);
      }
    }
    return { master: m, activeIndex: activeIndex, activeLocal: activeLocal };
  }

  /* ------------------------------------------------------------- render */

  var rafId = 0;

  function requestTick() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  function tick() {
    rafId = 0;
    if (!state.chapters || !state.chapters.length) return;

    var s = scrollState();
    var target = s.master;

    /* Camera progress. With motion switched off from the site's own toggle the
       camera holds the opening pose of whichever chapter is on screen while
       the copy and the progress rail still follow the reader's scroll. */
    var camTarget = target;
    var paused = !state.motionEnabled;
    if (paused) {
      camTarget = s.activeIndex >= 0 ? state.chapters[s.activeIndex].def.uStart : target;
    }

    state.progress.master = target;
    state.progress.camera = camTarget;

    /* Damped approach — the loop keeps running only while it is catching up. */
    var cur = state.progress.damped;
    var next = lerp(cur, camTarget, paused ? 1 : CONFIG.damping);
    var settled = Math.abs(next - camTarget) < CONFIG.settleEpsilon;
    if (settled) next = camTarget;
    state.progress.damped = next;

    var t0 = performance.now();
    var drew = false;
    for (var i = 0; i < state.chapters.length; i++) {
      var h = state.chapters[i];
      if (!h.renderer || !h.visible) continue;
      poseAt(next, h.camera);
      paintCopy(h, target);
      h.renderer.render(h.scene, h.camera);
      drew = true;
      if (h.bar) {
        var lp = (target - h.def.uStart) / Math.max(0.0001, h.def.uEnd - h.def.uStart);
        h.bar.style.transform = "scaleX(" + clamp(lp, 0, 1).toFixed(4) + ")";
      }
    }
    if (drew) {
      var dt = performance.now() - t0;
      state.lastFrameMs = dt;
      sampleQuality(dt);
    }

    if (!settled) requestTick();
  }

  function sampleQuality(ms) {
    var q = CONFIG.quality;
    if (state.quality === "off") return;
    state.frameSamples.push(ms);
    if (state.frameSamples.length < q.sampleFrames) return;
    var total = 0;
    for (var i = 0; i < state.frameSamples.length; i++) total += state.frameSamples[i];
    var avg = total / state.frameSamples.length;
    state.frameSamples.length = 0;

    if (avg > q.disableMs) {
      state.quality = "off";
      console.warn("[ar3d] frame cost too high (" + avg.toFixed(1) + "ms) — hiding 3D chapters.");
      document.documentElement.classList.add("ar3d-off");
    } else if (avg > q.floorMs && state.quality !== "low") {
      state.quality = "low";
      console.info("[ar3d] quality → low (" + avg.toFixed(1) + "ms)");
      restyleChapters();
    } else if (avg > q.degradeMs && state.quality === "high") {
      state.quality = "medium";
      console.info("[ar3d] quality → medium (" + avg.toFixed(1) + "ms)");
      restyleChapters();
    }
  }

  function restyleChapters() {
    var list = state.chapters || [];
    for (var i = 0; i < list.length; i++) resizeChapter(list[i]);
  }

  /* --------------------------------------------------------------- motion */

  function applyMotion() {
    var site = window.alRyumMotion;
    if (site && typeof site.enabled === "boolean") {
      state.motionEnabled = site.enabled;
    } else {
      state.motionEnabled = true;
    }
    document.documentElement.classList.toggle("ar3d-paused", !state.motionEnabled);
    requestTick();
  }

  /* --------------------------------------------------------- observer/events */

  function setupObserver() {
    if (observer || typeof IntersectionObserver !== "function") return;
    observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          var list = state.chapters || [];
          for (var j = 0; j < list.length; j++) {
            if (list[j].el === e.target) {
              list[j].visible = e.isIntersecting;
              if (e.isIntersecting) {
                resizeChapter(list[j]);
                list[j].lastBeat = -1;
              }
            }
          }
        }
        requestTick();
      },
      { rootMargin: "20% 0px 20% 0px", threshold: 0 }
    );
  }

  function notifyLayout() {
    try {
      window.lenis && window.lenis.resize && window.lenis.resize();
    } catch (e) {}
    if (CONFIG.refreshScrollTrigger) {
      try {
        window.ScrollTrigger && window.ScrollTrigger.refresh && window.ScrollTrigger.refresh();
      } catch (e) {}
    }
  }

  /* The renderer is demand-driven: it runs only while the damped progress is
     still travelling to the scroll position, then stops so an idle page costs
     nothing on a laptop GPU. This is what wakes it again — without it the
     camera would only catch up on the next safety poll. */
  function onScroll() {
    requestTick();
  }

  /* --------------------------------------------------------------- teardown */

  function destroy() {
    var list = state.chapters || [];
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      try {
        h.ro && h.ro.disconnect();
        h.renderer && h.renderer.dispose();
      } catch (e) {}
      if (h.el && h.el.parentNode) h.el.parentNode.removeChild(h.el);
    }
    state.chapters = [];
    if (state.scene) {
      state.scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
          else o.material.dispose();
        }
      });
      state.scene = null;
    }
    document.documentElement.classList.remove("ar3d-paused", "ar3d-off");
    state.built = false;
    built = false;
    notifyLayout();
  }

  /* ================================================================= boot */

  function boot() {
    if (route() !== CONFIG.homeRoute) {
      if (built) destroy();
      return;
    }
    if (built) return;
    build();
    if (built) {
      setupObserver();
      applyMotion();
      state.chapters.forEach(function (h) {
        observer && observer.observe(h.el, { threshold: 0 });
      });
      onResizeBound = function () {
        state.chapters.forEach(resizeChapter);
        notifyLayout();
      };
      window.addEventListener("resize", onResizeBound, { passive: true });
      if (!scrollHooked) {
        scrollHooked = true;
        window.addEventListener("scroll", onScroll, { passive: true });
        try {
          window.lenis && window.lenis.on && window.lenis.on("scroll", onScroll);
        } catch (e) {}
      }
      onMotionBound = applyMotion;
      window.addEventListener("alryum-motion-change", onMotionBound);
      window.addEventListener("popstate", boot);
      requestTick();
      notifyLayout();
    }
  }

  window.__alRyum3D = {
    state: state,
    build: build,
    destroy: destroy,
    config: CONFIG,
    beats: BEATS,
    get chapters() {
      return state.chapters || [];
    }
  };

  function poll() {
    if (pollTimer) return;
    pollTimer = window.setInterval(function () {
      if (!document.body) return;
      boot();
      if (built && state.chapters) {
        var changed = false;
        state.chapters.forEach(function (h) {
          if (!h.el.isConnected) changed = true;
        });
        if (changed) destroy();
        requestTick();
      }
    }, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot();
      poll();
    }, { once: true });
  } else {
    boot();
    poll();
  }

  /* The site is a client-rendered SPA: React mounts after this module runs,
     so watch for the anchors rather than assuming they exist. */
  (function watch() {
    var mo = new MutationObserver(function () {
      boot();
    });
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    window.addEventListener("load", boot);
  })();
})();
