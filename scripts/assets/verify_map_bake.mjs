// Check a baked map set for the failures this pipeline actually produces.
//
// Every defect this pipeline has shipped was SILENT. Local coordinates read as
// world, a stride-3 walk over 4-wide normals, a missing dequantize, an
// unconditional UV clamp: none of them threw, and several rendered convincingly.
// So the bake is checked against properties that a plausible-looking wrong answer
// still fails, and the checks are stated as thresholds rather than eyeballed.
//
// USAGE
//   node scripts/assets/verify_map_bake.mjs <chunkDir> [--atlas <dir>]
//     [--layouts <dir>] [--max-draws <n>] [--json]
//
// Exits non-zero if any check fails, so it can gate a rebuild.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** A cell is one draw per atlas, so this is what a frame actually costs near the
 *  camera. The repo's frame baseline is about 150 calls. */
export const DEFAULT_MAX_DRAWS = 120;

/** Accumulate a pass/fail list with the evidence attached, so a failure reports
 *  the number that failed rather than just its name. */
export function makeReport() {
  const checks = [];
  return {
    checks,
    ok(name, detail) {
      checks.push({ name, pass: true, detail });
    },
    fail(name, detail) {
      checks.push({ name, pass: false, detail });
    },
    assert(name, condition, detail) {
      checks.push({ name, pass: Boolean(condition), detail });
      return Boolean(condition);
    },
    get failed() {
      return checks.filter((c) => !c.pass);
    },
  };
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const VALUED = new Set(['--atlas', '--layouts', '--max-draws']);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const chunkDir = positional[0];
  if (!chunkDir) {
    console.log(
      'usage: node scripts/assets/verify_map_bake.mjs <chunkDir> [--atlas dir] [--layouts dir] [--max-draws n]',
    );
    process.exit(1);
  }
  const atlasDir = flag('--atlas');
  const maxDraws = Number(flag('--max-draws', String(DEFAULT_MAX_DRAWS)));
  const asJson = argv.includes('--json');

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  const atlasFiles = atlasDir
    ? new Set(
        readdirSync(atlasDir)
          .filter((f) => f.endsWith('.webp'))
          .map((f) => f.replace(/\.webp$/, '')),
      )
    : null;

  const maps = readdirSync(chunkDir).filter((m) =>
    existsSync(path.join(chunkDir, m, 'chunks.json')),
  );
  const report = makeReport();

  let totalChunks = 0;
  let totalTris = 0;
  let texturedTris = 0;
  let danglingAtlas = 0;
  let nonUnitNormals = 0;
  let degenerateNormals = 0;
  let normalsChecked = 0;
  let nonVec3Normals = 0;
  let emptyPrims = 0;
  let outOfRangeIndices = 0;
  let uvMissing = 0;
  let degenerateTris = 0;
  let trianglesChecked = 0;
  let nonFinite = 0;
  const worstCell = [];
  const hugeMaps = [];
  const perMap = [];

  for (const map of maps.sort()) {
    const dir = path.join(chunkDir, map);
    const index = JSON.parse(readFileSync(path.join(dir, 'chunks.json'), 'utf8'));
    const chunks = index.chunks ?? [];
    totalChunks += chunks.length;

    // A cell can be split across several atlases and several triangle budgets,
    // so group back to the CELL to count what one place actually costs to draw.
    const byCell = new Map();
    for (const c of chunks) {
      const cell = `${c.origin[0]}_${c.origin[2]}`;
      byCell.set(cell, (byCell.get(cell) ?? 0) + 1);
      totalTris += c.tris;
      if (c.atlas) {
        texturedTris += c.tris;
        if (atlasFiles && !atlasFiles.has(c.atlas)) danglingAtlas++;
      }
    }
    // A FRAME DRAWS A NEIGHBOURHOOD, NOT ONE CELL. Counting the busiest single
    // cell made this gate unfailable: the corpus maximum is 30 against a
    // threshold of 120. At a 64 m grid, a camera anywhere inside a cell sees that
    // cell and its eight neighbours, so that 3x3 block is what a frame costs.
    const partsAt = new Map();
    for (const c of chunks) {
      const k = `${Math.round(c.origin[0] / 64)},${Math.round(c.origin[2] / 64)}`;
      partsAt.set(k, (partsAt.get(k) ?? 0) + 1);
    }
    let draws = 0;
    for (const key of partsAt.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      let block = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) block += partsAt.get(`${cx + dx},${cz + dz}`) ?? 0;
      }
      if (block > draws) draws = block;
    }
    worstCell.push([map, draws]);

    const mn = [1e9, 1e9, 1e9];
    const mx = [-1e9, -1e9, -1e9];
    for (const c of chunks) {
      const doc = await io.read(path.join(dir, `${c.chunk}.glb`));
      await doc.transform(dequantize());
      const root = doc.getRoot();
      for (const mesh of root.listMeshes()) {
        const node = root.listNodes().find((n) => n.getMesh() === mesh);
        const s = node?.getScale() ?? [1, 1, 1];
        const t = node?.getTranslation() ?? [0, 0, 0];
        for (const prim of mesh.listPrimitives()) {
          const pos = prim.getAttribute('POSITION');
          const nrm = prim.getAttribute('NORMAL');
          const uv = prim.getAttribute('TEXCOORD_0');
          const idx = prim.getIndices();
          if (!pos || !idx || idx.getCount() === 0) {
            emptyPrims++;
            continue;
          }
          if (!uv) uvMissing++;
          const count = pos.getCount();
          const ia = idx.getArray();
          for (let i = 0; i < ia.length; i++) {
            if (ia[i] >= count) {
              outOfRangeIndices++;
              break;
            }
          }
          const pa = pos.getArray();
          // NaN FAILS EVERY COMPARISON BELOW SILENTLY, so it is caught by name
          // rather than by a threshold. A NaN position sails through the extent
          // check (both `<` and `>` are false) and a NaN normal through the unit
          // check, so a chunk full of them reads as clean.
          for (let i = 0; i < pa.length; i++) {
            if (!Number.isFinite(pa[i])) {
              nonFinite++;
              break;
            }
          }

          // DEGENERATE TRIANGLES, which is the check this file was missing when
          // it most mattered. The baker re-indexes densely on the way out, so a
          // triangle welded from the wrong or out-of-range vertices arrives here
          // with perfectly valid indices pointing at the wrong points. The only
          // trace left is that it has no area. A bake carrying 442,739 collapsed
          // triangles passed every other check in this file clean.
          for (let i = 0; i + 2 < ia.length; i += 3) {
            // Not named a/b/c: `c` is the chunk in the enclosing scope, and
            // shadowing it here is a trap for the next reader.
            const i0 = ia[i] * 3;
            const i1 = ia[i + 1] * 3;
            const i2 = ia[i + 2] * 3;
            const ux = pa[i1] - pa[i0];
            const uy = pa[i1 + 1] - pa[i0 + 1];
            const uz = pa[i1 + 2] - pa[i0 + 2];
            const vx = pa[i2] - pa[i0];
            const vy = pa[i2 + 1] - pa[i0 + 1];
            const vz = pa[i2 + 2] - pa[i0 + 2];
            const cx = uy * vz - uz * vy;
            const cy = uz * vx - ux * vz;
            const cz = ux * vy - uy * vx;
            trianglesChecked++;
            if (Math.hypot(cx, cy, cz) * 0.5 < 1e-9) degenerateTris++;
          }
          for (let i = 0; i < pa.length; i += 3) {
            for (let k = 0; k < 3; k++) {
              const v = pa[i + k] * s[k] + t[k] + c.origin[k];
              if (v < mn[k]) mn[k] = v;
              if (v > mx[k]) mx[k] = v;
            }
          }
          if (nrm) {
            if (nrm.getType() !== 'VEC3') nonVec3Normals++;
            const na = nrm.getArray();
            for (let i = 0; i + 2 < na.length; i += 3) {
              normalsChecked++;
              const len = Math.hypot(na[i], na[i + 1], na[i + 2]);
              if (!Number.isFinite(len)) nonFinite++;
              else if (len < 1e-6) degenerateNormals++;
              else if (Math.abs(len - 1) > 0.05) nonUnitNormals++;
            }
          }
        }
      }
    }
    const size = mx.map((v, i) => v - mn[i]);
    // A map that measures kilometres is the missing-dequantize signature; one
    // that measures a couple of metres is reading normalized accessors raw.
    if (size[0] > 4000 || size[2] > 4000 || size[0] < 5 || size[2] < 5) {
      hugeMaps.push([map, size.map((v) => Math.round(v))]);
    }
    perMap.push({ map, chunks: chunks.length, draws, size: size.map((v) => Math.round(v)) });
  }

  report.assert(
    'every chunk atlas exists on disk',
    danglingAtlas === 0,
    `${danglingAtlas} dangling`,
  );
  report.assert('no empty primitives', emptyPrims === 0, `${emptyPrims} empty`);
  report.assert('no NaN positions or normals', nonFinite === 0, `${nonFinite} primitives`);
  report.assert(
    'no out-of-range indices',
    outOfRangeIndices === 0,
    `${outOfRangeIndices} primitives`,
  );
  report.assert('normals are VEC3', nonVec3Normals === 0, `${nonVec3Normals} primitives are not`);
  report.assert(
    'normals are unit length',
    nonUnitNormals === 0 && degenerateNormals === 0,
    `${nonUnitNormals} non-unit, ${degenerateNormals} zero-length of ${normalsChecked.toLocaleString('en-US')}`,
  );
  report.assert('every primitive has texcoords', uvMissing === 0, `${uvMissing} without`);
  // A handful of collapsed triangles is normal in source art; a percent of them
  // is a welding defect. The bake this check was written for carried 1.43%.
  const degeneratePct = trianglesChecked ? (degenerateTris / trianglesChecked) * 100 : 0;
  report.assert(
    'under 0.5% of triangles are degenerate',
    degeneratePct < 0.5,
    `${degenerateTris.toLocaleString('en-US')} of ${trianglesChecked.toLocaleString('en-US')} (${degeneratePct.toFixed(3)}%)`,
  );
  report.assert(
    'map extents are plausible',
    hugeMaps.length === 0,
    hugeMaps.length ? JSON.stringify(hugeMaps.slice(0, 4)) : 'all within 5m to 4km',
  );
  worstCell.sort((a, b) => b[1] - a[1]);
  report.assert(
    `no cell exceeds ${maxDraws} draws`,
    (worstCell[0]?.[1] ?? 0) <= maxDraws,
    worstCell[0] && worstCell[0][1] > maxDraws
      ? `${worstCell
          .filter((w) => w[1] > maxDraws)
          .map((w) => `${w[0]} ${w[1]}`)
          .join(', ')} - bake these with build_map_instances instead`
      : `worst is ${worstCell[0]?.[0]} at ${worstCell[0]?.[1]}`,
  );
  const texturedPct = totalTris ? (texturedTris / totalTris) * 100 : 0;
  report.assert(
    'at least 95% of triangles are textured',
    texturedPct >= 95,
    `${texturedPct.toFixed(2)}%`,
  );

  if (asJson) {
    console.log(JSON.stringify({ checks: report.checks, perMap }, null, 2));
  } else {
    console.log(
      `verify_map_bake: ${maps.length} maps, ${totalChunks.toLocaleString('en-US')} chunks, ` +
        `${totalTris.toLocaleString('en-US')} tris\n`,
    );
    for (const c of report.checks) {
      console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(42)} ${c.detail}`);
    }
    console.log('\n  busiest 3x3 neighbourhoods:');
    for (const [m, d] of worstCell.slice(0, 6)) console.log(`    ${m.padEnd(26)} ${d} draws`);
  }
  process.exit(report.failed.length ? 1 : 0);
}
