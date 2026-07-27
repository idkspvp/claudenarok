// Content integration checks: referential integrity across the merged
// content tables, and the XP pacing budget that keeps leveling 1-20 free of
// forced grinding. These tests are content-shape tests: they run against
// whatever the content modules currently export, so they hold as zones grow.
import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  ALL_RECIPES,
  CAMPS,
  CLASSES,
  DUNGEON_LIST,
  GATHER_NODES,
  GROUND_OBJECTS,
  ITEMS,
  MOBS,
  NPCS,
  REWARD_ARCHETYPE,
  ROADS,
  WORLD_MAX_X,
  WORLD_MAX_Z,
  WORLD_MIN_X,
  WORLD_MIN_Z,
  ZONES,
} from '../src/sim/data';
import { canEquipItem } from '../src/sim/equipment_rules';
import { HARVEST_COMPONENT_ITEMS, NODE_MATERIAL_TABLE } from '../src/sim/professions/gathering';
import { Sim } from '../src/sim/sim';
import {
  ALL_CLASSES,
  KILLS_PER_LEVEL,
  MAX_LEVEL,
  mobXpValue,
  XP_TABLE,
  xpForLevel,
  type ZoneDef,
} from '../src/sim/types';
import { terrainHeight, WATER_LEVEL } from '../src/sim/world';

const WORLD_SEED = 20061; // production seed (main.ts / server/game.ts)
const SCRIPTED_COLLECT_ITEMS = new Set(['the_codfather']);

// The complete set of ways a collect-objective item can legitimately enter a
// player's bags. The mob-loot / ground-object / scripted trio is the original
// model, plus the two gathering acquisition paths the work-order
// materials use: gather-node harvest (NODE_MATERIAL_TABLE grants copper_ore,
// ironbark_log, goldleaf_herb in their zones) and corpse harvest
// (HARVEST_COMPONENT_ITEMS maps a component tag to game_meat, spider_silk,
// rough_hide, etc). Both the obtainability check and its negative control call
// this one predicate, so the negative control proves the REAL model, not a copy.
function collectItemAcquirable(itemId: string): boolean {
  const fromLoot = Object.values(MOBS).some((m) => m.loot.some((l) => l.itemId === itemId));
  const fromGround = GROUND_OBJECTS.some((g) => g.itemId === itemId);
  const fromScript = SCRIPTED_COLLECT_ITEMS.has(itemId);
  const fromNode = Object.values(NODE_MATERIAL_TABLE).some((byZone) =>
    Object.values(byZone).some((row) => row.itemId === itemId),
  );
  const fromHarvest = Object.values(HARVEST_COMPONENT_ITEMS).includes(itemId);
  return fromLoot || fromGround || fromScript || fromNode || fromHarvest;
}

