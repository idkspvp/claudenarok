// Bake a map layout plus its prop GLBs into merged per-chunk GLBs.
//
// PREFER build_map_instances.mjs. This is kept for the maps where merging wins.
//
// Two claims that used to head this file were both wrong, and both were wrong in
// the same way: measured over a WHOLE MAP rather than over what a frame draws.
//
//   "the largest town draws 498 distinct meshes, so instancing collapses
//    nothing" - a frame only draws what is near the camera. Measured over a 60 m
//    radius across all 52 maps, instancing costs a p95 of 169 draws at worst
//    against 113 for merging, and 51 of 52 maps stay under 150.
//
//   "the source's props share a single atlas material" - they do not. 353 meshes
//    take a different atlas depending on which map places them and 149 bind a
//    different material per submesh, so a cell averages 2.56 draws even merged
//    and the worst single cell is 30.
//
// What merging really trades is GPU MEMORY for draw calls, because it duplicates
// a mesh's geometry once per placement and every copy stays resident. On Nevaris
// that is 201.26 MiB against 17.58 MiB instanced, an 11.4x difference on the one
// budget a phone cannot grow. Merging is still the better choice where a map is
// varied rather than repetitive, which is why this remains.
//
// Doing the merge in the browser instead would mean fetching hundreds of GLBs and
// welding them on the main thread at map entry; doing it here means the client
// fetches ready-made chunks.
//
// USAGE
//   node scripts/assets/build_map_chunks.mjs <layoutDir> <propGlbDir> <outDir>
//     [--chunk <metres>]     cell size, default 64
//     [--maps <a,b,c>]       only these maps
//     [--max-tris <n>]       split a cell that exceeds this, default 120000
//     [--limit <n>]
//     [--atlas <dir>]        atlas index from unity_atlas_to_webp, for textures
//     [--max-span <metres>]  drop a placement bigger than this, default 1200
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
import {
  cellKey,
  DEFAULT_MAX_SPAN_M,
  makeAtlasResolver,
  propFileName,
  skipPlacement,
} from './map_placements.mjs';
import { applyDir, applyMat, matMul, normalMatrix, trs } from './transform_math.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--chunk', '--maps', '--max-tris', '--limit', '--atlas', '--max-span']);
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
  const maxSpan = Number(flag('--max-span', String(DEFAULT_MAX_SPAN_M)));
  /** Placements dropped for being skydome-scale, reported rather than silent. */
  const oversized = [];

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

  // The atlas index, if one was built. Without it every prop lands in a single
  // untextured bucket, which is what this produced before textures existed.
  const atlasDir = flag('--atlas');
  const atlasIndex = atlasDir
    ? JSON.parse(readFileSync(path.join(atlasDir, 'index.json'), 'utf8'))
    : null;
  const atlasFor = makeAtlasResolver(atlasIndex);

  async function loadProp(name) {
    if (propCache.has(name)) return propCache.get(name);
    const file = path.join(propDir, `${name}.glb`);
    let geo = null;
    try {
      const doc = await io.read(file);
      await doc.transform(dequantize());
      const root = doc.getRoot();
      const mesh = root.listMeshes()[0];
      const prims = mesh?.listPrimitives() ?? [];
      if (prims.length) {
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

        // EVERY PRIMITIVE IS DECODED FROM ITS OWN ACCESSORS.
        //
        // The exporter builds a mesh whose primitives share one set of attribute
        // accessors and differ only in indices, and an earlier version of this
        // decoded prims[0] once and applied every primitive's indices to it,
        // saying so in a comment. That comment described the in-memory document,
        // not the file: meshopt() reorders vertices PER PRIMITIVE on write, so
        // the accessors are split by the time anything reads them back. Sampled
        // over 600 shipped props, 0 of 42 multi-primitive meshes still share.
        //
        // Reading prims[0] for all of them was therefore wrong twice over. Where
        // a later primitive's indices stayed in range, its triangles were welded
        // from the wrong vertices; where they ran past (Back_16_0 has 237
        // vertices in prims[0] and uses index 1469) the reads came back undefined
        // and the triangles collapsed to a point. It cost 442,739 zero-area and
        // ~219,000 mis-sourced triangles across the bake, concentrated in the
        // multi-part building pieces, so castle walls lost their back faces.
        const lo = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
        const hi = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
        const parts = [];
        for (const prim of prims) {
          const posAttr = prim.getAttribute('POSITION');
          const idx = prim.getIndices()?.getArray();
          if (!posAttr || !idx) continue;
          const rawPos = posAttr.getArray();
          const ps = ELEMENTS[posAttr.getType()] ?? 3;
          const count = Math.floor(rawPos.length / ps);
          const position = new Float32Array(count * 3);
          for (let v = 0; v < count; v++) {
            const w = applyMat(nodeMat, rawPos[v * ps], rawPos[v * ps + 1], rawPos[v * ps + 2]);
            position[v * 3] = w[0];
            position[v * 3 + 1] = w[1];
            position[v * 3 + 2] = w[2];
            for (let k = 0; k < 3; k++) {
              if (w[k] < lo[k]) lo[k] = w[k];
              if (w[k] > hi[k]) hi[k] = w[k];
            }
          }

          const nrmAttr = prim.getAttribute('NORMAL');
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

          const uvAttr = prim.getAttribute('TEXCOORD_0');
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

          // COLOR_0 SURVIVES THE MERGE. The converter keeps it deliberately,
          // because Synty shades with vertex colour and dropping it flattens the
          // art, and this baker was then throwing it away again: 4.3% of the
          // placed props carry it and 0 baked chunks did. Read as unsigned
          // normalized, whatever width it came in at, and always stored RGBA.
          const colAttr = prim.getAttribute('COLOR_0');
          let color = null;
          if (colAttr) {
            const rawCol = colAttr.getArray();
            const cs = ELEMENTS[colAttr.getType()] ?? 4;
            const denom = colAttr.getNormalized()
              ? rawCol.BYTES_PER_ELEMENT === 1
                ? 255
                : 65535
              : 1;
            color = new Float32Array(count * 4);
            for (let v = 0; v < count; v++) {
              color[v * 4] = (rawCol[v * cs] ?? denom) / denom;
              color[v * 4 + 1] = (rawCol[v * cs + 1] ?? denom) / denom;
              color[v * 4 + 2] = (rawCol[v * cs + 2] ?? denom) / denom;
              color[v * 4 + 3] = cs > 3 ? (rawCol[v * cs + 3] ?? denom) / denom : 1;
            }
          }
          // In prefab m_Materials order, which is what lets each find its atlas.
          parts.push({ position, normal, uv, color, indices: idx, count });
        }
        // The prop's own longest side, over EVERY primitive: a bounding box from
        // prims[0] alone understates a multi-part model, and the skydome filter
        // decides on it.
        const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
        if (parts.length) geo = { parts, span: Number.isFinite(span) ? span : 0 };
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
    // Which placements to draw and where they belong come from the SHARED rules,
    // not from a copy here. This baker and the instancing one differ only in how
    // they emit; if they disagreed about what to draw they would produce
    // different worlds from the same input and nothing would report it. Over the
    // real corpus they draw an identical 30,888,832 triangles on all 52 maps.
    const cells = new Map();
    for (const p of layout.props) {
      if (skipPlacement(p)) continue;
      const key = cellKey(p, chunkSize);
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

      // ONE BUCKET PER ATLAS. Merging is only legal between props that sample the
      // same texture, so the cell is split by atlas first and welded within each.
      // Counted off the finished bake that is 4,685 parts over 1,830 cells, so
      // 2.56 buckets per cell on average and 30 at the worst single cell,
      // against 1 if every prop really did share a single atlas the way the
      // original comment here assumed.
      const buckets = new Map();
      const bucketOf = (atlas) => {
        let b = buckets.get(atlas);
        if (!b) {
          b = {
            atlas,
            pos: [],
            nrm: [],
            uv: [],
            col: [],
            hasColor: false,
            idx: [],
            base: 0,
            tris: 0,
          };
          buckets.set(atlas, b);
        }
        return b;
      };

      for (const p of placements) {
        const geo = await loadProp(propFileName(p.name));
        if (!geo) continue;
        // SKYDOME-SCALE SCENERY IS EXCLUDED BY SIZE, not by name.
        //
        // The name filter above catches the ones actually called Backdrop or
        // Skydome, and it cannot catch the rest: a prop named "Plane" at scale
        // 269.6 spans 11 kilometres and swallowed a whole map's bounding box,
        // and a name blacklist would also wrongly drop a legitimate prop that
        // happened to be called Backdrop. Size is the honest discriminator.
        // Measured over 38,309 placements the median is 10 m, p99 is 164 m and
        // p99.9 is 893 m; past a kilometre every single one is a skydome, cloud
        // ring, fog ring, backdrop mountain or water plane, which a web renderer
        // draws as its own horizon.
        const worldSpan = geo.span * Math.max(...p.scale.map(Math.abs));
        if (worldSpan > maxSpan) {
          oversized.push([p.name, Math.round(worldSpan), layout.map]);
          continue;
        }
        // `mat` overrides the TRS triple where the layout carried one: a rotated
        // child under a non-uniformly scaled parent composes to a SHEARED matrix
        // that no position/rotation/scale triple can express. Six props in the
        // whole corpus, but silently wrong without this.
        const m = p.mat
          ? [...p.mat.slice(0, 12), p.mat[12] - originX, p.mat[13], p.mat[14] - originZ, p.mat[15]]
          : trs([p.pos[0] - originX, p.pos[1], p.pos[2] - originZ], p.rot, p.scale);
        const nm = normalMatrix(m);
        // A MIRRORED PLACEMENT NEEDS ITS WINDING REVERSED. 641 of 38,512 drawn
        // placements (1.66%) carry a negative-determinant scale, which turns the
        // geometry inside out: the triangle order that was counter-clockwise in
        // the prop is clockwise once reflected, so back-face culling removes the
        // faces the player should see and keeps the ones behind them. normalMatrix
        // already divides by the determinant so the shading stays right, which is
        // exactly what makes this invisible in a lit render.
        const det =
          m[0] * (m[5] * m[10] - m[9] * m[6]) -
          m[4] * (m[1] * m[10] - m[9] * m[2]) +
          m[8] * (m[1] * m[6] - m[5] * m[2]);
        const flipWinding = det < 0;

        // Each submesh transforms ITS OWN vertices. They cannot be transformed
        // once up front and shared, because the primitives do not share a vertex
        // array on disk (see loadProp).
        for (const [si, part] of geo.parts.entries()) {
          const b = bucketOf(atlasFor(p, si));
          // Only the vertices this submesh actually references travel into the
          // bucket, so a prop spanning two atlases does not copy its whole vertex
          // block into each.
          const seen = new Map();
          for (let i = 0; i < part.indices.length; i++) {
            const src = part.indices[i];
            // A source index past this primitive's own vertex count would mean
            // the file disagrees with itself. Refuse rather than read undefined
            // and silently emit a collapsed triangle, which is exactly how the
            // previous version failed.
            if (src >= part.count) {
              throw new Error(
                `${p.name}: submesh ${si} index ${src} exceeds its ${part.count} vertices`,
              );
            }
            let dst = seen.get(src);
            if (dst === undefined) {
              dst = b.base + seen.size;
              seen.set(src, dst);
              const w = applyMat(
                m,
                part.position[src * 3],
                part.position[src * 3 + 1],
                part.position[src * 3 + 2],
              );
              b.pos.push(w[0], w[1], w[2]);
              if (part.normal) {
                const n = applyDir(
                  nm,
                  part.normal[src * 3],
                  part.normal[src * 3 + 1],
                  part.normal[src * 3 + 2],
                );
                b.nrm.push(n[0], n[1], n[2]);
              } else b.nrm.push(0, 1, 0);
              b.uv.push(part.uv ? part.uv[src * 2] : 0, part.uv ? part.uv[src * 2 + 1] : 0);
              // White where a prop has no vertex colour, so a bucket mixing
              // coloured and plain props stays uniform and the plain ones are
              // unaffected by the multiply.
              if (part.color) {
                b.hasColor = true;
                b.col.push(
                  part.color[src * 4],
                  part.color[src * 4 + 1],
                  part.color[src * 4 + 2],
                  part.color[src * 4 + 3],
                );
              } else b.col.push(1, 1, 1, 1);
            }
            b.idx.push(dst);
          }
          // Reverse each mirrored triangle, in place, now that its three indices
          // are all appended. Swapping the second and third of every triple is
          // what puts the winding back the way the culler expects.
          if (flipWinding) {
            const start = b.idx.length - part.indices.length;
            for (let i = start; i + 2 < b.idx.length; i += 3) {
              const t = b.idx[i + 1];
              b.idx[i + 1] = b.idx[i + 2];
              b.idx[i + 2] = t;
            }
          }
          b.base += seen.size;
          b.tris += part.indices.length / 3;
        }
      }

      // A cell dense enough to blow the frame budget is split rather than shipped
      // whole: the densest 32m cell in the source holds 1.3M triangles against a
      // 250k budget, so this is a real case, not a guard rail. Splitting happens
      // per bucket, since a bucket is what becomes one draw.
      const parts = [];
      for (const b of buckets.values()) {
        if (!b.idx.length) continue;
        if (b.tris <= maxTris) {
          parts.push(b);
          continue;
        }
        const chunksNeeded = Math.ceil(b.tris / maxTris);
        const perChunk = Math.ceil(b.idx.length / 3 / chunksNeeded) * 3;
        for (let s = 0; s < b.idx.length; s += perChunk) {
          const slice = b.idx.slice(s, s + perChunk);
          // Re-index so each split carries only the vertices it uses.
          const remap = new Map();
          const pos = [];
          const nrm = [];
          const uv = [];
          const col = [];
          const idx = [];
          for (const original of slice) {
            let next = remap.get(original);
            if (next === undefined) {
              next = remap.size;
              remap.set(original, next);
              pos.push(b.pos[original * 3], b.pos[original * 3 + 1], b.pos[original * 3 + 2]);
              nrm.push(b.nrm[original * 3], b.nrm[original * 3 + 1], b.nrm[original * 3 + 2]);
              uv.push(b.uv[original * 2], b.uv[original * 2 + 1]);
              col.push(
                b.col[original * 4],
                b.col[original * 4 + 1],
                b.col[original * 4 + 2],
                b.col[original * 4 + 3],
              );
            }
            idx.push(next);
          }
          parts.push({
            atlas: b.atlas,
            pos,
            nrm,
            uv,
            col,
            hasColor: b.hasColor,
            idx,
            tris: idx.length / 3,
          });
        }
      }
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
          .setMaterial(
            doc
              .createMaterial(p.atlas || 'atlas')
              .setRoughnessFactor(0.9)
              .setMetallicFactor(0),
          );
        // Only where a prop in this bucket actually had vertex colour. Emitting
        // it unconditionally would add four bytes per vertex across the whole
        // bake to carry white on the 95.7% of props that have none.
        if (p.hasColor) {
          prim.setAttribute(
            'COLOR_0',
            doc.createAccessor().setType('VEC4').setArray(new Float32Array(p.col)).setBuffer(buf),
          );
        }
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
          // Which WebP the renderer binds for this chunk. The texture is NOT
          // embedded: one atlas serves many chunks across many maps, so it is
          // fetched once and shared rather than duplicated into every GLB.
          atlas: p.atlas || null,
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
  if (oversized.length) {
    // Never silent: a dropped placement is art that will not appear, so it is
    // named here rather than left to be noticed as a hole later.
    const byName = new Map();
    for (const [name, span, map] of oversized) {
      const e = byName.get(name) ?? { n: 0, span: 0, maps: new Set() };
      e.n++;
      e.span = Math.max(e.span, span);
      e.maps.add(map);
      byName.set(name, e);
    }
    console.log(`  ${oversized.length} placements dropped as scenery larger than ${maxSpan} m:`);
    for (const [name, e] of [...byName].sort((a, b) => b[1].span - a[1].span)) {
      console.log(
        `    ${name.padEnd(34)} x${String(e.n).padStart(3)}  up to ${String(e.span).padStart(6)} m  in ${[...e.maps].slice(0, 3).join(', ')}`,
      );
    }
  }
}
