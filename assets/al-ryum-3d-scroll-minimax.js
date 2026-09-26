import * as THREE from "three";
/*!
 * Al Ryum Group — Cinematic 3D Scroll Hero
 * Module: al-ryum-3d-scroll-minimax
 *
 * Architecture: single persistent full-viewport <canvas>, single WebGLRenderer.
 *   The canvas is position:fixed, z-index:0, pointer-events:none. Layer HTML
 *   copy above with z-index >= 1 to "fade over" the 3D scene.
 *
 * Camera flies a THREE.CatmullRomCurve3 path; progress is
 *   scrollY / (scrollHeight - innerHeight), damped (lerp 0.07), then
 *   smoothstepped, then sampled. Camera position follows sampled point
 *   with another lerp (0.075). LookAt is a *separate* CatmullRomCurve3
 *   sampled slightly ahead of the position curve, with its own damping
 *   (0.06). Mouse parallax is a small position-offset on the camera
 *   target (x +/- 2.5, y +/- 1.6) with damped mouse (0.05).
 *
 * World: procedural. 6-variant CanvasTexture window emissives (additive
 *   blend), 100+ box towers in 3 density rings, 5 animated tower cranes
 *   (lattice mast + counter-jib + counterweight + main jib + tie bar +
 *   hook line, slewing group rotates), Louvre-Abu-Dhabi-inspired dome
 *   (solid + wireframe geometric lattice overlay), wireframe globe with
 *   9 glowing project pins, reflective water plane, displaced desert
 *   ground. Warm dusk lighting (HemisphereLight + warm key + cool fill
 *   + low ambient) behind FogExp2 (0x2a1a22, density 0.0028).
 *
 * Mobile guard: returns early if window.innerWidth < 768. The
 *   WebGLRenderer is wrapped in try/catch so a context-creation failure
 *   logs and bails instead of breaking the page.
 *
 * Requires global THREE (three@0.159, exposed by three.min.js).
 */

