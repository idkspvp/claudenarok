// Bake each map's Unity terrain into a ground mesh GLB.
//
// The ground is the one thing a rebuilt map cannot do without, and it was
// missing from all of this: 38 of the 53 maps carry a Terrain component (Unity
// class 218) whose geometry is not a mesh at all but a heightfield inside a
// binary TerrainData asset. Every prop was importing correctly and floating over
// nothing.
//
// TWO VALUES HERE WERE MEASURED, NOT ASSUMED, because both have a plausible
// wrong answer that still renders:
//
//   * The height divisor is 32767, not 65535. Unity stores a heightmap sample as
//     a signed 16-bit value over 0..1, and picking the wrong one halves or
//     doubles the world height while still producing a believable landscape.
//     Settled against the props: trees and rocks were hand-placed ON the ground,
//     and at /32767 they sit a median 0.55 m off the surface, versus 6.49 m at
//     /65535.
//   * Heights are indexed [z * res + x]. The transposed reading is also a valid
//     landscape, just mirrored about the diagonal.
//
// RESOLUTION IS REDUCED ON PURPOSE. A 513x513 heightfield is 263k vertices and
// 524k triangles per map, which is more than the whole prop budget for a map and
// far past what the terrain's own shape justifies. This resamples to a target
// world SPACING and reports the height error that costs, so the trade is visible
// rather than assumed.
//
// USAGE
//   node scripts/assets/unity_terrain_to_glb.mjs <bundlesDir> <outDir>
//     --guid-map <guid_map.json>
//     [--spacing <metres>]   target grid spacing, default 2.5
//     [--max-res <n>]        cap on samples per side, default 257
//     [--maps <a,b,c>]
//
// Emits <outDir>/<map>.glb plus <outDir>/index.json carrying each terrain's
// world origin and size, which is what places it beside the baked prop chunks.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { decompose, matMul, trs } from './transform_math.mjs';
import { readObject, readSerializedFile } from './unity_serialized.mjs';

/** Unity stores a heightmap sample as a signed 16-bit value over 0..1. */
export const HEIGHT_DIVISOR = 32767;

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--guid-map', '--spacing', '--max-res', '--maps']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));

const NUM = '(-?[\\d.eE+-]+)';
const vec = (b, k) => {
  const m = b.match(new RegExp(`${k}: \\{x: ${NUM}, y: ${NUM}, z: ${NUM}(?:, w: ${NUM})?\\}`));
  if (!m) return null;
  const o = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] !== undefined) o.push(Number(m[4]));
  return o;
};
const ref = (b, k) => b.match(new RegExp(`${k}: \\{fileID: (\\d+)`))?.[1] ?? null;

/** The Terrain components in a map prefab, with the world transform of each and
 *  the guid of the TerrainData it draws. */
