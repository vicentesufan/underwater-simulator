import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from '../assets/bluerov2.glb?url';

/**
 * BlueROV2 usando la geometría CAD real (STL del usuario, decimada a GLB).
 *
 * El STL no lleva materiales/colores, así que coloreamos la malla por regiones
 * espaciales (color por vértice) para reproducir el aspecto de la referencia:
 * frame negro (HDPE), espuma de flotación azul, carcasa/electrónica gris claro y
 * thrusters oscuros. Además añadimos focos frontales encendibles y burbujas.
 *
 * Convención local del sim: el frente mira a -Z. La orientación del GLB se
 * corrige en load() (FRONT_IS_POS_Z / UP_AXIS) tras verificar visualmente.
 */

// Colores tipo BlueROV2.
const C_FRAME = new THREE.Color(0x15161a); // HDPE negro
const C_FOAM = new THREE.Color(0x2f86cf); // espuma azul
const C_SHELL = new THREE.Color(0x9aa3ab); // carcasa/aluminio gris
const C_DARK = new THREE.Color(0x101216); // thrusters / bajo el chasis

export class BlueROV2Model {
  constructor() {
    this.group = new THREE.Group();
    this.lights = [];
    this.lightsOn = true;
    this.ready = false;

    // Ancla para cámara FPV (se ajusta al tamaño real tras cargar).
    this.fpvAnchor = new THREE.Object3D();
    this.group.add(this.fpvAnchor);

    this._buildBubbles();
    this._tmpV = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
  }

  async load() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(glbUrl);
    const model = gltf.scene;

    // Durante la coloración dejamos el grupo en identidad, así las coordenadas
    // de mundo coinciden con el frame real de render (Y arriba, centrado en el
    // ROV) sin el offset de la física. Luego restauramos.
    const savedPos = this.group.position.clone();
    const savedQuat = this.group.quaternion.clone();
    this.group.position.set(0, 0, 0);
    this.group.quaternion.identity();

    // Orientación: si el frente apuntara al lado contrario, girar 180°.
    const FRONT_IS_POS_Z = true;
    if (FRONT_IS_POS_Z) model.rotation.y = Math.PI;

    this.group.add(model);
    this.model = model;
    this.group.updateMatrixWorld(true);

    // Bounding box en coords de mundo (== frame del ROV con el grupo en identidad).
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const halfX = size.x / 2;
    const halfY = size.y / 2;
    const hz = size.z / 2;

