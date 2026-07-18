import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { SimplexNoise } from '../utils/noise.js';
import { Caustics } from './Caustics.js';
import { Particles } from './Particles.js';

/**
 * Ambiente submarino completo: color y niebla del agua, superficie vista desde
 * abajo, lecho marino con relieve, cáusticas y partículas en suspensión.
 *
 * Convención de ejes: Y+ es hacia arriba (superficie). El lecho está en
 * y = SEABED_Y y la superficie en y = SURFACE_Y.
 */
export const SURFACE_Y = 0;
export const SEABED_Y = -45;
const WATER_COLOR = 0x0a3a4a;

export class Ocean {
  constructor(scene, renderer) {
    this.scene = scene;

    // Niebla exponencial: la visibilidad cae con la distancia, tiñendo todo de
    // azul-verde como en aguas costeras reales.
    scene.fog = new THREE.FogExp2(0x0a4a60, 0.019);

    this.noise = new SimplexNoise(1337);
    // Cúpula de gradiente: agua clara arriba (hacia la superficie) → azul
    // profundo abajo. Da sensación de profundidad más allá de la niebla.
    this._buildSkydome();
    this._buildSeabed();
    this._buildSurface(renderer);
    this._buildRocks();

    this.caustics = new Caustics();
    this.caustics.mesh.position.y = SEABED_Y + 0.4;
    scene.add(this.caustics.mesh);

    this.particles = new Particles(1500, 55);
    scene.add(this.particles.points);

    // Rayos de luz (god rays) descendiendo desde la superficie.
    this._buildLightShafts();

    this._t = 0;
  }

  _buildSkydome() {
    // Gradiente vertical pintado en una esfera interior (BackSide).
    const s = 8;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#1a6f8a'); // superficie iluminada
    grad.addColorStop(0.35, '#0d4a63');
    grad.addColorStop(0.65, '#073445');
    grad.addColorStop(1.0, '#03181f'); // profundidad oscura
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.SphereGeometry(400, 24, 24);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skydome = new THREE.Mesh(geo, mat);
    // Centrar el gradiente: la superficie (SURFACE_Y) queda arriba de la cúpula.
    this.skydome.position.y = SURFACE_Y - 180;
    this.scene.add(this.skydome);
  }

