// Build a SpiritVale map into a Three scene graph, from the baked instance table.
//
// The table is authoritative and comes from the offline pipeline
// (scripts/assets/build_map_instances.mjs). It already resolved which atlas each
// placement samples, composed every world transform up the prefab's parent chain,
// dropped the reduced LOD levels and the skydome-scale scenery, and grouped the
// result into batches of one mesh, one atlas and one cell. Nothing here re-decides
// any of that; this fetches what the table names and draws it.
//
// ONE InstancedMesh PER BATCH. A cell holds 709 copies of the same castle wall in
// the busiest map, and drawing them merged would keep 709 copies of that wall's
// vertices resident: 201 MiB against 17.58 on Nevaris. Instancing pays one
// geometry and a transform per copy, which is what makes the map fit on a phone.

import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Position(3) + quaternion(4) + scale(3), matching build_map_instances. */
export const INSTANCE_STRIDE = 10;

export interface BakedBatch {
  mesh: string;
  /** One atlas name per submesh, in submesh order. */
  atlases: string[];
  cell: string;
  /** Flat, INSTANCE_STRIDE numbers per copy. */
  instances: number[];
}

export interface BakedMap {
  map: string;
  chunkSize: number;
  batches: BakedBatch[];
  terrain: { file: string; origin: number[]; size: number[] } | null;
}

export interface MapBuildResult {
  group: THREE.Group;
  terrain: THREE.Object3D | null;
  /** One per InstancedMesh, which is one draw call. */
  drawCalls: number;
  instances: number;
  triangles: number;
  /** Batches whose mesh or atlas could not be fetched, named rather than hidden. */
  missing: string[];
}

/** One primitive of a prop, plus the node transform that scales it. */
export interface PropPart {
  geometry: THREE.BufferGeometry;
  nodeMatrix: THREE.Matrix4;
}

export interface MapAssetUrls {
  /** e.g. `/spiritvale` */
  root: string;
}

/** Fetch and parse the baked table for one map. */
export async function loadBakedMap(map: string, urls: MapAssetUrls): Promise<BakedMap> {
  const res = await fetch(`${urls.root}/maps/${map}.json`);
  if (!res.ok) throw new Error(`spiritvale map ${map}: ${res.status} ${res.statusText}`);
  return (await res.json()) as BakedMap;
}

/** The on-disk basename a prop's GLB uses, matching the converter. */
export function propFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_');
}

function makeLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/** Load an atlas as a texture configured the way this art needs it.
 *
 *  flipY is off because the source is a Unity atlas, whose V axis runs the other
 *  way, and wrapping is Repeat because 543 of the meshes genuinely tile: clamping
 *  them would collapse every repeat onto one edge, which is the same damage the
 *  converter's old UV clamp did. */
export function configureAtlas(texture: THREE.Texture): THREE.Texture {
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Write one batch's flat instance array into an InstancedMesh's matrices. */
export function applyInstances(
  target: THREE.InstancedMesh,
  instances: number[],
  nodeMatrix?: THREE.Matrix4,
): number {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const count = Math.floor(instances.length / INSTANCE_STRIDE);
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE;
    p.set(instances[o], instances[o + 1], instances[o + 2]);
    q.set(instances[o + 3], instances[o + 4], instances[o + 5], instances[o + 6]);
    s.set(instances[o + 7], instances[o + 8], instances[o + 9]);
    m.compose(p, q, s);
    // The prop node carries the dequantization transform, so it applies BEFORE
    // the placement: world = placement * node.
    if (nodeMatrix) m.multiply(nodeMatrix);
    target.setMatrixAt(i, m);
  }
  target.instanceMatrix.needsUpdate = true;
  return count;
}

/** Build the whole map. Props and atlases are fetched once each and shared across
 *  every batch that names them, which is the point of a shared pool. */
