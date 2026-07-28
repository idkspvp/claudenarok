// Pair every monster in this game with its counterpart in the reference server's
// pre-renewal monster table, and print the pairing for review.
//
// This is the analytical half of taking the reference's monster values directly:
// deciding WHICH reference monster each of ours corresponds to. Applying the
// values is a separate pass, so the pairing can be read and argued with first.
//
// The reference clone lives outside this repo (see docs/design/ro-reference-source.md);
// point at it with RO_REFERENCE, default E:/ro-reference/rathena.
//
//   node scripts/ro_mob_match.mjs            print the table
//   node scripts/ro_mob_match.mjs --json     emit the id -> reference-name pairs
//
// NEIGHBOURHOODS, which is the load-bearing idea. A monster is balanced against
// the monsters it shares a map with, so pairing ours one at a time produced a
// zone whose sources were scattered across the reference world: a field wolf
// borrowed from one map and the wolf beside it from another twenty levels away.
// Instead each of OUR places (a zone's field, a dungeon) is matched to ONE
// reference MAP, and our monsters are then paired inside that map's roster.
// Whatever the reference balanced together stays together, which is what makes
// the numbers safe to lay out a map with.
//
// Within a neighbourhood the pairing is by RANK: our weakest takes their
// weakest, our strongest their strongest, spread proportionally when the two
// rosters are different sizes. Rank order is monotone, so neighbours of ours
// stay neighbours of theirs, which is the entire point. The neighbourhood
// itself is chosen by level centre AND spread, not centre alone.
//
// Excluded from the pool: event and quest dummies (the reference carries a pile
// at defence 100, magic defence 99 and zero experience, and they are not
// monsters). Boss-class monsters are matched only against our bosses: an MVP's
// health is an order of magnitude above a normal monster of its level, so
// letting one match an ordinary spawn is how a first pass gave a level-6 wolf
// eighteen hundred health.
import fs from 'node:fs';
import path from 'node:path';
import { DUNGEONS, MOBS, ZONES } from '../src/sim/data.ts';

const REFERENCE = process.env.RO_REFERENCE ?? 'E:/ro-reference/rathena';
const MOB_DB = path.join(REFERENCE, 'db/pre-re/mob_db.yml');
const SPAWN_DIRS = [
  path.join(REFERENCE, 'npc/pre-re/mobs/fields'),
  path.join(REFERENCE, 'npc/pre-re/mobs/dungeons'),
];

function parseReference() {
  const text = fs.readFileSync(MOB_DB, 'utf8');
  const byName = new Map();
  for (const chunk of text.split('\n  - Id:').slice(1)) {
    const g = (k) => {
      const m = chunk.match(new RegExp(String.raw`^    ${k}:\s*(\S+)`, 'm'));
      return m ? m[1] : undefined;
    };
    const num = (k) => {
      const v = g(k);
      return v === undefined ? undefined : Number(v);
    };
    const name = g('Name');
    if (!name) continue;
    byName.set(name.toLowerCase(), {
      aegis: g('AegisName'),
      name,
      level: num('Level') ?? 1,
      hp: num('Hp') ?? 1,
      baseExp: num('BaseExp') ?? 0,
      jobExp: num('JobExp') ?? 0,
      atk: num('Attack') ?? 0,
      atk2: num('Attack2') ?? 0,
      def: num('Defense') ?? 0,
      mdef: num('MagicDefense') ?? 0,
      str: num('Str') ?? 0,
      agi: num('Agi') ?? 0,
      vit: num('Vit') ?? 0,
      int: num('Int') ?? 0,
      dex: num('Dex') ?? 0,
      luk: num('Luk') ?? 0,
      range: num('AttackRange') ?? 1,
      size: (g('Size') ?? 'Medium').toLowerCase(),
      race: (g('Race') ?? 'Formless').toLowerCase(),
      element: (g('Element') ?? 'Neutral').toLowerCase(),
      elementLevel: num('ElementLevel') ?? 1,
      walkSpeed: num('WalkSpeed') ?? 400,
      attackDelay: num('AttackDelay') ?? 1000,
      boss: g('Class') === 'Boss',
      mvp: /Mvp: true/.test(chunk),
    });
  }
  return byName;
}

