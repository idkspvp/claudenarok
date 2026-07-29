// Reduce a map's MESH VARIETY without leaving holes in it.
//
// The problem this solves, measured rather than assumed: the largest town places
// 6,911 props drawn from 495 distinct meshes, which costs 11.6 MiB to download
// and 495 draw calls to render.
//
// THIS PAIRS WITH INSTANCING, NOT WITH MERGING, and getting that backwards was
// the first attempt. Merged size is the sum over PLACEMENTS of each one's mesh
// bytes, so swapping which mesh a placement uses barely moves it and can make it
// worse when the substitute is the heavier model. Instanced size is the sum over
// DISTINCT meshes, each downloaded once and reused without limit, so halving the
// variety halves the download and the draw calls together. Measured on that same
// town: 495 meshes cost 11.62 MiB and 495 calls, 128 cost 1.44 MiB and 128.
//
// SUBSTITUTE, NEVER DELETE. Dropping the rare props would thin the map out and
// leave gaps exactly where a designer put something deliberate. Instead every
// retired mesh is redirected to the nearest surviving one, so the same number of
// objects stands in the same places and only the variety falls.
//
// NEAREST is decided by the source's own naming, which is systematic:
// `SM_Bld_Castle_Wall_01` and `SM_Bld_Castle_Wall_04` are variants of one family,
// so swapping between them is invisible at play distance.
//
// ROLE IS A HARD WALL, and this is the correction that made the output usable.
// Ranking substitutes on shared name PREFIX alone rated Roof and Wall as close,
// because `Bld_Castle_Roof_*` and `Bld_Castle_Wall_*` share two tokens. The
// result put a door where a roof corner belonged and a window wall where a beam
// cap belonged. These are architectural kit pieces that have to MEET each other,
// so a wrong role does not read as a variation, it reads as a hole. A prop may
// only be substituted within its own role, and a prop whose role has no survivor
// is KEPT rather than mangled. That costs a few meshes over the target and is
// the right trade.
//
// USAGE
//   node scripts/assets/reduce_map_variety.mjs <layoutDir> <propManifest> <outDir>
//     [--keep <n>]        distinct meshes to keep per map (default 256)
//     [--maps <a,b,c>]
//     [--report-only]     print the curve and write nothing
//
// With --report-only it prints, for a range of keep counts, the resulting mesh
// count, estimated merged size, and how many placements would take a
// cross-family substitute. That curve is the thing to choose a number from.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const has = (n) => argv.includes(n);
const VALUED = new Set(['--keep', '--maps']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));

/** The family a mesh belongs to: its name with the trailing variant number and
 *  any orientation/size suffix removed. `Bld_Castle_Wall_01` -> `Bld_Castle_Wall`. */
export function familyOf(name) {
  return name
    .replace(/^SM_/, '')
    .replace(/_\d+$/, '')
    .replace(/_(L|R|Left|Right|Angle|Half|Corner|End|Mid|Short|Long|Large|Small)$/i, '');
}

/** The structural job a kit piece does. Two pieces with different roles are
 *  never interchangeable however similar their names look: a roof that becomes a
 *  door leaves a hole in the roof AND a door hanging in the air.
 *
 *  Ordered longest-first so `Wall_Window` is read as a window rather than a wall. */
const ROLES = [
  'Battlements',
  'Archway',
  'Railing',
  'Stairs',
  'Pillar',
  'Window',
  'Ceiling',
  'Bridge',
  'Column',
  'Beam',
  'Roof',
  'Wall',
  'Door',
  'Floor',
  'Gate',
  'Fence',
  'Tile',
  'Step',
  'Path',
  'Rock',
  'Tree',
  'Bush',
  'Grass',
  'Plant',
];

export function roleOf(name) {
  for (const r of ROLES) if (new RegExp(`(^|_)${r}`, 'i').test(name)) return r;
  // No recognised structural role. Fall back to the OBJECT'S OWN NAME, because
  // the alternative is worse than it sounds: everything unrecognised shares the
  // empty role and becomes one interchangeable bucket, which is how a bench
  // turned into a flag, bunting into a ladder, and a wall bracket into a hanging
  // chain. A prop with no structural role is only interchangeable with its own
  // kind.
  const parts = name.replace(/^SM_/, '').split('_');
  // Drop the category prefix (Bld / Env / Prop / Wep) so Prop_Bench and
  // Env_Bench would still match; keep the noun that follows.
  const noun = /^(Bld|Env|Prop|Wep|Veh|Gen)$/i.test(parts[0]) ? parts[1] : parts[0];
  return `#${(noun ?? '').toLowerCase()}`;
}

