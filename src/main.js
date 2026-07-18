import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './styles.css';

import { Ocean, SURFACE_Y } from './scene/Ocean.js';
import { createLighting } from './scene/Lighting.js';
import { BlueROV2Model } from './robot/BlueROV2Model.js';
import { VehiclePhysics } from './physics/VehiclePhysics.js';
import { KeyboardController } from './controls/KeyboardController.js';
import { CameraRig } from './controls/CameraRig.js';
import { HUD } from './ui/HUD.js';
import { HelpOverlay } from './ui/HelpOverlay.js';

// ---------------------------------------------------------------------------
// Renderer y escena
// ---------------------------------------------------------------------------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();

// Environment map (PMREM): da reflejos suaves e ilumina correctamente los
// materiales metálicos/PBR. Sin esto, los metales se ven casi negros.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, -16, 12);

// ---------------------------------------------------------------------------
// Mundo: iluminación, océano, vehículo
// ---------------------------------------------------------------------------
createLighting(scene);
const ocean = new Ocean(scene, renderer);

const rov = new BlueROV2Model();
scene.add(rov.group);
scene.add(rov.bubbles);

const physics = new VehiclePhysics(new THREE.Vector3(0, -18, 0));
physics.setBounds({
  surfaceY: SURFACE_Y,
  floorFn: (x, z) => ocean.seabedHeightAt(x, z),
});
physics.applyTo(rov.group);

// El "sol" direccional sigue al ROV para que las sombras siempre lo cubran.
// (createLighting devuelve las luces; reobtenemos el DirectionalLight de la escena.)
const sun = scene.children.find((c) => c.isDirectionalLight);

// ---------------------------------------------------------------------------
// Cámara y controles
// ---------------------------------------------------------------------------
const rig = new CameraRig(camera, renderer.domElement, rov);

const keyboard = new KeyboardController();
const hud = new HUD(document.getElementById('hud'));
const help = new HelpOverlay(
  document.getElementById('help'),
  document.getElementById('hint')
);
const camIndicator = document.getElementById('cam-indicator');

function updateCamIndicator(mode) {
  camIndicator.innerHTML =
    mode === 'orbit' ? '◎ Cámara orbital' : '⦿ Cámara piloto (FPV)';
}
updateCamIndicator(rig.mode);

// Toggles emitidos por el teclado.
keyboard.on('lights', () => rov.toggleLights());
keyboard.on('camera', () => updateCamIndicator(rig.toggle()));
keyboard.on('help', () => help.toggle());

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Bucle de animación
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp para evitar saltos

  const input = keyboard.getInput();

  // Física → modelo.
  physics.step(dt, input);
  physics.applyTo(rov.group);

  // Animaciones del vehículo (hélices, burbujas, luces).
  rov.update(dt, input);

  // El sol sigue al ROV (sombras siempre presentes).
  if (sun) {
    sun.position.set(
      rov.group.position.x + 30,
      SURFACE_Y + 120,
      rov.group.position.z + 20
    );
    sun.target.position.copy(rov.group.position);
  }

  // Escena y cámara.
  ocean.update(dt, camera.position);
  rig.update(dt);

  // Telemetría.
  hud.update(physics, dt);

  renderer.render(scene, camera);
}

// Cargar el modelo GLB real y luego arrancar (mantiene la pantalla de carga).
rov
  .load()
  .catch((err) => console.error('Error cargando el modelo BlueROV2:', err))
  .finally(() => {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 900);
    animate();
  });