export function findTerrains(text) {
  const re = /^--- !u!(\d+) &(\d+)/gm;
  const heads = [];
  let m = re.exec(text);
  while (m) {
    heads.push({ c: Number(m[1]), a: m[2], at: m.index });
    m = re.exec(text);
  }
  const bodyOf = (i) => text.slice(heads[i].at, heads[i + 1]?.at ?? text.length);

  const transforms = new Map();
  const terrains = [];
  for (let i = 0; i < heads.length; i++) {
    const b = bodyOf(i);
    if (heads[i].c === 4) {
      transforms.set(heads[i].a, {
        go: ref(b, 'm_GameObject'),
        parent: ref(b, 'm_Father'),
        pos: vec(b, 'm_LocalPosition'),
        rot: vec(b, 'm_LocalRotation'),
        scale: vec(b, 'm_LocalScale'),
      });
    } else if (heads[i].c === 218) {
      const guid = b.match(/m_TerrainData: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
      const go = ref(b, 'm_GameObject');
      if (guid && go) terrains.push({ guid, go });
    }
  }

  const anchorOfGo = new Map();
  for (const [a, t] of transforms) if (t.go) anchorOfGo.set(t.go, a);
  const worldOf = (anchor, guard = 0) => {
    const t = transforms.get(anchor);
    if (!t || guard > 64) return null;
    let mm = trs(t.pos ?? [0, 0, 0], t.rot ?? [0, 0, 0, 1], t.scale ?? [1, 1, 1]);
    if (t.parent && t.parent !== '0') {
      const p = worldOf(t.parent, guard + 1);
      if (p) mm = matMul(p, mm);
    }
    return mm;
  };

  return terrains.map((t) => {
    const w = worldOf(anchorOfGo.get(t.go));
    return { guid: t.guid, world: w ? decompose(w) : null };
  });
}

/** Heights, resolution and world scale from a binary TerrainData asset. */
export function readTerrainData(buf) {
  const file = readSerializedFile(buf);
  const obj = file.objects.find((o) => file.types[o.typeIndex].classId === 156);
  if (!obj) throw new Error('no TerrainData object in this file');
  const read = readObject(file, obj, (p) => /m_Heights|m_Scale/.test(p));
  if (read.consumed !== read.expected) {
    // The walk desynchronising means the layout was misread, and every value
    // after that point is garbage. Refuse rather than emit a plausible terrain.
    throw new Error(`type tree walk consumed ${read.consumed} of ${read.expected} bytes`);
  }
  const hm = read.value.m_Heightmap;
  const heights = hm?.m_Heights?.typedArray;
  if (!heights) throw new Error('no heightmap');
  const res = Math.round(Math.sqrt(heights.length));
  if (res * res !== heights.length) throw new Error(`heightmap is not square: ${heights.length}`);
  return { heights, res, scale: hm.m_Scale };
}

/** Bilinear sample in grid coordinates. Unity indexes heights as [z * res + x]. */
function sampleGrid(heights, res, fx, fz) {
  const x0 = Math.max(0, Math.min(res - 1, Math.floor(fx)));
  const z0 = Math.max(0, Math.min(res - 1, Math.floor(fz)));
  const x1 = Math.min(res - 1, x0 + 1);
  const z1 = Math.min(res - 1, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const h00 = heights[z0 * res + x0];
  const h10 = heights[z0 * res + x1];
  const h01 = heights[z1 * res + x0];
  const h11 = heights[z1 * res + x1];
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

/** Resample a heightfield to `out` samples per side, and report the worst height
 *  error the reduction introduces, in metres. */
export function resample(heights, res, out, scaleY) {
  const grid = new Float32Array(out * out);
  const step = (res - 1) / (out - 1);
  for (let z = 0; z < out; z++) {
    for (let x = 0; x < out; x++) {
      grid[z * out + x] = sampleGrid(heights, res, x * step, z * step);
    }
  }
  // Error is measured at the ORIGINAL samples: reconstruct each from the reduced
  // grid and take the worst disagreement.
  let worst = 0;
  let sum = 0;
  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const recon = sampleGrid(grid, out, x / step, z / step);
      const err = Math.abs(recon - heights[z * res + x]);
      sum += err;
      if (err > worst) worst = err;
    }
  }
  const toMetres = (v) => (v / HEIGHT_DIVISOR) * scaleY;
  return { grid, worstError: toMetres(worst), meanError: toMetres(sum / (res * res)) };
}

/** Build positions, normals and indices for a terrain grid, in terrain-local
 *  metres with the origin at the terrain's own corner.
 *
 *  `spanX`/`spanZ` are the world size the grid covers, and `heightScale` is
 *  Unity's m_Scale.y. The reduced grid covers the SAME ground as the original, so
 *  its step is the span divided by its own sample count, never the source's. */
export function buildTerrainMesh(grid, out, spanX, spanZ, heightScale) {
  const position = new Float32Array(out * out * 3);
  const normal = new Float32Array(out * out * 3);
  const stepX = spanX / (out - 1);
  const stepZ = spanZ / (out - 1);
  const hAt = (x, z) =>
    (grid[Math.max(0, Math.min(out - 1, z)) * out + Math.max(0, Math.min(out - 1, x))] /
      HEIGHT_DIVISOR) *
    heightScale;

  for (let z = 0; z < out; z++) {
    for (let x = 0; x < out; x++) {
      const i = (z * out + x) * 3;
      position[i] = x * stepX;
      position[i + 1] = hAt(x, z);
      position[i + 2] = z * stepZ;
      // Central differences give the surface gradient; the normal is its cross.
      const dx = (hAt(x + 1, z) - hAt(x - 1, z)) / (2 * stepX);
      const dz = (hAt(x, z + 1) - hAt(x, z - 1)) / (2 * stepZ);
      const len = Math.hypot(-dx, 1, -dz) || 1;
      normal[i] = -dx / len;
      normal[i + 1] = 1 / len;
      normal[i + 2] = -dz / len;
    }
  }

  const quads = (out - 1) * (out - 1);
  const indices = quads * 4 > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
  let k = 0;
  for (let z = 0; z < out - 1; z++) {
    for (let x = 0; x < out - 1; x++) {
      const a = z * out + x;
      const b = a + 1;
      const c = a + out;
      const d = c + 1;
      // Counter-clockwise when seen from above, so the +Y normals agree.
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  }
  return { position, normal, indices, tris: quads * 2 };
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [bundlesDir, outDir] = positional;
  const guidMapPath = flag('--guid-map');
  if (!bundlesDir || !outDir || !guidMapPath) {
    console.log(
      'usage: node scripts/assets/unity_terrain_to_glb.mjs <bundlesDir> <outDir> --guid-map <f> [--spacing m] [--max-res n] [--maps a,b]',
    );
    process.exit(1);
  }
  const spacing = Number(flag('--spacing', '2.5'));
  const maxRes = Number(flag('--max-res', '257'));
  const only = flag('--maps')
    ?.split(',')
    .map((s) => s.trim());

  const guidMap = JSON.parse(readFileSync(guidMapPath, 'utf8'));
  const assetsRoot = path.resolve(bundlesDir, '..');

  const found = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith('.prefab') && p.includes('_Maps')) found.push(p);
    }
  };
  walk(bundlesDir);
  found.sort();

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  mkdirSync(outDir, { recursive: true });
  const index = [];
  let skipped = 0;

  for (const file of found) {
    const mapName = path.basename(file, '.prefab');
    if (only && !only.includes(mapName)) continue;
    let terrains;
    try {
      terrains = findTerrains(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`  FAIL ${mapName}: ${String(err.message).slice(0, 120)}`);
      continue;
    }
    if (!terrains.length) {
      skipped++;
      continue;
    }
    // Every map in this set has exactly one terrain; take the first and say so
    // if that ever stops being true rather than silently dropping the rest.
    if (terrains.length > 1)
      console.error(`  note ${mapName}: ${terrains.length} terrains, using the first`);
    const t = terrains[0];
    const entry = guidMap[t.guid];
    if (!entry) {
      console.error(`  FAIL ${mapName}: TerrainData guid ${t.guid} not in the guid map`);
      continue;
    }

    let data;
    try {
      data = readTerrainData(readFileSync(path.join(assetsRoot, entry.path)));
    } catch (err) {
      console.error(`  FAIL ${mapName}: ${String(err.message).slice(0, 120)}`);
      continue;
    }

    const spanX = (data.res - 1) * data.scale.x;
    const spanZ = (data.res - 1) * data.scale.z;
    const target = Math.max(
      33,
      Math.min(maxRes, data.res, 2 ** Math.ceil(Math.log2(Math.max(spanX, spanZ) / spacing)) + 1),
    );
    const { grid, worstError, meanError } = resample(data.heights, data.res, target, data.scale.y);
    const mesh = buildTerrainMesh(grid, target, spanX, spanZ, data.scale.y);

    const doc = new Document();
    const buffer = doc.createBuffer();
    const prim = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(mesh.position).setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(mesh.normal).setBuffer(buffer),
      )
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(mesh.indices).setBuffer(buffer));
    const node = doc
      .createNode(mapName)
      .setMesh(doc.createMesh(mapName).addPrimitive(prim))
      .setTranslation([t.world?.pos[0] ?? 0, t.world?.pos[1] ?? 0, t.world?.pos[2] ?? 0]);
    doc.createScene().addChild(node);
    await doc.transform(meshopt({ encoder: MeshoptEncoder }));

    const out = path.join(outDir, `${mapName}.glb`);
    writeFileSync(out, await io.writeBinary(doc));
    const bytes = statSync(out).size;
    index.push({
      map: mapName,
      res: target,
      sourceRes: data.res,
      origin: t.world?.pos.map((v) => Math.round(v * 1e4) / 1e4) ?? [0, 0, 0],
      size: [Math.round(spanX * 100) / 100, data.scale.y, Math.round(spanZ * 100) / 100],
      tris: mesh.tris,
      bytes,
      worstErrorM: Math.round(worstError * 100) / 100,
      meanErrorM: Math.round(meanError * 1000) / 1000,
    });
    console.log(
      `  ${mapName.padEnd(24)} ${String(data.res).padStart(4)} -> ${String(target).padStart(3)}  ` +
        `${String(mesh.tris).padStart(7)} tris  ${(bytes / 1024).toFixed(0).padStart(5)} KiB  ` +
        `err mean ${meanError.toFixed(2)} m worst ${worstError.toFixed(2)} m`,
    );
  }

  index.sort((a, b) => a.map.localeCompare(b.map));
  writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  const totalBytes = index.reduce((a, m) => a + m.bytes, 0);
  const totalTris = index.reduce((a, m) => a + m.tris, 0);
  console.log(
    `\nunity_terrain_to_glb: ${index.length} terrains, ${totalTris.toLocaleString('en-US')} tris, ` +
      `${(totalBytes / 1024 / 1024).toFixed(2)} MiB  (${skipped} maps have no terrain)`,
  );
}
