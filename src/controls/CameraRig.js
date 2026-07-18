import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Gestiona dos modos de cámara y la transición entre ellos:
 *  - 'orbit': cámara externa con OrbitControls, centrada y siguiendo al ROV.
 *  - 'fpv':   cámara de piloto anclada al frente del ROV (mira -Z).
 *
 * `C` alterna el modo (llamando a toggle()). El seguimiento del objetivo en
 * modo órbita es suave para no marear.
 */
export class CameraRig {
  constructor(camera, domElement, rov) {
    this.camera = camera;
    this.rov = rov; // BlueROV2 (usa group y fpvAnchor)
    this.mode = 'orbit';

    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 40;
    this.orbit.maxPolarAngle = Math.PI * 0.98;

    this._targetLerp = new THREE.Vector3();
    this._fpvPos = new THREE.Vector3();
    this._fpvQuat = new THREE.Quaternion();

    // Posición inicial de la órbita respecto al ROV.
    this._orbitOffset = new THREE.Vector3(0, 3.5, 9);

    const p = rov.group.position;
    this._targetLerp.copy(p);
    camera.position.copy(p).add(this._orbitOffset);
    this.orbit.target.copy(p);
  }

  toggle() {
    this.mode = this.mode === 'orbit' ? 'fpv' : 'orbit';
    this.orbit.enabled = this.mode === 'orbit';
    return this.mode;
  }

  update(dt) {
    const rovPos = this.rov.group.position;

    if (this.mode === 'orbit') {
      // Seguir suavemente el centro del ROV sin bloquear el giro manual.
      this._targetLerp.lerp(rovPos, 1 - Math.pow(0.001, dt));
      const delta = this._targetLerp.clone().sub(this.orbit.target);
      this.orbit.target.add(delta);
      this.camera.position.add(delta); // mantener el offset al desplazarse el ROV
      this.orbit.update();
    } else {
      // FPV: interpolar hacia la pose del ancla frontal del ROV.
      this.rov.fpvAnchor.getWorldPosition(this._fpvPos);
      this.rov.fpvAnchor.getWorldQuaternion(this._fpvQuat);
      const k = 1 - Math.pow(0.0001, dt);
      this.camera.position.lerp(this._fpvPos, k);
      this.camera.quaternion.slerp(this._fpvQuat, k);
    }
  }
}
