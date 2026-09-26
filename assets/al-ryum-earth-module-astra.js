/* ═══════ AL RYUM · @astra ═══════
   Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE — to disconnect:
   remove this file and revert the <script src> in index.html to the original.
   DO NOT hand-edit alongside the original; treat as a drop-in replacement. */

import * as THREE from "three/webgpu";
import {
  step, normalWorldGeometry, output, texture, vec3, vec4, normalize,
  positionWorld, bumpMap, cameraPosition, color, uniform, mix, uv, max
} from "three/tsl";

class EarthScene {
  constructor({ canvasSelector = ".alryum-earth-canvas" } = {}) {
    this.canvas = document.querySelector(canvasSelector);
    if (!this.canvas) {
      throw new Error(`[EarthScene] canvas "${canvasSelector}" not found`);
    }

    this.isMobile =
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      !!window.matchMedia?.("(pointer: coarse)").matches;
    this.isSafari =
      /apple/i.test(navigator.vendor || "") &&
      !/crios|fxios|edgios|chrome|android/i.test(navigator.userAgent);

    this.ASSETS = { ...(window.MOTO_EARTH_ASSETS || {}) };
    this.ATMOSPHERE = {
      dayColor: "#a3afbd",
      twilightColor: "#47649e",
      nightIntensity: 0.95,
      reach: 0.635
    };
    this.SUN = { position: new THREE.Vector3(0.26, 1.39, -3), intensity: 6 };
    this.GLOBE = { offsetX: 0, offsetY: 0, scale: 1.1, rotationSpeed: 0.025 };
    this.MATERIAL = { roughnessLow: 0.25, roughnessHigh: 0.35 };
    this.RENDER = { exposure: 1.16 };
    this.SCROLL = { sectionSelector: ".section_sticky", pinLength: 2500 };
    this.CAMERA = {
      fov: 25,
      near: 0.1,
      far: 100,
      position: new THREE.Vector3(0, 0.2, 5)
    };

    this.camera = null;
    this.scene = null;
    this.renderer = null;
    this.sun = null;
    this.globe = null;
    this.atmosphere = null;
    this.earthGroup = null;
    this.timer = null;
    this.uniforms = {};
    this.GS = { progress: 0 };
    this.scrollTL = null;

    this._running = false;
    this._destroyed = false;
    this._initialized = false;
    this._loopActive = false;
    this._resizeObserver = null;
    this._io = null;
    this._nearViewport = true;
    this._throttleCounter = 0;
    this._textures = new Set();
    this._materials = new Set();
    this._textureWaiters = new Set();
    this._needsRender = true;
    this._resetDelta = true;
    this._scrollContext = null;
    this._scrollWrap = null;
    this._scrollBase = null;

    this._motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this._reducedMotion = !!this._motionQuery?.matches;
    this._onResize = this.onResize.bind(this);
    this._animate = this.animate.bind(this);
    this._onVisibility = () => {
      this._resetDelta = true;
      this._needsRender = true;
      this._syncLoop();
    };
    this._onMotionChange = event => {
      if (this._destroyed) return;
      this._reducedMotion = event.matches;
      this._resetDelta = true;
      this._needsRender = true;
      if (this._scrollWrap) rebuildScrollTimeline(this, this._scrollWrap);
      this._syncLoop();
    };

    this.ready = this.init().catch(error => {
      if (!this._destroyed) {
        console.error("[EarthScene] init error", error);
        this.destroy();
      }
    });
  }

  async init() {
    if (this._destroyed || this._initialized) return;
    if (this._initTask) return this._initTask;

    this._initTask = (async () => {
      this.setupSceneCamera();
      this.setupSun();
      this.setupUniforms();
      this.setupTextures();
      this.buildGlobe();
      this.buildAtmosphere();
      this.assembleEarth();
      this.setupRenderer();

      const renderer = this.renderer;
      this._rendererInitializing = true;
      try {
        await renderer.init();
      } finally {
        this._rendererInitializing = false;
        if (this._destroyed) this._disposeRenderer(renderer);
      }
      if (this._destroyed) return;

      this._initialized = true;
      this.bindEvents();
      this.attachVisibilityObserver();
      this.resize();
      this.start();
      void this.warmup();
      window.__earth = this;
    })();

    return this._initTask;
  }

  size() {
    const rect = this.canvas.getBoundingClientRect();
    return {
      w: Math.max(1, rect.width || window.innerWidth || 1),
      h: Math.max(1, rect.height > 4 ? rect.height : window.innerHeight || 1)
    };
  }

