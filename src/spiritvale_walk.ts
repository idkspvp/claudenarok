// Walk around an imported SpiritVale map.
//
// DEV ONLY, and deliberately not in the vite build inputs, the same way
// music_editor.html is: this exists so a human can put their feet on the imported
// world and see whether it holds up, which no amount of triangle counting
// answers. It is not a game mode and ships nothing.
//
// Controls: WASD to move, mouse to look (click to capture), shift to run,
// space to rise, ctrl to sink, F to toggle flying.

import * as THREE from 'three';
import { buildSpiritValeMap, loadBakedMap } from './render/spiritvale_map';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;
const RUN_SPEED = 18;
const GRAVITY = 22;
const JUMP = 7.5;

function statusLine(text: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const mapName = params.get('map') ?? 'Sunny_Meadows_1';
  statusLine(`loading ${mapName}...`);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4e8);
  scene.fog = new THREE.Fog(0x9fc4e8, 120, 420);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x4a4436, 2.0));
  const sun = new THREE.DirectionalLight(0xfff4de, 1.9);
  sun.position.set(80, 160, 60);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1200);

  const baked = await loadBakedMap(mapName, { root: '/spiritvale' });
  const built = await buildSpiritValeMap(baked, { root: '/spiritvale' });
  scene.add(built.group);

  // Stand on the ground rather than guessing a height: raycast down through the
  // terrain, which is the same surface the props were placed against.
  const ray = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const groundAt = (x: number, z: number): number | null => {
    if (!built.terrain) return null;
    ray.set(new THREE.Vector3(x, 500, z), DOWN);
    const hit = ray.intersectObject(built.terrain, true)[0];
    return hit ? hit.point.y : null;
  };

  // Start in the middle of whatever was actually built.
  const box = new THREE.Box3().setFromObject(built.group);
  const centre = box.getCenter(new THREE.Vector3());
  const startY = groundAt(centre.x, centre.z);
  camera.position.set(centre.x, (startY ?? box.min.y) + EYE_HEIGHT, centre.z);

  let yaw = 0;
  let pitch = 0;
  let flying = false;
  let velocityY = 0;
  const keys = new Set<string>();

  renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
  });
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyF') flying = !flying;
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let last = performance.now();
  let frames = 0;
  let fpsClock = last;
  let fps = 0;

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED) * dt;
    if (keys.has('KeyW')) camera.position.addScaledVector(forward, speed);
    if (keys.has('KeyS')) camera.position.addScaledVector(forward, -speed);
    if (keys.has('KeyD')) camera.position.addScaledVector(right, speed);
    if (keys.has('KeyA')) camera.position.addScaledVector(right, -speed);

    if (flying) {
      if (keys.has('Space')) camera.position.y += speed;
      if (keys.has('ControlLeft')) camera.position.y -= speed;
      velocityY = 0;
    } else {
      const ground = groundAt(camera.position.x, camera.position.z);
      if (ground === null) {
        // Off the terrain entirely: hold height rather than fall forever.
        velocityY = 0;
      } else {
        const feet = camera.position.y - EYE_HEIGHT;
        if (feet <= ground + 0.05) {
          camera.position.y = ground + EYE_HEIGHT;
          velocityY = keys.has('Space') ? JUMP : 0;
        } else {
          velocityY -= GRAVITY * dt;
        }
        camera.position.y += velocityY * dt;
        if (camera.position.y - EYE_HEIGHT < ground) camera.position.y = ground + EYE_HEIGHT;
      }
    }

    renderer.render(scene, camera);

    frames++;
    if (now - fpsClock >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsClock));
      frames = 0;
      fpsClock = now;
      const info = renderer.info.render;
      statusLine(
        `${mapName}  ${fps} fps  ${info.calls} draws  ${info.triangles.toLocaleString('en-US')} tris` +
          `  |  ${built.drawCalls} batches, ${built.instances.toLocaleString('en-US')} instances` +
          `  |  x ${camera.position.x.toFixed(0)} y ${camera.position.y.toFixed(0)} z ${camera.position.z.toFixed(0)}` +
          `${flying ? '  [flying]' : ''}`,
      );
    }
    requestAnimationFrame(tick);
  };

  if (built.missing.length) {
    console.warn(`spiritvale: ${built.missing.length} batch(es) could not load`, built.missing);
  }

  // The same dev handle the repo's other browser tooling uses (window.__game), so
  // a puppeteer script can read what was built and step the world without a
  // visible window. requestAnimationFrame does not fire in a headless or hidden
  // tab, so `render()` is exposed rather than assumed.
  (globalThis as unknown as Record<string, unknown>).__spiritvale = {
    map: mapName,
    built,
    scene,
    camera,
    renderer,
    groundAt,
    render: () => {
      renderer.render(scene, camera);
      return { ...renderer.info.render };
    },
    teleport: (x: number, z: number) => {
      const y = groundAt(x, z);
      camera.position.set(x, (y ?? camera.position.y - EYE_HEIGHT) + EYE_HEIGHT, z);
      return camera.position.toArray();
    },
  };

  statusLine(`${mapName} ready: ${built.drawCalls} batches, ${built.instances} instances`);
  requestAnimationFrame(tick);
}

main().catch((err) => {
  statusLine(`failed: ${String(err)}`);
  console.error(err);
});
