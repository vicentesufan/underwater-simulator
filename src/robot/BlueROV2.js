import * as THREE from 'three';

/**
 * Modelo procedural del BlueROV2 (Blue Robotics).
 *
 * Rasgos reconocibles reproducidos:
 *  - Frame azul anodizado con placas laterales.
 *  - Dos carcasas cilíndricas horizontales (electrónica principal + batería).
 *  - Bloque de flotación (buoyancy foam) superior.
 *  - 6 thrusters T200: 4 vectorizados en las esquinas (a 45°) + 2 verticales.
 *  - Hélices que giran según el empuje aplicado.
 *  - Dos focos frontales (Lumen) encendibles.
 *  - Emisores de burbujas por thruster.
 *
 * Convención local: el frente del vehículo mira hacia -Z (coincide con la
 * dirección de vista natural de una cámara hija → cámara FPV inmediata).
 */

const BLUE = 0x1f6fb2;
const DARK = 0x14232b;
const FOAM = 0x123a52;
const ACRYLIC = 0xdfeef2;

export class BlueROV2 {
  constructor() {
    this.group = new THREE.Group();
    this.thrusters = [];
    this.lights = [];
    this.lightsOn = true;

    this._buildFrame();
    this._buildEnclosures();
    this._buildBuoyancy();
    this._buildThrusters();
    this._buildLights();
    this._buildBubbles();

    // Punto de anclaje para la cámara FPV (justo sobre las carcasas, mirando -Z).
    this.fpvAnchor = new THREE.Object3D();
    this.fpvAnchor.position.set(0, 1.4, -1.2);
    this.group.add(this.fpvAnchor);
  }

  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.55,
      metalness: opts.metalness ?? 0.35,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
    });
  }

  _buildFrame() {
    const frameMat = this._mat(BLUE, { roughness: 0.4, metalness: 0.6 });

    // Placas laterales (paneles azules característicos).
    const plateGeo = new THREE.BoxGeometry(0.12, 1.7, 3.2);
    const left = new THREE.Mesh(plateGeo, frameMat);
    left.position.set(-1.35, 0, 0);
    const right = left.clone();
    right.position.x = 1.35;
    [left, right].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    });

    // Travesaños del chasis (barras que unen las placas).
    const barMat = this._mat(DARK, { roughness: 0.6, metalness: 0.5 });
    const barGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.7, 12);
    barGeo.rotateZ(Math.PI / 2);
    const barZ = [-1.2, 1.2];
    const barY = [-0.75, 0.75];
    barZ.forEach((z) =>
      barY.forEach((y) => {
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(0, y, z);
        bar.castShadow = true;
        this.group.add(bar);
      })
    );

    // Patines inferiores.
    const skidGeo = new THREE.BoxGeometry(0.1, 0.1, 3.0);
    [-1.1, 1.1].forEach((x) => {
      const skid = new THREE.Mesh(skidGeo, barMat);
      skid.position.set(x, -0.9, 0);
      skid.castShadow = true;
      this.group.add(skid);
    });
  }

  _buildEnclosures() {
    // Dos tubos horizontales a lo largo de Z (frente-atrás): carcasa de
    // electrónica (translúcida) y batería (oscura), lado a lado.
    const tubeGeo = new THREE.CylinderGeometry(0.42, 0.42, 2.5, 24);
    tubeGeo.rotateX(Math.PI / 2);

    const acrylicMat = this._mat(ACRYLIC, {
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    });
    const batteryMat = this._mat(DARK, { roughness: 0.5, metalness: 0.4 });

    const main = new THREE.Mesh(tubeGeo, acrylicMat);
    main.position.set(-0.5, 0.15, 0);
    main.castShadow = true;

    const battery = new THREE.Mesh(tubeGeo, batteryMat);
    battery.position.set(0.5, 0.15, 0);
    battery.castShadow = true;

    this.group.add(main, battery);

    // Tapas (end caps) de aluminio en los extremos de los tubos.
    const capMat = this._mat(0x8a97a0, { roughness: 0.35, metalness: 0.8 });
    const capGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.12, 24);
    capGeo.rotateX(Math.PI / 2);
    [-0.5, 0.5].forEach((x) => {
      [-1.28, 1.28].forEach((z) => {
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(x, 0.15, z);
        this.group.add(cap);
      });
    });
  }

  _buildBuoyancy() {
    // Bloque de flotación superior (espuma), con forma redondeada.
    const foamMat = this._mat(FOAM, { roughness: 0.9, metalness: 0.0 });
    const geo = new THREE.BoxGeometry(2.4, 0.5, 2.6);
    const foam = new THREE.Mesh(geo, foamMat);
    foam.position.set(0, 0.85, 0);
    foam.castShadow = true;
    // Bisel: escalar ligeramente la parte superior mediante un segundo bloque.
    const topGeo = new THREE.BoxGeometry(2.0, 0.2, 2.2);
    const top = new THREE.Mesh(topGeo, foamMat);
    top.position.set(0, 1.15, 0);
    this.group.add(foam, top);
  }

  _makeThruster() {
    const g = new THREE.Group();
    // Cuerpo (nozzle / conducto).
    const bodyMat = this._mat(DARK, { roughness: 0.5, metalness: 0.5 });
    const bodyGeo = new THREE.CylinderGeometry(0.26, 0.3, 0.34, 20, 1, true);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    g.add(body);

    // Anillo exterior.
    const ringGeo = new THREE.TorusGeometry(0.3, 0.05, 8, 24);
    const ring = new THREE.Mesh(ringGeo, this._mat(BLUE, { metalness: 0.6, roughness: 0.4 }));
    g.add(ring);

    // Hélice (3 palas) que rotará en torno a Z.
    const prop = new THREE.Group();
    const bladeMat = this._mat(0xbfc7cc, { roughness: 0.4, metalness: 0.3 });
    const bladeGeo = new THREE.BoxGeometry(0.05, 0.22, 0.04);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.11;
      blade.rotation.z = (i / 3) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.z = (i / 3) * Math.PI * 2;
      pivot.add(blade);
      prop.add(pivot);
    }
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12),
      bodyMat
    );
    hub.rotation.x = Math.PI / 2;
    prop.add(hub);
    g.add(prop);

    g.userData.prop = prop;
    return g;
  }

  _buildThrusters() {
    // 4 vectorizados en las esquinas (orientados a 45° en el plano horizontal)
    // + 2 verticales. Guardamos su eje de empuje para animar hélices/burbujas.
    const corners = [
      { x: -1.15, z: -1.15, yaw: Math.PI * 0.25 },
      { x: 1.15, z: -1.15, yaw: -Math.PI * 0.25 },
      { x: -1.15, z: 1.15, yaw: -Math.PI * 0.25 },
      { x: 1.15, z: 1.15, yaw: Math.PI * 0.25 },
    ];
    corners.forEach((c) => {
      const t = this._makeThruster();
      t.position.set(c.x, -0.2, c.z);
      t.rotation.y = c.yaw;
      t.userData.kind = 'horizontal';
      // Dirección de expulsión de burbujas (hacia atrás del thruster, en -Z local).
      this.thrusters.push(t);
      this.group.add(t);
    });

    // 2 verticales, en el centro de los laterales.
    const verticals = [
      { x: -0.9, z: 0 },
      { x: 0.9, z: 0 },
    ];
    verticals.forEach((c) => {
      const t = this._makeThruster();
      t.position.set(c.x, 0.55, c.z);
      t.rotation.x = Math.PI / 2; // eje de empuje vertical
      t.userData.kind = 'vertical';
      this.thrusters.push(t);
      this.group.add(t);
    });
  }

  _buildLights() {
    // Dos focos frontales apuntando hacia -Z (el frente del vehículo).
    const housingMat = this._mat(0x9aa4ab, { metalness: 0.8, roughness: 0.3 });
    const housingGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.2, 16);
    housingGeo.rotateX(Math.PI / 2);

    [-0.7, 0.7].forEach((x) => {
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(x, 0.1, -1.35);
      this.group.add(housing);

      // Lente emisiva (brilla cuando las luces están encendidas).
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xdff4ff,
        emissiveIntensity: 2.2,
      });
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 16),
        lensMat
      );
      lens.position.set(x, 0.1, -1.46);
      lens.rotation.y = Math.PI;
      this.group.add(lens);

      // Foco real (SpotLight) con cono visible en el agua.
      const spot = new THREE.SpotLight(0xdff4ff, 6, 40, Math.PI / 6, 0.5, 1.2);
      spot.position.set(x, 0.1, -1.45);
      spot.target.position.set(x * 1.3, -1.5, -14);
      this.group.add(spot);
      this.group.add(spot.target);

      this.lights.push({ spot, lens, lensMat });
    });

    // Cono volumétrico tenue para "ver" el haz en el agua turbia.
    [-0.7, 0.7].forEach((x) => {
      const coneGeo = new THREE.CylinderGeometry(0.05, 2.4, 12, 16, 1, true);
      coneGeo.translate(0, -6, 0);
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
      cone.position.set(x, 0.1, -1.45);
      cone.rotation.x = -0.06;
      this.lights[x < 0 ? 0 : 1].cone = cone;
      this.group.add(cone);
    });
  }

  _buildBubbles() {
    // Pool de burbujas en espacio-mundo: se emiten desde los thrusters activos
    // y ascienden. Usamos Points con reciclaje.
    this.bubbleCount = 260;
    const positions = new Float32Array(this.bubbleCount * 3);
    this.bubbleLife = new Float32Array(this.bubbleCount);
    this.bubbleVel = new Float32Array(this.bubbleCount * 3);
    this._bubbleCursor = 0;

    for (let i = 0; i < this.bubbleCount; i++) {
      positions[i * 3 + 1] = 9999; // fuera de vista al inicio
      this.bubbleLife[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdafaff,
      size: 0.16,
      transparent: true,
      opacity: 0.75,
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
    this.bubbleVel[i * 3 + 1] = 0.9 + Math.random() * 0.6; // flotan hacia arriba
    this.bubbleVel[i * 3 + 2] = dir.z * 1.2 + (Math.random() - 0.5) * 0.4;
    this.bubbleLife[i] = 1.6 + Math.random() * 0.8;
  }

  setLights(on) {
    this.lightsOn = on;
    this.lights.forEach(({ spot, lensMat, cone }) => {
      spot.intensity = on ? 6 : 0;
      lensMat.emissiveIntensity = on ? 2.2 : 0.05;
      if (cone) cone.visible = on;
    });
  }

  toggleLights() {
    this.setLights(!this.lightsOn);
    return this.lightsOn;
  }

  /**
   * Anima el vehículo.
   * @param {number} dt
   * @param {object} input estado normalizado {surge,sway,heave,yaw,pitch,roll}
   */
  update(dt, input) {
    const activity =
      Math.abs(input.surge) +
      Math.abs(input.sway) +
      Math.abs(input.heave) +
      Math.abs(input.yaw) +
      Math.abs(input.pitch) +
      Math.abs(input.roll);
    const horiz = Math.abs(input.surge) + Math.abs(input.sway) + Math.abs(input.yaw);
    const vert = Math.abs(input.heave) + Math.abs(input.pitch) + Math.abs(input.roll);

    // Girar hélices proporcional a la actividad de su tipo.
    const spinH = horiz * 22 * dt;
    const spinV = vert * 22 * dt;
    this.thrusters.forEach((t) => {
      const s = t.userData.kind === 'vertical' ? spinV : spinH;
      t.userData.prop.rotation.z += Math.max(s, activity * 3 * dt);
    });

    // Emitir burbujas desde thrusters activos.
    this._tmpV = this._tmpV || new THREE.Vector3();
    this._tmpDir = this._tmpDir || new THREE.Vector3();
    if (activity > 0.05) {
      const emitCount = Math.min(4, Math.ceil(activity * 2));
      for (let e = 0; e < emitCount; e++) {
        // Elegir thrusters según el tipo de movimiento dominante.
        const preferVertical = vert > horiz;
        const pool = this.thrusters.filter((t) =>
          preferVertical ? t.userData.kind === 'vertical' : t.userData.kind === 'horizontal'
        );
        const t = pool[(Math.random() * pool.length) | 0] || this.thrusters[0];
        t.getWorldPosition(this._tmpV);
        // Dirección de expulsión: hacia atrás del vehículo aproximadamente.
        this._tmpDir.set(0, 0, 0.6).applyQuaternion(this.group.quaternion);
        this._emitBubble(this._tmpV, this._tmpDir);
      }
    }

    // Integrar burbujas.
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