  _buildSeabed() {
    const size = 600;
    const seg = 200;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Relieve fractal: dunas amplias + detalle fino.
      let h = this.noise.fbm2D(x * 0.012, z * 0.012, 5, 0.5, 2.0) * 6.5;
      h += this.noise.fbm2D(x * 0.06, z * 0.06, 3, 0.5, 2.0) * 1.2;
      // Depresión suave hacia el centro para una zona despejada de pilotaje.
      const d = Math.sqrt(x * x + z * z);
      h -= Math.max(0, 1 - d / 60) * 2.5;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();

    const colorTex = this._sandColorTexture();
    const normalTex = this._sandNormalTexture();
    colorTex.repeat.set(60, 60);
    normalTex.repeat.set(90, 90);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xb6a880,
      map: colorTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.98,
      metalness: 0.0,
    });

    this.seabed = new THREE.Mesh(geo, mat);
    this.seabed.position.y = SEABED_Y;
    this.seabed.receiveShadow = true;
    this.scene.add(this.seabed);
  }

  /** Textura de color de arena: base cálida + granos y parches sutiles. */
  _sandColorTexture() {
    const s = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(s, s);
    const n = new SimplexNoise(321);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        // Parches de tono (arena clara / sedimento más oscuro).
        const patch = n.fbm2D(x * 0.02, y * 0.02, 4, 0.5, 2) * 0.5 + 0.5;
        // Grano fino de alta frecuencia.
        const grain = n.noise2D(x * 0.9, y * 0.9) * 0.09;
        const t = THREE.MathUtils.clamp(patch * 0.7 + 0.25 + grain, 0, 1);
        const i = (y * s + x) * 4;
        // Interpolar entre sedimento oscuro y arena clara.
        img.data[i] = 120 + t * 90;      // R
        img.data[i + 1] = 108 + t * 82;  // G
        img.data[i + 2] = 82 + t * 60;   // B
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  /** Normal map procedural con ripples direccionales (ondulaciones de arena). */
  _sandNormalTexture() {
    const s = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(s, s);
    const n = new SimplexNoise(654);
    const height = (x, y) => {
      // Ripples: ondas en una dirección, moduladas por ruido para naturalidad.
      const warp = n.fbm2D(x * 0.03, y * 0.03, 3, 0.5, 2) * 6;
      const ripple = Math.sin((x + warp) * 0.5) * 0.5 + 0.5;
      const micro = n.noise2D(x * 0.5, y * 0.5) * 0.2;
      return ripple * 0.8 + micro;
    };
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const hL = height(x - 1, y);
        const hR = height(x + 1, y);
        const hD = height(x, y - 1);
        const hU = height(x, y + 1);
        const nx = (hL - hR) * 2;
        const ny = (hD - hU) * 2;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz);
        const i = (y * s + x) * 4;
        img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Altura del lecho en (x, z) mundo — para no atravesarlo con el vehículo. */
  seabedHeightAt(x, z) {
    let h = this.noise.fbm2D(x * 0.012, z * 0.012, 5, 0.5, 2.0) * 6.5;
    h += this.noise.fbm2D(x * 0.06, z * 0.06, 3, 0.5, 2.0) * 1.2;
    const d = Math.sqrt(x * x + z * z);
    h -= Math.max(0, 1 - d / 60) * 2.5;
    return SEABED_Y + h;
  }

  _buildSurface(renderer) {
    // Superficie del agua vista desde abajo. Usamos Water para el reflejo del
    // "cielo" y desactivamos el lado frontal para ver a través desde abajo.
    const geo = new THREE.PlaneGeometry(600, 600);
    const water = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: this._proceduralWaterNormals(),
      sunDirection: new THREE.Vector3(0.3, 1, 0.2).normalize(),
      sunColor: 0xbfefff,
      waterColor: WATER_COLOR,
      distortionScale: 3.2,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = SURFACE_Y;
    water.material.side = THREE.DoubleSide;
    water.material.transparent = true;
    this.surface = water;
    this.scene.add(water);

    // Plano tenue extra bajo la superficie para reforzar el gradiente de luz.
    const glowGeo = new THREE.PlaneGeometry(600, 600);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2b90b0,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.surfaceGlow = new THREE.Mesh(glowGeo, glowMat);
    this.surfaceGlow.position.y = SURFACE_Y - 0.5;
    this.scene.add(this.surfaceGlow);
  }

  _proceduralWaterNormals() {
    // Textura de normales de agua generada por ruido (evita assets externos).
    const s = 128;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(s, s);
    const n = new SimplexNoise(99);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const e = n.fbm2D(x * 0.08, y * 0.08, 3, 0.5, 2) * 0.5 + 0.5;
        const i = (y * s + x) * 4;
        img.data[i] = 128 + (n.noise2D(x * 0.08 + 5, y * 0.08) * 60);
        img.data[i + 1] = 128 + (n.noise2D(x * 0.08, y * 0.08 + 5) * 60);
        img.data[i + 2] = 200 + e * 55;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _buildRocks() {
    // Rocas dispersas para dar escala y referencias visuales al pilotar.
    this.rocks = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x55564a,
      roughness: 1,
      metalness: 0,
    });
    const rng = new SimplexNoise(2024);
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2 + rng.noise2D(i, 0);
      const dist = 35 + Math.abs(rng.noise2D(i * 3, 7)) * 180;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const scale = 1.2 + Math.abs(rng.noise2D(i, 11)) * 5;
      const geo = new THREE.IcosahedronGeometry(scale, 1);
      // Deformar los vértices para que no sean esferas perfectas.
      const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const f = 1 + rng.noise2D(p.getX(v) + i, p.getZ(v)) * 0.35;
        p.setXYZ(v, p.getX(v) * f, p.getY(v) * f * 0.7, p.getZ(v) * f);
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, rockMat);
      rock.position.set(x, this.seabedHeightAt(x, z) + scale * 0.35, z);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.rocks.add(rock);
    }
    this.scene.add(this.rocks);
  }

  _buildLightShafts() {
    // Conos verticales semitransparentes que sugieren rayos de sol filtrándose.
    this.shafts = new THREE.Group();
    const rng = new SimplexNoise(55);
    for (let i = 0; i < 7; i++) {
      const h = 45;
      const geo = new THREE.CylinderGeometry(0.4, 6, h, 8, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9fe4ff,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const shaft = new THREE.Mesh(geo, mat);
      const x = rng.noise2D(i, 0) * 70;
      const z = rng.noise2D(0, i) * 70;
      shaft.position.set(x, SURFACE_Y - h / 2, z);
      shaft.rotation.z = rng.noise2D(i, i) * 0.15;
      shaft.userData.phase = i * 1.3;
      shaft.userData.baseOpacity = 0.04 + Math.abs(rng.noise2D(i, 3)) * 0.05;
      this.shafts.add(shaft);
    }
    this.scene.add(this.shafts);
  }

  update(dt, cameraPosition) {
    this._t += dt;
    if (this.surface) this.surface.material.uniforms.time.value += dt * 0.6;
    this.caustics.update(dt);
    this.particles.update(dt, cameraPosition);

    // La cúpula de gradiente y las cáusticas siguen a la cámara en el plano XZ
    // para que el ambiente sea "infinito" sin poblar todo el océano.
    if (this.skydome) {
      this.skydome.position.x = cameraPosition.x;
      this.skydome.position.z = cameraPosition.z;
    }
    this.caustics.mesh.position.x = cameraPosition.x;
    this.caustics.mesh.position.z = cameraPosition.z;

    // Parpadeo suave de los rayos de luz (shimmer del oleaje).
    for (const shaft of this.shafts.children) {
      const p = shaft.userData.phase;
      shaft.material.opacity =
        shaft.userData.baseOpacity * (0.6 + 0.4 * Math.sin(this._t * 0.7 + p));
    }
  }
}
