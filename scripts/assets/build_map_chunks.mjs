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
import { dedup, dequantize, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { applyDir, applyMat, matMul, normalMatrix, trs } from './transform_math.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--chunk', '--maps', '--max-tris', '--limit']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));

// The 4x4 maths lives in its own tested module: it is shared with the prefab
// extractor and every defect it guards against was silent, so it is pinned by
// tests/asset_transform_math.test.ts rather than trusted in place.

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

  /** Prop geometry, read once and reused across every map that places it.
   *
   *  THE GEOMETRY IS DEQUANTIZED, AND NONE OF THAT IS OPTIONAL. These GLBs carry
   *  KHR_mesh_quantization, so an accessor reads back as the raw integer it is
   *  stored as and the compensating scale lives on the NODE. Read naively, a wall
   *  came out 65,534 units across and a baked map measured 255 kilometres instead
   *  of 343 metres, with nothing erroring: the geometry is simply enormous.
   *
   *  The hand-rolled version of this hard-coded a /32767 divisor and a stride of
   *  3, and BOTH are wrong for normals. NORMAL is quantized to int8, so the
   *  divisor is 127, and it is stored as VEC4 on 3,120 of the props because Unity
   *  pads float16 normals to four components. A stride-3 walk over a 4-wide array
   *  reads a different lane on every vertex after the first: measured mean error
   *  73 to 94 degrees on real props, on 46% of the placements in a single map.
   *  gltf-transform's own dequantize() knows every component type and divisor, so
   *  the strides are read from the accessors and the arithmetic is not repeated
   *  here. */
  const propCache = new Map();
  const ELEMENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

  async function loadProp(name) {
    if (propCache.has(name)) return propCache.get(name);
    const file = path.join(propDir, `${name}.glb`);
    let geo = null;
    try {
      const doc = await io.read(file);
      await doc.transform(dequantize());
      const root = doc.getRoot();
      const mesh = root.listMeshes()[0];
      const prim = mesh?.listPrimitives()[0];
      if (prim) {
        // The node carrying the mesh holds the compensating transform. Its own
        // parents count too: a converter that emits a scene graph (the Synty FBX
        // path does) puts part of the scale on a parent node.
        const node = root.listNodes().find((n) => n.getMesh() === mesh);
        const local = node
          ? trs(node.getTranslation(), node.getRotation(), node.getScale())
          : trs([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
        let nodeMat = local;
        let up = node?.getParentNode?.() ?? null;
        let guard = 0;
        while (up && guard++ < 32) {
          nodeMat = matMul(trs(up.getTranslation(), up.getRotation(), up.getScale()), nodeMat);
          up = up.getParentNode?.() ?? null;
        }
        const nodeNrm = normalMatrix(nodeMat);

        const posAttr = prim.getAttribute('POSITION');
        const nrmAttr = prim.getAttribute('NORMAL');
        const uvAttr = prim.getAttribute('TEXCOORD_0');
        const idx = prim.getIndices()?.getArray();
        if (posAttr && idx) {
          const rawPos = posAttr.getArray();
          const ps = ELEMENTS[posAttr.getType()] ?? 3;
          const count = Math.floor(rawPos.length / ps);
          const position = new Float32Array(count * 3);
          for (let v = 0; v < count; v++) {
            const w = applyMat(nodeMat, rawPos[v * ps], rawPos[v * ps + 1], rawPos[v * ps + 2]);
            position[v * 3] = w[0];
            position[v * 3 + 1] = w[1];
            position[v * 3 + 2] = w[2];
          }

          let normal = null;
          if (nrmAttr) {
            const rawNrm = nrmAttr.getArray();
            const ns = ELEMENTS[nrmAttr.getType()] ?? 3;
            normal = new Float32Array(count * 3);
            for (let v = 0; v < count; v++) {
              const o = v * ns;
              if (o + 2 >= rawNrm.length) break;
              const n = applyDir(nodeNrm, rawNrm[o], rawNrm[o + 1], rawNrm[o + 2]);
              normal[v * 3] = n[0];
              normal[v * 3 + 1] = n[1];
              normal[v * 3 + 2] = n[2];
            }
          }

          let uv = null;
          if (uvAttr) {
            const rawUv = uvAttr.getArray();
            const us = ELEMENTS[uvAttr.getType()] ?? 2;
            uv = new Float32Array(count * 2);
            for (let v = 0; v < count; v++) {
              uv[v * 2] = rawUv[v * us] ?? 0;
              uv[v * 2 + 1] = rawUv[v * us + 1] ?? 0;
            }
          }
          geo = { position, normal, uv, indices: idx };
        }
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
      const n = p.name.toLowerCase();
      // Skydome-scale scenery is excluded by NAME as well as by group, because
      // the group is where the designer filed it and the name is what it is:
      // BackdropMountains sits under the ordinary "World" group yet spans two
      // kilometres, so it swallowed a 64m cell whole and stretched the baked map
      // from 343 metres to 2032. A web renderer draws its own distant horizon.
      if (g === 'lighting' || g === 'fog' || g === 'backdropmountains') continue;
      if (/backdrop|skyline|skydome|skybox|colormap|horizon/.test(n) || /backdrop|skyline/.test(g))
        continue;
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
        // `mat` overrides the TRS triple where the layout carried one: a rotated
        // child under a non-uniformly scaled parent composes to a SHEARED matrix
        // that no position/rotation/scale triple can express. Six props in the
        // whole corpus, but silently wrong without this.
        const m = p.mat
          ? [...p.mat.slice(0, 12), p.mat[12] - originX, p.mat[13], p.mat[14] - originZ, p.mat[15]]
          : trs([p.pos[0] - originX, p.pos[1], p.pos[2] - originZ], p.rot, p.scale);
        const nm = normalMatrix(m);
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
            const n = applyDir(nm, geo.normal[v * 3], geo.normal[v * 3 + 1], geo.normal[v * 3 + 2]);
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
        await doc.transform(
          prune({ keepAttributes: true }),
          dedup(),
          meshopt({ encoder: MeshoptEncoder, level: 'high' }),
        );
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
