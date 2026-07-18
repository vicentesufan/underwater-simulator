import * as THREE from 'three';

/**
 * Materia en suspensión ("marine snow"): puntos tenues que derivan lentamente
 * para dar sensación de estar dentro del agua. Se recolocan alrededor de la
 * cámara para que siempre haya partículas visibles sin poblar todo el océano.
 */
export class Particles {
  constructor(count = 1400, radius = 60) {
    this.count = count;
    this.radius = radius;

    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2 * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * radius;
      // Deriva suave, con leve ascenso.
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.15;
      this.velocities[i * 3 + 1] = Math.random() * 0.12 + 0.02;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xbfeaff,
      size: 0.12,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this._positions = positions;
  }

  /** Deriva las partículas y las envuelve alrededor de `center` (la cámara). */
  update(dt, center) {
    const p = this._positions;
    const v = this.velocities;
    const r = this.radius;
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      p[ix] += v[ix] * dt;
      p[ix + 1] += v[ix + 1] * dt;
      p[ix + 2] += v[ix + 2] * dt;

      // Las posiciones son offsets locales respecto a `points.position`
      // (que fijamos en la cámara). Al salir de la caja, se envuelven.
      for (let a = 0; a < 3; a++) {
        if (p[ix + a] > r) p[ix + a] -= 2 * r;
        else if (p[ix + a] < -r) p[ix + a] += 2 * r;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.position.copy(center);
  }
}