  setupSceneCamera() {
    this.scene = new THREE.Scene();
    const { w, h } = this.size();
    this.camera = new THREE.PerspectiveCamera(
      this.CAMERA.fov, w / h, this.CAMERA.near, this.CAMERA.far
    );
    this.camera.position.copy(this.CAMERA.position);
    this.timer = new THREE.Timer();
    this.timer.connect(document);
  }

  setupSun() {
    this.sun = new THREE.DirectionalLight("#ffffff", this.SUN.intensity);
    this.sun.position.copy(this.SUN.position);
    this.scene.add(this.sun);
  }

  setupUniforms() {
    const atmosphere = this.ATMOSPHERE;
    this.uniforms.atmosphereDayColor = uniform(color(atmosphere.dayColor));
    this.uniforms.atmosphereTwilightColor = uniform(color(atmosphere.twilightColor));
    this.uniforms.nightIntensity = uniform(atmosphere.nightIntensity);
    this.uniforms.atmosphereReach = uniform(atmosphere.reach);
    this.uniforms.roughnessLow = uniform(this.MATERIAL.roughnessLow);
    this.uniforms.roughnessHigh = uniform(this.MATERIAL.roughnessHigh);
    this.uniforms.opacity = uniform(1);
  }

  setupTextures() {
    const loader = new THREE.TextureLoader();
    const pending = [];

    const load = (key, srgb = false) => {
      const url = this.ASSETS[key];
      let resolveReady;
      const ready = new Promise(resolve => { resolveReady = resolve; });
      pending.push(ready);

      const settle = () => {
        this._textureWaiters.delete(settle);
        resolveReady();
      };
      this._textureWaiters.add(settle);

      const fail = error => {
        if (!this._destroyed) {
          console.warn(`[EarthScene] failed to load "${key}" texture`, error);
        }
        settle();
      };

      let result;
      if (typeof url !== "string" || !url.trim()) {
        result = new THREE.Texture();
        fail(new Error(`Missing MOTO_EARTH_ASSETS.${key}`));
      } else {
        try {
          result = loader.load(
            url,
            loaded => {
              if (this._destroyed) loaded.dispose();
              else this._needsRender = true;
              settle();
            },
            undefined,
            fail
          );
        } catch (error) {
          result = new THREE.Texture();
          fail(error);
        }
      }

      if (srgb) result.colorSpace = THREE.SRGBColorSpace;
      result.anisotropy = 8;
      this._textures.add(result);
      return result;
    };

    this.dayTex = load("day", true);
    this.nightTex = load("night", true);
    this.bumpTex = load("bump");
    this._texturesReady = Promise.all(pending);
  }

  buildGlobe() {
    const {
      atmosphereDayColor, atmosphereTwilightColor, nightIntensity,
      atmosphereReach, roughnessLow, roughnessHigh, opacity
    } = this.uniforms;

    const viewDirection = positionWorld.sub(cameraPosition).normalize();
    const fresnel = viewDirection.dot(normalWorldGeometry).abs().oneMinus().toVar();
    const sunOrientation = normalWorldGeometry
      .dot(normalize(this.sun.position)).toVar();
    const atmosphereColor = mix(
      atmosphereTwilightColor,
      atmosphereDayColor,
      sunOrientation.smoothstep(-0.25, 0.75)
    );
    const reachStart = atmosphereReach.mul(2.35).sub(1.5);
    const reachMask = normalWorldGeometry.y.smoothstep(
      reachStart, reachStart.add(0.3)
    );

    this._fresnel = fresnel;
    this._sunOrientation = sunOrientation;
    this._atmosphereColor = atmosphereColor;
    this._reachMask = reachMask;

    const material = new THREE.MeshStandardNodeMaterial({ transparent: true });
    this._materials.add(material);

    let clouds, roughness, elevation;
    if (this.isSafari || this.isMobile) {
      const sample = texture(this.bumpTex, uv());
      clouds = sample.b.smoothstep(0.2, 1);
      roughness = sample.g;
      elevation = sample.r;
    } else {
      clouds = texture(this.bumpTex, uv()).b.smoothstep(0.2, 1);
      roughness = texture(this.bumpTex).g;
      elevation = texture(this.bumpTex).r;
    }

    material.colorNode = mix(texture(this.dayTex), vec3(1), clouds.mul(2));
    material.roughnessNode = max(roughness, step(0.01, clouds))
      .remap(0, 1, roughnessLow, roughnessHigh);

    const dayMix = sunOrientation.smoothstep(-0.25, 0.5);
    const atmosphereMix = sunOrientation.smoothstep(-0.5, 1)
      .mul(fresnel.pow(2)).mul(reachMask).clamp(0, 1);
    const surfaceColor = mix(
      texture(this.nightTex).rgb.mul(nightIntensity), output.rgb, dayMix
    );

    material.outputNode = vec4(
      mix(surfaceColor, atmosphereColor, atmosphereMix),
      output.a.mul(opacity)
    );
    material.normalNode = bumpMap(max(elevation, clouds));

    this._sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    this.globe = new THREE.Mesh(this._sphereGeo, material);
  }

