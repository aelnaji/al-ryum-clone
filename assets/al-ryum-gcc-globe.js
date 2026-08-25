/*
 * MotoCard-reference adaptation for Al Ryum Global Reach.
 * This enhancement replaces only the legacy map visual. Existing page copy,
 * marquees, and country content remain owned by the source application.
 */
(function () {
  "use strict";

  if (window.__alRyumGccGlobeLoaded) return;
  window.__alRyumGccGlobeLoaded = true;

  var EARTH_ASSETS = {
    day: "https://cdn.prod.website-files.com/6a4002cce4ba0d72bb35a7fc/6a418ffc9ea227a7c2e11171_day_2.webp",
    night: "https://cdn.prod.website-files.com/6a4002cce4ba0d72bb35a7fc/6a418ffc55c6edeb67368418_night_2.webp",
    bump: "https://cdn.prod.website-files.com/6a4002cce4ba0d72bb35a7fc/6a418ffc495223e0854f7b13_clouds_2.webp"
  };
  var CITIES = [
    { id: "abu-dhabi", city: "Abu Dhabi", country: "UAE", lat: 24.4539, lon: 54.3773 },
    { id: "doha", city: "Doha", country: "Qatar", lat: 25.2854, lon: 51.5310 },
    { id: "riyadh", city: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lon: 46.6753 },
    { id: "baghdad", city: "Baghdad", country: "Iraq", lat: 33.3152, lon: 44.3661 },
    { id: "aqaba", city: "Aqaba", country: "Jordan", lat: 29.5321, lon: 35.0063 }
  ];

  function injectStyles() {
    if (document.getElementById("al-ryum-gcc-globe-styles")) return;
    var style = document.createElement("style");
    style.id = "al-ryum-gcc-globe-styles";
    style.textContent = `
      /* Reference-matched globe stage: dark earth, restrained signal points, no added editorial content. */
      #global-reach .alryum-globe-shell { position: relative; min-height: 250svh; margin-top: clamp(2rem, 6vw, 5rem); background: #07090a; overflow: clip; }
      #global-reach .alryum-globe-stage { position: relative; height: 100svh; min-height: 39rem; overflow: hidden; background: radial-gradient(ellipse at 52% 70%, #20262e 0%, #111417 34%, #070809 76%); border-top: 1px solid rgba(215,223,230,.18); border-bottom: 1px solid rgba(215,223,230,.11); }
      #global-reach .alryum-globe-stage::before { position: absolute; z-index: 2; inset: 0; content: ""; pointer-events: none; background: linear-gradient(90deg, rgba(7,8,9,.85) 0%, transparent 24%, transparent 76%, rgba(7,8,9,.7) 100%), linear-gradient(180deg, rgba(6,7,8,.3), transparent 42%, rgba(6,7,8,.76)); }
      #global-reach .canvas_earth { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; }
      #global-reach .alryum-globe-legend { position: absolute; z-index: 3; right: clamp(1.25rem, 4vw, 4.5rem); bottom: clamp(1.2rem, 4vh, 3rem); display: flex; align-items: center; gap: .72rem; color: rgba(238,241,244,.6); font-size: .57rem; font-weight: 700; letter-spacing: .13em; pointer-events: none; }
      #global-reach .alryum-globe-legend::before { width: .35rem; height: .35rem; border-radius: 50%; content: ""; background: #9ef3ee; box-shadow: 0 0 .7rem rgba(158,243,238,.7); }
      #global-reach .alryum-globe-label { position: absolute; z-index: 3; min-width: 6.6rem; color: #f3f4f5; font-size: .6rem; font-weight: 700; letter-spacing: .13em; line-height: 1.2; pointer-events: none; opacity: .28; text-transform: uppercase; transform: translate(-50%, -50%); transition: opacity .35s ease; }
      #global-reach .alryum-globe-label::before { display: block; width: 1.25rem; height: 1px; margin-bottom: .34rem; content: ""; background: rgba(158,243,238,.8); }
      #global-reach .alryum-globe-label.is-active { opacity: .98; }
      #global-reach .alryum-globe-label span { display: block; margin-top: .18rem; color: rgba(243,244,245,.55); font-size: .48rem; font-weight: 600; letter-spacing: .1em; }
      #global-reach .alryum-globe-hover { position: absolute; z-index: 4; padding: .42rem .58rem; border: 1px solid rgba(158,243,238,.72); background: rgba(5,14,15,.86); box-shadow: 0 12px 30px rgba(0,0,0,.3); color: #effffc; font-size: .55rem; font-weight: 800; letter-spacing: .13em; opacity: 0; pointer-events: none; text-transform: uppercase; transform: translate(.65rem, calc(-100% - .65rem)); transition: opacity .14s ease; }
      #global-reach .alryum-globe-hover[data-visible="true"] { opacity: 1; }
      @media (max-width: 760px) { #global-reach .alryum-globe-shell { min-height: 180svh; } #global-reach .alryum-globe-stage { min-height: 34rem; } #global-reach .alryum-globe-label { font-size: .48rem; } #global-reach .alryum-globe-legend { left: 1.25rem; right: auto; bottom: 1.25rem; font-size: .49rem; } }
      @media (prefers-reduced-motion: reduce) { #global-reach .alryum-globe-shell { min-height: 100svh; } }
    `;
    document.head.appendChild(style);
  }

  function latLonToVector(THREE, lat, lon, radius) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function loadTexture(loader, url, colorSpace) {
    return new Promise(function (resolve, reject) {
      loader.load(url, function (texture) {
        if (colorSpace) texture.colorSpace = colorSpace;
        resolve(texture);
      }, undefined, reject);
    });
  }

  function createStage(legacyMap) {
    injectStyles();
    var shell = document.createElement("div");
    shell.className = "alryum-globe-shell";
    var stage = document.createElement("section");
    stage.className = "alryum-globe-stage earth";
    stage.setAttribute("aria-label", "GCC partnership network globe");
    var canvas = document.createElement("canvas");
    canvas.className = "canvas_earth";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "3D animation: a globe with GCC city markers");
    stage.appendChild(canvas);
    var legend = document.createElement("p");
    legend.className = "alryum-globe-legend";
    legend.textContent = "GCC PARTNERSHIP NETWORK";
    stage.appendChild(legend);
    var hoverLabel = document.createElement("div");
    hoverLabel.className = "alryum-globe-hover";
    hoverLabel.dataset.visible = "false";
    hoverLabel.setAttribute("aria-live", "polite");
    stage.appendChild(hoverLabel);
    shell.appendChild(stage);
    legacyMap.replaceWith(shell);
    return { shell: shell, stage: stage, canvas: canvas, hoverLabel: hoverLabel };
  }

  async function mountGlobe(parts) {
    var THREE = await import("https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.js");
    var canvas = parts.canvas;
    var stage = parts.stage;
    var shell = parts.shell;
    var hoverLabel = parts.hoverLabel;
    var isMobile = window.matchMedia("(max-width: 760px)").matches;
    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(25, 1, .1, 100);
    camera.position.set(0, .2, isMobile ? 5.8 : 5);
    var clock = new THREE.Clock();
    var earthGroup = new THREE.Group();
    earthGroup.position.set(0, -1.32, 0);
    earthGroup.scale.setScalar(1.3);
    earthGroup.rotation.set(.04, 3.73, 0);
    scene.add(earthGroup);

    var sun = new THREE.DirectionalLight(0xc3cedd, 4.4);
    sun.position.set(.26, 1.39, 3);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x47649e, 0x030405, .48));

    var textureLoader = new THREE.TextureLoader();
    var textures = {};
    try {
      var loaded = await Promise.all([
        loadTexture(textureLoader, EARTH_ASSETS.day, THREE.SRGBColorSpace),
        loadTexture(textureLoader, EARTH_ASSETS.night, THREE.SRGBColorSpace),
        loadTexture(textureLoader, EARTH_ASSETS.bump)
      ]);
      textures.day = loaded[0];
      textures.night = loaded[1];
      textures.bump = loaded[2];
    } catch (error) {
      console.warn("[Al Ryum GCC globe] Reference earth textures unavailable; using material fallback.", error);
    }

    var earthMaterial = new THREE.MeshStandardMaterial({
      color: 0xa3afbd,
      map: textures.day || null,
      bumpMap: textures.bump || null,
      bumpScale: .06,
      emissive: 0x101a2a,
      emissiveMap: textures.night || null,
      emissiveIntensity: .95,
      roughness: .3,
      metalness: .02,
      transparent: true
    });
    var sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    var globe = new THREE.Mesh(sphereGeometry, earthMaterial);
    earthGroup.add(globe);

    var atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0x47649e, side: THREE.BackSide, transparent: true, opacity: .08, depthWrite: false });
    var atmosphere = new THREE.Mesh(sphereGeometry, atmosphereMaterial);
    atmosphere.scale.setScalar(1.04);
    earthGroup.add(atmosphere);

    var network = new THREE.Group();
    earthGroup.add(network);
    var markerRings = [];
    var labels = [];
    var hoverTargets = [];
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();

    CITIES.forEach(function (city, index) {
      var position = latLonToVector(THREE, city.lat, city.lon, 1.012);
      var normal = position.clone().normalize();
      var marker = new THREE.Group();
      marker.position.copy(position);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      var stem = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, .078, 8), new THREE.MeshBasicMaterial({ color: 0xd6fffc, transparent: true, opacity: .9 }));
      stem.position.y = .039;
      marker.add(stem);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(.022, .0017, 8, 24), new THREE.MeshBasicMaterial({ color: 0x9ef3ee, transparent: true, opacity: .8 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .08;
      marker.add(ring);
      var point = new THREE.Mesh(new THREE.SphereGeometry(.009, 14, 14), new THREE.MeshBasicMaterial({ color: 0xf5ffff }));
      point.position.y = .08;
      marker.add(point);
      marker.userData.offset = index * .72;
      network.add(marker);
      markerRings.push(ring);
      if (index < 3) {
        var hitTarget = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hitTarget.position.y = .08;
        hitTarget.userData.city = city.city;
        marker.add(hitTarget);
        hoverTargets.push(hitTarget);
      }

      var label = document.createElement("div");
      label.className = "alryum-globe-label" + (index === 0 ? " is-active" : "");
      label.innerHTML = city.city + "<span>" + city.country + "</span>";
      stage.appendChild(label);
      labels.push({ element: label, marker: marker, city: city });
    });

    function addRoute(from, to) {
      var start = latLonToVector(THREE, from.lat, from.lon, 1.016);
      var end = latLonToVector(THREE, to.lat, to.lon, 1.016);
      var lift = start.clone().add(end).normalize().multiplyScalar(1.07);
      var curve = new THREE.QuadraticBezierCurve3(start, lift, end);
      network.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 56, .003, 6, false), new THREE.MeshBasicMaterial({ color: 0x9ef3ee, transparent: true, opacity: .58 })));
    }
    addRoute(CITIES[0], CITIES[1]);
    addRoute(CITIES[0], CITIES[2]);
    addRoute(CITIES[0], CITIES[3]);
    addRoute(CITIES[0], CITIES[4]);
    addRoute(CITIES[1], CITIES[2]);

    var progress = 0;
    var activeCity = 0;
    function setActiveCity(index) {
      if (activeCity === index) return;
      activeCity = index;
      labels.forEach(function (label, position) { label.element.classList.toggle("is-active", position === index); });
    }
    if (window.gsap && window.ScrollTrigger && !prefersReducedMotion) {
      window.gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: function () { return "+=" + 2.5 * window.innerHeight; },
          pin: true,
          scrub: 1,
          pinSpacing: false,
          invalidateOnRefresh: true,
          onUpdate: function (self) { progress = self.progress; setActiveCity(Math.min(CITIES.length - 1, Math.floor(self.progress * CITIES.length))); }
        }
      })
      .to(earthGroup.rotation, { y: earthGroup.rotation.y + .38, ease: "none" }, 0)
      .to(earthGroup.scale, { x: .52, y: .52, z: .52, ease: "power2.out" }, .1)
      .to(earthMaterial, { opacity: .18, duration: .15, ease: "none" }, .2)
      .to(atmosphereMaterial, { opacity: 0, duration: .15, ease: "none" }, .2);
    }

    var visibility = true;
    var observer = new IntersectionObserver(function (entries) { visibility = entries[0].isIntersecting; }, { rootMargin: "400px 0px" });
    observer.observe(stage);
    var resizeObserver = new ResizeObserver(function () {
      var bounds = stage.getBoundingClientRect();
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
    });
    resizeObserver.observe(stage);

    function showHoverLabel(event) {
      if (event.pointerType === "touch") return;
      var bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hit = raycaster.intersectObjects(hoverTargets, false)[0];
      if (!hit) {
        hoverLabel.dataset.visible = "false";
        stage.style.cursor = "default";
        return;
      }
      hoverLabel.textContent = hit.object.userData.city;
      hoverLabel.style.left = (event.clientX - bounds.left) + "px";
      hoverLabel.style.top = (event.clientY - bounds.top) + "px";
      hoverLabel.dataset.visible = "true";
      stage.style.cursor = "crosshair";
    }
    stage.addEventListener("pointermove", showHoverLabel);
    stage.addEventListener("pointerleave", function () {
      hoverLabel.dataset.visible = "false";
      stage.style.cursor = "default";
    });

    function updateLabels() {
      earthGroup.updateMatrixWorld(true);
      labels.forEach(function (entry, index) {
        var position = entry.marker.getWorldPosition(new THREE.Vector3()).project(camera);
        entry.element.style.left = ((position.x * .5 + .5) * stage.clientWidth) + "px";
        entry.element.style.top = ((-position.y * .5 + .5) * stage.clientHeight) + "px";
        entry.element.style.display = position.z > .99 ? "none" : "block";
        if (index !== activeCity) entry.element.style.opacity = position.z < .1 ? ".25" : ".08";
      });
    }
    function animate() {
      requestAnimationFrame(animate);
      if (!visibility) return;
      var delta = clock.getDelta();
      if (prefersReducedMotion) globe.rotation.y = 0; else globe.rotation.y += delta * .22;
      markerRings.forEach(function (ring, index) {
        var pulse = .92 + Math.sin(clock.elapsedTime * 1.3 + index * .72) * .08;
        ring.scale.setScalar(pulse);
      });
      renderer.render(scene, camera);
      updateLabels();
    }
    animate();
  }

  function boot() {
    var section = document.getElementById("global-reach");
    if (!section || section.dataset.gccGlobeMounted === "true") return false;
    var legacyMap = section.querySelector("svg");
    if (!legacyMap) return false;
    section.dataset.gccGlobeMounted = "true";
    var parts = createStage(legacyMap);
    mountGlobe(parts).catch(function (error) { console.error("[Al Ryum GCC globe] Mount failed", error); });
    return true;
  }

  function waitForSection() { if (!boot()) window.setTimeout(waitForSection, 320); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForSection); else waitForSection();
})();
