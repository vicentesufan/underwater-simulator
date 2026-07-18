import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise.js';

/**
 * Cáusticas: patrón luminoso animado (como el que dibuja la luz al atravesar
 * el oleaje) proyectado sobre el lecho marino. Se genera una textura por
 * canvas con ruido y se anima desplazando el offset UV cada frame.
 */
export class Caustics {
  constructor() {
    this.size = 256;
    this.noise = new SimplexNoise(7); // semilla distinta a la del fondo
    this.texture = this._buildTexture();

    // Malla plana justo por encima del lecho, con blending aditivo para
    // que las líneas brillen sin oscurecer la arena.
    const geo = new THREE.PlaneGeometry(600, 600, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0x8ff0ff,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 1;

    this._t = 0;
  }

  _buildTexture() {
    const s = this.size;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(s, s);

    const scale = 0.045;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        // Ruido tileable: muestreamos en un toroide para que la textura
        // se pueda repetir sin costuras.
        const nx = x * scale;
        const ny = y * scale;
        let n = this.noise.fbm2D(nx, ny, 3, 0.55, 2.1);
        n = Math.abs(n); // pliegues → filamentos brillantes
        // Realzar los picos para lograr el aspecto de red de cáusticas.
        let v = Math.pow(1 - Math.min(1, n * 2.2), 3);
        v = Math.min(1, v * 1.4);
        const i = (y * s + x) * 4;
        const c = Math.floor(v * 255);
        img.data[i] = c;
        img.data[i + 1] = c;
        img.data[i + 2] = c;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  }

  /** Desplaza y "respira" el patrón para simular el vaivén del oleaje. */
  update(dt) {
    this._t += dt;
    this.texture.offset.x = this._t * 0.015;
    this.texture.offset.y = Math.sin(this._t * 0.25) * 0.02 + this._t * 0.008;
    this.mesh.material.opacity = 0.28 + Math.sin(this._t * 0.8) * 0.07;
  }
}