  buildAtmosphere() {
    const material = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      transparent: true
    });
    this._materials.add(material);

    const alpha = this._fresnel.remap(0.73, 1, 1, 0).pow(3)
      .mul(this._sunOrientation.smoothstep(-0.5, 1))
      .mul(this._reachMask)
      .mul(this.uniforms.opacity);

    material.outputNode = vec4(this._atmosphereColor, alpha);
    this.atmosphere = new THREE.Mesh(this._sphereGeo, material);
    this.atmosphere.scale.setScalar(1.04);
  }

  assembleEarth() {
    this.earthGroup = new THREE.Group();
    this.earthGroup.add(this.globe, this.atmosphere);
    this.earthGroup.position.set(this.GLOBE.offsetX, this.GLOBE.offsetY, 0);
    this.earthGroup.scale.setScalar(this.GLOBE.scale);
    this.globe.renderOrder = 0;
    this.atmosphere.renderOrder = 1;
    this.scene.add(this.earthGroup);
  }

  _pixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 1);
  }

  setupRenderer() {
    const { w, h } = this.size();
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      forceWebGL: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(this._pixelRatio());
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.RENDER.exposure;
  }

  bindEvents() {
    if (this._eventsBound || this._destroyed) return;
    this._eventsBound = true;

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.canvas);
    }
    window.addEventListener("resize", this._onResize, { passive: true });
    document.addEventListener("visibilitychange", this._onVisibility);

    if (this._motionQuery?.addEventListener) {
      this._motionQuery.addEventListener("change", this._onMotionChange);
    } else {
      this._motionQuery?.addListener?.(this._onMotionChange);
    }
  }

  attachVisibilityObserver() {
    if (this._destroyed || this._io || typeof IntersectionObserver === "undefined") {
      return;
    }
    this._io = new IntersectionObserver(entries => {
      if (this._destroyed) return;
      const entry = entries.find(item => item.target === this.canvas);
      if (!entry) return;
      const wasNear = this._nearViewport;
      this._nearViewport = entry.isIntersecting;
      if (wasNear !== this._nearViewport) {
        this._resetDelta = true;
        this._needsRender = true;
        this._throttleCounter = 0;
      }
    }, { root: null, rootMargin: "400px 0px", threshold: 0 });
    this._io.observe(this.canvas);
  }

  onResize() {
    this.resize();
  }

  resize() {
    if (this._destroyed || !this.camera || !this.renderer) return;
    const { w, h } = this.size();
    const ratio = this._pixelRatio();
    if (w === this._lastW && h === this._lastH && ratio === this._lastDPR) return;

    this._lastW = w;
    this._lastH = h;
    this._lastDPR = ratio;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this._needsRender = true;
  }

  start() {
    if (this._destroyed) return;
    this._running = true;
    this._resetDelta = true;
    this._needsRender = true;
    this._syncLoop();
  }

  stop() {
    this._running = false;
    this._syncLoop();
  }

  _syncLoop() {
    if (!this.renderer || !this._initialized || this._destroyed) return;
    const active = this._running && !document.hidden;
    if (active === this._loopActive) return;
    this._loopActive = active;
    this._resetDelta = true;
    this.renderer.setAnimationLoop(active ? this._animate : null);
  }

  async warmup() {
    try {
      await this._texturesReady;
      if (this._destroyed) return;
      this._needsRender = true;
      this.attachVisibilityObserver();
    } catch (error) {
      if (!this._destroyed) console.warn("[EarthScene] warmup", error);
    }
  }

  animate() {
    if (this._destroyed || !this._running || document.hidden) return;
    if (!this._nearViewport) {
      this._throttleCounter = (this._throttleCounter + 1) % 3;
      if (this._throttleCounter !== 0) return;
    }

    try {
      this.timer.update();
      const delta = this._resetDelta ? 0 : Math.min(this.timer.getDelta(), 0.1);
      this._resetDelta = false;

      if (!this._reducedMotion) {
        this.globe.rotation.y += delta * this.GLOBE.rotationSpeed;
      } else if (!this._needsRender) {
        return;
      }

      this.renderer.render(this.scene, this.camera);
      this._needsRender = false;
    } catch (error) {
      this.stop();
      console.error("[EarthScene] render error", error);
    }
  }

  _disposeRenderer(renderer) {
    try {
      renderer?.dispose();
    } catch (error) {
      console.warn("[EarthScene] renderer cleanup", error);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this.stop();
    this._destroyed = true;

    this._resizeObserver?.disconnect();
    this._io?.disconnect();
    this._resizeObserver = null;
    this._io = null;
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("visibilitychange", this._onVisibility);

    if (this._motionQuery?.removeEventListener) {
      this._motionQuery.removeEventListener("change", this._onMotionChange);
    } else {
      this._motionQuery?.removeListener?.(this._onMotionChange);
    }

    clearScrollTimeline(this);
    this._scrollWrap = null;
    this._scrollBase = null;

    for (const settle of this._textureWaiters) settle();
    this._textureWaiters.clear();

    const dispose = resource => {
      try {
        resource?.dispose?.();
      } catch (error) {
        console.warn("[EarthScene] resource cleanup", error);
      }
    };
    dispose(this.timer);
    dispose(this._sphereGeo);
    for (const material of this._materials) dispose(material);
    for (const loadedTexture of this._textures) dispose(loadedTexture);
    this._materials.clear();
    this._textures.clear();
    this.scene?.clear();

    if (!this._rendererInitializing) this._disposeRenderer(this.renderer);
    if (window.__earth === this) delete window.__earth;
  }
}