    // Colorear por regiones usando coordenadas de mundo (Y arriba real).
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        this._colorize(o, halfX, halfY);
        // El GLB decimado no trae normales fiables → recalcularlas para que la
        // iluminación PBR responda (si no, la malla se ve negra).
        o.geometry.computeVertexNormals();
        o.material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.55,
          metalness: 0.12,
          envMapIntensity: 0.9,
        });
      }
    });

    // Restaurar la transformación del grupo (la controla la física).
    this.group.position.copy(savedPos);
    this.group.quaternion.copy(savedQuat);

    // Ancla FPV: justo delante y algo arriba del vehículo.
    this.fpvAnchor.position.set(0, halfY * 0.4, -hz - 0.1);

    // Posiciones aproximadas de thrusters (para emitir burbujas), en coords
    // locales del grupo, derivadas del bounding box.
    this.thrusterPoints = [
      new THREE.Vector3(-halfX * 0.8, -halfY * 0.3, hz * 0.75),
      new THREE.Vector3(halfX * 0.8, -halfY * 0.3, hz * 0.75),
      new THREE.Vector3(-halfX * 0.8, -halfY * 0.3, -hz * 0.75),
      new THREE.Vector3(halfX * 0.8, -halfY * 0.3, -hz * 0.75),
      new THREE.Vector3(-halfX * 0.45, halfY * 0.2, 0),
      new THREE.Vector3(halfX * 0.45, halfY * 0.2, 0),
    ];

    this._buildLights(size);
    this.ready = true;
    return this;
  }

  /**
   * Asigna color por vértice según la región espacial. Con el grupo en identidad
   * durante la carga, matrixWorld da directamente el frame real (Y arriba).
   */
  _colorize(mesh, halfX, halfY) {
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); // → mundo = frame del ROV (Y up)
      const ax = Math.abs(v.x);
      if (ax > halfX * 0.78) {
        c.copy(C_FRAME); // placas laterales del frame (negro HDPE)
      } else if (v.y < -halfY * 0.3) {
        c.copy(C_DARK); // parte baja / thrusters (negro)
      } else if (v.y > halfY * 0.1) {
        c.copy(C_FOAM); // espuma de flotación (azul, arriba)
      } else {
        c.copy(C_SHELL); // carcasa / electrónica central (gris)
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _buildLights(size) {
    const zFront = -size.z * 0.5;
    [-size.x * 0.28, size.x * 0.28].forEach((x, idx) => {
      // Lente emisiva.
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xdff4ff,
        emissiveIntensity: 2.4,
      });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), lensMat);
      lens.position.set(x, size.y * 0.02, zFront - 0.02);
      lens.rotation.y = Math.PI;
      this.group.add(lens);

      // Foco real.
      const spot = new THREE.SpotLight(0xdff4ff, 7, 45, Math.PI / 6, 0.55, 1.1);
      spot.position.set(x, size.y * 0.02, zFront - 0.02);
      spot.target.position.set(x * 1.4, -1.6, zFront - 14);
      this.group.add(spot, spot.target);

      // Cono volumétrico tenue.
      const coneGeo = new THREE.CylinderGeometry(0.05, 2.6, 13, 16, 1, true);
      coneGeo.translate(0, -6.5, 0);
      coneGeo.rotateX(-Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xcfeeff,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(x, size.y * 0.02, zFront - 0.05);
      cone.rotation.x = -0.05;
      this.group.add(cone);

      this.lights.push({ spot, lensMat, cone });
    });
  }

  // ---------------- Burbujas ----------------
  _buildBubbles() {
    this.bubbleCount = 260;
    const positions = new Float32Array(this.bubbleCount * 3);
    this.bubbleLife = new Float32Array(this.bubbleCount);
    this.bubbleVel = new Float32Array(this.bubbleCount * 3);
    this._bubbleCursor = 0;
    for (let i = 0; i < this.bubbleCount; i++) positions[i * 3 + 1] = 9999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdafaff,
      size: 0.14,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.bubbles = new THREE.Points(geo, mat);
    this.bubbles.frustumCulled = false;
    this._bubblePositions = positions;
  }

  _emitBubble(worldPos, dir) {
    const i = this._bubbleCursor;
    this._bubbleCursor = (this._bubbleCursor + 1) % this.bubbleCount;
    const p = this._bubblePositions;
    p[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.2;
    p[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * 0.2;
    p[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.2;
    this.bubbleVel[i * 3] = dir.x * 1.2 + (Math.random() - 0.5) * 0.4;
    this.bubbleVel[i * 3 + 1] = 0.9 + Math.random() * 0.6;
    this.bubbleVel[i * 3 + 2] = dir.z * 1.2 + (Math.random() - 0.5) * 0.4;
    this.bubbleLife[i] = 1.6 + Math.random() * 0.8;
  }

  setLights(on) {
    this.lightsOn = on;
    this.lights.forEach(({ spot, lensMat, cone }) => {
      spot.intensity = on ? 7 : 0;
      lensMat.emissiveIntensity = on ? 2.4 : 0.05;
      cone.visible = on;
    });
  }

  toggleLights() {
    this.setLights(!this.lightsOn);
    return this.lightsOn;
  }

  update(dt, input) {
    if (!this.ready) return;
    const activity =
      Math.abs(input.surge) + Math.abs(input.sway) + Math.abs(input.heave) +
      Math.abs(input.yaw) + Math.abs(input.pitch) + Math.abs(input.roll);
    const vert = Math.abs(input.heave) + Math.abs(input.pitch) + Math.abs(input.roll);
    const horiz = activity - vert;

    if (activity > 0.05 && this.thrusterPoints) {
      const emitCount = Math.min(4, Math.ceil(activity * 2));
      const preferVertical = vert > horiz;
      const pool = preferVertical
        ? this.thrusterPoints.slice(4)
        : this.thrusterPoints.slice(0, 4);
      for (let e = 0; e < emitCount; e++) {
        const local = pool[(Math.random() * pool.length) | 0];
        this._tmpV.copy(local).applyMatrix4(this.group.matrixWorld);
        this._tmpDir.set(0, 0, 0.6).applyQuaternion(this.group.quaternion);
        this._emitBubble(this._tmpV, this._tmpDir);
      }
    }

    const p = this._bubblePositions;
    const v = this.bubbleVel;
    for (let i = 0; i < this.bubbleCount; i++) {
      if (this.bubbleLife[i] <= 0) continue;
      this.bubbleLife[i] -= dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      v[i * 3] *= 0.96;
      v[i * 3 + 2] *= 0.96;
      if (this.bubbleLife[i] <= 0) p[i * 3 + 1] = 9999;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
  }
}
