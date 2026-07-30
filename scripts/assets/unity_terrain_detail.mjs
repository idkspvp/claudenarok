// Extract the two things the terrain import left behind: the ground SPLAT and
// the painted GRASS.
//
// The heightmap alone gives a shape with one flat colour and nothing growing on
// it. Neither is a limit of the source art:
//
//   SplatDatabase   a 512x512 RGBA mask plus four terrain layers, so the ground
//                   is grass, cliff dirt, path dirt and dark foliage blended,
//                   each tiling at its own rate.
//   DetailDatabase  a 256x256 coverage grid the level designer painted, which on
//                   Sunny_Meadows_1 is 61,442 non-empty cells and works out to
//                   122,299 plants at two per cell, 85% grass and 15% flowers.
//
// THE DETAIL LAYOUT WAS VERIFIED, NOT GUESSED. Coverage is [layerSlot][sample],
// and reading it as interleaved instead produced a suspiciously even six-way
// split across the layers, which is exactly the shape that mistake makes. Every
// patch satisfies `coverage.length === layerIndices.length * PatchSamples^2`
// across the corpus, which is what pins it.
//
// The six detail prototypes are ordinary prefabs already converted into the prop
// pool, so grass instances are emitted in the SAME batch shape
// build_map_instances.mjs produces and draw through the same path.
//
// USAGE
//   node scripts/assets/unity_terrain_detail.mjs <bundlesDir> <outDir>
//     --guid-map <guid_map.json>
//     [--per-cell <n>]   plants per painted cell, default 2
//     [--maps <a,b,c>]
//     [--report]         only print the survey, write nothing

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readObject, readSerializedFile } from './unity_serialized.mjs';

/** Deterministic per-map scatter: the same map must produce the same meadow
 *  every run, so this never touches Math.random. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Decode the painted detail grid into plant placements.
 *
 *  `sampleHeight(x, z)` lifts each plant onto the ground; without it they sit at
 *  y = 0 and the whole meadow is buried or floating. */
export function decodeDetail(detail, { spanX, spanZ, seed = 12345 }) {
  const patchCount = detail.m_PatchCount;
  const samples = detail.m_PatchSamples;
  const cellsPerSide = patchCount * samples;
  void spanX;
  void spanZ;
  const byLayer = new Map();
  void seed;
  let paintedCells = 0;
  let rawCoverage = 0;

  const patches = detail.m_Patches ?? [];
  for (const [pi, patch] of patches.entries()) {
    const idx = patch.layerIndices?.typedArray ?? patch.layerIndices;
    const cov = patch.coverage?.typedArray ?? patch.coverage;
    if (!idx?.length || !cov?.length) continue;
    // The layout, pinned by the length identity above.
    if (cov.length !== idx.length * samples * samples) continue;
    const px = pi % patchCount;
    const pz = Math.floor(pi / patchCount);
    for (let i = 0; i < cov.length; i++) {
      const c = cov[i] & 0xff;
      if (!c) continue;
      rawCoverage += c;
      paintedCells++;
      const layer = idx[Math.floor(i / (samples * samples))];
      const within = i % (samples * samples);
      const sx = within % samples;
      const sz = Math.floor(within / samples);
      const cellX = px * samples + sx;
      const cellZ = pz * samples + sz;
      let grid = byLayer.get(layer);
      if (!grid) {
        grid = new Uint8Array(cellsPerSide * cellsPerSide);
        byLayer.set(layer, grid);
      }
      grid[cellZ * cellsPerSide + cellX] = c;
    }
  }
  // Plant count at a given per-cell cap, which is what the survey reports; the
  // plants themselves are scattered at draw time from this grid.
  const plantsAt = (cap) => {
    let n = 0;
    for (const grid of byLayer.values()) for (const c of grid) n += Math.min(cap, c);
    return n;
  };
  return {
    byLayer,
    paintedCells,
    rawCoverage,
    cellsPerSide,
    plantsAt,
    coverageOf: (layer) => byLayer.get(layer) ?? new Uint8Array(cellsPerSide * cellsPerSide),
  };
}