/** map name -> the monsters that spawn there, from the reference spawn scripts. */
function parseNeighbourhoods(byName) {
  const maps = new Map();
  for (const dir of SPAWN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))) {
      for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
        if (line.startsWith('//')) continue;
        const m = line.match(/^(\w+),[\d,]*\s+monster\s+(.+?)\t+(\d+),(\d+)/);
        if (!m) continue;
        const ref = byName.get(m[2].trim().toLowerCase());
        if (!ref) continue;
        // The neighbourhood is the REGION, not the single map. One reference map
        // holds about six monsters and our zones hold forty, so a map cannot
        // stand in for a zone; a region (every Prontera field, every level of the
        // Payon dungeon) is the unit that actually corresponds to one of ours.
        const key = file.replace('.txt', '');
        if (!maps.has(key)) maps.set(key, new Set());
        maps.get(key).add(ref);
      }
    }
  }
  return maps;
}

// A real, ordinary monster. Beyond the event and quest dummies, this rules out
// the special high-health spawns the reference scatters through otherwise normal
// regions: a level-5 Condor with eight thousand health and 200 to 400 attack is
// a scripted encounter wearing an ordinary monster's name, and pairing one of
// our starter mobs with it would be a disaster nobody would spot until they
// played it.
const isReal = (r) =>
  r.baseExp > 0 &&
  r.hp > 30 &&
  r.def < 90 &&
  r.mdef < 90 &&
  r.atk2 > 0 &&
  r.hp < 80 * (r.level + 4) ** 1.35;
const mid = (m) => Math.round((m.minLevel + m.maxLevel) / 2);

/** Our places: each zone's field, and each dungeon. */
function ourPlaces() {
  const places = [];
  const inDungeon = new Set();
  for (const d of Object.values(DUNGEONS)) {
    const ids = [...new Set((d.spawns ?? []).map((s) => s.mobId))].filter((id) => MOBS[id]);
    if (!ids.length) continue;
    for (const id of ids) inDungeon.add(id);
    places.push({ name: d.id, kind: 'dungeon', ids });
  }
  // Zone level bands overlap, so claim each monster for the FIRST zone that
  // wants it. Without this a monster in two bands is paired twice and the totals
  // come out above the roster size.
  const claimed = new Set(inDungeon);
  for (const zone of ZONES) {
    const [lo, hi] = zone.levelRange;
    const ids = Object.values(MOBS)
      .filter((m) => !claimed.has(m.id) && mid(m) >= lo && mid(m) <= hi)
      .map((m) => m.id);
    for (const id of ids) claimed.add(id);
    if (ids.length) places.push({ name: zone.id, kind: 'field', ids });
  }
  const rest = Object.keys(MOBS).filter((id) => !claimed.has(id));
  if (rest.length) places.push({ name: 'unplaced', kind: 'field', ids: rest });
  // Lowest band first, so the starter field gets first pick of the starter
  // region. Processing dungeons first let a level-8 crypt take Prontera's
  // fields and pushed the level-1 zone onto a region that starts at 14.
  const band = (p) => Math.min(...p.ids.map((id) => mid(MOBS[id])));
  return places.sort((a, b) => band(a) - band(b));
}

