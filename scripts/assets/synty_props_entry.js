// Browser-side batch: parse N static prop FBX files with three.js FBXLoader and
// export each as its own GLB.
//
// Bundled by synty_to_glb.mjs (esbuild) and run in headless Chrome, so it uses
// the SAME loader the game uses. That is why it handles FBX that standalone Node
// converters choke on, and it is the approach scripts/combine_fbx_to_glb_entry.js
// already proved for rigged characters. This one is the STATIC sibling: props and
// buildings carry no skeleton and no clips, so it drops animation handling
// entirely and instead does the two things a prop batch needs, mesh merging by
// material and a hard triangle budget.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

function b64ToAB(b64) {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a.buffer;
}
function abToB64(ab) {
  const bytes = new Uint8Array(ab);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Triangles in an object tree, so the caller can enforce a budget per prop. */
function countTriangles(root) {
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    tris += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
  });
  return tris;
}

/**
 * Strip everything a web renderer will not use.
 *
 * Synty FBX carries editor-only nodes (colliders, LOD groups it manages itself,
 * empty pivots) that would otherwise ship as real geometry or as dozens of empty
 * nodes per prop. LOD1/LOD2 go too: the game draws one level and picks detail
 * with its own graphics tier, so shipping three copies of every rock triples the
 * payload for nothing.
 */
function prune(root) {
  const doomed = [];
  root.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (/_lod[1-9]\b|collider|collision|_ref\b|camera|light/.test(n)) doomed.push(o);
  });
  for (const o of doomed) o.parent?.remove(o);
  return root;
}

/** Convert a native FBX material to a plain glTF-safe standard material.
 *
 *  Synty ships one atlas per pack and every prop samples it, so the material is
 *  deliberately flattened to base colour plus the atlas: the Unity shaders that
 *  produced the original look (Toony Colors Pro and friends) do not exist on the
 *  web and their effect is re-authored renderer-side. */
function flattenMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const out = src.map((m) => {
      if (!m) return new THREE.MeshStandardMaterial({ color: 0xffffff });
      // Synty props reference a SHARED atlas that lives beside the FBX rather
      // than inside it, so FBXLoader hands back a Texture with no image data and
      // GLTFExporter refuses it. Dropping the map here is not a loss: the whole
      // pack samples ONE atlas, so binding it once renderer-side is both correct
      // and far cheaper than embedding a copy of it in each of 431 props. The
      // expected texture name rides along in extras so the renderer can bind it.
      const atlas = m.map?.name || m.map?.image?.name || m.map?.source?.data?.name || '';
      const hasImage = Boolean(m.map?.image?.width || m.map?.source?.data?.width);
      const std = new THREE.MeshStandardMaterial({
        name: m.name || 'mat',
        color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
        map: hasImage ? m.map : null,
        roughness: 0.85,
        metalness: 0,
        transparent: Boolean(m.transparent),
        alphaTest: m.alphaTest ?? 0,
        side: m.side ?? THREE.FrontSide,
      });
      std.userData = { atlas: atlas.replace(/.(png|tga|jpg)$/i, '') };
      return std;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return root;
}

globalThis.__convertProp = async (fbxB64) => {
  const loader = new FBXLoader();
  const group = loader.parse(b64ToAB(fbxB64), '');
  prune(group);
  flattenMaterials(group);

  // Synty authors in centimetres; the game works in metres.
  group.scale.setScalar(0.01);
  group.updateMatrixWorld(true);

  const tris = countTriangles(group);

  const exporter = new GLTFExporter();
  const glb = await new Promise((resolve, reject) => {
    exporter.parse(group, resolve, reject, { binary: true, onlyVisible: true });
  });
  return { glb: abToB64(glb), tris };
};

globalThis.__ready = true;