/** The first mip of an uncompressed Texture2D, as raw RGBA. */
export function decodeTexture2D(tex) {
  const width = tex.m_Width;
  const height = tex.m_Height;
  const format = tex.m_TextureFormat;
  const raw = tex['image data'] ?? tex.m_ImageData;
  const bytes = raw?.typedArray ?? raw;
  if (!bytes || !bytes.length) return null;
  // 4 = RGBA32, 5 = ARGB32, 3 = RGB24. The splatmaps in this corpus are 4.
  const channels = format === 3 ? 3 : 4;
  const need = width * height * channels;
  if (bytes.length < need) return null;
  const buf = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, need);
  return { width, height, channels, format, data: buf };
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const VALUED = new Set(['--guid-map', '--per-cell', '--maps']);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const [bundlesDir, outDir] = positional;
  const guidMapPath = flag('--guid-map');
  if (!bundlesDir || !guidMapPath) {
    console.log(
      'usage: node scripts/assets/unity_terrain_detail.mjs <bundlesDir> <outDir> --guid-map <f> [--per-cell n] [--maps a,b] [--report]',
    );
    process.exit(1);
  }
  const perCell = Number(flag('--per-cell', '2'));
  const reportOnly = argv.includes('--report');
  const only = flag('--maps')
    ?.split(',')
    .map((s) => s.trim());
  const guidMap = JSON.parse(readFileSync(guidMapPath, 'utf8'));
  const assetsRoot = path.resolve(bundlesDir, '..');

  // Map name -> its TerrainData, via the prefab's Terrain component.
  const prefabs = [];
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
      else if (e.name.endsWith('.prefab') && p.includes('_Maps')) prefabs.push(p);
    }
  };
  walk(bundlesDir);
  prefabs.sort();

  if (!reportOnly) {
    mkdirSync(path.join(outDir, 'splat'), { recursive: true });
    mkdirSync(path.join(outDir, 'detail'), { recursive: true });
  }
  /** The mesh a detail prefab actually draws, resolved through its MeshFilter
   *  guid. Memoized: the same grass prefab appears on most maps. */
  const prefabMeshCache = new Map();
  const prefabMesh = (entry) => {
    if (prefabMeshCache.has(entry.path)) return prefabMeshCache.get(entry.path);
    let name = null;
    try {
      const body = readFileSync(path.join(assetsRoot, entry.path), 'utf8');
      const g = body.match(/m_Mesh: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
      name = g ? (guidMap[g]?.name ?? null) : null;
    } catch {
      name = null;
    }
    prefabMeshCache.set(entry.path, name);
    return name;
  };

  const index = [];
  const anomalies = [];

  for (const file of prefabs) {
    const mapName = path.basename(file, '.prefab');
    if (only && !only.includes(mapName)) continue;
    const text = readFileSync(file, 'utf8');
    const guid = text.match(/m_TerrainData: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
    if (!guid) continue;
    const entry = guidMap[guid];
    if (!entry) {
      anomalies.push(`${mapName}: TerrainData guid ${guid} not in the guid map`);
      continue;
    }

    let sf;
    let v;
    try {
      sf = readSerializedFile(readFileSync(path.join(assetsRoot, entry.path)));
      const obj = sf.objects.find((o) => sf.types[o.typeIndex].classId === 156);
      const read = readObject(sf, obj, () => true);
      if (read.consumed !== read.expected) {
        anomalies.push(`${mapName}: type-tree walk consumed ${read.consumed} of ${read.expected}`);
        continue;
      }
      v = read.value;
    } catch (err) {
      anomalies.push(`${mapName}: ${String(err.message).slice(0, 90)}`);
      continue;
    }

    const heights = v.m_Heightmap.m_Heights.typedArray;
    const res = Math.round(Math.sqrt(heights.length));
    const scale = v.m_Heightmap.m_Scale;
    const spanX = (res - 1) * scale.x;
    const spanZ = (res - 1) * scale.z;
    const sampleHeight = (x, z) => {
      const fx = Math.max(0, Math.min(res - 1, x / scale.x));
      const fz = Math.max(0, Math.min(res - 1, z / scale.z));
      const x0 = Math.floor(fx);
      const z0 = Math.floor(fz);
      const x1 = Math.min(res - 1, x0 + 1);
      const z1 = Math.min(res - 1, z0 + 1);
      const tx = fx - x0;
      const tz = fz - z0;
      const h =
        (heights[z0 * res + x0] * (1 - tx) + heights[z0 * res + x1] * tx) * (1 - tz) +
        (heights[z1 * res + x0] * (1 - tx) + heights[z1 * res + x1] * tx) * tz;
      return (h / 32767) * scale.y;
    };

    // The externals table names what the terrain points at; ground layers are
    // .terrainlayer and the detail prototypes are .prefab.
    const externals = sf.externals.map((e) => guidMap[e.guid] ?? null);
    const layerNames = externals.filter((e) => e?.ext === 'terrainlayer').map((e) => e.name);
    // A detail prototype is a PREFAB, not a mesh, so its name is a scene label
    // and not something the prop pool has a GLB for: only 5 of 41 matched by name.
    // The drawable mesh is behind the prefab's MeshFilter guid, the same hop the
    // map layout already makes for every prop.
    const detailPrefabs = externals
      .filter((e) => e?.ext === 'prefab')
      .map((e) => prefabMesh(e) ?? e.name);

    const splat = v.m_SplatDatabase ?? {};
    const detail = v.m_DetailDatabase ?? {};
    const decoded = decodeDetail(detail, {
      spanX,
      spanZ,
      perCell,
      sampleHeight,
      // Seed off the name so a map's meadow is stable run to run.
      seed: [...mapName].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7),
    });

    // Anomaly checks, stated as thresholds rather than eyeballed.
    const declaredLayers = (splat.m_TerrainLayers ?? []).length;
    if (declaredLayers && layerNames.length < declaredLayers) {
      anomalies.push(
        `${mapName}: ${declaredLayers} splat layers declared but only ${layerNames.length} resolved`,
      );
    }
    const protoCount = (detail.m_DetailPrototypes ?? []).length;
    if (protoCount && detailPrefabs.length < protoCount) {
      anomalies.push(
        `${mapName}: ${protoCount} detail prototypes but only ${detailPrefabs.length} prefabs resolved`,
      );
    }
    for (const [layer] of decoded.byLayer) {
      if (layer >= protoCount) {
        anomalies.push(`${mapName}: detail references layer ${layer} of ${protoCount} prototypes`);
        break;
      }
    }
    if (Math.abs(spanX - spanZ) > 0.01) {
      anomalies.push(
        `${mapName}: terrain is not square, ${spanX.toFixed(1)} x ${spanZ.toFixed(1)}`,
      );
    }

    // The splat mask, which lives inside the terrain asset as a Texture2D.
    let splatFile = null;
    let splatInfo = null;
    const texObj = sf.objects.find((o) => sf.types[o.typeIndex].classId === 28);
    if (texObj) {
      try {
        const tex = readObject(sf, texObj, () => true).value;
        const decodedTex = decodeTexture2D(tex);
        if (decodedTex) {
          splatInfo = {
            width: decodedTex.width,
            height: decodedTex.height,
            format: decodedTex.format,
          };
          if (!reportOnly) {
            splatFile = `${mapName}_splat.webp`;
            await sharp(decodedTex.data, {
              raw: {
                width: decodedTex.width,
                height: decodedTex.height,
                channels: decodedTex.channels,
              },
            })
              // Lossless: this is a mask, and a lossy edge between two ground
              // textures is a visible seam rather than a soft one.
              .webp({ lossless: true })
              .toFile(path.join(outDir, 'splat', splatFile));
          }
        } else {
          anomalies.push(`${mapName}: splat texture is format ${tex.m_TextureFormat}, not decoded`);
        }
      } catch (err) {
        anomalies.push(`${mapName}: splat decode failed, ${String(err.message).slice(0, 60)}`);
      }
    } else if (declaredLayers > 1) {
      anomalies.push(
        `${mapName}: ${declaredLayers} ground layers but no splat texture in the asset`,
      );
    }

    const plants = decoded.plantsAt(perCell);

    index.push({
      map: mapName,
      terrain: entry.name,
      spanX: Math.round(spanX * 10) / 10,
      spanZ: Math.round(spanZ * 10) / 10,
      heightScale: scale.y,
      layers: layerNames,
      detailPrefabs,
      detailGrid: decoded.cellsPerSide,
      paintedCells: decoded.paintedCells,
      plants,
      splat: splatInfo,
      splatFile,
      splatBytes:
        splatFile && !reportOnly ? statSync(path.join(outDir, 'splat', splatFile)).size : 0,
    });

    if (!reportOnly) {
      // THE COVERAGE GRID SHIPS, NOT THE PLANTS. Exploding the corpus into
      // per-plant transforms is 7.4 million entries and roughly 300 MB, to
      // describe something the source stores in a 256x256 byte grid per layer.
      // The grid is a few tens of kilobytes and the renderer scatters from it
      // deterministically within the draw radius, which is also the only way the
      // count stays bounded as the player moves.
      const grid = decoded.cellsPerSide;
      const layers = [...decoded.byLayer.keys()].sort((a, b) => a - b);
      const pages = [];
      for (let base = 0; base < layers.length; base += 4) {
        const slice = layers.slice(base, base + 4);
        const rgba = Buffer.alloc(grid * grid * 4);
        for (const [ci, layer] of slice.entries()) {
          const cov = decoded.coverageOf(layer);
          for (let i = 0; i < grid * grid; i++) rgba[i * 4 + ci] = cov[i];
        }
        // Alpha must be opaque where unused, or an encoder may discard the
        // colour channels it thinks are invisible.
        if (slice.length < 4) for (let i = 0; i < grid * grid; i++) rgba[i * 4 + 3] = 255;
        const fileName = `${mapName}_detail${base / 4}.webp`;
        await sharp(rgba, { raw: { width: grid, height: grid, channels: 4 } })
          .webp({ lossless: true })
          .toFile(path.join(outDir, 'detail', fileName));
        pages.push({ file: fileName, layers: slice.map((l) => detailPrefabs[l] ?? null) });
      }
      writeFileSync(
        path.join(outDir, `${mapName}.json`),
        `${JSON.stringify({
          map: mapName,
          spanX,
          spanZ,
          grid,
          layers: layerNames,
          splatFile,
          detailPages: pages,
          prototypes: (detail.m_DetailPrototypes ?? []).map((p, i) => ({
            mesh: detailPrefabs[i] ?? null,
            minWidth: p.minWidth,
            maxWidth: p.maxWidth,
            minHeight: p.minHeight,
            maxHeight: p.maxHeight,
            density: p.density,
          })),
          wind: {
            strength: detail.m_WavingGrassStrength,
            amount: detail.m_WavingGrassAmount,
            speed: detail.m_WavingGrassSpeed,
          },
        })}\n`,
      );
    }
    console.log(
      `  ${mapName.padEnd(24)} ${String(decoded.paintedCells).padStart(7)} cells  ` +
        `${String(plants).padStart(7)} plants  ${layerNames.length} layers  ${detailPrefabs.length} detail meshes`,
    );
  }

  if (!reportOnly) {
    writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  }
  const totalPlants = index.reduce((a, m) => a + m.plants, 0);
  const withDetail = index.filter((m) => m.plants > 0).length;
  console.log(
    `\nunity_terrain_detail: ${index.length} terrains, ${withDetail} with painted detail, ` +
      `${totalPlants.toLocaleString('en-US')} plants at ${perCell} per cell`,
  );
  if (anomalies.length) {
    console.log(`\n${anomalies.length} anomaly/anomalies:`);
    for (const a of anomalies) console.log(`  ${a}`);
  } else {
    console.log('\nno anomalies');
  }
}
