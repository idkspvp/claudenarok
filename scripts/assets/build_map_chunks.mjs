// Bake a map layout plus its prop GLBs into merged per-chunk GLBs.
//
// WHY OFFLINE. The draw-call problem these maps pose is not repetition, it is
// VARIETY: the largest town draws 498 distinct meshes, so instancing collapses
// nothing and spatial chunking alone made it worse (measured: 498 flat, 814
// chunked at 32m, both against a ~150-call frame baseline). What works is
// merging every prop in a cell into ONE geometry, which is possible because the
// source's props share a single atlas material. Within 60 metres that takes the
// same map from 498 draws to 16.
//
// Doing that merge in the browser would mean fetching hundreds of GLBs and
// welding them on the main thread at map entry. Doing it here means the client
// fetches a handful of already-merged chunks and draws each in one call.
//
// USAGE
//   node scripts/assets/build_map_chunks.mjs <layoutDir> <propGlbDir> <outDir>
//     [--chunk <metres>]     cell size, default 64
//     [--maps <a,b,c>]       only these maps
//     [--max-tris <n>]       split a cell that exceeds this, default 120000
//     [--limit <n>]
//
// Emits <outDir>/<map>/<cx>_<cz>[_<part>].glb plus <outDir>/<map>/chunks.json
// carrying each chunk's bounds and triangle count, which is what the renderer
// culls and budgets against.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--chunk', '--maps', '--max-tris', '--limit']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));

/** Quaternion (xyzw) + translation + scale to a column-major 4x4, the layout
 *  glTF and Three both use. Written out rather than pulled from a matrix library
 *  so this script stays dependency-light and the maths is auditable. */
function trs(pos, rot, scl) {
  const [x, y, z, w] = rot;
  const [sx, sy, sz] = scl;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    pos[0],
    pos[1],
    pos[2],
    1,
  ];
}

const applyMat = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
/** Directions ignore translation. Not the inverse-transpose: these transforms are
 *  rotation plus a uniform-or-near-uniform scale, and renormalising covers it. */