/** The art set a piece belongs to (Bld_Castle, Bld_Ruins, Env_Dwarf). Same role
 *  in a different set still reads as a different building, so this is preferred
 *  when choosing between otherwise equal substitutes. */
export function themeOf(name) {
  return name.replace(/^SM_/, '').split('_').slice(0, 2).join('_');
}

/** How close two meshes are, 0 (unrelated) to 3 (same family), or -1 when they
 *  are not interchangeable at all. Used to pick the least visible substitute. */
export function affinity(a, b) {
  // Different structural roles are not a distant match, they are NOT a match.
  const ra = roleOf(a);
  const rb = roleOf(b);
  if (ra !== rb) return -1;
  if (a === b) return 3;
  const fa = familyOf(a);
  const fb = familyOf(b);
  if (fa === fb) return 3;
  const pa = fa.split('_');
  const pb = fb.split('_');
  let shared = 0;
  while (shared < pa.length && shared < pb.length && pa[shared] === pb[shared]) shared++;
  // Two shared leading tokens (Bld_Castle) is a near miss; one (Bld) is a
  // visible swap; none is a last resort.
  return Math.min(2, shared);
}

/**
 * Choose which meshes to keep and what every retired one becomes.
 *
 * Keeps the most-PLACED meshes, because those are what the map looks like: a
 * mesh used 400 times is the map's texture, one used twice is a detail.
 *
 * A retired mesh then takes the kept mesh with the highest family affinity, and
 * among equals the one CLOSEST IN SIZE. Breaking ties toward the most-used mesh
 * instead (the first attempt) swapped pebbles for castle walls: visually absurd
 * and, since the substitute is drawn at every one of the original's positions,
 * more expensive than what it replaced.
 */
