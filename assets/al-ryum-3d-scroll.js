/* ============================================================================
 * AL RYUM — 3D SCROLL FLYTHROUGH
 * ----------------------------------------------------------------------------
 * Self-contained Three.js procedural "Gulf skyline" scroll flythrough.
 *
 * SINGLE PERSISTENT CANVAS pattern (NOT per-section pinned scenes).
 * One fixed full-viewport <canvas> with its own THREE.WebGLRenderer drives a
 * CatmullRomCurve3 camera path whose progress is bound to page scroll.
 *
 * Load order (wired by whoever embeds this — this file does NOT touch
 * index.html): a local single-file build of Three.js must be loaded BEFORE
 * this script, e.g.:
 *
 *     <script src="/assets/three.min.js"></script>
 *     <script src="/assets/al-ryum-3d-scroll.js"></script>
 *
 * three.min.js here is three@0.159.0 (the last release that ships the UMD
 * single-file build). It exposes the global `THREE`.
 *
 * Behaviour:
 *   - Desktop only: WebGL is built iff window.innerWidth >= 768. Below that,
 *     this module does nothing (the flat CSS fallback takes over).
 *   - Camera: progress = scrollY / (scrollHeight - innerHeight), eased with
 *     smoothstep, sampled on a CatmullRomCurve3, then followed with damped
 *     lerp (~0.07) and a damped look-at, plus subtle mouse parallax.
 *   - Skyline is procedural: glass towers, emissive window planes, cranes,
 *     a reflective water plane, drifting fog (FogExp2 + fog banks), warm
 *     dusk lighting. No GLB / Blender assets.
 * ========================================================================== */