export function matchMonsters() {
  const byName = parseReference();
  const neighbourhoods = parseNeighbourhoods(byName);
  const places = ourPlaces();
  const usedMaps = new Set();
  const out = [];

  for (const place of places) {
    const mobs = place.ids.map((id) => MOBS[id]).sort((a, b) => mid(a) - mid(b));
    const bosses = mobs.filter((m) => m.boss || m.worldBoss);
    const normals = mobs.filter((m) => !m.boss && !m.worldBoss);
    const levels = mobs.map(mid);
    const lo = Math.min(...levels);
    const hi = Math.max(...levels);

    // Pick the one reference map whose roster covers this place's level band and
    // has enough ordinary monsters to go round.
    let bestMap = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [name, set] of neighbourhoods) {
      const roster = [...set].filter(isReal);
      const pool = roster.filter((r) => !r.boss && !r.mvp);
      // Three residents is enough to be a neighbourhood. Demanding one per
      // monster of ours ruled out every region for our two big zones, which hold
      // forty monsters against a region's twenty; repeating a resident is
      // already the cheap, intended outcome.
      if (pool.length < 3) continue;
      // Score by FIT: for each of our monsters, how far is the nearest resident
      // of this region? Summed, so a region is good when it actually has
      // monsters at the levels ours are at.
      //
      // This replaced a centre-and-spread score measured over the region's
      // minimum and maximum level, which a single outlier destroyed: Prontera's
      // fields are the reference's true starter ladder (Poring 1, Fabre 2, Pupa
      // 2, Picky 4, Condor 5, Hornet 8, Rocker 9) but carry one level-62 spawn,
      // so their "spread" read 1 to 62 and lost to Payon, whose roster jumps
      // straight from level 4 to level 14 with nothing in between.
      const rl = pool.map((r) => r.level).sort((a, b) => a - b);
      let fit = 0;
      for (const level of levels) {
        let nearest = Number.POSITIVE_INFINITY;
        for (const r of rl) nearest = Math.min(nearest, Math.abs(r - level));
        fit += nearest;
      }
      let score = fit / levels.length;
      // A region with far fewer residents than we have monsters makes everyone
      // share, so prefer one that can carry the roster, gently.
      if (pool.length < normals.length) score += (normals.length - pool.length) * 0.1;
      // One region per place: a world where three of our zones all borrow from
      // Prontera field is not a world with three zones in it.
      if (usedMaps.has(name)) score += 25;
      if (score < bestScore) {
        bestScore = score;
        bestMap = { name, pool, bosses: roster.filter((r) => r.boss || r.mvp) };
      }
    }
    if (!bestMap) {
      console.error(
        `no reference region fits ${place.name} (${normals.length} monsters, lv ${lo}-${hi})`,
      );
      continue;
    }
    usedMaps.add(bestMap.name);

    // Inside the neighbourhood, by RANK rather than by nearest level: our
    // weakest takes their weakest and our strongest their strongest, spread
    // proportionally when the two rosters are different sizes. Nearest-level
    // matching collapsed a whole zone onto whichever end of the region happened
    // to be crowded; rank order is monotone, so neighbours of ours stay
    // neighbours of theirs, which is the entire point of the exercise.
    const rank = (list, i, n) =>
      list[Math.min(list.length - 1, Math.floor((i * list.length) / Math.max(1, n)))];
    const ladder = [...bestMap.pool].sort((a, b) => a.level - b.level);
    normals.forEach((mob, i) => {
      out.push({ mob, ref: rank(ladder, i, normals.length), place: place.name, map: bestMap.name });
    });
    // Bosses take the neighbourhood's own bosses where it has them, and
    // otherwise the strongest thing living there.
    const bossLadder = [...(bestMap.bosses.length ? bestMap.bosses : bestMap.pool)].sort(
      (a, b) => a.level - b.level,
    );
    bosses.forEach((mob, i) => {
      out.push({
        mob,
        ref: rank(bossLadder, i, bosses.length),
        place: place.name,
        map: bestMap.name,
      });
    });
  }
  return out;
}

const pairs = matchMonsters();

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      Object.fromEntries(pairs.map((p) => [p.mob.id, { ref: p.ref.aegis, map: p.map }])),
      null,
      2,
    ),
  );
} else {
  let place = null;
  for (const p of pairs.sort(
    (a, b) => a.place.localeCompare(b.place) || a.ref.level - b.ref.level,
  )) {
    if (p.place !== place) {
      place = p.place;
      console.log(`\n${place}  <-  ${p.map}`);
    }
    console.log(
      `  ${p.mob.id.padEnd(32)} lv${String(mid(p.mob)).padStart(2)} -> ${p.ref.name.padEnd(20)} lv${String(p.ref.level).padStart(2)} hp${String(p.ref.hp).padStart(6)} atk${p.ref.atk}-${p.ref.atk2} def${p.ref.def} exp${p.ref.baseExp}/${p.ref.jobExp}`,
    );
  }
  console.error(`\npaired ${pairs.length} of ${Object.keys(MOBS).length}`);
}
