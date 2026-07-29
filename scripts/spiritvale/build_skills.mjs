// Generates src/sim/content/skills/*.generated.ts from the raw SpiritVale
// export in docs/design/data/spiritvale-raw/.
//
// Run via `npm run skills:content`. The build runs it and the committed output
// is freshness-checked in tests/spiritvale_skills.test.ts, in the same shape as
// the wiki generator (scripts/wiki/build_content.mjs) and its guide.test.ts
// gate: regenerate, then `git diff --exit-code`.
//
// Deterministic by construction: it reads two JSON files and writes TypeScript.
// No clock, no randomness, no network. Every collection it emits is sorted by a
// stable key so a re-run cannot reorder anything.
//
// THE JOIN, because it is not obvious from either file alone:
//   - A class's `gridLayout` is an object keyed "0".."3", each a 7-wide array of
//     ENGINE ids. A skill's engine id is gridLayout[row-1][col-1], read off its
//     own `position`. The `id` on the class-side skill record is a display SLUG
//     and often differs (`axe-quicken` is `TwohandQuicken`).
//   - `.skills` is keyed by engine id (key === record.id on all 279).
//   - `.passives` is keyed by a kebab SLUG and its key NEVER equals record.id.
//     Index it by `.id` or all 22 base passives silently vanish.
//
// Verified before this generator was written: all 93 base-class placements
// resolve (71 active, 22 passive, 0 missing), and the two raw files agree on all
// 150 numbers they both publish (31 damage, 119 cost/cooldown, plus every
// maxLevel), which is what proves the grid join is the right one.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const RAW = path.join(root, 'docs', 'design', 'data', 'spiritvale-raw');
const OUT = path.join(root, 'src', 'sim', 'content', 'skills');

const readRaw = (name) => JSON.parse(readFileSync(path.join(RAW, name), 'utf8'));
const allClasses = readRaw('spiritvale-all-classes.json');
const combat = readRaw('skills-combat.json');

// The reference's base classes, mapped onto this game's class ids. The mapping is
// the same one class_health_map.ts and class_blocks.ts already assert, and it
// needs no invention: these classes ARE the first jobs the reference's base
// classes were built from. Knight and Summoner have no counterpart yet and take
// their own ids.
const CLASS_ID_BY_ARCHETYPE = {
  Warrior: 'swordman',
  Rogue: 'thief',
  Scout: 'archer',
  Acolyte: 'acolyte',
  Mage: 'mage',
  Knight: 'knight',
  Summoner: 'summoner',
};

// Enum labels, derived from the data rather than published. Nothing in
// mechanics.json or wiki-strings-en.json names these fields or any of their
// values; the labels below come from a full cross-tab plus per-value description
// evidence, recorded in docs/design/spiritvale-coverage.md.
const CAST_TYPE = ['none', 'unit', 'ground', 'toggle'];
const TARGET_TYPE = ['enemy', 'ally', 'allyOther', 'self', 'any', 'summon', 'summonOther', 'grave'];
const EXCLUSIVE_GROUP = ['none', 'weaponEnchant', 'stance', 'aura', 'summon', 'coating'];

const activeById = combat.skills;
// Index passives by their RECORD id, never by the object key (see the join note).
const passiveById = {};
for (const p of Object.values(combat.passives)) passiveById[p.id] = p;
const statusById = combat.statuses;
const summonById = combat.summons;

const baseClasses = Object.entries(allClasses.classes)
  .filter(([, c]) => c.type === 'base')
  .sort(([a], [b]) => a.localeCompare(b));

/** The engine id for a placed skill, read off the class grid. */
const engineIdOf = (cls, skill) => {
  const row = cls.gridLayout[String(skill.position.row - 1)];
  if (!row) throw new Error(`no grid row ${skill.position.row} on ${cls.displayName}`);
  const id = row[skill.position.col - 1];
  if (!id) throw new Error(`empty grid cell for ${cls.displayName}/${skill.id}`);
  return id;
};

// ---------------------------------------------------------------------------
// Collect: which engine ids each base class places, and who owns what.
// ---------------------------------------------------------------------------

/** engine id -> sorted class ids that place it. A few skills are shared. */
const ownersOf = new Map();
/** engine id -> the class-side record (for slug, maxLevel, requirements). */
const placementOf = new Map();
const trees = [];

