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
// How the match is scored: level proximity DOMINATES, because a monster twenty
// levels away is the wrong monster however well its attributes line up. Race,
// attribute and size are penalties on top of that, and reuse is a penalty too so
// one reference monster does not end up standing in for a dozen of ours.
//
// Excluded from the pool: event and quest dummies (the reference carries a pile
// at defence 100, magic defence 99 and zero experience, and they are not
// monsters), and boss-class monsters are matched only against our bosses. An
// MVP's health is an order of magnitude above a normal monster of its level, so
// letting one match an ordinary spawn is how a level-6 wolf ends up with
// eighteen hundred health.
import fs from 'node:fs';
import path from 'node:path';
import { MOBS } from '../src/sim/data.ts';

const REFERENCE = process.env.RO_REFERENCE ?? 'E:/ro-reference/rathena';
const DB = path.join(REFERENCE, 'db/pre-re/mob_db.yml');

function parseReference() {
  const text = fs.readFileSync(DB, 'utf8');
  const rows = [];
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
    rows.push({
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
  return rows;
}

// Our attribute names against the reference's.
const ELEMENT_ALIAS = { shadow: 'dark' };
const alias = (e) => ELEMENT_ALIAS[e] ?? e;

const RACE_PENALTY = 8;
const ELEMENT_PENALTY = 5;
const SIZE_PENALTY = 3;
const REUSE_PENALTY = 4;

export function matchMonsters(reference, mobs) {
  const real = reference.filter(
    (r) => r.baseExp > 0 && r.hp > 30 && r.def < 90 && r.mdef < 90 && r.atk2 > 0,
  );
  const normals = real.filter((r) => !r.boss && !r.mvp);
  const bosses = real.filter((r) => r.boss || r.mvp);
  const used = new Map();
  const out = [];
  for (const mob of mobs) {
    const level = Math.round((mob.minLevel + mob.maxLevel) / 2);
    const pool = mob.boss || mob.worldBoss ? bosses : normals;
    let bestRow = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const r of pool) {
      let score = Math.abs(r.level - level);
      if (r.race !== mob.race) score += RACE_PENALTY;
      if (r.element !== alias(mob.element)) score += ELEMENT_PENALTY;
      if (r.size !== mob.size) score += SIZE_PENALTY;
      score += (used.get(r.aegis) ?? 0) * REUSE_PENALTY;
      if (score < bestScore) {
        bestScore = score;
        bestRow = r;
      }
    }
    if (!bestRow) continue;
    used.set(bestRow.aegis, (used.get(bestRow.aegis) ?? 0) + 1);
    out.push({ mob, ref: bestRow, ourLevel: level });
  }
  return out;
}

const reference = parseReference();
const pairs = matchMonsters(reference, Object.values(MOBS));

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(Object.fromEntries(pairs.map((p) => [p.mob.id, p.ref.aegis])), null, 2),
  );
} else {
  for (const { mob, ref, ourLevel } of pairs) {
    console.log(
      `${mob.id.padEnd(32)} lv${String(ourLevel).padStart(2)} ${String(mob.race).padEnd(10)}${String(mob.element).padEnd(8)}${String(mob.size).padEnd(7)}` +
        ` -> ${ref.name.padEnd(22)} lv${String(ref.level).padStart(2)} hp${String(ref.hp).padStart(6)} atk${ref.atk}-${ref.atk2} def${ref.def} mdef${ref.mdef} exp${ref.baseExp}/${ref.jobExp}`,
    );
  }
  const gap = pairs.reduce((sum, p) => sum + Math.abs(p.ref.level - p.ourLevel), 0) / pairs.length;
  console.error(
    `\npaired ${pairs.length} of ${Object.keys(MOBS).length}, mean level gap ${gap.toFixed(1)}`,
  );
}