export function planReduction(placements, keepCount, manifest = null) {
  const uses = new Map();
  for (const p of placements) uses.set(p.name, (uses.get(p.name) ?? 0) + 1);

  const ranked = [...uses.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const keep = ranked.slice(0, keepCount).map(([n]) => n);
  const retire = ranked.slice(keepCount).map(([n]) => n);
  const keepSet = new Set(keep);

  /** A mesh's triangle count, for choosing a substitute of similar bulk. */
  const sizeOf = (n) => manifest?.get(n)?.tris ?? 0;

  const substitute = new Map();
  const quality = { same: 0, near: 0, visible: 0, lastResort: 0 };
  /** Meshes that had to be kept past the target because nothing in their role
   *  survived. Reported so the overshoot is visible rather than silent. */
  const forced = [];

  for (const name of retire) {
    let best = null;
    let bestScore = -1;
    let bestRank = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    const want = sizeOf(name);
    for (const k of keep) {
      const score = affinity(name, k);
      if (score < 0) continue;
      // Same art set beats a different one at equal affinity: a ruined archway
      // and a castle archway are both archways, but they are not the same
      // building.
      const sameTheme = themeOf(name) === themeOf(k) ? 1 : 0;
      // Log-space so "twice as big" costs the same whether the props are small
      // or large; a flat difference would let every tiny prop match every other
      // tiny prop equally well and ignore shape entirely.
      const delta = Math.abs(Math.log((sizeOf(k) || 1) / (want || 1)));
      // Rank on affinity, then art set, then bulk.
      const rank = score * 2 + sameTheme;
      if (rank > bestRank || (rank === bestRank && delta < bestDelta)) {
        best = k;
        bestRank = rank;
        bestScore = score;
        bestDelta = delta;
      }
    }
    // Nothing in this role survived. Keep the original: a kit piece with no
    // same-role stand-in has no acceptable substitute, and dropping it would
    // leave the hole this whole module exists to avoid.
    if (!best) {
      keep.push(name);
      keepSet.add(name);
      forced.push(name);
      continue;
    }
    substitute.set(name, best);
    const n = uses.get(name) ?? 0;
    if (bestScore === 3) quality.same += n;
    else if (bestScore === 2) quality.near += n;
    else if (bestScore === 1) quality.visible += n;
    else quality.lastResort += n;
  }

  return { keep, keepSet, substitute, uses, quality, forced };
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [layoutDir, manifestPath, outDir] = positional;
  if (!layoutDir || !manifestPath) {
    console.log(
      'usage: node scripts/assets/reduce_map_variety.mjs <layoutDir> <propManifest> <outDir> [--keep n] [--report-only]',
    );
    process.exit(1);
  }
  const manifest = new Map(JSON.parse(readFileSync(manifestPath, 'utf8')).map((m) => [m.name, m]));
  // 256 rather than a tighter number, chosen from the measured curve rather than
  // by feel. Going 192 -> 256 costs 2 MiB of pool and 0.59 MiB on the heaviest
  // map, and halves both the props that change model (717 -> 289) and the ones
  // that cross art sets (55 -> 29). The saving is already banked by then: the
  // largest town drops from 11.62 MiB to under 6 either way. Past 256 the
  // returns fall off sharply.
  const keepCount = Number(flag('--keep', '256'));
  const reportOnly = has('--report-only');
  const only = flag('--maps')
    ?.split(',')
    .map((s) => s.trim());

  let files = readdirSync(layoutDir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  if (only) files = files.filter((f) => only.includes(path.basename(f, '.json')));

  if (!reportOnly) mkdirSync(outDir, { recursive: true });

  /** What a set of placements costs INSTANCED: each distinct mesh downloaded once
   *  and drawn once per frame, however many times it appears. This is the number
   *  variety reduction actually moves. */
  const instancedCost = (placements) => {
    const distinct = new Set(placements.map((p) => p.name));
    let bytes = 0;
    for (const n of distinct) bytes += manifest.get(n)?.bytes ?? 0;
    return { bytes, draws: distinct.size };
  };

  for (const file of files.sort()) {
    const layout = JSON.parse(readFileSync(path.join(layoutDir, file), 'utf8'));
    const usable = layout.props.filter((p) => !p.inactive && manifest.has(p.name));
    if (!usable.length) continue;
    const distinct = new Set(usable.map((p) => p.name)).size;

    if (reportOnly) {
      const base = instancedCost(usable);
      console.log(`\n${layout.map}: ${usable.length} placements, ${distinct} distinct meshes`);
      console.log(
        `  as authored: ${(base.bytes / 1048576).toFixed(2)} MiB, ${base.draws} draw calls`,
      );
      for (const k of [48, 96, 128, 192, 256].filter((n) => n < distinct)) {
        const plan = planReduction(usable, k, manifest);
        const swapped = usable.map((p) => ({ ...p, name: plan.substitute.get(p.name) ?? p.name }));
        const cost = instancedCost(swapped);
        const q = plan.quality;
        const swaps = q.same + q.near + q.visible + q.lastResort;
        const exact = usable.length - swaps;
        console.log(
          `  keep ${String(k).padStart(3)}: ${(cost.bytes / 1048576).toFixed(2).padStart(6)} MiB, ` +
            `${String(cost.draws).padStart(3)} draws | ` +
            `${((100 * exact) / usable.length).toFixed(1).padStart(5)}% exact, ` +
            `same-family ${String(q.same).padStart(4)}, near ${String(q.near).padStart(4)}, ` +
            `VISIBLE ${String(q.visible + q.lastResort).padStart(4)}`,
        );
      }
      continue;
    }

    const plan = planReduction(usable, keepCount, manifest);
    const props = layout.props.map((p) => {
      if (!plan.substitute.has(p.name)) return p;
      // THE MATERIAL LIST DOES NOT SURVIVE A SUBSTITUTION. `mats` holds the guids
      // the prefab's MeshRenderer bound when drawing the RETIRED mesh, and they
      // describe that mesh's submeshes, not the replacement's. Carrying them over
      // textured 78 of the 246 swapped placements with the wrong atlas: a cannon
      // swapped to a cannon WHEEL kept the cannon's FantasyKingdom sheet while
      // the wheel's own art is on the GoblinWarCamp one. Dropping the field lets
      // the resolver fall through to the substitute's own mapping, which is the
      // only thing that still describes it.
      const { mats, ...rest } = p;
      void mats;
      return { ...rest, name: plan.substitute.get(p.name), was: p.name };
    });
    const out = {
      ...layout,
      props,
      reducedTo: plan.keep.length,
      substitutions: plan.substitute.size,
    };
    writeFileSync(path.join(outDir, file), `${JSON.stringify(out)}\n`);
    const q = plan.quality;
    const after = instancedCost(props.filter((p) => !p.inactive && manifest.has(p.name)));
    console.log(
      `  ${layout.map.padEnd(24)} ${String(distinct).padStart(4)} -> ${String(after.draws).padStart(3)} meshes, ` +
        `${(after.bytes / 1048576).toFixed(2).padStart(6)} MiB  visible swaps ${q.visible + q.lastResort}`,
    );
  }
}
