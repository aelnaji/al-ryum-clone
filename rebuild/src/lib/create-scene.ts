import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createLogo } from "./logo-model";

export type SceneController = {
  render: (progress: number, pointerX?: number, pointerY?: number) => void;
  resize: () => void;
  dispose: () => void;
};

const smooth = (a: number, b: number, t: number) =>
  THREE.MathUtils.smoothstep(t, a, b);

/** One renderer, no global singleton, no self-starting animation loop. */
export function createScene(host: HTMLDivElement): SceneController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.dataset.scene = "arc-real-geometry";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  camera.position.set(0, 0, 16);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.85;
  room.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight("#f1e3c4", 2.5);
  key.position.set(-5, 8, 9);
  const rim = new THREE.DirectionalLight("#9cdfc4", 2.7);
  rim.position.set(6, 1, -3);
  const fill = new THREE.HemisphereLight("#b9ddda", "#142127", 0.8);
  scene.add(key, rim, fill);

  const { group, parts } = createLogo();
  scene.add(group);
  let lastProgress = 0;
  let lastX = 0;
  let lastY = 0;
  let width = host.clientWidth;
  let height = host.clientHeight;

  function render(progress: number, pointerX = 0, pointerY = 0) {
    lastProgress = progress;
    lastX = pointerX;
    lastY = pointerY;
    const mobile = width < 800;
    const firstTurn = smooth(0.08, 0.48, progress);
    const lastTurn = smooth(0.56, 0.94, progress);
    const explode = Math.sin(smooth(0.2, 0.83, progress) * Math.PI);
    group.position.set(
      mobile ? 0 : THREE.MathUtils.lerp(3.5, -3.9, firstTurn),
      mobile ? 1.65 - firstTurn * 0.3 : -0.05 + Math.sin(progress * Math.PI) * 0.45,
      0,
    );
    group.rotation.set(
      0.07 + Math.sin(progress * Math.PI) * 0.22 + pointerY * 0.025,
      -0.48 + firstTurn * 1.48 - lastTurn * 0.95 + pointerX * 0.045,
      -0.07 + firstTurn * 0.21 - lastTurn * 0.19,
    );
    const scale = mobile ? Math.min(0.76, (width / height) * 1.05) : 1.08 + explode * 0.06;
    group.scale.setScalar(scale);
    parts.forEach((part, index) => {
      part.position.z = explode * [1.0, -0.25, -1.3, 1.65][index];
      part.position.y = explode * [0.38, 0.05, -0.06, -0.3][index];
      part.rotation.y = explode * [0.06, -0.035, 0.04, -0.06][index];
    });
    renderer.render(scene, camera);
    // Small inspection surface, useful for regression tests without exposing internals.
    host.dataset.progress = progress.toFixed(3);
    host.dataset.drawCalls = String(renderer.info.render.calls);
    host.dataset.triangles = String(renderer.info.render.triangles);
  }

  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render(lastProgress, lastX, lastY);
  }
  resize();

  return {
    render,
    resize,
    dispose() {
      for (const part of parts) {
        part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
