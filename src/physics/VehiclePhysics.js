import * as THREE from 'three';

/**
 * Física "de sensación" para un ROV/AUV holonómico (6-DOF).
 *
 * No resuelve hidrodinámica real: aplica aceleraciones en el marco del cuerpo
 * (body-frame) e integra velocidad con arrastre viscoso, de modo que el
 * vehículo tiene inercia y desacelera suavemente al soltar los mandos, como si
 * se moviera dentro del agua. Cada eje es independiente → movimiento holonómico.
 *
 * Todos los parámetros de "tacto" están agrupados aquí para facilitar el tuneo.
 */
const CFG = {
  // Aceleraciones máximas (unidades/s²) por grado de libertad.
  surgeAccel: 9,   // adelante/atrás
  swayAccel: 8,    // lateral
  heaveAccel: 7,   // vertical
  yawAccel: 2.6,   // guiñada (rad/s²)
  pitchAccel: 2.2, // cabeceo
  rollAccel: 2.2,  // alabeo

  // Arrastre (fracción de velocidad disipada por segundo): mayor = más "pastoso".
  linearDrag: 1.7,
  angularDrag: 3.0,

  // Velocidades máximas (clamp) para que sea manejable.
  maxLinearSpeed: 6.5,
  maxAngularSpeed: 1.8,

  // Flotabilidad: leve tendencia a subir/estabilizar hacia flotación neutra.
  buoyancy: 0.25,          // empuje vertical residual (unid/s²)
  selfRightingTorque: 0.8, // par que devuelve pitch/roll a 0 (estabilidad pasiva)
};

export class VehiclePhysics {
  constructor(initialPos = new THREE.Vector3(0, -20, 0)) {
    this.position = initialPos.clone();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.angularVelocity = new THREE.Vector3(); // en marco del cuerpo (x=pitch, y=yaw, z=roll)

    this.cfg = CFG;

    // Límites verticales (se ajustan desde main con la escena real).
    this.surfaceY = -0.5;
    this.floorFn = null; // (x,z) => altura del lecho; se inyecta desde Ocean.

    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
  }

  setBounds({ surfaceY, floorFn }) {
    if (surfaceY !== undefined) this.surfaceY = surfaceY;
    if (floorFn) this.floorFn = floorFn;
  }

  /**
   * @param {number} dt segundos
   * @param {object} input estado normalizado en [-1,1] por eje:
   *   {surge, sway, heave, yaw, pitch, roll}
   */
  step(dt, input) {
    const c = this.cfg;

    // --- Aceleración lineal en marco del cuerpo → mundo ---
    const bodyAccel = this._v.set(
      (input.sway || 0) * c.swayAccel,
      (input.heave || 0) * c.heaveAccel,
      -(input.surge || 0) * c.surgeAccel // -Z es "adelante"
    );
    bodyAccel.applyQuaternion(this.quaternion);

    // Flotabilidad neutra (mundo, siempre hacia arriba).
    bodyAccel.y += c.buoyancy;

    this.velocity.addScaledVector(bodyAccel, dt);

    // Arrastre viscoso.
    const linDamp = Math.max(0, 1 - c.linearDrag * dt);
    this.velocity.multiplyScalar(linDamp);

    // Clamp de velocidad.
    if (this.velocity.length() > c.maxLinearSpeed) {
      this.velocity.setLength(c.maxLinearSpeed);
    }

    // Integrar posición.
    this.position.addScaledVector(this.velocity, dt);

    // --- Rotación (body-frame) ---
    this.angularVelocity.x += (input.pitch || 0) * c.pitchAccel * dt;
    this.angularVelocity.y += (input.yaw || 0) * c.yawAccel * dt;
    this.angularVelocity.z += (input.roll || 0) * c.rollAccel * dt;

    // Auto-enderezamiento pasivo: pitch/roll tienden a 0 (estabilidad de un ROV
    // con flotación arriba y lastre abajo). El yaw no se corrige (rumbo libre).
    this._e.setFromQuaternion(this.quaternion, 'YXZ');
    this.angularVelocity.x -= this._e.x * c.selfRightingTorque * dt;
    this.angularVelocity.z -= this._e.z * c.selfRightingTorque * dt;

    const angDamp = Math.max(0, 1 - c.angularDrag * dt);
    this.angularVelocity.multiplyScalar(angDamp);
    if (this.angularVelocity.length() > c.maxAngularSpeed) {
      this.angularVelocity.setLength(c.maxAngularSpeed);
    }

    // Aplicar velocidad angular como rotación incremental en marco del cuerpo.
    this._e.set(
      this.angularVelocity.x * dt,
      this.angularVelocity.y * dt,
      this.angularVelocity.z * dt,
      'XYZ'
    );
    this._q.setFromEuler(this._e);
    this.quaternion.multiply(this._q).normalize();

    this._applyBounds();
  }

  _applyBounds() {
    // Techo: no atravesar la superficie del agua.
    const ceiling = this.surfaceY - 0.6;
    if (this.position.y > ceiling) {
      this.position.y = ceiling;
      if (this.velocity.y > 0) this.velocity.y *= -0.25; // rebote suave
    }

    // Suelo: no atravesar el lecho marino.
    if (this.floorFn) {
      const floor = this.floorFn(this.position.x, this.position.z) + 1.2;
      if (this.position.y < floor) {
        this.position.y = floor;
        if (this.velocity.y < 0) this.velocity.y *= -0.25;
      }
    }
  }

  // --- Telemetría derivada para el HUD ---
  get depth() {
    return Math.max(0, this.surfaceY - this.position.y);
  }

  get eulerDeg() {
    this._e.setFromQuaternion(this.quaternion, 'YXZ');
    return {
      // Heading: 0..360, 0 = -Z (norte convencional).
      heading: (THREE.MathUtils.radToDeg(this._e.y) + 360 + 180) % 360,
      pitch: THREE.MathUtils.radToDeg(this._e.x),
      roll: THREE.MathUtils.radToDeg(this._e.z),
    };
  }

  get speed() {
    return this.velocity.length();
  }

  /** Sincroniza un objeto Three.js (el modelo) con el estado físico. */
  applyTo(object3d) {
    object3d.position.copy(this.position);
    object3d.quaternion.copy(this.quaternion);
  }
}