(function () {
  'use strict';

  /* ============================================================ */
  /* 0. Guards                                                    */
  /* ============================================================ */
  if (window.innerWidth < 768) return;
  if (typeof THREE === 'undefined') {
    console.error('[al-ryum-3d] THREE not found on window; aborting');
    return;
  }

  /* ============================================================ */
  /* 1. State                                                     */
  /* ============================================================ */
  const state = {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollProgress: 0,
    targetScrollProgress: 0,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    currentLookAt: new THREE.Vector3(0, 5, 0),
    targetLookAt: new THREE.Vector3(0, 5, 0),
    cranes: []
  };

  /* ============================================================ */
  /* 2. Helpers                                                   */
  /* ============================================================ */
  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function smoothstep(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ============================================================ */
  /* 3. Window emissive texture (shared variant pool)             */
  /* ============================================================ */
  function makeWindowTexture(seed) {
    const w = 128, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Dark base
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, 0, w, h);

    const cols = 6, rows = 16;
    const cellW = w / cols, cellH = h / rows;
    const rng = mulberry32(seed);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (rng() < 0.45) continue; // unlit
        const warmth = rng();
        const r = 255;
        const g = Math.floor(175 + warmth * 75);
        const b = Math.floor(95 + warmth * 80);
        const a = 0.55 + rng() * 0.45;
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        const padX = 2, padY = 3;
        ctx.fillRect(
          x * cellW + padX,
          y * cellH + padY,
          cellW - padX * 2,
          cellH - padY * 2
        );
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.anisotropy = 4;
    return tex;
  }

  /* ============================================================ */
  /* 4. Building factory                                          */
  /* ============================================================ */
  function makeBuilding(opts) {
    const width = opts.width;
    const depth = opts.depth;
    const height = opts.height;
    const winTex = opts.winTex;
    const bodyColor = opts.bodyColor;
    const metalness = opts.metalness;

    const g = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.32,
      metalness: metalness
    });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      bodyMat
    );
    body.position.y = height / 2;
    g.add(body);

    // Emissive window overlay (front + back only, additive)
    const winMat = new THREE.MeshBasicMaterial({
      map: winTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const winGeo = new THREE.PlaneGeometry(width * 0.97, height * 0.97);
    const winFront = new THREE.Mesh(winGeo, winMat);
    winFront.position.set(0, height / 2, depth / 2 + 0.01);
    g.add(winFront);
    const winBack = new THREE.Mesh(winGeo, winMat);
    winBack.position.set(0, height / 2, -depth / 2 - 0.01);
    winBack.rotation.y = Math.PI;
    g.add(winBack);

    // Crown / spire on tall towers
    if (height > 90) {
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a32,
        roughness: 0.4,
        metalness: 0.7
      });
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(width, depth) * 0.35, height * 0.12, 6),
        crownMat
      );
      crown.position.y = height + height * 0.06;
      g.add(crown);
    }

    g.position.set(opts.x, 0, opts.z);
    return g;
  }

  /* ============================================================ */
  /* 5. Crane factory (lattice mast + slewing jib assembly)       */
  /* ============================================================ */
  function makeCrane(x, z, mastHeight) {
    const g = new THREE.Group();

    const yellow = new THREE.MeshStandardMaterial({
      color: 0xf3a418, roughness: 0.55, metalness: 0.4
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x1f1f24, roughness: 0.6, metalness: 0.5
    });

    // Concrete base
    const base = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 7), dark);
    base.position.y = 1.25;
    g.add(base);

    // Lattice mast (4 columns + cross braces)
    const mastH = mastHeight;
    const colGeo = new THREE.BoxGeometry(0.7, mastH, 0.7);
    const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    offsets.forEach(function (o) {
      const c = new THREE.Mesh(colGeo, yellow);
      c.position.set(o[0] * 1.2, 2.5 + mastH / 2, o[1] * 1.2);
      g.add(c);
    });
    for (let i = 0; i < 5; i++) {
      const y = 2.5 + (i + 1) * (mastH / 6);
      const braceA = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 0.4), yellow);
      braceA.position.set(0, y, 1.2);
      g.add(braceA);
      const braceB = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 0.4), yellow);
      braceB.position.set(0, y, -1.2);
      g.add(braceB);
    }

    // Slewing assembly (rotates as a unit)
    const slew = new THREE.Group();
    slew.position.y = 2.5 + mastH;
    g.add(slew);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), dark);
    cabin.position.set(0, 0.8, 0);
    slew.add(cabin);

    const counterJib = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 0.7), yellow);
    counterJib.position.set(-4.5, 1.6, 0);
    slew.add(counterJib);

    const cw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.2), dark);
    cw.position.set(-7.5, 1.2, 0);
    slew.add(cw);

    const jib = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 0.6), yellow);
    jib.position.set(10, 1.6, 0);
    slew.add(jib);

    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), yellow);
    tie.position.set(2, 4.5, 0);
    slew.add(tie);

    // Hook line (simple visual)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x101010 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(10, 1.0, 0),
      new THREE.Vector3(10, -6, 0)
    ]);
    slew.add(new THREE.Line(lineGeo, lineMat));

    g.position.set(x, 0, z);
    g.userData.slew = slew;
    g.userData.speed = 0.05 + Math.random() * 0.12;
    return g;
  }

  /* ============================================================ */
  /* 6. Landmark (Louvre Abu Dhabi-inspired dome)                 */
  /* ============================================================ */
  function makeLandmark() {
    const g = new THREE.Group();
    const x0 = -40, z0 = -210;

    // Plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(90, 4, 90),
      new THREE.MeshStandardMaterial({ color: 0x8a8579, roughness: 0.8, metalness: 0.1 })
    );
    plinth.position.set(x0, 2, z0);
    g.add(plinth);

    // Lower museum mass
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(70, 7, 70),
      new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.7, metalness: 0.1 })
    );
    lower.position.set(x0, 7.5, z0);
    g.add(lower);

    // Shallow dome
    const domeR = 30;
    const domeGeo = new THREE.SphereGeometry(
      domeR, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.3
    );
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xeae0d0, roughness: 0.45, metalness: 0.15
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(x0, 11, z0);
    g.add(dome);

    // Geometric lattice overlay (the iconic Louvre ABU DHABI pattern)
    const lattice = new THREE.Mesh(
      new THREE.SphereGeometry(domeR + 0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.3),
      new THREE.MeshStandardMaterial({
        color: 0xc8b896, roughness: 0.3, metalness: 0.6, wireframe: true
      })
    );
    lattice.position.set(x0, 11, z0);
    g.add(lattice);

    return g;
  }

  /* ============================================================ */
  /* 7. Globe (Beat 5 — global reach)                             */
  /* ============================================================ */
  function makeGlobe() {
    const g = new THREE.Group();
    g.position.set(0, 380, 200);
    g.scale.setScalar(0.9);

    // Wireframe sphere
    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(45, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0x4a5a8a, roughness: 0.3, metalness: 0.7, wireframe: true
      })
    );
    g.add(wire);

    // Inner glow shell
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(44, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x2a3a5e, transparent: true, opacity: 0.12
      })
    );
    g.add(inner);

    // Project pins (plausible GCC + landmark locations on a unit sphere)
    const pins = [
      'Louvre Abu Dhabi', 'Zayed National Museum', 'Dubai Parks',
      'Pearl Jumeirah', 'La Mer', 'Trump IG',
      'Meydan', 'Kempinski', 'Lusail'
    ];
    // Each pin position hand-placed on a unit sphere (loosely GCC-clustered)
    const pinPos = [
      new THREE.Vector3(0.18, 0.55, 0.81),
      new THREE.Vector3(0.20, 0.52, 0.83),
      new THREE.Vector3(0.22, 0.50, 0.84),
      new THREE.Vector3(0.16, 0.48, 0.86),
      new THREE.Vector3(0.17, 0.49, 0.85),
      new THREE.Vector3(0.19, 0.51, 0.82),
      new THREE.Vector3(0.21, 0.53, 0.80),
      new THREE.Vector3(0.23, 0.54, 0.79),
      new THREE.Vector3(0.14, 0.58, 0.80)
    ];

    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffaa55 });
    const pinGlow = new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    for (let i = 0; i < pins.length; i++) {
      const pos = pinPos[i].clone().multiplyScalar(45);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), pinMat);
      pin.position.copy(pos);
      g.add(pin);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8), pinGlow);
      halo.position.copy(pos);
      g.add(halo);
    }

    return g;
  }

  /* ============================================================ */
  /* 8. Ground & water                                            */
  /* ============================================================ */
  function makeGround() {
    const geo = new THREE.PlaneGeometry(4000, 4000, 80, 80);
    const pos = geo.attributes.position;
    const rng = mulberry32(7);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      const fade = Math.max(0, 1 - dist / 800);
      const h = (Math.sin(x * 0.04) * Math.cos(y * 0.04) * 1.5 +
                 Math.sin(x * 0.11 + 1) * 0.6 +
                 (rng() - 0.5) * 0.4) * fade;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc89a6a, roughness: 0.95, metalness: 0.0
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  function makeWater() {
    const geo = new THREE.PlaneGeometry(4000, 4000, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0e1828, roughness: 0.18, metalness: 0.92
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.2;
    return m;
  }

  /* ============================================================ */
  /* 9. Canvas, renderer, scene, camera                           */
  /* ============================================================ */
  const canvas = document.createElement('canvas');
  canvas.id = 'al-ryum-3d-canvas';
  canvas.style.cssText = [
    'position:fixed', 'top:0', 'left:0',
    'width:100vw', 'height:100vh',
    'z-index:0', 'pointer-events:none', 'display:block'
  ].join(';');
  if (document.body) {
    document.body.insertBefore(canvas, document.body.firstChild);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.insertBefore(canvas, document.body.firstChild);
    }, { once: true });
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    console.error('[al-ryum-3d] WebGL init failed:', err);
    return;
  }
  renderer.setSize(state.width, state.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x2a1a22);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.0028);

  const camera = new THREE.PerspectiveCamera(
    55, state.width / state.height, 0.5, 2500
  );
  camera.position.set(0, 6, 250);

  /* ============================================================ */
  /* 10. Lighting (warm dusk)                                     */
  /* ============================================================ */
  const hemi = new THREE.HemisphereLight(0xffb789, 0x1a1428, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffa066, 1.55);
  sun.position.set(-350, 220, -250);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x6a92b8, 0.45);
  fill.position.set(250, 120, 220);
  scene.add(fill);

  const ambient = new THREE.AmbientLight(0x2a1f2c, 0.28);
  scene.add(ambient);

  /* ============================================================ */
  /* 11. Path curves                                              */
  /* ============================================================ */
  const positionPoints = [
    new THREE.Vector3(0,   6,   250),   // beat 1: desert dawn, low
    new THREE.Vector3(40,  50,  100),   // rising
    new THREE.Vector3(100, 95,  -30),   // beat 2: skyline pass
    new THREE.Vector3(60,  32, -120),   // descending into build
    new THREE.Vector3(20,  18, -200),   // beat 3: build zone, near cranes
    new THREE.Vector3(-30, 35, -150),   // approach landmark
    new THREE.Vector3(-80, 45,  -50),   // beat 4: orbit landmark
    new THREE.Vector3(-40, 180, 130),   // rising
    new THREE.Vector3(0,   360, 320)    // beat 5: pullback, globe in view
  ];
  const positionCurve = new THREE.CatmullRomCurve3(
    positionPoints, false, 'catmullrom', 0.4
  );

  const lookAtPoints = [
    new THREE.Vector3(0,    5,  -100),
    new THREE.Vector3(80,   40, -150),
    new THREE.Vector3(100,  80, -200),
    new THREE.Vector3(0,    25, -260),
    new THREE.Vector3(0,    20, -310),
    new THREE.Vector3(-30,  25, -210),
    new THREE.Vector3(-80,  30, -100),
    new THREE.Vector3(0,    320, 150),
    new THREE.Vector3(0,    380, 200)   // look at globe center
  ];
  const lookAtCurve = new THREE.CatmullRomCurve3(
    lookAtPoints, false, 'catmullrom', 0.4
  );

  /* ============================================================ */
  /* 12. World construction                                       */
  /* ============================================================ */
  // Shared window-emissive variant pool
  const winTextures = [];
  for (let i = 0; i < 6; i++) {
    winTextures.push(makeWindowTexture(i * 7919 + 1));
  }

  // Ground and water
  scene.add(makeGround());
  scene.add(makeWater());

  // Skyline clusters
  const skyline = new THREE.Group();
  const rng = mulberry32(101);

  // Ring of background towers (silhouette in the haze)
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2 + rng() * 0.1;
    const dist = 320 + rng() * 220;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (z > 80) continue; // keep mostly ahead / to sides
    const w = 12 + rng() * 18;
    const d = 12 + rng() * 18;
    const h = 35 + Math.pow(rng(), 1.5) * 160;
    const hue = 0.56 + rng() * 0.08;
    const sat = 0.05 + rng() * 0.08;
    const lit = 0.12 + rng() * 0.05;
    skyline.add(makeBuilding({
      width: w, depth: d, height: h, x: x, z: z,
      winTex: winTextures[Math.floor(rng() * winTextures.length)],
      bodyColor: new THREE.Color().setHSL(hue, sat, lit),
      metalness: 0.6 + rng() * 0.2
    }));
  }

  // Downtown cluster (the dense silhouette at beat 2)
  for (let i = 0; i < 45; i++) {
    const cx = 80, cz = -90;
    const x = cx + (rng() - 0.5) * 240;
    const z = cz + (rng() - 0.5) * 240;
    const w = 10 + rng() * 16;
    const d = 10 + rng() * 16;
    const h = 50 + Math.pow(rng(), 1.6) * 220;
    const hue = 0.58 + rng() * 0.07;
    const sat = 0.06 + rng() * 0.08;
    const lit = 0.14 + rng() * 0.05;
    skyline.add(makeBuilding({
      width: w, depth: d, height: h, x: x, z: z,
      winTex: winTextures[Math.floor(rng() * winTextures.length)],
      bodyColor: new THREE.Color().setHSL(hue, sat, lit),
      metalness: 0.65 + rng() * 0.2
    }));
  }

  // Foreground flanking towers (along the path corridor)
  for (let i = 0; i < 24; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (60 + rng() * 90);
    const z = -260 + (rng() - 0.5) * 320;
    const w = 8 + rng() * 12;
    const d = 8 + rng() * 12;
    const h = 35 + Math.pow(rng(), 1.4) * 130;
    const hue = 0.55 + rng() * 0.09;
    const sat = 0.05 + rng() * 0.08;
    const lit = 0.13 + rng() * 0.05;
    skyline.add(makeBuilding({
      width: w, depth: d, height: h, x: x, z: z,
      winTex: winTextures[Math.floor(rng() * winTextures.length)],
      bodyColor: new THREE.Color().setHSL(hue, sat, lit),
      metalness: 0.6 + rng() * 0.2
    }));
  }
  scene.add(skyline);

  // Cranes in the build zone (Beat 3)
  const craneSpecs = [
    [50,  -130, 55],
    [-10, -180, 60],
    [85,  -160, 50],
    [-60, -140, 52],
    [25,  -210, 48]
  ];
  craneSpecs.forEach(function (spec) {
    const c = makeCrane(spec[0], spec[1], spec[2]);
    state.cranes.push(c);
    scene.add(c);
  });

  // Landmark dome
  scene.add(makeLandmark());

  // Globe (positioned in Beat 5 framing area)
  const globe = makeGlobe();
  scene.add(globe);

  /* ============================================================ */
  /* 13. Input                                                    */
  /* ============================================================ */
  function updateScroll() {
    const max = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    state.targetScrollProgress = clamp(window.scrollY / max, 0, 1);
  }

  function onMouseMove(e) {
    state.targetMouseX = (e.clientX / state.width) * 2 - 1;
    state.targetMouseY = (e.clientY / state.height) * 2 - 1;
  }

  function onResize() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    camera.aspect = state.width / state.height;
    camera.updateProjectionMatrix();
    renderer.setSize(state.width, state.height);
  }

  function onOrientationChange() {
    // Defer to next frame so innerWidth/Height are settled
    requestAnimationFrame(onResize);
  }

  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onOrientationChange, { passive: true });
  updateScroll();

  /* ============================================================ */
  /* 14. Animation loop                                           */
  /* ============================================================ */
  const tmpTarget = new THREE.Vector3();
  const tmpParallax = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function tick() {
    requestAnimationFrame(tick);

    // Damp scroll progress
    state.scrollProgress +=
      (state.targetScrollProgress - state.scrollProgress) * 0.07;

    // Damp mouse
    state.mouseX += (state.targetMouseX - state.mouseX) * 0.05;
    state.mouseY += (state.targetMouseY - state.mouseY) * 0.05;

    // Eased progress along path
    const eased = smoothstep(state.scrollProgress);

    // Sample curves
    positionCurve.getPointAt(eased, tmpTarget);
    const aheadT = Math.min(1, eased + 0.04);
    lookAtCurve.getPointAt(aheadT, tmpLook);

    // Subtle parallax offset
    tmpParallax.set(state.mouseX * 2.5, -state.mouseY * 1.6, 0);

    // Lerp camera
    camera.position.x +=
      (tmpTarget.x + tmpParallax.x - camera.position.x) * 0.075;
    camera.position.y +=
      (tmpTarget.y + tmpParallax.y - camera.position.y) * 0.075;
    camera.position.z += (tmpTarget.z - camera.position.z) * 0.075;

    // Damped lookAt
    state.targetLookAt.copy(tmpLook);
    state.currentLookAt.lerp(state.targetLookAt, 0.06);
    camera.lookAt(state.currentLookAt);

    // Animate cranes
    for (let i = 0; i < state.cranes.length; i++) {
      const c = state.cranes[i];
      c.userData.slew.rotation.y += c.userData.speed * 0.012;
    }

    // Globe slow rotation
    globe.rotation.y += 0.0008;

    renderer.render(scene, camera);
  }
  tick();

  // Lightweight debug handle (no global pollution beyond a single namespaced key)
  window.__alRyum3D = {
    state: state,
    scene: scene,
    camera: camera,
    renderer: renderer
  };
})();
