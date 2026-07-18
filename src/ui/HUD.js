/**
 * HUD de telemetría: profundidad, rumbo (con brújula), pitch/roll, velocidad y
 * posición XYZ. Se actualiza cada frame desde el estado de VehiclePhysics.
 */
export class HUD {
  constructor(el) {
    this.el = el;
    this.el.innerHTML = `
      <h2>Telemetría · BlueROV2</h2>
      <div class="hud-row"><span class="label">Profundidad</span><span class="value" data-f="depth">0.0<small>m</small></span></div>
      <div class="hud-row"><span class="label">Rumbo</span><span class="value" data-f="heading">000<small>°</small></span></div>
      <div class="hud-row"><span class="label">Cabeceo</span><span class="value" data-f="pitch">0<small>°</small></span></div>
      <div class="hud-row"><span class="label">Alabeo</span><span class="value" data-f="roll">0<small>°</small></span></div>
      <div class="hud-row"><span class="label">Velocidad</span><span class="value" data-f="speed">0.00<small>m/s</small></span></div>
      <div class="hud-row"><span class="label">Posición</span><span class="value" data-f="pos" style="font-size:11px">0, 0, 0</span></div>
      <div class="compass">
        <div class="ticks" data-f="ticks"></div>
        <div class="needle"></div>
      </div>
    `;
    this.refs = {};
    this.el.querySelectorAll('[data-f]').forEach((n) => {
      this.refs[n.dataset.f] = n;
    });

    // Construir marcas de brújula (cada 30°, doble vuelta para desplazamiento).
    const labels = ['N', '30', '60', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
    let html = '';
    for (let rep = 0; rep < 3; rep++) {
      for (const l of labels) html += `<span>${l}</span>`;
    }
    this.refs.ticks.innerHTML = html;

    this._acc = 0;
  }

  update(physics, dt) {
    // Refrescar el texto a ~15 Hz para que los números sean legibles.
    this._acc += dt;
    if (this._acc < 0.066) return;
    this._acc = 0;

    const e = physics.eulerDeg;
    this.refs.depth.innerHTML = `${physics.depth.toFixed(1)}<small>m</small>`;
    this.refs.heading.innerHTML = `${String(Math.round(e.heading)).padStart(3, '0')}<small>°</small>`;
    this.refs.pitch.innerHTML = `${e.pitch >= 0 ? '+' : ''}${e.pitch.toFixed(0)}<small>°</small>`;
    this.refs.roll.innerHTML = `${e.roll >= 0 ? '+' : ''}${e.roll.toFixed(0)}<small>°</small>`;
    this.refs.speed.innerHTML = `${physics.speed.toFixed(2)}<small>m/s</small>`;
    const p = physics.position;
    this.refs.pos.textContent = `${p.x.toFixed(0)}, ${(-p.y).toFixed(0)}, ${p.z.toFixed(0)}`;

    // Desplazar la cinta de la brújula según el rumbo. Cada etiqueta = 40px = 30°.
    // La cinta tiene 3 vueltas (0–1080°); centramos sobre la vuelta central para
    // que nunca se agoten las etiquetas a los lados de la aguja.
    const pxPerDeg = 40 / 30;
    const px = (e.heading + 360) * pxPerDeg + 20; // +20 = media etiqueta
    this.refs.ticks.style.transform = `translateX(${-px}px)`;
  }
}