export async function buildSpiritValeMap(
  baked: BakedMap,
  urls: MapAssetUrls,
): Promise<MapBuildResult> {
  const loader = makeLoader();
  const textureLoader = new THREE.TextureLoader();
  const group = new THREE.Group();
  group.name = `spiritvale:${baked.map}`;

  const geometryCache = new Map<string, PropPart[] | null>();
  const textureCache = new Map<string, THREE.Texture | null>();
  const missing: string[] = [];

  /** Every primitive of a prop, in submesh order, each with the node transform
   *  that scales it.
   *
   *  THE NODE MATRIX IS NOT BAKED INTO THE GEOMETRY, and that is deliberate.
   *  These GLBs carry KHR_mesh_quantization: POSITION is a NORMALIZED int16 whose
   *  compensating scale sits on the node, and three applies that normalization in
   *  the shader. Calling geometry.applyMatrix4 multiplies the raw integers
   *  instead, so the node scale lands twice and every prop renders a fraction of
   *  its size, a castle wall reduced to a speck while the map extent still looks
   *  correct. Folding the node matrix into the INSTANCE matrix leaves the
   *  attribute untouched and lets three decode it as designed. */
  async function propGeometries(mesh: string): Promise<PropPart[] | null> {
    const key = propFileName(mesh);
    const hit = geometryCache.get(key);
    if (hit !== undefined) return hit;
    let out: PropPart[] | null = null;
    try {
      const gltf = await loader.loadAsync(`${urls.root}/props/${key}.glb`);
      const parts: PropPart[] = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        const asMesh = o as THREE.Mesh;
        if (!asMesh.isMesh) return;
        parts.push({ geometry: asMesh.geometry, nodeMatrix: asMesh.matrixWorld.clone() });
      });
      out = parts.length ? parts : null;
    } catch {
      out = null;
    }
    geometryCache.set(key, out);
    return out;
  }

  async function atlasTexture(name: string): Promise<THREE.Texture | null> {
    if (!name) return null;
    const hit = textureCache.get(name);
    if (hit !== undefined) return hit;
    let tex: THREE.Texture | null = null;
    try {
      tex = configureAtlas(await textureLoader.loadAsync(`${urls.root}/atlas/${name}.webp`));
    } catch {
      tex = null;
    }
    textureCache.set(name, tex);
    return tex;
  }

  const materialCache = new Map<string, THREE.Material>();
  async function atlasMaterial(name: string): Promise<THREE.Material> {
    const cached = materialCache.get(name);
    if (cached) return cached;
    const map = await atlasTexture(name);
    const mat = new THREE.MeshLambertMaterial({
      map,
      // Untextured batches read grey rather than blending in, so a missing atlas
      // is visible instead of quietly looking like art.
      color: map ? 0xffffff : 0xb9b2a4,
      vertexColors: false,
      side: THREE.FrontSide,
    });
    materialCache.set(name, mat);
    return mat;
  }

  let drawCalls = 0;
  let instances = 0;
  let triangles = 0;

  for (const batch of baked.batches) {
    const parts = await propGeometries(batch.mesh);
    if (!parts) {
      missing.push(batch.mesh);
      continue;
    }
    const count = Math.floor(batch.instances.length / INSTANCE_STRIDE);
    if (!count) continue;
    for (const [si, part] of parts.entries()) {
      const geo = part.geometry;
      const material = await atlasMaterial(batch.atlases[si] ?? batch.atlases[0] ?? '');
      // Vertex colour only where the geometry actually has it; Synty shades with
      // it and the converter keeps it for that reason.
      const usesColor = Boolean(geo.getAttribute('color'));
      const mat = usesColor
        ? Object.assign((material as THREE.MeshLambertMaterial).clone(), { vertexColors: true })
        : material;
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.name = `${batch.mesh}#${si}@${batch.cell}`;
      // The table groups by cell, so per-batch culling is per-cell culling.
      inst.frustumCulled = true;
      applyInstances(inst, batch.instances, part.nodeMatrix);
      inst.computeBoundingSphere();
      group.add(inst);
      drawCalls++;
      const idx = geo.getIndex();
      triangles += ((idx ? idx.count : geo.getAttribute('position').count) / 3) * count;
    }
    instances += count;
  }

  let terrain: THREE.Object3D | null = null;
  if (baked.terrain) {
    try {
      const gltf = await loader.loadAsync(`${urls.root}/terrain/${baked.terrain.file}`);
      terrain = gltf.scene;
      terrain.traverse((o) => {
        const asMesh = o as THREE.Mesh;
        if (!asMesh.isMesh) return;
        asMesh.material = new THREE.MeshLambertMaterial({ color: 0x6f7a55 });
      });
      group.add(terrain);
      drawCalls++;
    } catch {
      missing.push(`terrain:${baked.terrain.file}`);
    }
  }

  return { group, terrain, drawCalls, instances, triangles: Math.round(triangles), missing };
}