function clearScrollTimeline(earth) {
  const timeline = earth.scrollTL;
  const context = earth._scrollContext;
  earth.scrollTL = null;
  earth._scrollContext = null;

  const attempt = callback => {
    try {
      callback();
    } catch (error) {
      console.warn("[EarthScene] scroll cleanup", error);
    }
  };

  if (context) attempt(() => context.revert());
  else if (timeline?.revert) attempt(() => timeline.revert());

  attempt(() => timeline?.scrollTrigger?.kill());
  attempt(() => timeline?.kill());

  if (earth._scrollBase && earth.earthGroup) {
    earth.earthGroup.scale.copy(earth._scrollBase.scale);
    earth.earthGroup.rotation.copy(earth._scrollBase.rotation);
    earth._needsRender = true;
  }
}

function createScrollTimeline(earth, wrap) {
  if (!earth || earth._destroyed || !earth.earthGroup) return null;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  clearScrollTimeline(earth);
  earth._scrollWrap = wrap;
  if (!gsap || !ScrollTrigger) return null;

  gsap.registerPlugin?.(ScrollTrigger);

  if (!earth._scrollBase) {
    earth._scrollBase = {
      rotation: earth.earthGroup.rotation.clone(),
      scale: earth.earthGroup.scale.clone()
    };
  }

  const rotation = earth._scrollBase.rotation;
  const scale = earth._scrollBase.scale.x;

  const build = () => {
    if (earth._reducedMotion) {
      gsap.set(".gr_point", { autoAlpha: 1, y: 0 });
      earth._needsRender = true;
      return;
    }

    const timeline = gsap.timeline({
      onUpdate: () => { earth._needsRender = true; },
      scrollTrigger: {
        trigger: wrap,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        invalidateOnRefresh: true
      }
    });
    earth.scrollTL = timeline;

    timeline.fromTo(
      earth.earthGroup.scale,
      { x: scale * 0.62, y: scale * 0.62, z: scale * 0.62 },
      { x: scale, y: scale, z: scale, duration: 1, ease: "power2.out" },
      0
    );
    timeline.fromTo(
      ".gr_point",
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.12, ease: "power2.out" },
      0.15
    );
    timeline.fromTo(
      earth.earthGroup.rotation,
      { x: rotation.x, y: rotation.y - Math.PI / 1.4, z: rotation.z },
      { x: rotation.x, y: rotation.y - Math.PI / 5, z: rotation.z, ease: "none" },
      0
    );
  };

  try {
    if (typeof gsap.context === "function") {
      earth._scrollContext = gsap.context(() => {});
      earth._scrollContext.add(build);
    } else {
      build();
    }
  } catch (error) {
    clearScrollTimeline(earth);
    console.warn("[EarthScene] scroll timeline error", error);
    return null;
  }

  return earth.scrollTL;
}

function rebuildScrollTimeline(earth, wrap) {
  if (!earth || earth._destroyed) return;
  clearScrollTimeline(earth);
  createScrollTimeline(earth, wrap);
  window.ScrollTrigger?.refresh?.();
}

export { EarthScene, createScrollTimeline, rebuildScrollTimeline };
