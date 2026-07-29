// Copy one map's baked assets into public/, so a browser can fetch them.
//
// Everything upstream of this writes into the gitignored tmp/ tree. A map only
// becomes loadable once its four pieces sit under public/ together: the instance
// table that says what goes where, the prop GLBs it references, the atlases those
// props sample, and the terrain it stands on.
//
// A map is CHEAP because the prop pool is shared. Sunny_Meadows_1 is 48 GLBs,
// 14 atlases, one terrain and one table: 2.65 MiB for a walkable world. Staging a
// second map that reuses the same trees copies almost nothing new.
//
// USAGE
//   node scripts/assets/stage_spiritvale_map.mjs <map> [<map> ...]
//     [--instances <dir>] [--props <dir>] [--atlas <dir>] [--terrain <dir>]
//     [--out <dir>]   default public/spiritvale
//     [--clean]       remove the output directory first

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { propFileName } from './map_placements.mjs';

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const VALUED = new Set(['--instances', '--props', '--atlas', '--terrain', '--out']);
  const maps = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  if (!maps.length) {
    console.log(
      'usage: node scripts/assets/stage_spiritvale_map.mjs <map> [<map> ...] [--out dir]',
    );
    process.exit(1);
  }
  const instDir = flag('--instances', 'tmp/instances');
  const propDir = flag('--props', 'tmp/sv_props');
  const atlasDir = flag('--atlas', 'tmp/atlas');
  const terrainDir = flag('--terrain', 'tmp/terrain');
  const outDir = flag('--out', 'public/spiritvale');

  if (argv.includes('--clean') && existsSync(outDir))
    rmSync(outDir, { recursive: true, force: true });
  for (const sub of ['maps', 'props', 'atlas', 'terrain']) {
    mkdirSync(path.join(outDir, sub), { recursive: true });
  }

  const terrainIndex = existsSync(path.join(terrainDir, 'index.json'))
    ? JSON.parse(readFileSync(path.join(terrainDir, 'index.json'), 'utf8'))
    : [];
  const atlasIndex = JSON.parse(readFileSync(path.join(atlasDir, 'index.json'), 'utf8'));
  const atlasByName = new Map((atlasIndex.atlases ?? []).map((a) => [a.atlas, a]));

  const stagedProps = new Set();
  const stagedAtlases = new Set();
  const staged = [];
  let missingProps = 0;

  for (const map of maps) {
    const tablePath = path.join(instDir, `${map}.json`);
    if (!existsSync(tablePath)) {
      console.error(`  SKIP ${map}: no instance table at ${tablePath}`);
      continue;
    }
    const table = JSON.parse(readFileSync(tablePath, 'utf8'));

    // The terrain's world origin lives in the terrain index, not in the GLB, so
    // it travels with the map record rather than being rediscovered at runtime.
    const terrain = terrainIndex.find((t) => t.map === map) ?? null;
    if (terrain && existsSync(path.join(terrainDir, `${map}.glb`))) {
      copyFileSync(path.join(terrainDir, `${map}.glb`), path.join(outDir, 'terrain', `${map}.glb`));
    }

    for (const b of table.batches) {
      const file = `${propFileName(b.mesh)}.glb`;
      if (!stagedProps.has(file)) {
        const src = path.join(propDir, file);
        if (existsSync(src)) {
          copyFileSync(src, path.join(outDir, 'props', file));
          stagedProps.add(file);
        } else missingProps++;
      }
      for (const a of b.atlases) {
        if (!a || stagedAtlases.has(a)) continue;
        const src = path.join(atlasDir, `${a}.webp`);
        if (existsSync(src)) {
          copyFileSync(src, path.join(outDir, 'atlas', `${a}.webp`));
          stagedAtlases.add(a);
        }
      }
    }

    writeFileSync(
      path.join(outDir, 'maps', `${map}.json`),
      `${JSON.stringify({
        ...table,
        terrain: terrain
          ? { file: `${map}.glb`, origin: terrain.origin, size: terrain.size }
          : null,
      })}\n`,
    );
    staged.push(map);
  }

  const dirBytes = (sub) =>
    readdirSync(path.join(outDir, sub)).reduce(
      (a, f) => a + statSync(path.join(outDir, sub, f)).size,
      0,
    );
  const total = ['maps', 'props', 'atlas', 'terrain'].reduce((a, s) => a + dirBytes(s), 0);
  writeFileSync(
    path.join(outDir, 'index.json'),
    `${JSON.stringify({ maps: staged, props: stagedProps.size, atlases: stagedAtlases.size }, null, 2)}\n`,
  );
  console.log(
    `stage_spiritvale_map: ${staged.length} map(s) -> ${outDir}\n` +
      `  ${stagedProps.size} props, ${stagedAtlases.size} atlases, ${(total / 1048576).toFixed(2)} MiB total`,
  );
  if (missingProps) console.error(`  ${missingProps} referenced prop GLB(s) were missing`);
}
