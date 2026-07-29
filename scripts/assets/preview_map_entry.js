// Browser half of the map preview: load baked chunk GLBs, frame the whole thing,
// and render it. Bundled by preview_map.mjs and run in headless Chrome, the same
// way the repo's other GLB tooling works.

import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function b64ToAB(b64) {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a.buffer;
}

globalThis.__renderMap = async ({ chunks, terrain, width, height, pitch, yaw, wireframe }) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x141920, 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2420, 2.2));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.set(0.6, 1, 0.35).multiplyScalar(100);
  scene.add(sun);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const root = new THREE.Group();
  scene.add(root);
  let tris = 0;
  let draws = 0;

  for (const c of chunks) {
    const gltf = await loader.parseAsync(b64ToAB(c.glb), '');
    const g = gltf.scene;
    // The baker subtracts the cell origin from its geometry; put it back.
    g.position.set(c.origin[0], c.origin[1], c.origin[2]);
    g.traverse((o) => {
      if (!o.isMesh) return;
      draws++;
      const idx = o.geometry.index;
      tris += idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
      o.material = new THREE.MeshStandardMaterial({
        color: 0xb9b2a4,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
        wireframe: Boolean(wireframe),
      });
    });
    root.add(g);
  }

  // The ground, shaded differently from the props so the two read apart and a
  // prop left floating above the surface is obvious rather than camouflaged.
  if (terrain) {
    const gltf = await loader.parseAsync(b64ToAB(terrain), '');
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      draws++;
      const idx = o.geometry.index;
      tris += idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
      o.material = new THREE.MeshStandardMaterial({
        color: 0x6f7a55,
        roughness: 1,
        metalness: 0,
        wireframe: Boolean(wireframe),
      });
    });
    root.add(gltf.scene);
  }

  // Frame everything.
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, size.y) * 0.5 || 1;

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, radius * 40);
  const p = (pitch ?? 38) * (Math.PI / 180);
  const y = (yaw ?? 35) * (Math.PI / 180);
  const dist = (radius / Math.tan(camera.fov * 0.5 * (Math.PI / 180))) * 1.25;
  camera.position.set(
    centre.x + Math.sin(y) * Math.cos(p) * dist,
    centre.y + Math.sin(p) * dist,
    centre.z + Math.cos(y) * Math.cos(p) * dist,
  );
  camera.lookAt(centre);

  // A north marker, so the reader can tell which way +Z points. That is the
  // whole question a mirrored import raises, and it cannot be answered from an
  // unlabelled render.
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(centre.x, box.min.y, centre.z),
    radius * 0.55,
    0x4ea3ff,
    radius * 0.12,
    radius * 0.07,
  );
  scene.add(arrow);
  const xArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(centre.x, box.min.y, centre.z),
    radius * 0.55,
    0xff6b6b,
    radius * 0.12,
    radius * 0.07,
  );
  scene.add(xArrow);

  renderer.render(scene, camera);
  return {
    png: renderer.domElement.toDataURL('image/png'),
    tris: Math.round(tris),
    draws,
    size: [size.x, size.y, size.z].map((n) => Math.round(n)),
  };
};

globalThis.__ready = true;