(function () {
  'use strict';

  /* Desktop guard — never build WebGL on small screens. */
  if (window.innerWidth < 768) return;

  var ALREADY_BUILT = false;
  var WAIT_TICKS = 0;
  var MAX_WAIT = 120; // ~ 120 * 120ms = ~14s grace for THREE to appear

  function boot() {
    if (ALREADY_BUILT) return;
    if (window.innerWidth < 768) return; // re-check in case of early load
    if (typeof THREE === 'undefined' || !document.body) {
      if (++WAIT_TICKS > MAX_WAIT) return;
      setTimeout(boot, 120);
      return;
    }
    ALREADY_BUILT = true;
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  }
  boot();

  /* ==========================================================================
   * Helpers
   * ======================================================================== */

  function smoothstep(t) {
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  /* Deterministic PRNG so the skyline is stable across reloads. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Vertical dusk gradient (top -> bottom) as a canvas texture. */
  function makeGradientTexture(stops, w, h) {
    w = w || 16; h = h || 256;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, h);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* Soft radial blob texture for drifting fog banks. */
  function makeRadialTexture(size) {
    size = size || 256;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,224,186,0.85)');
    g.addColorStop(0.5, 'rgba(255,208,170,0.30)');
    g.addColorStop(1, 'rgba(255,208,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ==========================================================================
   * build()
   * ======================================================================== */
  function build() {
    var rnd = mulberry32(0xA1F0A1F0);

    /* ---- Canvas + renderer (single persistent canvas) -------------------- */
    var canvas = document.createElement('canvas');
    canvas.id = 'al-ryum-3d-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight); // <-- else 300x150
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    /* Fixed, behind-content, non-interactive layer. */
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.display = 'block';

    /* ---- Scene ---------------------------------------------------------- */
    var scene = new THREE.Scene();
    var bg = new THREE.Color(0x070a12);
    scene.background = bg;
    scene.fog = new THREE.FogExp2(0x6e4a33, 0.0032);

    var camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      3000
    );

    /* ---- Gradient sky (dome) -------------------------------------------- */
    var skyStops = [
      [0.00, '#05070d'],
      [0.42, '#101a30'],
      [0.62, '#3a2438'],
      [0.74, '#a8582c'],
      [0.82, '#e0913f'],
      [0.90, '#2a2f36'],
      [1.00, '#0a0f16']
    ];
    var skyTex = makeGradientTexture(skyStops);
    var skyMat = new THREE.MeshBasicMaterial({
      map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 20), skyMat);
    sky.renderOrder = -10;
    scene.add(sky);

    /* ---- Environment map (for water + glass reflections) ----------------- */
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    var envSky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 16, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
    );
    envScene.add(envSky);
    var envSun = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    );
    envSun.position.set(-120, 50, -140);
    envScene.add(envSun);
    var envRT = pmrem.fromScene(envScene, 0.04, 0.1, 1000);
    scene.environment = envRT.texture;
    pmrem.dispose();

    /* ---- Lights (warm dusk) ---------------------------------------------- */
    scene.add(new THREE.AmbientLight(0x4a3a2e, 0.9));
    var hemi = new THREE.HemisphereLight(0xffb070, 0x0b1016, 0.55);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffa45c, 2.4);
    sun.position.set(-180, 90, 140);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0x5a7a9a, 0.5);
    fill.position.set(140, 40, -80);
    scene.add(fill);

    /* ---- Shared materials + geometry ------------------------------------- */
    var unitBox = new THREE.BoxGeometry(1, 1, 1);

    var glassMat = new THREE.MeshStandardMaterial({
      color: 0x0e2a36, metalness: 0.85, roughness: 0.12,
      transparent: true, opacity: 0.78, envMapIntensity: 1.5
    });
    var glassMatDark = new THREE.MeshStandardMaterial({
      color: 0x0a1d28, metalness: 0.85, roughness: 0.15,
      transparent: true, opacity: 0.82, envMapIntensity: 1.3
    });
    var windowWarm = new THREE.MeshBasicMaterial({ color: 0xffc98a });
    var windowCool = new THREE.MeshBasicMaterial({ color: 0xbcd8ff });
    var steelMat = new THREE.MeshStandardMaterial({
      color: 0x23272e, metalness: 0.75, roughness: 0.45
    });
    var darkSteel = new THREE.MeshStandardMaterial({
      color: 0x14171d, metalness: 0.5, roughness: 0.6
    });

    /* ---- Reflective water plane ------------------------------------------- */
    var waterMat = new THREE.MeshStandardMaterial({
      color: 0x0c1c2c, metalness: 0.78, roughness: 0.16,
      envMapIntensity: 1.7, emissive: 0x06121f, emissiveIntensity: 0.5
    });
    var water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    scene.add(water);

    /* ---- Camera path (flythrough) ----------------------------------------- */
    var pathPts = [
      new THREE.Vector3(0, 10, 150),
      new THREE.Vector3(55, 16, 85),
      new THREE.Vector3(-62, 30, 20),
      new THREE.Vector3(26, 55, -40),
      new THREE.Vector3(-40, 88, -110),
      new THREE.Vector3(12, 120, -180),
      new THREE.Vector3(52, 152, -260),
      new THREE.Vector3(-20, 186, -340)
    ];
    var curve = new THREE.CatmullRomCurve3(pathPts);

    /* ---- Procedural skyline ------------------------------------------------- */

    function addWindow(group, sx, sy, sz, x, y, z, mat) {
      var m = new THREE.Mesh(unitBox, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      group.add(m);
    }

    function buildTower(w, h, d) {
      var g = new THREE.Group();
      var glass = new THREE.Mesh(unitBox, rnd() < 0.5 ? glassMat : glassMatDark);
      glass.scale.set(w, h, d);
      glass.position.y = h / 2;
      g.add(glass);

      var floors = Math.max(2, Math.min(6, Math.round(h / 22)));
      for (var i = 0; i < floors; i++) {
        var y = 4 + i * (h / floors) + (h / floors) * 0.4;
        if (y > h - 4) break;
        var mat = (i % 3 === 0) ? windowCool : windowWarm;
        addWindow(g, w * 0.86, 2.4, 0.18, 0, y, d / 2 + 0.1, mat);       // +z
        addWindow(g, w * 0.86, 2.4, 0.18, 0, y, -d / 2 - 0.1, mat);      // -z
        addWindow(g, 0.18, 2.4, d * 0.86, w / 2 + 0.1, y, 0, mat);       // +x
        addWindow(g, 0.18, 2.4, d * 0.86, -w / 2 - 0.1, y, 0, mat);      // -x
      }
      return g;
    }

    /* Scatter towers along the path corridor so the camera weaves between. */
    var towers = [];
    var i, t, base, tangent, normal, pos, w, h, d, tower;

    for (i = 0; i < 34; i++) {
      t = rnd();
      base = curve.getPointAt(t);
      tangent = curve.getTangentAt(t);
      normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      var side = rnd() < 0.5 ? -1 : 1;
      pos = base.clone()
        .addScaledVector(normal, side * (42 + rnd() * 130))
        .addScaledVector(tangent, 12 + rnd() * 60);
      w = 10 + rnd() * 16;
      d = 10 + rnd() * 16;
      h = 30 + rnd() * 150;
      tower = buildTower(w, h, d);
      tower.position.set(pos.x, 0, pos.z);
      scene.add(tower);
      towers.push(tower);
    }

    /* Dense "downtown" cluster of taller towers around the mid-path. */
    var hub = curve.getPointAt(0.5);
    for (i = 0; i < 14; i++) {
      var ang = rnd() * Math.PI * 2;
      var rad = 30 + rnd() * 90;
      w = 14 + rnd() * 16;
      d = 14 + rnd() * 16;
      h = 90 + rnd() * 90;
      tower = buildTower(w, h, d);
      tower.position.set(hub.x + Math.cos(ang) * rad, 0, hub.z + Math.sin(ang) * rad);
      scene.add(tower);
      towers.push(tower);
    }

    /* ---- Cranes ------------------------------------------------------------ */
    var beacons = [];
    function buildCrane(x, z, hgt) {
      var g = new THREE.Group();
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, hgt, 6), steelMat);
      mast.position.y = hgt / 2;
      g.add(mast);
      var cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), steelMat);
      cab.position.y = hgt;
      g.add(cab);
      var jib = new THREE.Mesh(new THREE.BoxGeometry(40, 1.1, 1.1), steelMat);
      jib.position.set(20, hgt + 1.6, 0);
      g.add(jib);
      var cjib = new THREE.Mesh(new THREE.BoxGeometry(13, 1.1, 1.1), steelMat);
      cjib.position.set(-6.5, hgt + 1.6, 0);
      g.add(cjib);
      var cw = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 3.2), darkSteel);
      cw.position.set(-10.5, hgt + 0.6, 0);
      g.add(cw);
      var cable = new THREE.Mesh(new THREE.BoxGeometry(0.14, 16, 0.14), darkSteel);
      cable.position.set(32, hgt - 6, 0);
      g.add(cable);
      var hook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), steelMat);
      hook.position.set(32, hgt - 16, 0);
      g.add(hook);
      var beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3b30 })
      );
      beacon.position.set(0, hgt + 3.2, 0);
      g.add(beacon);
      beacons.push(beacon);
      g.position.set(x, 0, z);
      return g;
    }

    var craneSpots = [
      [70, -60, 95], [-90, -20, 80], [40, -140, 130]
    ];
    for (i = 0; i < craneSpots.length; i++) {
      scene.add(buildCrane(craneSpots[i][0], craneSpots[i][2], craneSpots[i][1]));
    }

    /* ---- Drifting fog banks (soft radial blobs over the water) --------------- */
    var fogTex = makeRadialTexture();
    var fogBankMat = new THREE.MeshBasicMaterial({
      map: fogTex, color: 0xffc090, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var fogBanks = [];
    for (i = 0; i < 5; i++) {
      var bank = new THREE.Mesh(new THREE.PlaneGeometry(600 + rnd() * 500, 180 + rnd() * 120), fogBankMat);
      bank.rotation.x = -Math.PI / 2;
      bank.rotation.z = rnd() * Math.PI * 2;
      bank.position.set(-300 + rnd() * 600, 8 + rnd() * 26, 60 - rnd() * 420);
      bank.phase = rnd() * Math.PI * 2;
      scene.add(bank);
      fogBanks.push(bank);
    }

    /* ---- Camera follow state ------------------------------------------------ */
    var targetPos = new THREE.Vector3();
    var ahead = new THREE.Vector3();
    var lookSmoothed = new THREE.Vector3();
    var look = new THREE.Vector3();
    var k = 0.07; // damped-follow lerp factor

    camera.position.copy(curve.getPointAt(0));
    lookSmoothed.copy(camera.position).addScaledVector(curve.getTangentAt(0), 40);
    camera.lookAt(lookSmoothed);

    var mouse = { x: 0, y: 0 };
    var mouseS = { x: 0, y: 0 };

    window.addEventListener('mousemove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /* ---- Scroll source ------------------------------------------------------- */
    function scrollY() {
      return window.scrollY || window.pageYOffset ||
        document.documentElement.scrollTop || 0;
    }
    function maxScroll() {
      var doc = document.documentElement;
      return Math.max(1, (doc.scrollHeight || document.body.scrollHeight) - window.innerHeight);
    }

    /* ---- Render loop --------------------------------------------------------- */
    function render(time) {
      requestAnimationFrame(render);
      var t = time / 1000;

      /* progress -> smoothstep -> curve sample -> damped follow */
      var raw = scrollY() / maxScroll();
      var eased = smoothstep(raw);
      targetPos = curve.getPointAt(eased, targetPos);
      var tangent = curve.getTangentAt(eased);
      ahead.copy(targetPos).addScaledVector(tangent, 40);

      camera.position.lerp(targetPos, k);
      lookSmoothed.lerp(ahead, k);

      /* subtle damped mouse parallax on the look target */
      mouseS.x += (mouse.x - mouseS.x) * 0.04;
      mouseS.y += (mouse.y - mouseS.y) * 0.04;
      look.copy(lookSmoothed);
      look.x += mouseS.x * 12;
      look.y += -mouseS.y * 8;
      camera.lookAt(look);

      /* drifting depth fog + fog banks */
      scene.fog.density = 0.0032 + Math.sin(t * 0.12) * 0.0004;
      for (var f = 0; f < fogBanks.length; f++) {
        var b = fogBanks[f];
        b.position.x += Math.sin(t * 0.03 + b.phase) * 0.6;
        b.position.z += Math.cos(t * 0.02 + b.phase) * 0.4;
        b.position.y += Math.sin(t * 0.05 + b.phase) * 0.25;
      }

      /* blinking crane beacons */
      for (var n = 0; n < beacons.length; n++) {
        beacons[n].scale.setScalar(1 + Math.sin(t * 2.2 + n * 1.7) * 0.3);
      }

      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);

    /* ---- Debug / teardown handle --------------------------------------------- */
    window.alRyum3DScroll = {
      getState: function () {
        var raw = scrollY() / maxScroll();
        var eased = smoothstep(raw);
        var tp = curve.getPointAt(eased);
        return {
          scrollY: scrollY(),
          maxScroll: maxScroll(),
          progress: raw < 0 ? 0 : (raw > 1 ? 1 : raw),
          eased: eased,
          cameraPos: camera.position.toArray(),
          targetPos: tp.toArray(),
          lookAt: lookSmoothed.toArray()
        };
      },
      dispose: function () {
        ALREADY_BUILT = true; // prevent rebuild
        renderer.dispose();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
        });
      }
    };
  }
})();
