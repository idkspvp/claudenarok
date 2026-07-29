// The seven base-class skill trees.
//
// Two jobs. The FRESHNESS gate (regenerate, then diff) proves the committed
// content is derived from the current raw data, in the same shape as the wiki
// gate in tests/guide.test.ts. Everything else pins facts a regeneration cannot
// check, because a consistently-wrong generator regenerates identically: the
// grid join, the closure, the enum mapping, and the traps the source's shape
// sets.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  maxLevelOf,
  nodesFor,
  recordFor,
  SPIRITVALE_PASSIVES,
  SPIRITVALE_SKILLS,
  SPIRITVALE_STATUSES,
  SPIRITVALE_SUMMONS,
  SPIRITVALE_TREES,
  treeFor,
} from '../src/sim/content/skills';
import { valueAt } from '../src/sim/skills/scaling';

const repo = new URL('..', import.meta.url);
const raw = (name: string) =>
  JSON.parse(readFileSync(new URL(`docs/design/data/spiritvale-raw/${name}`, repo), 'utf8'));

const BASE_CLASS_IDS = [
  'acolyte',
  'archer',
  'knight',
  'mage',
  'summoner',
  'swordman',
  'thief',
] as const;

describe('freshness', () => {
  it('matches the raw data (regenerating leaves the committed files unchanged)', () => {
    execFileSync('node', ['scripts/spiritvale/build_skills.mjs'], { cwd: repo });
    expect(() =>
      execFileSync('git', ['diff', '--exit-code', '--', 'src/sim/content/skills/'], {
        cwd: repo,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });
});

describe('the seven trees', () => {
  it('carries exactly the seven base classes, and no advanced one', () => {
    expect(Object.keys(SPIRITVALE_TREES).sort()).toEqual([...BASE_CLASS_IDS]);
    // Named explicitly so an advanced tree cannot arrive unnoticed by widening a
    // count. Berserker is Warrior's advancement and is a later phase's business.
    for (const advanced of ['berserker', 'wizard', 'priest', 'paladin', 'weaver']) {
      expect(SPIRITVALE_TREES[advanced]).toBeUndefined();
    }
  });

  it('places 93 nodes, and every one resolves in exactly one table', () => {
    const nodes = Object.values(SPIRITVALE_TREES).flatMap((t) => t.nodes);
    expect(nodes).toHaveLength(93);
    for (const n of nodes) {
      const rec = recordFor(n);
      expect(rec, `${n.id} resolves`).toBeDefined();
      // A node names one table and never both: an id in both would make
      // recordFor's isPassive branch load-bearing in a way nothing else checks.
      const inActive = Boolean(SPIRITVALE_SKILLS[n.id]);
      const inPassive = Boolean(SPIRITVALE_PASSIVES[n.id]);
      expect(inActive && inPassive, `${n.id} is in both tables`).toBe(false);
      expect(n.isPassive ? inPassive : inActive).toBe(true);
    }
  });

  it('matches the published per-class counts', () => {
    const counts = Object.fromEntries(
      Object.entries(SPIRITVALE_TREES).map(([id, t]) => [id, t.nodes.length]),
    );
    expect(counts).toEqual({
      acolyte: 13,
      archer: 10,
      knight: 14,
      mage: 14,
      summoner: 19,
      swordman: 10,
      thief: 13,
    });
  });

  it('is seven wide on every class, and four or five rows deep', () => {
    // The WIDTH is uniform and is what the window can lay out blind. The HEIGHT
    // is not: Acolyte and Rogue publish a fifth row and the other five do not,
    // so a window that hardcodes four would clip two trees. Pinned per class
    // rather than asserted uniform, because that was the wrong assumption.
    const rowsByClass = Object.fromEntries(
      Object.entries(SPIRITVALE_TREES).map(([id, t]) => [id, t.rows]),
    );
    expect(rowsByClass).toEqual({
      acolyte: 5,
      archer: 4,
      knight: 4,
      mage: 4,
      summoner: 4,
      swordman: 4,
      thief: 5,
    });
    for (const [id, t] of Object.entries(SPIRITVALE_TREES)) {
      expect(t.cols, `${id} width`).toBe(7);
      expect(t.maxJobLevel, `${id} job cap`).toBe(50);
      const cells = t.nodes.map((n) => `${n.row}:${n.col}`);
      expect(new Set(cells).size, `${id} has two nodes in one cell`).toBe(cells.length);
      for (const n of t.nodes) {
        expect(n.row, `${id}/${n.id} row`).toBeGreaterThanOrEqual(1);
        expect(n.row).toBeLessThanOrEqual(t.rows);
        expect(n.col).toBeGreaterThanOrEqual(1);
        expect(n.col).toBeLessThanOrEqual(t.cols);
      }
    }
  });
});

describe('prerequisites', () => {
  it('names a node in the SAME tree, by engine id, at a reachable level', () => {
    // The raw data writes a requirement against the display SLUG. If the
    // generator failed to resolve it, this would be naming an id that exists
    // nowhere, and a runtime gate would silently never open.
    for (const [classId, t] of Object.entries(SPIRITVALE_TREES)) {
      const own = new Set(t.nodes.map((n) => n.id));
      for (const n of t.nodes) {
        for (const r of n.requires) {
          expect(own.has(r.id), `${classId}/${n.id} requires ${r.id}, not in its tree`).toBe(true);
          expect(r.level).toBeGreaterThanOrEqual(1);
          expect(r.level, `${classId}/${n.id} requires ${r.id} above its cap`).toBeLessThanOrEqual(
            maxLevelOf(r.id),
          );
        }
      }
    }
  });

  it('has no cycles, so every node is reachable from an unrequired root', () => {
    for (const [classId, t] of Object.entries(SPIRITVALE_TREES)) {
      const byId = new Map(t.nodes.map((n) => [n.id, n]));
      const settled = new Set<string>();
      // Repeatedly take every node whose requirements are already settled. If a
      // pass adds nothing while nodes remain, what is left is a cycle.
      for (let pass = 0; pass < t.nodes.length + 1; pass++) {
        const before = settled.size;
        for (const n of t.nodes) {
          if (settled.has(n.id)) continue;
          if (n.requires.every((r) => settled.has(r.id))) settled.add(n.id);
        }
        if (settled.size === before) break;
      }
      const stuck = t.nodes.filter((n) => !settled.has(n.id)).map((n) => n.id);
      expect(stuck, `${classId} has unreachable nodes (a prerequisite cycle)`).toEqual([]);
      expect(settled.size).toBe(byId.size);
    }
  });

  it('gives every tree at least one node that needs nothing', () => {
    for (const [classId, t] of Object.entries(SPIRITVALE_TREES)) {
      const roots = t.nodes.filter((n) => n.requires.length === 0);
      expect(roots.length, `${classId} has no root`).toBeGreaterThan(0);
    }
  });
});

describe('the closure', () => {
  it('resolves every status a skill applies', () => {
    const refs = new Set<string>();
    for (const s of Object.values(SPIRITVALE_SKILLS)) {
      for (const r of s.statuses ?? []) refs.add(r.id);
      for (const r of s.selfStatuses ?? []) refs.add(r.id);
    }
    expect(refs.size).toBeGreaterThan(40);
    for (const id of refs) expect(SPIRITVALE_STATUSES[id], `status ${id}`).toBeDefined();
  });

  it('resolves every status a status procs, and every skill a summon knows', () => {
    for (const st of Object.values(SPIRITVALE_STATUSES)) {
      for (const p of st.procs ?? [])
        expect(SPIRITVALE_STATUSES[p.id], `proc ${p.id}`).toBeDefined();
    }
    for (const s of Object.values(SPIRITVALE_SUMMONS)) {
      for (const sk of s.skills) {
        expect(SPIRITVALE_SKILLS[sk.id], `${s.id} knows ${sk.id}`).toBeDefined();
      }
      if (sk_targetStatuses(s).length) {
        for (const id of sk_targetStatuses(s)) {
          expect(SPIRITVALE_STATUSES[id], `${s.id} target status ${id}`).toBeDefined();
        }
      }
    }
  });

  it('resolves every summon a skill calls, and gives it the six attributes', () => {
    const refs = Object.values(SPIRITVALE_SKILLS)
      .map((s) => s.summon?.ref)
      .filter((r): r is string => Boolean(r));
    expect(new Set(refs).size).toBe(4);
    for (const ref of refs) {
      const s = SPIRITVALE_SUMMONS[ref];
      expect(s, `summon ${ref}`).toBeDefined();
      // A summon publishes no HP, MP or ATK: its whole combat profile is derived
      // from these six, so a missing one is a pet with no body.
      expect(s.stats.map((m) => m.stat)).toEqual(['Str', 'Agi', 'Vit', 'Int', 'Dex', 'Luk']);
    }
  });

  it('carries no record the trees cannot reach', () => {
    // The generator emits a closure, not the whole 279/185/29. An unreferenced
    // record means the closure widened by accident.
    const placed = new Set(
      Object.values(SPIRITVALE_TREES).flatMap((t) => t.nodes.map((n) => n.id)),
    );
    const summonKnown = new Set(
      Object.values(SPIRITVALE_SUMMONS).flatMap((s) => s.skills.map((k) => k.id)),
    );
    for (const id of Object.keys(SPIRITVALE_SKILLS)) {
      expect(placed.has(id) || summonKnown.has(id), `${id} is emitted but unreachable`).toBe(true);
    }
    for (const id of Object.keys(SPIRITVALE_PASSIVES)) {
      expect(placed.has(id), `passive ${id} is emitted but unplaced`).toBe(true);
    }
  });
});

describe('the shape traps', () => {
  it('keeps healing as negative damage on an ally-targeted skill', () => {
    const heal = SPIRITVALE_SKILLS.Heal;
    expect(heal).toBeDefined();
    expect(heal.targetType).toBe('ally');
    expect(heal.damage?.base).toBeLessThan(0);
    expect(valueAt(heal.damage as { base: number; per: number }, 5)).toBeLessThan(0);
  });

  it('puts a self-targeted skill s buff in statuses, not selfStatuses', () => {
    // statuses applies to the RESOLVED target, and for a self skill that is the
    // caster. A port that reads selfStatuses for self skills finds nothing.
    const selfSkills = Object.values(SPIRITVALE_SKILLS).filter((s) => s.targetType === 'self');
    expect(selfSkills.length).toBeGreaterThan(10);
    const withRider = selfSkills.filter((s) => (s.statuses ?? []).length > 0);
    expect(withRider.length).toBeGreaterThan(selfSkills.filter((s) => s.selfStatuses).length);
  });

  it('never gives a self-targeted skill an aim mode that needs a pick', () => {
    // The orthogonality check that the enum labels rest on. If this ever fails,
    // castType and targetType were mapped onto each other by mistake.
    for (const s of Object.values(SPIRITVALE_SKILLS)) {
      if (s.targetType !== 'self') continue;
      expect(['none', 'toggle'], `${s.id} is self but aimed`).toContain(s.castType);
      expect(s.area?.base ?? 0, `${s.id} is self but has an area`).toBe(0);
    }
  });

  it('gives every toggle a zero cast time, duration and cooldown', () => {
    for (const s of Object.values(SPIRITVALE_SKILLS)) {
      if (s.castType !== 'toggle') continue;
      expect(s.castTime?.base ?? 0, `${s.id} toggle cast time`).toBe(0);
      expect(s.duration?.base ?? 0, `${s.id} toggle duration`).toBe(0);
      expect(s.cooldown?.base ?? 0, `${s.id} toggle cooldown`).toBe(0);
    }
  });

  it('groups the four summons in one exclusive slot', () => {
    const summonSkills = Object.values(SPIRITVALE_SKILLS).filter((s) => s.summon);
    expect(summonSkills).toHaveLength(4);
    for (const s of summonSkills) {
      expect(s.exclusiveGroup, `${s.id} group`).toBe('summon');
      expect(s.summon?.exclusive).toBe(true);
      expect(s.classes).toEqual(['summoner']);
    }
  });
});

describe('against the raw source directly', () => {
  it('carries the same name, maxLevel and grid position as the published class data', () => {
    // Independent of the generator: re-derives the join from the raw JSON and
    // compares. A generator bug that regenerates consistently is exactly what
    // the freshness gate cannot see, and this is the case that would catch it.
    const all = raw('spiritvale-all-classes.json');
    const idFor = (
      cls: { gridLayout: Record<string, string[]> },
      s: { position: { row: number; col: number } },
    ) => cls.gridLayout[String(s.position.row - 1)][s.position.col - 1];
    let checked = 0;
    for (const cls of Object.values(all.classes) as {
      type: string;
      slug: string;
      skills: {
        id: string;
        name: string;
        maxLevel: number;
        position: { row: number; col: number };
      }[];
      gridLayout: Record<string, string[]>;
    }[]) {
      if (cls.type !== 'base') continue;
      for (const s of cls.skills) {
        const id = idFor(cls, s);
        const rec = SPIRITVALE_SKILLS[id] ?? SPIRITVALE_PASSIVES[id];
        expect(rec, `${cls.slug}/${s.id} -> ${id}`).toBeDefined();
        expect(rec.name, `${id} name`).toBe(s.name);
        expect(rec.maxLevel, `${id} maxLevel`).toBe(s.maxLevel);
        expect(rec.slug, `${id} slug`).toBe(s.id);
        const node = nodesFor(
          {
            Warrior: 'swordman',
            Rogue: 'thief',
            Scout: 'archer',
            Acolyte: 'acolyte',
            Mage: 'mage',
            Knight: 'knight',
            Summoner: 'summoner',
          }[cls.slug.charAt(0).toUpperCase() + cls.slug.slice(1)] ?? '',
        ).find((n) => n.id === id);
        expect(node, `${id} placed`).toBeDefined();
        expect([node?.row, node?.col]).toEqual([s.position.row, s.position.col]);
        checked++;
      }
    }
    expect(checked).toBe(93);
  });

  it('carries the same numbers as the published combat data', () => {
    const combat = raw('skills-combat.json');
    let checked = 0;
    for (const [id, s] of Object.entries(SPIRITVALE_SKILLS)) {
      const src = combat.skills[id];
      expect(src, `${id} in raw`).toBeDefined();
      for (const [ours, theirs] of [
        ['damage', 'dmg'],
        ['cost', 'cost'],
        ['cooldown', 'cooldown'],
        ['castTime', 'castTime'],
        ['area', 'area'],
        ['duration', 'duration'],
      ] as const) {
        const mine = s[ours] ?? { base: 0, per: 0 };
        expect([mine.base, mine.per], `${id}.${ours}`).toEqual([src[theirs].base, src[theirs].per]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(400);
  });
});

/** Every status a summon's skills name as their target status. */
function sk_targetStatuses(s: { skills: readonly { targetStatus?: string }[] }): string[] {
  return s.skills.map((k) => k.targetStatus).filter((x): x is string => Boolean(x));
}

describe('the class trees line up with the rest of the game', () => {
  it('gives a tree to every class the health map and the opening blocks name', () => {
    // These three tables must agree on what a base class IS. Two of them already
    // list all seven; this is the third.
    expect(Object.keys(SPIRITVALE_TREES).sort()).toEqual([...BASE_CLASS_IDS]);
    expect(treeFor('swordman')?.archetype).toBe('Warrior');
    expect(treeFor('thief')?.archetype).toBe('Rogue');
    expect(treeFor('archer')?.archetype).toBe('Scout');
    expect(treeFor('mage')?.archetype).toBe('Mage');
    expect(treeFor('acolyte')?.archetype).toBe('Acolyte');
    expect(treeFor('knight')?.archetype).toBe('Knight');
    expect(treeFor('summoner')?.archetype).toBe('Summoner');
  });

  it('costs more points to max a tree than a career grants, on every class', () => {
    // The reference's own design: 120 career points against trees costing 150 to
    // 198, so every build ends short. If a tree were ever cheap enough to max,
    // the skill budget would have stopped being a choice.
    for (const [classId, t] of Object.entries(SPIRITVALE_TREES)) {
      const cost = t.nodes.reduce((n, node) => n + maxLevelOf(node.id), 0);
      expect(cost, `${classId} full tree cost`).toBeGreaterThan(50);
    }
  });
});
