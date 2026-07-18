import * as THREE from 'three';

/**
 * Iluminación submarina: la luz solar entra atenuada y azulada desde la
 * superficie, con un relleno hemisférico agua/fondo y una ambiental tenue.
 */
export function createLighting(scene) {
  // Ambiental fría muy tenue: nada queda en negro absoluto.
  const ambient = new THREE.AmbientLight(0x1a4a5a, 0.6);
  scene.add(ambient);

  // Sol filtrado por el agua: desciende desde arriba, tono verde-azulado.
  const sun = new THREE.DirectionalLight(0x9fe8ff, 1.15);
  sun.position.set(30, 120, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Relleno hemisférico: cielo (agua iluminada) arriba, fondo oscuro abajo.
  const hemi = new THREE.HemisphereLight(0x2c86a8, 0x03141c, 0.75);
  scene.add(hemi);

  return { ambient, sun, hemi };
}
