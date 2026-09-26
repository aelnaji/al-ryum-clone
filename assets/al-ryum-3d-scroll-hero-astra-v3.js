/* ==== AL RYUM @astra v3 ==== GPT-6 Astra. CANDIDATE - disconnect: remove file + revert index.html src. */

/* ==== AL RYUM @astra v2 ==== GPT-6 Astra. CANDIDATE - disconnect: remove file + revert index.html src. */

import * as THREE from "three";

/*!
 * Al Ryum Group — Cinematic 3D Scroll Hero
 * Module: al-ryum-3d-scroll-minimax
 * Three.js r182 / ES module importmap.
 *
 * Binding:
 *   The existing hero is wrapped in a module-owned, isolated scroll region.
 *   A sticky viewport pins its HTML while five viewport-heights of local
 *   scroll drive the original five-beat camera path. One additional local
 *   viewport holds the exact end pose before the sticky viewport releases.
 *
 *   Camera position and orientation are deterministic functions of local
 *   scroll: no time-based damping, mouse parallax, or residual pose chase.
 *   The camera parks exactly at scrub completion and stays frozen through
 *   the hold interval and the handoff to the next section.
 *
 *   Cranes and globe have no idle animation. Only a faint, diffuse cloud
 *   layer advances on an independent ambient clock. Its gated rAF shares
 *   the existing render scheduler and never advances the camera.
 *   Reduced motion freezes the clouds and restores demand-only rendering.
 *
 *   The canvas lives INSIDE that sticky viewport, not behind the document.
 *   The region clips its contents, the copy is explicitly above the canvas,
 *   and rendering stops when the stage leaves the viewport. Later sections
 *   never contribute to progress or inherit the cinematic background.
 *
 *   Native sticky + an explicit spacer are intentional: no GSAP dependency,
 *   no competing ScrollTrigger scrub clock, and no plugin pin to clean up.
 *
 * Public side effect:
 *   window.__alRyum3D = { state, scene, camera, renderer, refresh, destroy }
 */

