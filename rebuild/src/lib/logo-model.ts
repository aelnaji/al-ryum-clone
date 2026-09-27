import * as THREE from "three";

/**
 * New hand-traced geometry based on the supplied arc-logo.png silhouette.
 * These four closed shapes are extruded meshes, not image planes or videos.
 * Coordinates use the original 768 x 657 artwork. This is a traced study,
 * not a claim that we have the original vector brand master.
 */
function trace(draw: (shape: THREE.Shape) => void) {
  const shape = new THREE.Shape();
  draw(shape);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 80,
    bevelEnabled: true,
    bevelThickness: 3.6,
    bevelSize: 2.4,
    bevelSegments: 4,
    curveSegments: 48,
    steps: 1,
  });
  geometry.translate(-384, -328.5, -40);
  geometry.scale(0.01, -0.01, 0.01);
  geometry.computeVertexNormals();
  return geometry;
}

export function createLogo() {
  const group = new THREE.Group();
  const shapes = [
    trace((s) => {
      s.moveTo(291, 28);
      s.bezierCurveTo(368, 34, 445, 52, 510, 72);
      s.bezierCurveTo(459, 122, 398, 170, 336, 209);
      s.bezierCurveTo(304, 158, 288, 99, 291, 28);
    }),
    trace((s) => {
      s.moveTo(34, 377);
      s.bezierCurveTo(223, 319, 423, 210, 551, 81);
      s.lineTo(640, 106);
      s.bezierCurveTo(534, 271, 357, 389, 150, 490);
      s.lineTo(34, 377);
    }),
    trace((s) => {
      s.moveTo(439, 345);
      s.bezierCurveTo(487, 310, 528, 273, 563, 233);
      s.bezierCurveTo(577, 335, 643, 423, 738, 516);
      s.lineTo(667, 617);
      s.bezierCurveTo(563, 529, 487, 434, 439, 345);
    }),
    trace((s) => {
      s.moveTo(168, 509);
      s.bezierCurveTo(252, 476, 327, 420, 398, 375);
      s.bezierCurveTo(470, 415, 528, 489, 579, 563);
      s.bezierCurveTo(455, 521, 341, 541, 247, 593);
      s.lineTo(168, 509);
    }),
  ];
  const colors = ["#399987", "#448eaa", "#399987", "#b3333c"];
  const parts = shapes.map((geometry, i) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: colors[i],
      metalness: 0.7,
      roughness: 0.25,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  });
  return { group, parts };
}
