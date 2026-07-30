// Recover the ORDER the maps are meant to be played in.
//
// The imported maps arrive as 53 prefabs in whatever order the filesystem walks
// them, which says nothing about progression. SpiritVale keeps that separately:
// one MonoBehaviour config per map carrying MonsterMinLevel and MonsterMaxLevel,
// the monster pool, the spawn density and a reference to the map prefab. Sorting
// on the level band is the progression, and it is authored data rather than
// something to infer from map names.
//
// THE PREFAB JOIN IS BY NAME, AND IT IS NOT COMPLETE. Each config points at its
// prefab through an Addressables m_AssetGUID, and those guids do not match the
// regenerated .prefab.meta guids anywhere in this corpus, so the guid route
// resolves nothing. Normalising the names joins most of them; the rest are
// configs whose display name has no matching prefab basename ("Poison Cave",
// "Sewers"), which are reported rather than dropped, because a map with no
// prefab is content that did not survive the rip and someone should know.
//
// USAGE
//   node scripts/assets/unity_map_order.mjs <assetsDir> [<out.json>]
//     [--layouts <dir>]   cross-check against the imported layouts

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Map names differ between the config and the prefab by spacing and
 *  punctuation only ("Demon's Maw" against "Demons_Maw"), so compare on a form
 *  with both removed. */
export function normalizeMapName(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const num = (text, key) => {
  const m = text.match(new RegExp(`^\\s*${key}: (-?\\d+(?:\\.\\d+)?)\\s*$`, 'm'));
  return m ? Number(m[1]) : null;
};

/** One map config: the level band that orders it, plus what it spawns. */
export function parseMapConfig(text) {
  // `Id` is the stable key; m_Name repeats it, and DisplayName is what a player
  // sees. The monster pools are plain NAMES, not guids: reading them as guids
  // returned an empty pool for every map while looking like it worked.
  const id = text.match(/^\s*Id: (.*)$/m)?.[1]?.trim() ?? '';
  const name = text.match(/^\s*m_Name: (.*)$/m)?.[1]?.trim() ?? id;
  const minLevel = num(text, 'MonsterMinLevel');
  const maxLevel = num(text, 'MonsterMaxLevel');
  if (minLevel === null || maxLevel === null) return null;
  const listOf = (key) =>
    (text.match(new RegExp(`^\\s*${key}:\\s*\\n((?:\\s*-\\s.*\\n)*)`, 'm'))?.[1] ?? '')
      .split('\n')
      .map((l) => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  return {
    id,
    name,
    displayName: text.match(/^\s*DisplayName: (.*)$/m)?.[1]?.trim() || name,
    minLevel,
    maxLevel,
    biome: num(text, 'Biome'),
    difficulty: num(text, 'Difficulty'),
    density: num(text, 'Density'),
    type: num(text, 'Type'),
    monsters: listOf('MonsterPool'),
    bosses: listOf('BossPool'),
    bossRespawnSec: num(text, 'BossRespawnInterval'),
  };
}

/** Sort by the level band, then by name so the result is stable. A map with a
 *  wider band sits at its floor: that is where a player meets it. */
export function orderMaps(configs) {
  return [...configs].sort(
    (a, b) => a.minLevel - b.minLevel || a.maxLevel - b.maxLevel || a.name.localeCompare(b.name),
  );
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const VALUED = new Set(['--layouts']);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const [assetsDir, outFile] = positional;
  if (!assetsDir) {
    console.log(
      'usage: node scripts/assets/unity_map_order.mjs <assetsDir> [out.json] [--layouts dir]',
    );
    process.exit(1);
  }
  const layoutDir = flag('--layouts', 'tmp/sv_maps');

  const monoDir = path.join(assetsDir, 'MonoBehaviour');
  const configs = [];
  for (const f of readdirSync(monoDir)) {
    if (!f.endsWith('.asset')) continue;
    let text;
    try {
      text = readFileSync(path.join(monoDir, f), 'utf8');
    } catch {
      continue;
    }
    if (!text.includes('MonsterMinLevel')) continue;
    const cfg = parseMapConfig(text);
    if (cfg) configs.push(cfg);
  }

  // What actually got imported, to join against.
  const imported = new Map();
  if (existsSync(layoutDir)) {
    for (const f of readdirSync(layoutDir)) {
      if (!f.endsWith('.json') || f === 'index.json') continue;
      const base = path.basename(f, '.json');
      imported.set(normalizeMapName(base), base);
    }
  }

  const ordered = orderMaps(configs).map((c, i) => ({
    order: i + 1,
    ...c,
    prefab: imported.get(normalizeMapName(c.name)) ?? null,
  }));

  const joined = ordered.filter((m) => m.prefab).length;
  const unjoined = ordered.filter((m) => !m.prefab);
  const usedPrefabs = new Set(ordered.map((m) => m.prefab).filter(Boolean));
  const orphanPrefabs = [...imported.values()].filter((p) => !usedPrefabs.has(p));

  console.log(
    `unity_map_order: ${ordered.length} map configs, ${joined} joined to an imported map\n`,
  );
  console.log('  #   levels    map                        prefab');
  for (const m of ordered) {
    console.log(
      `  ${String(m.order).padStart(2)}  ${String(`${m.minLevel}-${m.maxLevel}`).padStart(7)}  ` +
        `${m.name.padEnd(26)} ${m.prefab ?? '(no imported prefab)'}`,
    );
  }
  if (unjoined.length) {
    console.log(`\n  ${unjoined.length} config(s) with no imported prefab:`);
    console.log(`    ${unjoined.map((m) => m.name).join(', ')}`);
  }
  if (orphanPrefabs.length) {
    console.log(`\n  ${orphanPrefabs.length} imported map(s) with no config, so no level band:`);
    console.log(`    ${orphanPrefabs.join(', ')}`);
  }

  if (outFile) {
    writeFileSync(
      outFile,
      `${JSON.stringify({ maps: ordered, unjoined: unjoined.map((m) => m.name), orphanPrefabs }, null, 2)}\n`,
    );
    console.log(`\n  wrote ${outFile}`);
  }
}
