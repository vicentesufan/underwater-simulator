# 🌊 Underwater Simulator · BlueROV2

Simulador **visual** de robótica marina hecho con [Three.js](https://threejs.org/).
Pilota un **BlueROV2** con movimiento **holonómico en los 6 grados de libertad**
dentro de un ambiente submarino realista. Pensado para desplegarse gratis en la web
y ser accesible desde cualquier navegador.

No resuelve hidrodinámica exacta: usa una física "de sensación" (inercia + arrastre
del agua) para que el manejo se sienta creíble sin cálculos pesados.

![captura](docs/preview.png)

## ✨ Características

- **Modelo BlueROV2 real**: geometría CAD del vehículo (STL → GLB decimado a ~272k
  triángulos, ~4.9 MB) coloreada por regiones con los colores reales (frame negro
  HDPE, espuma de flotación azul, carcasas y thrusters). Ver
  [`src/robot/BlueROV2Model.js`](src/robot/BlueROV2Model.js).
- **Movimiento holonómico 6-DOF**: surge, sway, heave, yaw, pitch y roll independientes.
- **Física sencilla**: aceleración en el marco del cuerpo, arrastre viscoso, flotación
  neutra y auto-enderezamiento pasivo. Todos los parámetros son fáciles de tunear en
  [`src/physics/VehiclePhysics.js`](src/physics/VehiclePhysics.js).
- **Ambiente submarino rico**: niebla por profundidad, lecho marino con relieve,
  cáusticas animadas, partículas en suspensión, rayos de luz, rocas y superficie del agua.
- **HUD de telemetría**: profundidad, rumbo (con brújula), cabeceo/alabeo, velocidad y posición.
- **Cámara conmutable**: orbital externa ⟷ primera persona (piloto).
- **Focos del ROV** encendibles con conos de luz visibles y **burbujas** en los thrusters.

## 🎮 Controles

| Tecla | Acción |
|-------|--------|
| `W` / `S` | Avance / retroceso (surge) |
| `A` / `D` | Desplazamiento lateral (sway) |
| `R` / `F` | Ascenso / descenso (heave) |
| `Q` / `E` | Guiñada izquierda / derecha (yaw) |
| `↑` / `↓` | Cabeceo morro abajo / arriba (pitch) |
| `←` / `→` | Alabeo izquierda / derecha (roll) |
| `L` | Encender / apagar focos |
| `C` | Cambiar cámara (orbital / piloto) |
| `H` | Mostrar / ocultar la ayuda |
| Ratón | Arrastrar para orbitar · rueda para zoom (modo orbital) |

Las teclas se combinan libremente (movimiento holonómico). El mapeo está centralizado
en [`src/controls/KeyboardController.js`](src/controls/KeyboardController.js).

## 🚀 Uso local

Requiere **Node.js 18+**.

```bash
npm install
npm run dev        # servidor de desarrollo (abre la URL que imprime Vite)
```

Para generar el build de producción:

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ localmente para probar
```

## 🌐 Despliegue gratis

El proyecto es **100% estático** (sin backend). El `dist/` se puede subir a cualquier
hosting estático.

### GitHub Pages (incluido)

```bash
npm run deploy     # build + publica dist/ en la rama gh-pages
```

Luego, en el repositorio de GitHub → **Settings → Pages**, selecciona la rama
`gh-pages`. `vite.config.js` usa `base: './'`, así que funciona en el subpath de Pages
sin configuración extra.

### Netlify / Vercel / otros

- Arrastra la carpeta `dist/` a [Netlify Drop](https://app.netlify.com/drop), **o**
- conecta el repositorio con build command `npm run build` y publish directory `dist`.

## 🗂️ Estructura

```
src/
  main.js                 Bootstrap: renderer, escena, env map, bucle de animación
  scene/                  Océano, iluminación, cáusticas, partículas, gradiente
  robot/BlueROV2Model.js  Carga el GLB real, colorea por regiones, luces, burbujas
  assets/bluerov2.glb     Modelo CAD del BlueROV2 (decimado)
  physics/VehiclePhysics  Cinemática 6-DOF holonómica (parámetros tuneables)
  controls/               Teclado y rig de cámara (orbital / FPV)
  ui/                     HUD de telemetría y overlay de ayuda
  utils/noise.js          Ruido simplex (lecho, cáusticas, arena) — sin dependencias
```

> El GLB se generó a partir del STL de SolidWorks del usuario (`docs/*.STL`),
> decimado con `fast-simplification` y exportado con `trimesh`. Los archivos CAD
> fuente son muy pesados y están excluidos del repositorio (ver `.gitignore`).

## 🔧 Ideas para extender

- Cargar un modelo `.glb` real del BlueROV2 (la estructura ya aísla el modelo).
- Corrientes marinas que empujen al vehículo.
- Objetos de misión (aros, tuberías) y cronómetro para practicar pilotaje.
- Soporte de gamepad/joystick reutilizando el estado normalizado de 6-DOF.

## 📄 Licencia

MIT.