const applyDir = (m, x, y, z) => {
  const v = [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
};

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [layoutDir, propDir, outDir] = positional;
  if (!layoutDir || !propDir || !outDir) {
    console.log(
      'usage: node scripts/assets/build_map_chunks.mjs <layoutDir> <propGlbDir> <outDir>',
    );
    process.exit(1);
  }
  const chunkSize = Number(flag('--chunk', '64'));
  const maxTris = Number(flag('--max-tris', '120000'));
  const only = flag('--maps')
    ?.split(',')
    .map((s) => s.trim());
  const limit = Number(flag('--limit', '0'));

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  /** Prop geometry, read once and reused across every map that places it. */
  const propCache = new Map();
  async function loadProp(name) {
    if (propCache.has(name)) return propCache.get(name);
    const file = path.join(propDir, `${name}.glb`);
    let geo = null;
    try {
      const doc = await io.read(file);
      const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
      if (prim) {
        geo = {
          position: prim.getAttribute('POSITION')?.getArray(),
          normal: prim.getAttribute('NORMAL')?.getArray(),
          uv: prim.getAttribute('TEXCOORD_0')?.getArray(),
          indices: prim.getIndices()?.getArray(),
        };
        if (!geo.position || !geo.indices) geo = null;
      }
    } catch {
      geo = null;
    }
    propCache.set(name, geo);
    return geo;
  }

  let maps = readdirSync(layoutDir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  if (only) maps = maps.filter((f) => only.includes(path.basename(f, '.json')));
  if (limit > 0) maps = maps.slice(0, limit);

  const summary = [];
  for (const file of maps.sort()) {
    const layout = JSON.parse(readFileSync(path.join(layoutDir, file), 'utf8'));
    const mapOut = path.join(outDir, layout.map);
    mkdirSync(mapOut, { recursive: true });

    // Group placements into cells.
    const cells = new Map();
    for (const p of layout.props) {
      if (p.inactive) continue;
      const g = (p.group ?? '').toLowerCase();
      if (g === 'lighting' || g === 'fog' || g === 'backdropmountains') continue;
      const key = `${Math.floor(p.pos[0] / chunkSize)}_${Math.floor(p.pos[2] / chunkSize)}`;
      const list = cells.get(key);
      if (list) list.push(p);
      else cells.set(key, [p]);
    }

    const chunkIndex = [];
    for (const [key, placements] of [...cells].sort()) {
      // Weld every placement in the cell into one buffer, in WORLD space. The
      // cell's own origin is subtracted so coordinates stay small and quantise
      // well; the renderer puts the chunk back with a single node translation.
      const [cx, cz] = key.split('_').map(Number);
      const originX = cx * chunkSize;
      const originZ = cz * chunkSize;

      const parts = [];
      let pos = [];
      let nrm = [];
      let uv = [];
      let idx = [];
      let base = 0;
      let tris = 0;
      let part = 0;

      const flush = () => {
        if (!idx.length) return;
        parts.push({ pos, nrm, uv, idx, tris });
        pos = [];
        nrm = [];
        uv = [];
        idx = [];
        base = 0;
        tris = 0;
      };

      for (const p of placements) {
        const geo = await loadProp(p.name.replace(/[^A-Za-z0-9_-]/g, '_'));
        if (!geo) continue;
        const m = trs([p.pos[0] - originX, p.pos[1], p.pos[2] - originZ], p.rot, p.scale);
        const count = geo.position.length / 3;
        for (let v = 0; v < count; v++) {
          const w = applyMat(
            m,
            geo.position[v * 3],
            geo.position[v * 3 + 1],
            geo.position[v * 3 + 2],
          );
          pos.push(w[0], w[1], w[2]);
          if (geo.normal) {
            const n = applyDir(m, geo.normal[v * 3], geo.normal[v * 3 + 1], geo.normal[v * 3 + 2]);
            nrm.push(n[0], n[1], n[2]);
          } else nrm.push(0, 1, 0);
          uv.push(geo.uv ? geo.uv[v * 2] : 0, geo.uv ? geo.uv[v * 2 + 1] : 0);
        }
        for (let i = 0; i < geo.indices.length; i++) idx.push(geo.indices[i] + base);
        base += count;
        tris += geo.indices.length / 3;
        // A cell dense enough to blow the frame budget is split rather than
        // shipped whole: the densest 32m cell in the source holds 1.3M triangles
        // against a 250k budget, so this is a real case, not a guard rail.
        if (tris >= maxTris) {
          flush();
          part++;
        }
      }
      flush();
      if (!parts.length) continue;

      for (const [i, p] of parts.entries()) {
        const doc = new Document();
        const buf = doc.createBuffer();
        const prim = doc
          .createPrimitive()
          .setMode(4)
          .setAttribute(
            'POSITION',
            doc.createAccessor().setType('VEC3').setArray(new Float32Array(p.pos)).setBuffer(buf),
          )
          .setAttribute(
            'NORMAL',
            doc.createAccessor().setType('VEC3').setArray(new Float32Array(p.nrm)).setBuffer(buf),
          )
          .setAttribute(
            'TEXCOORD_0',
            doc.createAccessor().setType('VEC2').setArray(new Float32Array(p.uv)).setBuffer(buf),
          )
          .setIndices(
            doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(p.idx)).setBuffer(buf),
          )
          .setMaterial(doc.createMaterial('atlas').setRoughnessFactor(0.9).setMetallicFactor(0));
        const name = parts.length > 1 ? `${key}_${i}` : key;
        doc
          .createScene()
          .addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
        await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
        const outFile = path.join(mapOut, `${name}.glb`);
        await io.write(outFile, doc);
        chunkIndex.push({
          chunk: name,
          origin: [originX, 0, originZ],
          tris: Math.round(p.tris),
          bytes: statSync(outFile).size,
        });
      }
    }

    chunkIndex.sort((a, b) => a.chunk.localeCompare(b.chunk));
    writeFileSync(
      path.join(mapOut, 'chunks.json'),
      `${JSON.stringify({ map: layout.map, chunkSize, chunks: chunkIndex }, null, 2)}\n`,
    );
    const bytes = chunkIndex.reduce((n, c) => n + c.bytes, 0);
    const tris = chunkIndex.reduce((n, c) => n + c.tris, 0);
    summary.push({ map: layout.map, chunks: chunkIndex.length, bytes, tris });
    console.log(
      `  ${layout.map.padEnd(24)} ${String(chunkIndex.length).padStart(4)} chunks  ` +
        `${(bytes / 1048576).toFixed(2).padStart(7)} MiB  ${tris.toLocaleString('en-US').padStart(11)} tris`,
    );
  }

  const total = summary.reduce(
    (a, s) => ({ bytes: a.bytes + s.bytes, chunks: a.chunks + s.chunks }),
    {
      bytes: 0,
      chunks: 0,
    },
  );
  console.log(
    `\nbuild_map_chunks: ${summary.length} maps, ${total.chunks} chunks, ${(total.bytes / 1048576).toFixed(2)} MiB`,
  );
}
