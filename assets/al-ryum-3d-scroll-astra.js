/* ═══════ AL RYUM · @astra ═══════
   Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE — to disconnect:
   remove this file and revert the <script src> in index.html to the original.
   DO NOT hand-edit alongside the original; treat as a drop-in replacement. */

/* ============================================================================
 * AL RYUM — 3D SCROLL FLYTHROUGH
 * Load after the local Three.js UMD build. Desktop-only, single fixed canvas.
 * Camera scrub is bounded to the hero; endpoint motion settles, then parks.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.innerWidth < 768) return;

  var THREE;
  var bootTimer = 0;
  var waitTicks = 0;
  var stopped = false;
  var MAX_WAIT = 120;

  function stopBoot() {
    window.clearTimeout(bootTimer);
    bootTimer = 0;
    document.removeEventListener('DOMContentLoaded', boot);
    window.removeEventListener('pagehide', onBootPageHide);
  }

  function onBootPageHide(event) {
    if (!event.persisted) {
      stopped = true;
      stopBoot();
    }
  }

  function boot() {
    if (stopped) return;
    window.clearTimeout(bootTimer);
    bootTimer = 0;

    if (window.innerWidth < 768 || window.alRyum3DScroll ||
        document.getElementById('al-ryum-3d-canvas')) {
      stopped = true;
      stopBoot();
      return;
    }

    THREE = window.THREE;
    if (!THREE || !document.body || document.readyState === 'loading') {
      if (++waitTicks > MAX_WAIT) {
        stopped = true;
        stopBoot();
        return;
      }
      bootTimer = window.setTimeout(boot, 120);
      return;
    }

    stopped = true;
    stopBoot();
    build();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    value = clamp(value, 0, 1);
    return value * value * (3 - 2 * value);
  }

  function scrollY() {
    return window.scrollY || window.pageYOffset ||
      document.documentElement.scrollTop || 0;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build() {
    var rnd = mulberry32(0xA1F0A1F0);
    var resources = new Set();
    var listeners = [];
    var renderer = null;
    var canvas = null;
    var scene = null;
    var camera = null;
    var curve = null;
    var api = null;
    var intersectionObserver = null;
    var resizeObserver = null;
    var disposed = false;
    var suspended = false;
    var contextLost = false;
    var frame = 0;
    var lastTime = 0;
    var animationTime = 0;
    var dirty = true;
    var measureDirty = true;
    var viewportWidth = 0;
    var viewportHeight = 0;
    var pixelRatio = 0;
    var heroTop = 0;
    var heroHeight = 1;
    var scrubLength = 1;
    var progress = 0;
    var heroVisible = true;

    // No additional HTML hook is required; the first section is the fallback.
    var hero = document.querySelector('#hero, .hero, [data-hero]') ||
      document.querySelector('main section, section');
    var motionQuery = window.matchMedia ?
      window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reducedMotion = !!(motionQuery && motionQuery.matches);

    var targetPos;
    var tangent;
    var ahead;
    var lookSmoothed;
    var look;
    var mouse = { x: 0, y: 0 };
    var mouseS = { x: 0, y: 0 };
    var beacons = [];
    var fogBanks = [];

    function own(resource) {
      resources.add(resource);
      return resource;
    }

    function release(resource) {
      if (!resource || !resources.has(resource)) return;
      resources.delete(resource);
      resource.dispose();
    }

    function listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      listeners.push(function () {
        target.removeEventListener(name, handler, options);
      });
    }

    function mesh(geometry, material) {
      own(geometry);
      own(material);
      return new THREE.Mesh(geometry, material);
    }

    function makeTexture(width, height, paint) {
      var surface = document.createElement('canvas');
      surface.width = width;
      surface.height = height;
      var context = surface.getContext('2d');
      if (!context) throw new Error('Canvas 2D is unavailable.');
      paint(context, width, height);
      var texture = own(new THREE.CanvasTexture(surface));
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(frame);
      frame = 0;

      listeners.forEach(function (remove) { remove(); });
      listeners.length = 0;
      if (intersectionObserver) intersectionObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();

      if (scene) {
        scene.environment = null;
        scene.background = null;
        scene.clear();
      }

      resources.forEach(function (resource) {
        try {
          resource.dispose();
        } catch (error) {
          // Continue releasing the remaining resources after a lost context.
        }
      });
      resources.clear();

      if (renderer) {
        try {
          renderer.dispose();
          renderer.forceContextLoss();
        } catch (error) {
          // The browser may already have released the context.
        }
      }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    function measure() {
      var width = Math.max(1, window.innerWidth);
      var height = Math.max(1, window.innerHeight);
      var ratio = Math.min(window.devicePixelRatio || 1, 2);

      if (width !== viewportWidth || height !== viewportHeight || ratio !== pixelRatio) {
        viewportWidth = width;
        viewportHeight = height;
        pixelRatio = ratio;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height);
        dirty = true;
      }

      if (hero && hero.isConnected) {
        var rect = hero.getBoundingClientRect();
        heroTop = rect.top + scrollY();
        heroHeight = Math.max(1, rect.height);
        heroVisible = rect.height > 0 && rect.width > 0 &&
          rect.bottom > 0 && rect.top < height &&
          rect.right > 0 && rect.left < width;
      } else {
        heroTop = 0;
        heroHeight = height;
        heroVisible = scrollY() < height;
      }

      // A tall hero uses its internal travel; a viewport hero uses its exit.
      scrubLength = Math.max(1, heroHeight - height, Math.min(heroHeight, height));
      measureDirty = false;
    }

    function readProgress() {
      return clamp((scrollY() - heroTop) / scrubLength, 0, 1);
    }

    function canRender() {
      return !disposed && !suspended && !contextLost &&
        !document.hidden && window.innerWidth >= 768 && heroVisible;
    }

    function updateVisibility() {
      canvas.style.display = canRender() ? 'block' : 'none';
    }

    function requestFrame() {
      if (!frame && canRender()) frame = window.requestAnimationFrame(render);
    }

    function refresh() {
      if (disposed) return;
      measure();
      updateVisibility();
      if (!canRender()) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        return;
      }
      dirty = true;
      requestFrame();
    }

    function onScroll() {
      refresh();
    }

    function onResize() {
      measureDirty = true;
      refresh();
    }

    function onMouseMove(event) {
      if (!canRender() || reducedMotion || progress >= 1) return;
      mouse.x = clamp(event.clientX / viewportWidth * 2 - 1, -1, 1);
      mouse.y = clamp(event.clientY / viewportHeight * 2 - 1, -1, 1);
      requestFrame();
    }

    function resetMouse() {
      mouse.x = mouse.y = 0;
      requestFrame();
    }

    function onMotionChange() {
      reducedMotion = !!motionQuery.matches;
      resetMouse();
      refresh();
    }

    function sampleTarget(value) {
      curve.getPointAt(smoothstep(value), targetPos);
      curve.getTangentAt(smoothstep(value), tangent);
      ahead.copy(targetPos).addScaledVector(tangent, 40);
    }

    function animateAtmosphere(time) {
      scene.fog.density = 0.0032 + Math.sin(time * 0.12) * 0.0004;
      for (var i = 0; i < fogBanks.length; i++) {
        var bank = fogBanks[i];
        var phase = bank.userData.phase;
        var origin = bank.userData.origin;
        bank.position.set(
          origin.x + Math.sin(time * 0.03 + phase) * 36,
          origin.y + Math.sin(time * 0.05 + phase) * 15,
          origin.z + Math.cos(time * 0.02 + phase) * 24
        );
      }
      for (var n = 0; n < beacons.length; n++) {
        beacons[n].scale.setScalar(1 + Math.sin(time * 2.2 + n * 1.7) * 0.3);
      }
    }

    function render(time) {
      frame = 0;
      if (disposed) return;

      try {
        if (measureDirty) measure();
        if (!canRender()) {
          updateVisibility();
          lastTime = 0;
          return;
        }

        var dt = lastTime ? clamp((time - lastTime) / 1000, 0, 0.05) : 1 / 60;
        lastTime = time;
        progress = readProgress();
        sampleTarget(progress);

        var follow = reducedMotion ? 1 : 1 - Math.pow(0.93, dt * 60);
        var parallax = reducedMotion ? 1 : 1 - Math.pow(0.96, dt * 60);
        var mouseX = !reducedMotion && progress < 1 ? mouse.x : 0;
        var mouseY = !reducedMotion && progress < 1 ? mouse.y : 0;

        camera.position.lerp(targetPos, follow);
        lookSmoothed.lerp(ahead, follow);
        mouseS.x += (mouseX - mouseS.x) * parallax;
        mouseS.y += (mouseY - mouseS.y) * parallax;

        var settled = camera.position.distanceToSquared(targetPos) < 0.0001 &&
          lookSmoothed.distanceToSquared(ahead) < 0.0001 &&
          Math.abs(mouseX - mouseS.x) < 0.0001 &&
          Math.abs(mouseY - mouseS.y) < 0.0001;

        if (settled) {
          camera.position.copy(targetPos);
          lookSmoothed.copy(ahead);
          mouseS.x = mouseX;
          mouseS.y = mouseY;
        }

        look.copy(lookSmoothed);
        look.x += mouseS.x * 12;
        look.y -= mouseS.y * 8;
        camera.lookAt(look);

        // Ambient motion never keeps an endpoint's settled camera loop alive.
        var scrubbing = progress > 0 && progress < 1;
        if (!reducedMotion && (scrubbing || !settled)) animationTime += dt;
        animateAtmosphere(animationTime);

        if (dirty || !settled || scrubbing) renderer.render(scene, camera);
        dirty = false;

        if (!reducedMotion && (scrubbing || !settled)) {
          // Ensure the final snapped pose is rendered before parking.
          dirty = true;
          requestFrame();
        } else {
          lastTime = 0;
        }
      } catch (error) {
        dispose();
        if (window.console && window.console.warn) {
          window.console.warn('Al Ryum 3D scroll stopped; using the CSS fallback.', error);
        }
      }
    }

    try {
      canvas = document.createElement('canvas');
      canvas.id = 'al-ryum-3d-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText =
        'position:fixed;top:0;left:0;z-index:0;pointer-events:none;display:none;';
      document.body.insertBefore(canvas, document.body.firstChild);

      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x070a12);
      scene.fog = new THREE.FogExp2(0x6e4a33, 0.0032);
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);

      var skyTex = makeTexture(16, 256, function (context, width, height) {
        var stops = [
          [0, '#05070d'], [0.42, '#101a30'], [0.62, '#3a2438'],
          [0.74, '#a8582c'], [0.82, '#e0913f'], [0.90, '#2a2f36'],
          [1, '#0a0f16']
        ];
        var gradient = context.createLinearGradient(0, 0, 0, height);
        stops.forEach(function (stop) { gradient.addColorStop(stop[0], stop[1]); });
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      });

      var sky = mesh(
        new THREE.SphereGeometry(1500, 32, 20),
        new THREE.MeshBasicMaterial({
          map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false
        })
      );
      sky.renderOrder = -10;
      scene.add(sky);

      var pmrem = own(new THREE.PMREMGenerator(renderer));
      var envScene = new THREE.Scene();
      var envSky = mesh(
        new THREE.SphereGeometry(300, 16, 16),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
      );
      var envSun = mesh(
        new THREE.SphereGeometry(12, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
      );
      envSun.position.set(-120, 50, -140);
      envScene.add(envSky, envSun);
      var envRT = own(pmrem.fromScene(envScene, 0.04, 0.1, 1000));
      scene.environment = envRT.texture;
      release(pmrem);
      release(envSky.geometry);
      release(envSky.material);
      release(envSun.geometry);
      release(envSun.material);
      envScene.clear();

      scene.add(new THREE.AmbientLight(0x4a3a2e, 0.9));
      scene.add(new THREE.HemisphereLight(0xffb070, 0x0b1016, 0.55));
      var sun = new THREE.DirectionalLight(0xffa45c, 2.4);
      sun.position.set(-180, 90, 140);
      scene.add(sun);
      var fill = new THREE.DirectionalLight(0x5a7a9a, 0.5);
      fill.position.set(140, 40, -80);
      scene.add(fill);

      var unitBox = own(new THREE.BoxGeometry(1, 1, 1));
      var glassMat = own(new THREE.MeshStandardMaterial({
        color: 0x0e2a36, metalness: 0.85, roughness: 0.12,
        transparent: true, opacity: 0.78, envMapIntensity: 1.5
      }));
      var glassMatDark = own(new THREE.MeshStandardMaterial({
        color: 0x0a1d28, metalness: 0.85, roughness: 0.15,
        transparent: true, opacity: 0.82, envMapIntensity: 1.3
      }));
      var windowWarm = own(new THREE.MeshBasicMaterial({ color: 0xffc98a }));
      var windowCool = own(new THREE.MeshBasicMaterial({ color: 0xbcd8ff }));
      var steelMat = own(new THREE.MeshStandardMaterial({
        color: 0x23272e, metalness: 0.75, roughness: 0.45
      }));
      var darkSteel = own(new THREE.MeshStandardMaterial({
        color: 0x14171d, metalness: 0.5, roughness: 0.6
      }));

      var water = mesh(
        new THREE.PlaneGeometry(5000, 5000),
        new THREE.MeshStandardMaterial({
          color: 0x0c1c2c, metalness: 0.78, roughness: 0.16,
          envMapIntensity: 1.7, emissive: 0x06121f, emissiveIntensity: 0.5
        })
      );
      water.rotation.x = -Math.PI / 2;
      scene.add(water);

      curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 10, 150),
        new THREE.Vector3(55, 16, 85),
        new THREE.Vector3(-62, 30, 20),
        new THREE.Vector3(26, 55, -40),
        new THREE.Vector3(-40, 88, -110),
        new THREE.Vector3(12, 120, -180),
        new THREE.Vector3(52, 152, -260),
        new THREE.Vector3(-20, 186, -340)
      ]);

      function addBox(group, sx, sy, sz, x, y, z, material) {
        var box = new THREE.Mesh(unitBox, material);
        box.scale.set(sx, sy, sz);
        box.position.set(x, y, z);
        group.add(box);
        return box;
      }

      function buildTower(width, height, depth) {
        var group = new THREE.Group();
        addBox(group, width, height, depth, 0, height / 2, 0,
          rnd() < 0.5 ? glassMat : glassMatDark);

        var floors = Math.max(2, Math.min(6, Math.round(height / 22)));
        for (var floor = 0; floor < floors; floor++) {
          var y = 4 + floor * height / floors + height / floors * 0.4;
          if (y > height - 4) break;
          var material = floor % 3 === 0 ? windowCool : windowWarm;
          addBox(group, width * 0.86, 2.4, 0.18, 0, y, depth / 2 + 0.1, material);
          addBox(group, width * 0.86, 2.4, 0.18, 0, y, -depth / 2 - 0.1, material);
          addBox(group, 0.18, 2.4, depth * 0.86, width / 2 + 0.1, y, 0, material);
          addBox(group, 0.18, 2.4, depth * 0.86, -width / 2 - 0.1, y, 0, material);
        }
        return group;
      }

      var i, width, height, depth, tower;
      for (i = 0; i < 34; i++) {
        var pathProgress = rnd();
        var base = curve.getPointAt(pathProgress);
        var direction = curve.getTangentAt(pathProgress);
        var normal = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        var side = rnd() < 0.5 ? -1 : 1;
        var position = base.clone()
          .addScaledVector(normal, side * (42 + rnd() * 130))
          .addScaledVector(direction, 12 + rnd() * 60);
        width = 10 + rnd() * 16;
        depth = 10 + rnd() * 16;
        height = 30 + rnd() * 150;
        tower = buildTower(width, height, depth);
        tower.position.set(position.x, 0, position.z);
        scene.add(tower);
      }

      var hub = curve.getPointAt(0.5);
      for (i = 0; i < 14; i++) {
        var angle = rnd() * Math.PI * 2;
        var radius = 30 + rnd() * 90;
        width = 14 + rnd() * 16;
        depth = 14 + rnd() * 16;
        height = 90 + rnd() * 90;
        tower = buildTower(width, height, depth);
        tower.position.set(
          hub.x + Math.cos(angle) * radius, 0,
          hub.z + Math.sin(angle) * radius
        );
        scene.add(tower);
      }

      function buildCrane(x, z, craneHeight) {
        var group = new THREE.Group();
        var mast = mesh(
          new THREE.CylinderGeometry(0.9, 1.3, craneHeight, 6), steelMat
        );
        mast.position.y = craneHeight / 2;
        group.add(mast);
        addBox(group, 2.6, 2.6, 2.6, 0, craneHeight, 0, steelMat);
        addBox(group, 40, 1.1, 1.1, 20, craneHeight + 1.6, 0, steelMat);
        addBox(group, 13, 1.1, 1.1, -6.5, craneHeight + 1.6, 0, steelMat);
        addBox(group, 4, 3.2, 3.2, -10.5, craneHeight + 0.6, 0, darkSteel);
        addBox(group, 0.14, 16, 0.14, 32, craneHeight - 6, 0, darkSteel);
        addBox(group, 0.9, 0.9, 0.9, 32, craneHeight - 16, 0, steelMat);
        var beacon = mesh(
          new THREE.SphereGeometry(0.7, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff3b30 })
        );
        beacon.position.set(0, craneHeight + 3.2, 0);
        group.add(beacon);
        beacons.push(beacon);
        group.position.set(x, 0, z);
        return group;
      }

      var craneSpots = [[70, -60, 95], [-90, -20, 80], [40, -140, 130]];
      for (i = 0; i < craneSpots.length; i++) {
        scene.add(buildCrane(craneSpots[i][0], craneSpots[i][1], craneSpots[i][2]));
      }

      var fogTex = makeTexture(256, 256, function (context, width, height) {
        var gradient = context.createRadialGradient(
          width / 2, height / 2, 0, width / 2, height / 2, width / 2
        );
        gradient.addColorStop(0, 'rgba(255,224,186,0.85)');
        gradient.addColorStop(0.5, 'rgba(255,208,170,0.30)');
        gradient.addColorStop(1, 'rgba(255,208,170,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      });
      var fogBankMat = own(new THREE.MeshBasicMaterial({
        map: fogTex, color: 0xffc090, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      for (i = 0; i < 5; i++) {
        var bank = mesh(
          new THREE.PlaneGeometry(600 + rnd() * 500, 180 + rnd() * 120),
          fogBankMat
        );
        bank.rotation.x = -Math.PI / 2;
        bank.rotation.z = rnd() * Math.PI * 2;
        bank.position.set(-300 + rnd() * 600, 8 + rnd() * 26, 60 - rnd() * 420);
        bank.userData.phase = rnd() * Math.PI * 2;
        bank.userData.origin = bank.position.clone();
        scene.add(bank);
        fogBanks.push(bank);
      }

      targetPos = new THREE.Vector3();
      tangent = new THREE.Vector3();
      ahead = new THREE.Vector3();
      lookSmoothed = new THREE.Vector3();
      look = new THREE.Vector3();

      measure();
      progress = readProgress();
      sampleTarget(progress);
      camera.position.copy(targetPos);
      lookSmoothed.copy(ahead);
      camera.lookAt(lookSmoothed);

      listen(window, 'scroll', onScroll, { passive: true });
      listen(window, 'resize', onResize, { passive: true });
      listen(window, 'mousemove', onMouseMove, { passive: true });
      listen(window, 'blur', resetMouse);
      listen(document.documentElement, 'mouseleave', resetMouse);
      listen(document, 'visibilitychange', refresh);
      listen(window, 'load', onResize);
      listen(window, 'pagehide', function (event) {
        if (!event.persisted) {
          dispose();
          return;
        }
        suspended = true;
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        updateVisibility();
      });
      listen(window, 'pageshow', function () {
        suspended = false;
        refresh();
      });
      listen(canvas, 'webglcontextlost', function (event) {
        event.preventDefault();
        contextLost = true;
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        updateVisibility();
      });
      listen(canvas, 'webglcontextrestored', function () {
        contextLost = false;
        refresh();
      });

      if (motionQuery) {
        if (motionQuery.addEventListener) {
          listen(motionQuery, 'change', onMotionChange);
        } else if (motionQuery.addListener) {
          motionQuery.addListener(onMotionChange);
          listeners.push(function () { motionQuery.removeListener(onMotionChange); });
        }
      }

      if (hero && window.IntersectionObserver) {
        intersectionObserver = new window.IntersectionObserver(refresh, {
          threshold: [0, 0.001]
        });
        intersectionObserver.observe(hero);
      }
      if (hero && window.ResizeObserver) {
        resizeObserver = new window.ResizeObserver(onResize);
        resizeObserver.observe(hero);
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          if (!disposed) refresh();
        }, function () {});
      }

      api = {
        getState: function () {
          if (!disposed) measure();
          var raw = readProgress();
          return {
            scrollY: scrollY(),
            maxScroll: scrubLength,
            progress: raw,
            eased: smoothstep(raw),
            cameraPos: camera.position.toArray(),
            targetPos: curve.getPointAt(smoothstep(raw)).toArray(),
            lookAt: lookSmoothed.toArray()
          };
        },
        dispose: dispose
      };
      window.alRyum3DScroll = api;
      refresh();
    } catch (error) {
      dispose();
      if (window.console && window.console.warn) {
        window.console.warn('Al Ryum 3D scroll unavailable; using the CSS fallback.', error);
      }
    }
  }

  window.addEventListener('pagehide', onBootPageHide);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  }
  boot();
})();
