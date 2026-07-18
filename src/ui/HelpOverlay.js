/**
 * Overlay de ayuda: muestra el mapeo de teclas de los 6 grados de libertad y
 * los toggles. Se abre/cierra con `H`. Visible al arrancar la primera vez.
 */
export class HelpOverlay {
  constructor(el, hintEl) {
    this.el = el;
    this.hintEl = hintEl;
    this.el.innerHTML = `
      <h2>Controles · 6 Grados de Libertad</h2>
      <table>
        <tr><td class="section-label" colspan="2">Traslación</td></tr>
        <tr><td class="keys"><span class="key">W</span><span class="key">S</span></td><td class="desc">Avance / retroceso (surge)</td></tr>
        <tr><td class="keys"><span class="key">A</span><span class="key">D</span></td><td class="desc">Desplazamiento lateral (sway)</td></tr>
        <tr><td class="keys"><span class="key">R</span><span class="key">F</span></td><td class="desc">Ascenso / descenso (heave)</td></tr>
        <tr><td class="section-label" colspan="2">Rotación</td></tr>
        <tr><td class="keys"><span class="key">Q</span><span class="key">E</span></td><td class="desc">Guiñada izq. / der. (yaw)</td></tr>
        <tr><td class="keys"><span class="key">↑</span><span class="key">↓</span></td><td class="desc">Cabeceo morro abajo / arriba (pitch)</td></tr>
        <tr><td class="keys"><span class="key">←</span><span class="key">→</span></td><td class="desc">Alabeo izq. / der. (roll)</td></tr>
        <tr><td class="section-label" colspan="2">Sistema</td></tr>
        <tr><td class="keys"><span class="key">L</span></td><td class="desc">Encender / apagar focos</td></tr>
        <tr><td class="keys"><span class="key">C</span></td><td class="desc">Cambiar cámara (orbital / piloto)</td></tr>
        <tr><td class="keys"><span class="key">H</span></td><td class="desc">Mostrar / ocultar esta ayuda</td></tr>
      </table>
      <div class="foot">Movimiento holonómico · combina teclas libremente · arrastra con el ratón para orbitar</div>
    `;

    // Mostrar al inicio; ocultar automáticamente tras unos segundos si no se cerró.
    this.visible = true;
    this.el.classList.add('visible');
    this._autoHide = setTimeout(() => {
      if (this.visible) this.toggle();
    }, 6000);
  }

  toggle() {
    if (this._autoHide) {
      clearTimeout(this._autoHide);
      this._autoHide = null;
    }
    this.visible = !this.visible;
    this.el.classList.toggle('visible', this.visible);
    // Ocultar la pista inferior una vez que el usuario ya conoce la ayuda.
    if (this.hintEl) this.hintEl.style.display = this.visible ? 'none' : '';
  }
}
