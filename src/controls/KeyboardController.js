/**
 * Captura del teclado y traducción a un estado de 6-DOF holonómico.
 *
 * El mapeo se centraliza aquí (fácil de reasignar). Devuelve, cada frame, un
 * objeto normalizado {surge, sway, heave, yaw, pitch, roll} con valores en
 * [-1, 1] según las teclas presionadas.
 *
 * Toggles (se emiten como eventos, no como estado continuo):
 *   L → luces, C → cámara, H → ayuda.
 */

// Mapa de eje → { tecla positiva, tecla negativa }. Usamos `event.code`.
export const KEYMAP = {
  surge: { pos: 'KeyW', neg: 'KeyS' }, // adelante / atrás
  sway: { pos: 'KeyD', neg: 'KeyA' }, // derecha / izquierda
  heave: { pos: 'KeyR', neg: 'KeyF' }, // subir / bajar
  yaw: { pos: 'KeyE', neg: 'KeyQ' }, // guiñada derecha / izquierda
  pitch: { pos: 'ArrowDown', neg: 'ArrowUp' }, // morro arriba / abajo
  roll: { pos: 'ArrowRight', neg: 'ArrowLeft' }, // alabeo derecha / izquierda
};

const TOGGLE_KEYS = {
  KeyL: 'lights',
  KeyC: 'camera',
  KeyH: 'help',
};

export class KeyboardController {
  constructor() {
    this.keys = new Set();
    this.listeners = {}; // { lights: [fn], camera: [fn], help: [fn] }

    this._onDown = (e) => {
      // Evitar el scroll de la página con flechas/espacio.
      if (
        e.code.startsWith('Arrow') ||
        e.code === 'Space' ||
        Object.values(KEYMAP).some((m) => m.pos === e.code || m.neg === e.code)
      ) {
        e.preventDefault();
      }

      if (!this.keys.has(e.code) && TOGGLE_KEYS[e.code]) {
        this._emit(TOGGLE_KEYS[e.code]);
      }
      this.keys.add(e.code);
    };

    this._onUp = (e) => this.keys.delete(e.code);

    // Si la ventana pierde foco, soltar todas las teclas (evita "movimiento pegado").
    this._onBlur = () => this.keys.clear();

    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('blur', this._onBlur);
  }

  on(event, fn) {
    (this.listeners[event] = this.listeners[event] || []).push(fn);
  }

  _emit(event) {
    (this.listeners[event] || []).forEach((fn) => fn());
  }

  /** Estado de 6-DOF para este frame. */
  getInput() {
    const axis = (m) =>
      (this.keys.has(m.pos) ? 1 : 0) - (this.keys.has(m.neg) ? 1 : 0);
    return {
      surge: axis(KEYMAP.surge),
      sway: axis(KEYMAP.sway),
      heave: axis(KEYMAP.heave),
      yaw: axis(KEYMAP.yaw),
      pitch: axis(KEYMAP.pitch),
      roll: axis(KEYMAP.roll),
    };
  }

  dispose() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