for (const [archetype, cls] of baseClasses) {
  const classId = CLASS_ID_BY_ARCHETYPE[archetype];
  if (!classId) throw new Error(`no class id mapped for base class ${archetype}`);
  const nodes = [];
  for (const skill of cls.skills) {
    const id = engineIdOf(cls, skill);
    const isPassive = Boolean(skill.isPassive);
    const table = isPassive ? passiveById : activeById;
    if (!table[id]) {
      throw new Error(
        `${archetype}/${skill.id}: ${id} missing from ${isPassive ? 'passives' : 'skills'}`,
      );
    }
    if (!ownersOf.has(id)) ownersOf.set(id, new Set());
    ownersOf.get(id).add(classId);
    // A shared skill keeps the first placement's slug and maxLevel; assert the
    // later ones agree rather than silently taking the last.
    const prior = placementOf.get(id);
    if (prior && (prior.slug !== skill.id || prior.maxLevel !== skill.maxLevel)) {
      throw new Error(
        `${id} placed inconsistently: ${prior.slug}/${prior.maxLevel} vs ${skill.id}/${skill.maxLevel}`,
      );
    }
    if (!prior) {
      placementOf.set(id, {
        slug: skill.id,
        maxLevel: skill.maxLevel,
        isPassive,
        // The ACTIVE records in skills-combat.json carry no description at all;
        // only passives and statuses do. The class-side record is the one place
        // an active's prose exists, so it is read from here rather than there.
        description: skill.description ?? '',
      });
    }

    nodes.push({
      id,
      isPassive,
      row: skill.position.row,
      col: skill.position.col,
      // A requirement names another node by its display SLUG. Resolve it to the
      // engine id so the runtime never has to carry two id spaces.
      requires: (skill.requirements ?? []).map((r) => {
        const target = cls.skills.find((s) => s.id === r.id);
        if (!target) throw new Error(`${archetype}/${skill.id}: requires unknown ${r.id}`);
        return { id: engineIdOf(cls, target), level: r.level };
      }),
    });
  }
  const rowKeys = Object.keys(cls.gridLayout);
  trees.push({
    classId,
    archetype,
    maxJobLevel: cls.maxJobLevel,
    rows: rowKeys.length,
    cols: Math.max(...rowKeys.map((k) => cls.gridLayout[k].length)),
    nodes: nodes.sort((a, b) => a.row - b.row || a.col - b.col),
  });
}

// ---------------------------------------------------------------------------
// Closure: the statuses and summons the placed skills actually reach, plus the
// skills a summon itself knows. Everything else in the 185/29 stays out of the
// generated tree until the phase that needs it.
// ---------------------------------------------------------------------------

const activeIds = new Set([...placementOf].filter(([, p]) => !p.isPassive).map(([id]) => id));
const passiveIds = new Set([...placementOf].filter(([, p]) => p.isPassive).map(([id]) => id));

const neededStatuses = new Set();
const neededSummons = new Set();

const walkSkill = (rec) => {
  for (const s of rec.statuses ?? []) neededStatuses.add(s.id);
  for (const s of rec.selfStatuses ?? []) neededStatuses.add(s.id);
  if (rec.summon?.ref) neededSummons.add(rec.summon.ref);
};
for (const id of activeIds) walkSkill(activeById[id]);