(function () {
  "use strict";

  const previous = window.__alRyum3D;
  if (previous && typeof previous.destroy === "function") {
    previous.destroy();
  }

  let cancelled = false;

  function boot() {
    document.removeEventListener("DOMContentLoaded", boot);
    if (cancelled) return;
    if (window.__alRyum3D === pendingHandle) {
      delete window.__alRyum3D;
    }
    if (window.innerWidth < 768) return;

    initialize();
  }

  const pendingHandle = {
    destroy() {
      cancelled = true;
      document.removeEventListener("DOMContentLoaded", boot);
      if (window.__alRyum3D === pendingHandle) {
        delete window.__alRyum3D;
      }
    }
  };

  if (document.readyState === "loading") {
    window.__alRyum3D = pendingHandle;
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function initialize() {
    const cleanup = [];
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const savedStyles = new Map();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let destroyed = false;
    let renderer = null;
    let scene = null;
    let camera = null;
    let canvas = null;
    let region = null;
    let stage = null;
    let hero = null;
    let originalParent = null;
    let originalNextSibling = null;
    let anchor = null;
    let resizeObserver = null;
    let frameId = 0;
    let refreshFrameId = 0;
    let settleFrameId = 0;
    let contextLost = false;
    let suspended = false;
    let active = false;
    let needsRender = true;
    let initializedPose = false;
    let handle = null;

    // This clock owns cloud translation only, never camera/path state.
    let cloudLayer = null;
    let cloudLastTimestamp = null;
    const ambientClouds = [];

    const state = {
      width: window.innerWidth,
      height: Math.max(1, window.innerHeight),
      scrollProgress: 0,
      targetScrollProgress: 0,
      // Retained for compatibility; pointer input never owns the camera.
      mouseX: 0,
      mouseY: 0,
      targetMouseX: 0,
      targetMouseY: 0,
      currentLookAt: new THREE.Vector3(0, 5, 0),
      targetLookAt: new THREE.Vector3(0, 5, 0),
      cranes: [],
      reducedMotion: motionQuery.matches,
      regionStart: 0,
      scrubDistance: 1,
      pinDistance: 1,
      active: false,
      parked: false
    };

    function listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      cleanup.push(() => target.removeEventListener(type, listener, options));
    }

    function saveStyle(element, property, value) {
      let properties = savedStyles.get(element);
      if (!properties) {
        properties = new Map();
        savedStyles.set(element, properties);
      }
      if (!properties.has(property)) {
        properties.set(property, {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        });
      }
      element.style.setProperty(property, value);
    }

    function geometry(value) {
      geometries.add(value);
      return value;
    }

    function material(value) {
      materials.add(value);
      return value;
    }

    function mesh(geo, mat) {
      return new THREE.Mesh(geometry(geo), material(mat));
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function smoothstep(value) {
      const t = clamp(value, 0, 1);
      return t * t * (3 - 2 * t);
    }

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

    function isUsableHero(element) {
      if (!element || !element.parentElement) return false;
      if (element === document.body || element === document.documentElement) {
        return false;
      }

      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.position !== "fixed" &&
        style.position !== "absolute" &&
        element.getBoundingClientRect().height > 0
      );
    }

    function findHero() {
      // Existing conventional markup is used; no new configuration required.
      const selectors = [
        "#al-ryum-hero",
        "#hero",
        "main .hero",
        "main .hero-section",
        ".hero",
        ".hero-section",
        "main > section:first-of-type",
        "main section",
        "body > section:first-of-type"
      ];

      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          if (isUsableHero(element)) return element;
        }
      }
      return null;
    }

    function notifyScrollTrigger() {
      // Other page sections may use ScrollTrigger. We own no triggers, but
      // must notify those sections after adding/removing our local spacer.
      const plugin = window.ScrollTrigger || window.gsap?.plugins?.ScrollTrigger;
      if (plugin && typeof plugin.refresh === "function") {
        try {
          plugin.refresh();
        } catch (error) {
          console.warn("[al-ryum-3d] External ScrollTrigger refresh failed:", error);
        }
      }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;

      cancelAnimationFrame(frameId);
      cancelAnimationFrame(refreshFrameId);
      cancelAnimationFrame(settleFrameId);
      frameId = refreshFrameId = settleFrameId = 0;
      cloudLastTimestamp = null;

      resizeObserver?.disconnect();
      for (const remove of cleanup.splice(0)) remove();

      cloudLayer?.removeFromParent();
      cloudLayer?.clear();
      ambientClouds.length = 0;
      cloudLayer = null;

      canvas?.remove();

      // Put the original element back without recreating its HTML/listeners.
      if (hero && stage && hero.parentNode === stage) {
        if (anchor?.parentNode) {
          anchor.parentNode.insertBefore(hero, anchor.nextSibling);
        } else if (originalParent) {
          const next = originalNextSibling?.parentNode === originalParent
            ? originalNextSibling
            : null;
          originalParent.insertBefore(hero, next);
        }
      }

      region?.remove();
      anchor?.remove();

      for (const [element, properties] of savedStyles) {
        for (const [property, saved] of properties) {
          if (saved.value) {
            element.style.setProperty(property, saved.value, saved.priority);
          } else {
            element.style.removeProperty(property);
          }
        }
      }
      savedStyles.clear();

      for (const value of geometries) value.dispose();
      for (const value of materials) value.dispose();
      for (const value of textures) value.dispose();
      geometries.clear();
      materials.clear();
      textures.clear();
      scene?.clear();

      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }

      state.active = false;
      if (window.__alRyum3D === handle) delete window.__alRyum3D;
      if (region) notifyScrollTrigger();
    }

    function makeWindowTexture(seed) {
      const width = 128;
      const height = 256;
      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const ctx = source.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      ctx.fillStyle = "#070a10";
      ctx.fillRect(0, 0, width, height);

      const cols = 6;
      const rows = 16;
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const rng = mulberry32(seed);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (rng() < 0.45) continue;
          const warmth = rng();
          const green = Math.floor(175 + warmth * 75);
          const blue = Math.floor(95 + warmth * 80);
          const alpha = 0.55 + rng() * 0.45;
          ctx.fillStyle = `rgba(255,${green},${blue},${alpha})`;
          ctx.fillRect(
            x * cellWidth + 2,
            y * cellHeight + 3,
            cellWidth - 4,
            cellHeight - 6
          );
        }
      }

      const texture = new THREE.CanvasTexture(source);
      textures.add(texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }

    function makeAmbientClouds() {
      const layer = new THREE.Group();
      layer.name = "al-ryum-ambient-clouds";

      const rng = mulberry32(28091);
      const puffGeometry = geometry(new THREE.SphereGeometry(1, 24, 16));

      /*
       * Flattened sphere groups, not opaque balls or screen-space overlays.
       * Analytic silhouette feathering makes opacity reach zero well before
       * the mesh edge. The stock basic-material pipeline still handles fog,
       * tone mapping and output color space, without warm direct lighting.
       * Front faces only and no depth writes avoid dense double-sided shells;
       * depth testing preserves occlusion by the existing scene.
       */
      function makePuffMaterial(color, opacity) {
        const puffMaterial = material(new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          depthTest: true,
          side: THREE.FrontSide,
          fog: true,
          toneMapped: true
        }));

        puffMaterial.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `#include <common>
varying vec3 vCloudViewNormal;
varying vec3 vCloudViewPosition;`
          );
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
vCloudViewNormal = normalize(normalMatrix * normal);`
          );
          shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
vCloudViewPosition = -mvPosition.xyz;`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <common>",
            `#include <common>
varying vec3 vCloudViewNormal;
varying vec3 vCloudViewPosition;`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <alphamap_fragment>",
            `#include <alphamap_fragment>
float cloudFacing = clamp(
  dot(normalize(vCloudViewNormal), normalize(vCloudViewPosition)),
  0.0,
  1.0
);
float cloudFeather = smoothstep(0.0, 1.0, cloudFacing);
diffuseColor.a *= cloudFeather * cloudFeather;`
          );
        };
        puffMaterial.customProgramCacheKey = () => "al-ryum-soft-cloud-v1";
        return puffMaterial;
      }

      /*
       * Fixed world-space lower-sky bands in front of the distant horizon.
       * No camera parenting, billboarding, rotation, bobbing or scroll-based
       * opacity changes. Keep the original sky, fog and lighting untouched.
       */
      const specs = [
        [-260, 68, -135, 43, 8, 16, 0.14],
        [-155, 103, -190, 48, 10, 18, 0.16],
        [-40, 76, -160, 36, 7, 14, 0.13],
        [95, 120, -225, 50, 10, 18, 0.17],
        [225, 85, -155, 40, 8, 15, 0.14],
        [315, 139, -240, 46, 9, 17, 0.15]
      ];

      for (const [x, y, z, width, height, depth, opacity] of specs) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const color = new THREE.Color(0xe9eef3).lerp(
          new THREE.Color(0xc6d3df),
          rng() * 0.45
        );
        const puffMaterial = makePuffMaterial(color, opacity);

        for (let i = 0; i < 3; i++) {
          const puff = new THREE.Mesh(puffGeometry, puffMaterial);
          puff.position.set(
            (i - 1) * width * 0.72,
            i === 1 ? height * 0.22 : -height * 0.08,
            (rng() - 0.5) * depth * 0.45
          );
          puff.scale.set(
            width * (0.67 + rng() * 0.18),
            height * (0.75 + rng() * 0.25),
            depth * (0.8 + rng() * 0.2)
          );
          group.add(puff);
        }

        layer.add(group);
        ambientClouds.push({
          group,
          material: puffMaterial,
          baseOpacity: opacity,
          // Roughly a fraction of a screen pixel per second in the opener.
          speed: 0.16 + rng() * 0.12,
          minX: -650,
          maxX: 650,
          fadeDistance: 150
        });
      }

      return layer;
    }

    function cloudsCanAnimate() {
      return (
        !destroyed &&
        !!cloudLayer &&
        ambientClouds.length > 0 &&
        !state.reducedMotion &&
        active &&
        !contextLost &&
        !suspended &&
        !document.hidden
      );
    }

    function advanceAmbientClouds(timestamp) {
      if (!cloudsCanAnimate()) {
        cloudLastTimestamp = null;
        return;
      }

      if (cloudLastTimestamp === null) {
        cloudLastTimestamp = timestamp;
        return;
      }

      // Never catch up hidden/offscreen time or jump after a stalled frame.
      const dt = clamp((timestamp - cloudLastTimestamp) / 1000, 0, 0.05);
      cloudLastTimestamp = timestamp;
      if (dt === 0) return;

      for (const cloud of ambientClouds) {
        const span = cloud.maxX - cloud.minX;
        let x = cloud.group.position.x + cloud.speed * dt;
        if (x >= cloud.maxX) {
          x = cloud.minX + ((x - cloud.minX) % span);
        }
        cloud.group.position.x = x;

        // Feather both ends of the long drift corridor so recycling cannot
        // pop, even on an unusually wide viewport or a later camera beat.
        const edgeDistance = Math.min(x - cloud.minX, cloud.maxX - x);
        cloud.material.opacity = cloud.baseOpacity *
          smoothstep(edgeDistance / cloud.fadeDistance);
      }
      needsRender = true;
    }

    function makeBuilding(opts) {
      const group = new THREE.Group();
      const { width, depth, height } = opts;

      const body = mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
          color: opts.bodyColor,
          roughness: 0.32,
          metalness: opts.metalness
        })
      );
      body.position.y = height / 2;
      group.add(body);

      const windowMaterial = material(new THREE.MeshBasicMaterial({
        map: opts.winTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }));
      const windowGeometry = geometry(
        new THREE.PlaneGeometry(width * 0.97, height * 0.97)
      );

      const front = new THREE.Mesh(windowGeometry, windowMaterial);
      front.position.set(0, height / 2, depth / 2 + 0.01);
      group.add(front);

      const back = new THREE.Mesh(windowGeometry, windowMaterial);
      back.position.set(0, height / 2, -depth / 2 - 0.01);
      back.rotation.y = Math.PI;
      group.add(back);

      if (height > 90) {
        const crown = mesh(
          new THREE.ConeGeometry(Math.min(width, depth) * 0.35, height * 0.12, 6),
          new THREE.MeshStandardMaterial({
            color: 0x2a2a32,
            roughness: 0.4,
            metalness: 0.7
          })
        );
        crown.position.y = height + height * 0.06;
        group.add(crown);
      }

      group.position.set(opts.x, 0, opts.z);
      return group;
    }

    function makeCrane(x, z, mastHeight) {
      const group = new THREE.Group();
      const yellow = material(new THREE.MeshStandardMaterial({
        color: 0xf3a418,
        roughness: 0.55,
        metalness: 0.4
      }));
      const dark = material(new THREE.MeshStandardMaterial({
        color: 0x1f1f24,
        roughness: 0.6,
        metalness: 0.5
      }));

      const base = mesh(new THREE.BoxGeometry(7, 2.5, 7), dark);
      base.position.y = 1.25;
      group.add(base);

      const columnGeometry = geometry(
        new THREE.BoxGeometry(0.7, mastHeight, 0.7)
      );
      const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const offset of offsets) {
        const column = new THREE.Mesh(columnGeometry, yellow);
        column.position.set(
          offset[0] * 1.2,
          2.5 + mastHeight / 2,
          offset[1] * 1.2
        );
        group.add(column);
      }

      for (let i = 0; i < 5; i++) {
        const y = 2.5 + (i + 1) * (mastHeight / 6);
        const braceA = mesh(new THREE.BoxGeometry(3.4, 0.4, 0.4), yellow);
        braceA.position.set(0, y, 1.2);
        group.add(braceA);
        const braceB = mesh(new THREE.BoxGeometry(3.4, 0.4, 0.4), yellow);
        braceB.position.set(0, y, -1.2);
        group.add(braceB);
      }

      const slew = new THREE.Group();
      slew.position.y = 2.5 + mastHeight;
      group.add(slew);

      const cabin = mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), dark);
      cabin.position.set(0, 0.8, 0);
      slew.add(cabin);

      const counterJib = mesh(new THREE.BoxGeometry(8, 0.7, 0.7), yellow);
      counterJib.position.set(-4.5, 1.6, 0);
      slew.add(counterJib);

      const counterweight = mesh(new THREE.BoxGeometry(2.2, 2.4, 2.2), dark);
      counterweight.position.set(-7.5, 1.2, 0);
      slew.add(counterweight);

      const jib = mesh(new THREE.BoxGeometry(20, 0.6, 0.6), yellow);
      jib.position.set(10, 1.6, 0);
      slew.add(jib);

      const tie = mesh(new THREE.BoxGeometry(0.4, 5, 0.4), yellow);
      tie.position.set(2, 4.5, 0);
      slew.add(tie);

      const lineGeometry = geometry(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(10, 1, 0),
        new THREE.Vector3(10, -6, 0)
      ]));
      const lineMaterial = material(
        new THREE.LineBasicMaterial({ color: 0x101010 })
      );
      slew.add(new THREE.Line(lineGeometry, lineMaterial));

      group.position.set(x, 0, z);
      group.userData.slew = slew;
      // Retained as metadata only; no animation consumes this value.
      group.userData.speed = 0.05 + Math.random() * 0.12;
      return group;
    }

    function makeLandmark() {
      const group = new THREE.Group();
      const x = -40;
      const z = -210;

      const plinth = mesh(
        new THREE.BoxGeometry(90, 4, 90),
        new THREE.MeshStandardMaterial({
          color: 0x8a8579,
          roughness: 0.8,
          metalness: 0.1
        })
      );
      plinth.position.set(x, 2, z);
      group.add(plinth);

      const lower = mesh(
        new THREE.BoxGeometry(70, 7, 70),
        new THREE.MeshStandardMaterial({
          color: 0xb8b0a0,
          roughness: 0.7,
          metalness: 0.1
        })
      );
      lower.position.set(x, 7.5, z);
      group.add(lower);

      const dome = mesh(
        new THREE.SphereGeometry(30, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.3),
        new THREE.MeshStandardMaterial({
          color: 0xeae0d0,
          roughness: 0.45,
          metalness: 0.15
        })
      );
      dome.position.set(x, 11, z);
      group.add(dome);

      const lattice = mesh(
        new THREE.SphereGeometry(30.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.3),
        new THREE.MeshStandardMaterial({
          color: 0xc8b896,
          roughness: 0.3,
          metalness: 0.6,
          wireframe: true
        })
      );
      lattice.position.set(x, 11, z);
      group.add(lattice);
      return group;
    }

    function makeGlobe() {
      const group = new THREE.Group();
      group.position.set(0, 380, 200);
      group.scale.setScalar(0.9);

      group.add(mesh(
        new THREE.SphereGeometry(45, 24, 18),
        new THREE.MeshStandardMaterial({
          color: 0x4a5a8a,
          roughness: 0.3,
          metalness: 0.7,
          wireframe: true
        })
      ));
      group.add(mesh(
        new THREE.SphereGeometry(44, 24, 18),
        new THREE.MeshBasicMaterial({
          color: 0x2a3a5e,
          transparent: true,
          opacity: 0.12
        })
      ));

      const names = [
        "Louvre Abu Dhabi", "Zayed National Museum", "Dubai Parks",
        "Pearl Jumeirah", "La Mer", "Trump IG",
        "Meydan", "Kempinski", "Lusail"
      ];
      const positions = [
        [0.18, 0.55, 0.81],
        [0.20, 0.52, 0.83],
        [0.22, 0.50, 0.84],
        [0.16, 0.48, 0.86],
        [0.17, 0.49, 0.85],
        [0.19, 0.51, 0.82],
        [0.21, 0.53, 0.80],
        [0.23, 0.54, 0.79],
        [0.14, 0.58, 0.80]
      ];

      const pinMaterial = material(
        new THREE.MeshBasicMaterial({ color: 0xffaa55 })
      );
      const glowMaterial = material(new THREE.MeshBasicMaterial({
        color: 0xffaa55,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      const pinGeometry = geometry(new THREE.SphereGeometry(0.9, 10, 8));
      const haloGeometry = geometry(new THREE.SphereGeometry(2, 10, 8));

      positions.forEach((position, index) => {
        const point = new THREE.Vector3(...position).multiplyScalar(45);
        const pin = new THREE.Mesh(pinGeometry, pinMaterial);
        pin.name = names[index];
        pin.position.copy(point);
        group.add(pin);
        const halo = new THREE.Mesh(haloGeometry, glowMaterial);
        halo.position.copy(point);
        group.add(halo);
      });
      return group;
    }

    function makeGround() {
      const geo = geometry(new THREE.PlaneGeometry(4000, 4000, 80, 80));
      const positions = geo.attributes.position;
      const rng = mulberry32(7);

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const distance = Math.sqrt(x * x + y * y);
        const fade = Math.max(0, 1 - distance / 800);
        const height = (
          Math.sin(x * 0.04) * Math.cos(y * 0.04) * 1.5 +
          Math.sin(x * 0.11 + 1) * 0.6 +
          (rng() - 0.5) * 0.4
        ) * fade;
        positions.setZ(i, height);
      }
      geo.computeVertexNormals();

      const ground = mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0xc89a6a,
          roughness: 0.95,
          metalness: 0
        })
      );
      ground.rotation.x = -Math.PI / 2;
      return ground;
    }

    function makeWater() {
      const water = mesh(
        new THREE.PlaneGeometry(4000, 4000, 1, 1),
        new THREE.MeshStandardMaterial({
          color: 0x0e1828,
          roughness: 0.18,
          metalness: 0.92
        })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.2;
      return water;
    }

    try {
      hero = findHero();
      if (!hero) {
        console.warn(
          "[al-ryum-3d] No usable hero section found; leaving the page unchanged."
        );
        return;
      }

      /*
       * Sticky must be bound to the document viewport, not an accidental
       * overflow:auto/hidden ancestor. Fail closed rather than ship another
       * runaway background. overflow:clip itself does not create a scroller.
       */
      for (
        let parent = hero.parentElement;
        parent && parent !== document.body && parent !== document.documentElement;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll|hidden|overlay)/.test(style.overflowY)) {
          console.warn(
            "[al-ryum-3d] Hero has a non-viewport scrolling ancestor; cinematic disabled.",
            parent
          );
          return;
        }
      }

      if (!CSS.supports("position", "sticky")) {
        console.warn("[al-ryum-3d] Sticky positioning unavailable; cinematic disabled.");
        return;
      }

      canvas = document.createElement("canvas");
      canvas.id = "al-ryum-3d-canvas";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = [
        "position:absolute",
        "inset:0",
        "width:100%",
        "height:100%",
        "z-index:0",
        "pointer-events:none",
        "display:block",
        "visibility:hidden"
      ].join(";");

      // Context failure occurs before changing the document's layout.
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(state.width, state.height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;

      scene = new THREE.Scene();
      const fogColor = new THREE.Color(0x2a1a22);
      scene.background = fogColor;
      scene.fog = new THREE.FogExp2(fogColor, 0.0028);

      camera = new THREE.PerspectiveCamera(
        55, state.width / state.height, 0.5, 2500
      );

      scene.add(new THREE.HemisphereLight(0xffb789, 0x1a1428, 0.6));

      const sun = new THREE.DirectionalLight(0xffa066, 1.55);
      sun.position.set(-350, 220, -250);
      scene.add(sun);

      const fill = new THREE.DirectionalLight(0x6a92b8, 0.45);
      fill.position.set(250, 120, 220);
      scene.add(fill);
      scene.add(new THREE.AmbientLight(0x2a1f2c, 0.28));

      // Original five-beat path and independent, slightly leading look curve.
      const positionCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 6, 250),
        new THREE.Vector3(40, 50, 100),
        new THREE.Vector3(100, 95, -30),
        new THREE.Vector3(60, 32, -120),
        new THREE.Vector3(20, 18, -200),
        new THREE.Vector3(-30, 35, -150),
        new THREE.Vector3(-80, 45, -50),
        new THREE.Vector3(-40, 180, 130),
        new THREE.Vector3(0, 360, 320)
      ], false, "catmullrom", 0.4);

      const lookAtCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 5, -100),
        new THREE.Vector3(80, 40, -150),
        new THREE.Vector3(100, 80, -200),
        new THREE.Vector3(0, 25, -260),
        new THREE.Vector3(0, 20, -310),
        new THREE.Vector3(-30, 25, -210),
        new THREE.Vector3(-80, 30, -100),
        new THREE.Vector3(0, 320, 150),
        new THREE.Vector3(0, 380, 200)
      ], false, "catmullrom", 0.4);

      const winTextures = [];
      for (let i = 0; i < 6; i++) {
        winTextures.push(makeWindowTexture(i * 7919 + 1));
      }

      scene.add(makeGround());
      scene.add(makeWater());

      const skyline = new THREE.Group();
      const rng = mulberry32(101);

      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2 + rng() * 0.1;
        const distance = 320 + rng() * 220;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        if (z > 80) continue;

        const width = 12 + rng() * 18;
        const depth = 12 + rng() * 18;
        const height = 35 + Math.pow(rng(), 1.5) * 160;
        const hue = 0.56 + rng() * 0.08;
        const saturation = 0.05 + rng() * 0.08;
        const lightness = 0.12 + rng() * 0.05;

        skyline.add(makeBuilding({
          width, depth, height, x, z,
          winTex: winTextures[Math.floor(rng() * winTextures.length)],
          bodyColor: new THREE.Color().setHSL(hue, saturation, lightness),
          metalness: 0.6 + rng() * 0.2
        }));
      }

      for (let i = 0; i < 45; i++) {
        const x = 80 + (rng() - 0.5) * 240;
        const z = -90 + (rng() - 0.5) * 240;
        const width = 10 + rng() * 16;
        const depth = 10 + rng() * 16;
        const height = 50 + Math.pow(rng(), 1.6) * 220;
        const hue = 0.58 + rng() * 0.07;
        const saturation = 0.06 + rng() * 0.08;
        const lightness = 0.14 + rng() * 0.05;

        skyline.add(makeBuilding({
          width, depth, height, x, z,
          winTex: winTextures[Math.floor(rng() * winTextures.length)],
          bodyColor: new THREE.Color().setHSL(hue, saturation, lightness),
          metalness: 0.65 + rng() * 0.2
        }));
      }

      for (let i = 0; i < 24; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const x = side * (60 + rng() * 90);
        const z = -260 + (rng() - 0.5) * 320;
        const width = 8 + rng() * 12;
        const depth = 8 + rng() * 12;
        const height = 35 + Math.pow(rng(), 1.4) * 130;
        const hue = 0.55 + rng() * 0.09;
        const saturation = 0.05 + rng() * 0.08;
        const lightness = 0.13 + rng() * 0.05;

        skyline.add(makeBuilding({
          width, depth, height, x, z,
          winTex: winTextures[Math.floor(rng() * winTextures.length)],
          bodyColor: new THREE.Color().setHSL(hue, saturation, lightness),
          metalness: 0.6 + rng() * 0.2
        }));
      }
      scene.add(skyline);

      const craneSpecs = [
        [50, -130, 55],
        [-10, -180, 60],
        [85, -160, 50],
        [-60, -140, 52],
        [25, -210, 48]
      ];
      for (const spec of craneSpecs) {
        const crane = makeCrane(...spec);
        state.cranes.push(crane);
        scene.add(crane);
      }

      scene.add(makeLandmark());
      const globe = makeGlobe();
      scene.add(globe);

      cloudLayer = makeAmbientClouds();
      scene.add(cloudLayer);

      /*
       * A local stacking context is stronger than relying on later sections
       * being opaque. Canvas pixels cannot exist outside this region.
       * clip-path clips without creating a scroll container (unlike hidden).
       */
      originalParent = hero.parentNode;
      originalNextSibling = hero.nextSibling;
      anchor = document.createComment("al-ryum-3d hero insertion point");
      originalParent.insertBefore(anchor, hero);

      region = document.createElement("div");
      region.id = "al-ryum-3d-scroll-region";
      region.style.cssText = [
        "position:relative",
        "display:block",
        "width:100%",
        "min-width:0",
        "isolation:isolate",
        "z-index:0",
        "overflow:visible",
        "clip-path:inset(0)",
        "box-sizing:border-box",
        "flex-shrink:0",
        "overflow-anchor:none"
      ].join(";");

      stage = document.createElement("div");
      stage.style.cssText = [
        "position:sticky",
        "top:0",
        "width:100%",
        "isolation:isolate",
        "overflow:visible",
        "box-sizing:border-box"
      ].join(";");

      originalParent.insertBefore(region, hero);
      region.appendChild(stage);
      stage.appendChild(canvas);
      stage.appendChild(hero);

      if (getComputedStyle(hero).position === "static") {
        saveStyle(hero, "position", "relative");
      }
      saveStyle(hero, "z-index", "1");
      saveStyle(hero, "isolation", "isolate");

      const endPosition = positionCurve.getPointAt(1);
      const endLook = lookAtCurve.getPointAt(1);

      let viewportHeight = state.height;
      let stageHeight = state.height;
      let lastPixelRatio = renderer.getPixelRatio();

      function setPose(progress) {
        progress = clamp(progress, 0, 1);
        state.targetScrollProgress = progress;

        // No pointer offsets or hidden pointer-smoothing state.
        state.mouseX = state.mouseY = 0;
        state.targetMouseX = state.targetMouseY = 0;

        // Identical scroll means no writes to camera position/orientation.
        // There is no epsilon threshold, accumulated velocity, or dt clock.
        if (initializedPose && state.scrollProgress === progress) {
          return;
        }

        state.scrollProgress = progress;
        state.parked = progress === 1;

        if (state.parked) {
          // Scrub completion is an immediate exact park, not a tail release.
          camera.position.copy(endPosition);
          state.currentLookAt.copy(endLook);
        } else {
          // Spatial easing preserves the path's pacing without temporal lag.
          const eased = smoothstep(progress);
          positionCurve.getPointAt(eased, camera.position);
          lookAtCurve.getPointAt(
            Math.min(1, eased + 0.04),
            state.currentLookAt
          );
        }

        state.targetLookAt.copy(state.currentLookAt);
        camera.lookAt(state.currentLookAt);
        initializedPose = true;
        needsRender = true;
      }

      function requestTick() {
        if (
          destroyed || frameId || !active || contextLost ||
          suspended || document.hidden
        ) return;
        if (!needsRender && !cloudsCanAnimate()) return;
        frameId = requestAnimationFrame(tick);
      }

      function readScroll(scheduleRender = true) {
        if (destroyed) return;

        // Read region geometry directly: upstream layout shifts cannot turn
        // this into document-height progress or leave a stale start offset.
        const rect = region.getBoundingClientRect();
        state.regionStart = rect.top + window.scrollY;
        const localScroll = -rect.top;

        const progress = state.reducedMotion
          ? 0
          : clamp(localScroll / state.scrubDistance, 0, 1);

        // Reconcile synchronously, including fast jumps and reverse scroll.
        // Once local scroll reaches scrubDistance, all remaining pin and
        // outgoing-section travel maps to this same exact endpoint.
        setPose(progress);

        const stageRect = stage.getBoundingClientRect();
        const nextActive =
          stageRect.bottom > 0 &&
          stageRect.top < viewportHeight &&
          rect.bottom > 0 &&
          rect.top < viewportHeight;

        if (!nextActive) {
          canvas.style.visibility = "hidden";
          active = false;
          state.active = false;
          cancelAnimationFrame(frameId);
          frameId = 0;
          cloudLastTimestamp = null;
          return;
        }

        if (!active) {
          needsRender = true;
          cloudLastTimestamp = null;
        }
        active = true;
        state.active = true;
        if (scheduleRender) requestTick();
      }

      function refresh() {
        if (destroyed) return;
        if (window.innerWidth < 768) {
          destroy();
          return;
        }

        viewportHeight = Math.max(1, window.innerHeight);

        // Do not truncate unusually tall hero copy.
        stageHeight = Math.max(
          viewportHeight,
          Math.ceil(hero.getBoundingClientRect().height)
        );
        state.scrubDistance = viewportHeight * 5;
        // Preserve the spacer: five moving viewports plus one frozen hold.
        state.pinDistance = state.reducedMotion ? 0 : viewportHeight * 6;

        stage.style.height = `${stageHeight}px`;
        stage.style.position = state.reducedMotion ? "relative" : "sticky";
        region.style.height = `${stageHeight + state.pinDistance}px`;

        const width = Math.max(1, Math.round(stage.getBoundingClientRect().width));
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        if (
          width !== state.width ||
          viewportHeight !== state.height ||
          pixelRatio !== lastPixelRatio
        ) {
          state.width = width;
          state.height = viewportHeight;
          lastPixelRatio = pixelRatio;
          camera.aspect = width / viewportHeight;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, viewportHeight, false);
          needsRender = true;
        }

        canvas.style.height = `${viewportHeight}px`;
        readScroll();
      }

      function scheduleRefresh() {
        if (destroyed || refreshFrameId) return;
        refreshFrameId = requestAnimationFrame(() => {
          refreshFrameId = 0;
          refresh();
        });
      }

      function refreshAfterLayout() {
        scheduleRefresh();
        cancelAnimationFrame(settleFrameId);
        // These bounded callbacks settle layout measurements only; they
        // never interpolate or advance the camera independently of scroll.
        settleFrameId = requestAnimationFrame(() => {
          settleFrameId = requestAnimationFrame(() => {
            settleFrameId = 0;
            if (destroyed) return;
            refresh();
            notifyScrollTrigger();
          });
        });
      }

      function onMotionChange() {
        state.reducedMotion = motionQuery.matches;
        cloudLastTimestamp = null;
        // Preference changes intentionally replace movement with a static
        // opening composition and remove the long cinematic scroll spacer.
        // Clouds freeze at their current positions without a reset or jump.
        refresh();
        refreshAfterLayout();
      }

      function tick(timestamp) {
        frameId = 0;
        if (
          destroyed || !active || contextLost ||
          suspended || document.hidden
        ) {
          cloudLastTimestamp = null;
          return;
        }

        // Sample the latest geometry before drawing so a queued frame cannot
        // render a stale moving pose after a jump into the hold or next section.
        // This read never schedules another frame.
        readScroll(false);
        if (!active) return;

        // Elapsed time is consumed exclusively by the ambient cloud layer.
        // setPose remains unchanged and skips all camera writes at equal scroll.
        advanceAmbientClouds(timestamp);

        if (needsRender) {
          renderer.render(scene, camera);
          needsRender = false;
        }
        canvas.style.visibility = "visible";

        // A single shared rAF prevents competing scroll/ambient render loops.
        // Parked camera poses do not stop clouds; visibility and reduced motion do.
        if (cloudsCanAnimate()) requestTick();
      }

      listen(window, "scroll", readScroll, { passive: true });
      // No mouse listeners: camera ownership is strictly local scroll.
      listen(window, "resize", refreshAfterLayout, { passive: true });
      listen(window, "orientationchange", refreshAfterLayout, { passive: true });

      if (window.visualViewport) {
        listen(window.visualViewport, "resize", refreshAfterLayout, {
          passive: true
        });
      }

      listen(document, "visibilitychange", () => {
        cloudLastTimestamp = null;
        if (document.hidden) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        } else {
          needsRender = true;
          refreshAfterLayout();
        }
      });

      listen(window, "pagehide", (event) => {
        if (!event.persisted) {
          destroy();
          return;
        }
        suspended = true;
        cancelAnimationFrame(frameId);
        frameId = 0;
        cloudLastTimestamp = null;
      });

      listen(window, "pageshow", () => {
        suspended = false;
        cloudLastTimestamp = null;
        needsRender = true;
        refreshAfterLayout();
      });

      listen(canvas, "webglcontextlost", (event) => {
        event.preventDefault();
        contextLost = true;
        canvas.style.visibility = "hidden";
        cancelAnimationFrame(frameId);
        frameId = 0;
        cloudLastTimestamp = null;
      });

      listen(canvas, "webglcontextrestored", () => {
        contextLost = false;
        cloudLastTimestamp = null;
        needsRender = true;
        refreshAfterLayout();
      });

      if (typeof motionQuery.addEventListener === "function") {
        listen(motionQuery, "change", onMotionChange);
      } else {
        motionQuery.addListener(onMotionChange);
        cleanup.push(() => motionQuery.removeListener(onMotionChange));
      }

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleRefresh);
        resizeObserver.observe(hero);
        resizeObserver.observe(originalParent);
      }

      if (document.readyState !== "complete") {
        listen(window, "load", refreshAfterLayout, { once: true });
      }

      // Capture late image/media layout changes without owning those assets.
      listen(document, "load", scheduleRefresh, true);

      if (document.fonts) {
        document.fonts.ready.then(() => {
          if (!destroyed) refreshAfterLayout();
        });
        if (typeof document.fonts.addEventListener === "function") {
          listen(document.fonts, "loadingdone", refreshAfterLayout);
        }
      }

      handle = {
        state,
        scene,
        camera,
        renderer,
        refresh: refreshAfterLayout,
        destroy
      };
      window.__alRyum3D = handle;

      refresh();
      refreshAfterLayout();
    } catch (error) {
      console.error("[al-ryum-3d] Initialization failed; restoring page:", error);
      destroy();
    }
  }
})();