describe('content referential integrity', () => {
  it('all loot tables, vendor stock, camps and dungeon spawns resolve', () => {
    const problems: string[] = [];
    for (const m of Object.values(MOBS)) {
      for (const l of m.loot) {
        if (l.itemId && !ITEMS[l.itemId]) problems.push(`${m.id}: loot ${l.itemId} missing`);
      }
    }
    for (const npc of Object.values(NPCS)) {
      for (const itemId of npc.vendorItems ?? []) {
        if (!ITEMS[itemId]) problems.push(`${npc.id}: vendor item ${itemId} missing`);
        else if (!ITEMS[itemId].buyValue && !ITEMS[itemId].priceHonor)
          problems.push(`${npc.id}: vendor item ${itemId} has no purchase price`);
      }
    }
    for (const c of CAMPS) {
      if (!MOBS[c.mobId])
        problems.push(`camp at (${c.center.x},${c.center.z}): mob ${c.mobId} missing`);
    }
    for (const g of GROUND_OBJECTS) {
      if (!ITEMS[g.itemId]) problems.push(`ground object ${g.itemId} missing from ITEMS`);
    }
    for (const d of DUNGEON_LIST) {
      for (const s of d.spawns) {
        if (!MOBS[s.mobId]) problems.push(`${d.id}: spawn ${s.mobId} missing`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('zones tile the world strip and content sits inside its zone band', () => {
    for (let i = 0; i + 1 < ZONES.length; i++) {
      expect(ZONES[i].zMax).toBe(ZONES[i + 1].zMin);
    }
    const problems: string[] = [];
    const inWorld = (x: number, z: number) =>
      x > WORLD_MIN_X && x < WORLD_MAX_X && z > WORLD_MIN_Z && z < WORLD_MAX_Z;
    for (const zone of ZONES) {
      expect(zone.hub.z).toBeGreaterThanOrEqual(zone.zMin);
      expect(zone.hub.z).toBeLessThan(zone.zMax);
    }
    for (const npc of Object.values(NPCS)) {
      if (!inWorld(npc.pos.x, npc.pos.z))
        problems.push(`${npc.id} outside world at (${npc.pos.x},${npc.pos.z})`);
    }
    for (const c of CAMPS) {
      if (!inWorld(c.center.x, c.center.z)) problems.push(`camp ${c.mobId} outside world`);
    }
    for (const g of GROUND_OBJECTS) {
      for (const p of g.positions) {
        if (!inWorld(p.x, p.z))
          problems.push(`${g.itemId} sparkle outside world at (${p.x},${p.z})`);
      }
    }
    for (const d of DUNGEON_LIST) {
      if (!inWorld(d.doorPos.x, d.doorPos.z)) problems.push(`${d.id} door outside world`);
    }
    expect(problems).toEqual([]);
  });

  it('roads never dip into deep water (sampled every ~4yd)', () => {
    const problems: string[] = [];
    for (const road of ROADS) {
      for (let i = 0; i + 1 < road.length; i++) {
        const a = road[i],
          b = road[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const h = terrainHeight(x, z, WORLD_SEED);
          if (h < WATER_LEVEL - 0.5) {
            problems.push(
              `road point (${x.toFixed(1)},${z.toFixed(1)}) underwater (h=${h.toFixed(2)})`,
            );
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('class kits fit the 12-slot action bar and ranks are ordered', () => {
    for (const def of Object.values(CLASSES)) {
      expect(def.abilities.length).toBeGreaterThan(0);
      for (const id of def.abilities) {
        const ab = ABILITIES[id];
        expect(ab, `ability ${id} of ${def.id}`).toBeTruthy();
        expect(ab.learnLevel).toBeLessThanOrEqual(MAX_LEVEL);
        let prev = ab.learnLevel;
        for (const r of ab.ranks ?? []) {
          expect(r.level, `${id} rank ${r.rank} level ordering`).toBeGreaterThanOrEqual(prev);
          prev = r.level;
        }
      }
    }
  });
});

// The talent-row unlock block that stood here went with the talent trees
// (Phase D0).

// The XP curve's SHAPE is the thing worth pinning, not its 99 values: it is
// generated from growth bands, so asserting the output against itself would prove
// nothing. Each assertion names a property of classic Ragnarok pacing that a
// careless edit to the bands would break, stated as a literal so the test cannot
// drift along with the generator.
//
// These lived inside the "xp pacing budget" describe, alongside the per-zone
// quest-XP headroom assertions. Those went with the quest system; these did not.
describe('xp curve shape', () => {
  const total = XP_TABLE.slice(0, MAX_LEVEL - 1).reduce((a, b) => a + b, 0);

  it('reaches the level cap', () => {
    expect(XP_TABLE.length).toBeGreaterThanOrEqual(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(99);
  });

  it('opens with the near-free early levels of the RO curve', () => {
    // Levels 1 to 20 are minutes of play there, not the hours the old 107,795-XP
    // curve charged. If this creeps back into five figures the early game has
    // silently become a grind again.
    expect(XP_TABLE[0]).toBe(10);
    const throughTwenty = XP_TABLE.slice(0, 19).reduce((a, b) => a + b, 0);
    expect(throughTwenty).toBeLessThan(10_000);
    expect(throughTwenty / total).toBeLessThan(0.001);
  });

  it('puts the difficulty budget in the last fifteen levels', () => {
    const lastFifteen = XP_TABLE.slice(84, MAX_LEVEL - 1).reduce((a, b) => a + b, 0);
    expect(lastFifteen / total).toBeGreaterThan(0.6);
    expect(lastFifteen / total).toBeLessThan(0.95);
  });

  it('spans six orders of magnitude from the first level to the last', () => {
    const ratio = XP_TABLE[MAX_LEVEL - 2] / XP_TABLE[0];
    expect(ratio).toBeGreaterThan(1_000_000);
    expect(ratio).toBeLessThan(20_000_000);
  });

  it('never gets cheaper as levels climb', () => {
    for (let i = 1; i < XP_TABLE.length; i++) {
      expect(
        XP_TABLE[i],
        `level ${i + 1}->${i + 2} costs less than the one before`,
      ).toBeGreaterThan(XP_TABLE[i - 1]);
    }
  });

  // Mob XP is derived from the curve, so the grind stays the same length whether a
  // level costs 10 XP or 64 million. That coupling is the point of the derivation.
  it('holds kills-per-level flat once the floor stops binding', () => {
    for (const level of [20, 40, 60, 80, 98]) {
      const kills = xpForLevel(level) / mobXpValue(level, level);
      expect(kills, `kills per level at ${level}`).toBeGreaterThan(KILLS_PER_LEVEL * 0.9);
      expect(kills, `kills per level at ${level}`).toBeLessThan(KILLS_PER_LEVEL * 1.1);
    }
  });
});