// A summon drags in the skills it knows and the statuses those apply. Summoner
// is a BASE class, so this closure belongs to this phase, not to the advanced one.
const summonSkillIds = new Set();
for (const ref of neededSummons) {
  const s = summonById[ref];
  if (!s) throw new Error(`summon ${ref} not found`);
  for (const sk of s.skills ?? []) {
    summonSkillIds.add(sk.id);
    if (sk.targetStatus) neededStatuses.add(sk.targetStatus);
  }
}
for (const id of summonSkillIds) {
  const rec = activeById[id] ?? passiveById[id];
  if (!rec) throw new Error(`summon skill ${id} not found`);
  if (activeById[id]) walkSkill(activeById[id]);
}
// Statuses can proc other statuses. Close over that too.
for (let pass = 0; pass < 8; pass++) {
  const before = neededStatuses.size;
  for (const id of [...neededStatuses]) {
    const st = statusById[id];
    if (!st) throw new Error(`status ${id} not found`);
    for (const pr of st.procs ?? []) neededStatuses.add(pr.id);
  }
  if (neededStatuses.size === before) break;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const num = (n) => (Object.is(n, -0) ? '0' : String(n));
/** A `{base, per}` pair, or undefined when it says nothing. */
const scaled = (p) =>
  !p || (p.base === 0 && p.per === 0) ? null : `{ base: ${num(p.base)}, per: ${num(p.per)} }`;
const strList = (a) => `[${a.map(q).join(', ')}]`;

const mods = (list) =>
  `[${(list ?? [])
    .map(
      (m) =>
        `{ stat: ${q(m.stat)}, base: ${num(m.base)}, per: ${num(m.per)}${m.q ? `, q: ${q(m.q)}` : ''} }`,
    )
    .join(', ')}]`;

const riders = (list) => {
  const out = (list ?? []).map((r) => {
    const parts = [`id: ${q(r.id)}`, `duration: ${scaled(r.dur) ?? '{ base: 0, per: 0 }'}`];
    const c = scaled(r.chance);
    if (c) parts.push(`chance: ${c}`);
    const s = scaled(r.stacks);
    if (s) parts.push(`stacks: ${s}`);
    return `{ ${parts.join(', ')} }`;
  });
  return out.length ? `[${out.join(', ')}]` : null;
};

const skillRecord = (id) => {
  const rec = activeById[id];
  const place = placementOf.get(id);
  const owners = [...(ownersOf.get(id) ?? [])].sort();
  const lines = [
    `id: ${q(rec.id)}`,
    `slug: ${q(place?.slug ?? rec.id)}`,
    `name: ${q(rec.name)}`,
    `description: ${q(place?.description ?? rec.desc ?? '')}`,
    `maxLevel: ${place?.maxLevel ?? rec.maxLv}`,
    `classes: ${strList(owners)}`,
    `castType: ${q(CAST_TYPE[rec.castType])}`,
    `targetType: ${q(TARGET_TYPE[rec.targetType])}`,
    `element: ${q(rec.element)}`,
    `damageType: ${q(rec.damageType)}`,
  ];
  if (rec.exclusiveType) lines.push(`exclusiveGroup: ${q(EXCLUSIVE_GROUP[rec.exclusiveType])}`);
  const pairs = [
    ['damage', rec.dmg],
    ['hits', rec.hits],
    ['castTime', rec.castTime],
    ['cooldown', rec.cooldown],
    ['cost', rec.cost],
    ['area', rec.area],
    ['duration', rec.duration],
    ['velocity', rec.velocity],
    ['threat', rec.threat],
    ['comboReady', rec.comboReady],
    ['comboFinisher', rec.comboFinisher],
  ];
  for (const [name, p] of pairs) {
    const v = scaled(p);
    if (v) lines.push(`${name}: ${v}`);
  }
  for (const [name, on] of [
    ['hybrid', rec.hybrid],
    ['ignoreBlock', rec.ignoreBlock],
    ['triggerMultistrike', rec.triggerMultistrike],
    ['cloneCast', rec.cloneCast],
    ['attached', rec.attached],
  ]) {
    if (on) lines.push(`${name}: true`);
  }
  if (rec.autocastMult !== 1) lines.push(`autocastMultiplier: ${num(rec.autocastMult)}`);
  if ((rec.weaponTypes ?? []).length) lines.push(`weaponTypes: ${strList(rec.weaponTypes)}`);
  const st = riders(rec.statuses);
  if (st) lines.push(`statuses: ${st}`);
  const self = riders(rec.selfStatuses);
  if (self) lines.push(`selfStatuses: ${self}`);
  if (rec.summon?.ref) {
    lines.push(
      `summon: { ref: ${q(rec.summon.ref)}, count: ${scaled(rec.summon.count) ?? '{ base: 1, per: 0 }'}, exclusive: ${Boolean(rec.summon.exclusive)} }`,
    );
  }
  return `  ${q(rec.id)}: {\n${lines.map((l) => `    ${l},`).join('\n')}\n  },`;
};

const passiveRecord = (id) => {
  const rec = passiveById[id];
  const place = placementOf.get(id);
  const owners = [...(ownersOf.get(id) ?? [])].sort();
  return [
    `  ${q(rec.id)}: {`,
    `    id: ${q(rec.id)},`,
    `    slug: ${q(place?.slug ?? rec.id)},`,
    `    name: ${q(rec.name)},`,
    `    description: ${q(place?.description || rec.desc || '')},`,
    `    maxLevel: ${place?.maxLevel ?? rec.maxLv},`,
    `    classes: ${strList(owners)},`,
    `    values: ${mods(rec.values)},`,
    `    effects: ${strList(rec.effects ?? [])},`,
    '  },',
  ].join('\n');
};

const statusRecord = (id) => {
  const rec = statusById[id];
  const lines = [
    `id: ${q(rec.id)}`,
    `name: ${q(rec.name)}`,
    `description: ${q(rec.desc ?? '')}`,
    `element: ${q(rec.element)}`,
    `damage: ${num(rec.damage)}`,
    `damagePercent: ${num(rec.damagePerc)}`,
    `tick: ${num(rec.tick)}`,
    `isDot: ${Boolean(rec.dot)}`,
    `stackable: ${Boolean(rec.stackable)}`,
    `maxStacks: ${num(rec.maxStacks)}`,
    `stacksRefresh: ${Boolean(rec.stacksRefresh)}`,
    `category: ${num(rec.category)}`,
    `mods: ${mods(rec.mods)}`,
  ];
  const pr = riders(rec.procs);
  if (pr) lines.push(`procs: ${pr}`);
  lines.push(`effect: ${q(rec.effect ?? '')}`);
  return `  ${q(rec.id)}: {\n${lines.map((l) => `    ${l},`).join('\n')}\n  },`;
};

const summonRecord = (id) => {
  const rec = summonById[id];
  const skills = (rec.skills ?? [])
    .map((s) => {
      const parts = [
        `id: ${q(s.id)}`,
        `level: ${num(s.lv)}`,
        `chance: ${num(s.chance)}`,
        `castTime: ${num(s.ct)}`,
        `cooldown: ${num(s.cd)}`,
      ];
      if (s.targetStatus) parts.push(`targetStatus: ${q(s.targetStatus)}`);
      parts.push(`castType: ${q(CAST_TYPE[s.castType])}`);
      return `      { ${parts.join(', ')} },`;
    })
    .join('\n');
  return [
    `  ${q(rec.id)}: {`,
    `    id: ${q(rec.id)},`,
    `    name: ${q(rec.name)},`,
    `    hostile: ${Boolean(rec.hostile)},`,
    `    stats: ${mods(rec.stats)},`,
    `    skills: [\n${skills}\n    ],`,
    '  },',
  ].join('\n');
};

const header = (what) => `// GENERATED by scripts/spiritvale/build_skills.mjs. Do not edit by hand.
// Source: docs/design/data/spiritvale-raw/. Regenerate with \`npm run skills:content\`;
// tests/spiritvale_skills.test.ts fails if the committed output has drifted.
//
// ${what}
`;

mkdirSync(OUT, { recursive: true });

const sorted = (set) => [...set].sort();

writeFileSync(
  path.join(OUT, 'skills.generated.ts'),
  `${header(`The ${activeIds.size} active skills the seven base trees place, plus the ${summonSkillIds.size} a summoned pet knows.`)}
import type { SkillDef } from './types';

export const SPIRITVALE_SKILLS: Readonly<Record<string, SkillDef>> = {
${sorted(new Set([...activeIds, ...[...summonSkillIds].filter((i) => activeById[i])]))
  .map(skillRecord)
  .join('\n')}
};
`,
);

writeFileSync(
  path.join(OUT, 'passives.generated.ts'),
  `${header(`The ${passiveIds.size} passive skills the seven base trees place.`)}
import type { SkillPassiveDef } from './types';

export const SPIRITVALE_PASSIVES: Readonly<Record<string, SkillPassiveDef>> = {
${sorted(passiveIds).map(passiveRecord).join('\n')}
};
`,
);

writeFileSync(
  path.join(OUT, 'statuses.generated.ts'),
  `${header(`The ${neededStatuses.size} statuses those skills reach, transitively closed over status procs.`)}
import type { StatusDef } from './types';

export const SPIRITVALE_STATUSES: Readonly<Record<string, StatusDef>> = {
${sorted(neededStatuses).map(statusRecord).join('\n')}
};
`,
);

writeFileSync(
  path.join(OUT, 'summons.generated.ts'),
  `${header(`The ${neededSummons.size} pets the Summoner tree calls.`)}
import type { SummonDef } from './types';

export const SPIRITVALE_SUMMONS: Readonly<Record<string, SummonDef>> = {
${sorted(neededSummons).map(summonRecord).join('\n')}
};
`,
);

const treeRecord = (t) => {
  const nodes = t.nodes
    .map((n) => {
      const req = n.requires.map((r) => `{ id: ${q(r.id)}, level: ${r.level} }`).join(', ');
      return `      { id: ${q(n.id)}, isPassive: ${n.isPassive}, row: ${n.row}, col: ${n.col}, requires: [${req}] },`;
    })
    .join('\n');
  return [
    `  ${q(t.classId)}: {`,
    `    classId: ${q(t.classId)},`,
    `    archetype: ${q(t.archetype)},`,
    `    maxJobLevel: ${t.maxJobLevel},`,
    `    rows: ${t.rows},`,
    `    cols: ${t.cols},`,
    `    nodes: [\n${nodes}\n    ],`,
    '  },',
  ].join('\n');
};

writeFileSync(
  path.join(OUT, 'trees.generated.ts'),
  `${header(`The seven base-class trees, laid out on the published ${trees[0].rows}x${trees[0].cols} grid.`)}
import type { SkillTree } from './types';

export const SPIRITVALE_TREES: Readonly<Record<string, SkillTree>> = {
${trees
  .sort((a, b) => a.classId.localeCompare(b.classId))
  .map(treeRecord)
  .join('\n')}
};
`,
);

const placed = trees.reduce((n, t) => n + t.nodes.length, 0);
process.stdout.write(
  `skills:content -> ${trees.length} trees, ${placed} placements ` +
    `(${activeIds.size} active + ${passiveIds.size} passive distinct), ` +
    `${summonSkillIds.size} summon skills, ${neededStatuses.size} statuses, ${neededSummons.size} summons\n`,
);
