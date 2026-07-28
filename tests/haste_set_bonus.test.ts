// Haste from item-set bonuses: the aggregated `haste` stat in aggregateSetBonuses,
// its derivation in recalcPlayerStats (one stat drives meleeHaste/rangedHaste/
// spellHaste), and the three application sites (spell cast time, channel duration,
// melee swing, ranged auto-shot). Haste enters the game ONLY through set bonuses:
// the tier-2 3-piece bonuses and the three leveling haste kits.
import { describe, expect, it } from 'vitest';
import { updatePlayerAutoAttack } from '../src/sim/combat/auto_attack';
import {
  aggregateSetBonuses,
  ITEM_SETS,
  SET_BOUNDSTONE_VANGUARD,
  SET_DEATHLORD,
  SET_GREYJAW_STALKER,
  SET_HASTE_3PC,
  SET_HASTE_3PC_RATING,
  SET_NIGHTTALON,
  SET_VALE_ARCANIST,
} from '../src/sim/content/item_sets';
import { ITEMS, MOBS } from '../src/sim/data';
import { createMob, type PlayerEquipment, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity, ItemDef, PlayerClass } from '../src/sim/types';
import { spreadAllocation } from './helpers/alloc';
import { fundCasts } from './helpers/sp';

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

const HASTE_KITS = [SET_VALE_ARCANIST, SET_BOUNDSTONE_VANGUARD, SET_GREYJAW_STALKER];

function setMembers(setId: string): ItemDef[] {
  // One member per EQUIPMENT slot, so slicing N members yields N equipped
  // pieces. The accessory slot kind is the exception and has to be counted as
  // the two concrete slots it fills: a set carrying both a belt and a pair of
  // gloves really does wear both at once, and collapsing them by item slot made
  // a four-piece set look like a three-piece one.
  const bySlot = new Map<string, ItemDef>();
  let accessories = 0;
  for (const i of Object.values(ITEMS)) {
    if (i.set !== setId || !i.slot) continue;
    if (i.slot === 'ring') {
      if (accessories >= 2) continue;
      bySlot.set(`ring${++accessories}`, i);
      continue;
    }
    if (!bySlot.has(i.slot)) bySlot.set(i.slot, i);
  }
  return [...bySlot.values()];
}

function equipmentOf(items: ItemDef[]): PlayerEquipment {
  let accessories = 0;
  return Object.fromEntries(
    items.map((i) => [i.slot === 'ring' ? `ring${++accessories}` : i.slot, i.id]),
  ) as PlayerEquipment;
}

function player(cls: PlayerClass, level = 20): { sim: AnySim; p: AnyEntity; pid: number } {
  const sim = new Sim({ seed: 7, playerClass: 'swordman', noPlayer: true }) as AnySim;
  const pid = sim.addPlayer(cls, 'Tester');
  sim.setPlayerLevel(level, pid);
  sim.tick();
  return { sim, p: sim.entities.get(pid) as AnyEntity, pid };
}

function spawnDummy(sim: AnySim, p: AnyEntity, dz = 2): AnyEntity {
  const mob = createMob(sim.nextId++, MOBS['forest_wolf'], 20, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + dz,
  }) as AnyEntity;
  mob.maxHp = 500000;
  mob.hp = 500000;
  mob.hostile = true;
  mob.aiState = 'idle';
  sim.addEntity(mob);
  p.facing = Math.atan2(mob.pos.x - p.pos.x, mob.pos.z - p.pos.z);
  sim.targetEntity(mob.id, p.id);
  return mob;
}

describe('haste kit definitions (leveling sets in the ITEM_SETS framework)', () => {
  it('each kit has exactly 3 tagged member items and a single 3-piece haste tier', () => {
    for (const setId of HASTE_KITS) {
      const members = setMembers(setId);
      expect(members.length, `${setId} member count`).toBe(3);
      const set = ITEM_SETS[setId];
      expect(set.bonuses.length).toBe(1);
      expect(set.bonuses[0].pieces).toBe(3);
      expect(set.bonuses[0].effect.hasteRating).toBe(SET_HASTE_3PC_RATING);
    }
  });

  it('kit members share the family armor type, where they have one', () => {
    // Accessories are typeless, so any class may wear one. That is the reference
    // game's rule and the reason a set can pair a mail helm with a belt: only
    // the ARMOUR in a kit has to match the family.
    const armorOf = (setId: string) =>
      setMembers(setId)
        .filter((i) => i.armorType)
        .map((i) => i.armorType);
    for (const [setId, family] of [
      [SET_VALE_ARCANIST, 'cloth'],
      [SET_BOUNDSTONE_VANGUARD, 'mail'],
      [SET_GREYJAW_STALKER, 'leather'],
    ] as const) {
      const types = armorOf(setId);
      expect(types.length, `${setId} has armour`).toBeGreaterThan(0);
      expect(new Set(types), setId).toEqual(new Set([family]));
    }
  });

  it('kit members cover 3 distinct equip slots (the set is completable)', () => {
    // Counted as EQUIPMENT slots, so the two accessory slots count separately:
    // a kit of a helm, a belt and a pair of gloves is worn in three places even
    // though two of its members declare the same slot kind.
    for (const setId of HASTE_KITS) {
      let accessories = 0;
      const slots = setMembers(setId).map((i) =>
        i.slot === 'ring' ? `ring${++accessories}` : i.slot,
      );
      expect(new Set(slots).size, `${setId} slots ${slots}`).toBe(3);
    }
  });
});

describe('aggregated haste (pure resolver)', () => {
  it('a haste kit grants haste only at the full 3 pieces', () => {
    const two = aggregateSetBonuses(new Map([[SET_VALE_ARCANIST, 2]]));
    expect(two.hasteRating).toBe(0);
    const three = aggregateSetBonuses(new Map([[SET_VALE_ARCANIST, 3]]));
    expect(three.hasteRating).toBe(SET_HASTE_3PC_RATING);
  });

  it('every tier-2 3-piece bonus includes haste; tier-1 bonuses do not', () => {
    const t2 = ['crownforged', 'nighttalon', 'soulflame', 'stormcallers'];
    for (const setId of t2) {
      expect(aggregateSetBonuses(new Map([[setId, 3]])).hasteRating, `${setId} 3pc haste`).toBe(
        SET_HASTE_3PC_RATING,
      );
      expect(aggregateSetBonuses(new Map([[setId, 2]])).hasteRating, `${setId} 2pc haste`).toBe(0);
    }
    for (const setId of ['deathlord', 'wyrmshadow', 'necromancers']) {
      expect(aggregateSetBonuses(new Map([[setId, 3]])).hasteRating, `${setId} 3pc haste`).toBe(0);
    }
  });
});

describe('set-bonus haste derivation (recalcPlayerStats)', () => {
  it('3 caster kit pieces set all three haste channels from the one stat', () => {
    const { p } = player('mage');
    const [a, b, c] = setMembers(SET_VALE_ARCANIST);
    recalcPlayerStats(p, 'mage', equipmentOf([a, b]), undefined, {}, spreadAllocation(p.level));
    expect(p.spellHaste).toBe(0);
    expect(p.meleeHaste).toBe(0);
    recalcPlayerStats(p, 'mage', equipmentOf([a, b, c]), undefined, {}, spreadAllocation(p.level));
    expect(p.spellHaste).toBe(SET_HASTE_3PC);
    expect(p.meleeHaste).toBe(SET_HASTE_3PC);
    expect(p.rangedHaste).toBe(SET_HASTE_3PC);
  });

  it('the tier-2 Nighttalon 3-piece adds haste on top of its agi/crit bonus', () => {
    const { p } = player('thief');
    recalcPlayerStats(
      p,
      'thief',
      equipmentOf(setMembers(SET_NIGHTTALON).slice(0, 3)),
      undefined,
      {},
      spreadAllocation(p.level),
    );
    expect(p.meleeHaste).toBe(SET_HASTE_3PC);
    expect(p.spellHaste).toBe(SET_HASTE_3PC);
    // the pre-existing 3pc payload still applies alongside the haste
    expect(p.critChance).toBeCloseTo(0.01 + p.stats.luk * 0.003 + 0.01);
  });

  it('the tier-1 Deathlord 3-piece grants no haste', () => {
    const { p } = player('swordman');
    recalcPlayerStats(
      p,
      'swordman',
      equipmentOf(setMembers(SET_DEATHLORD).slice(0, 3)),
      undefined,
      {},
      spreadAllocation(p.level),
    );
    expect(p.meleeHaste).toBe(0);
    expect(p.spellHaste).toBe(0);
  });
});

describe('spell haste shortens casts and channels', () => {
  it('a timed cast is (1 + spellHaste) times shorter', () => {
    const { sim, p, pid } = player('mage');
    spawnDummy(sim, p);
    fundCasts(p);

    p.spellHaste = 0;
    sim.castAbility('frostbolt', pid);
    const base = p.castTotal;
    expect(base).toBeGreaterThan(0);

    p.castingAbility = null;
    p.castRemaining = 0;
    p.gcdRemaining = 0;
    fundCasts(p);
    p.spellHaste = SET_HASTE_3PC;
    sim.castAbility('frostbolt', pid);
    expect(p.castTotal).toBeCloseTo(base / (1 + SET_HASTE_3PC), 6);
  });

  it('a channel is shortened and its tick interval scales with it', () => {
    const { sim, p, pid } = player('mage');
    // Aether Darts moved from the shared mage kit to Chronomancy after this
    // release test was written; select that spec so the channel actually starts.
    spawnDummy(sim, p);
    fundCasts(p);

    p.spellHaste = 0;
    sim.castAbility('arcane_missiles', pid);
    const baseTotal = p.castTotal;
    const baseTick = p.channelTickEvery;
    expect(baseTotal).toBeGreaterThan(0);

    p.castingAbility = null;
    p.channeling = false;
    p.castRemaining = 0;
    p.gcdRemaining = 0;
    fundCasts(p);
    p.spellHaste = SET_HASTE_3PC;
    sim.castAbility('arcane_missiles', pid);
    expect(p.castTotal).toBeCloseTo(baseTotal / (1 + SET_HASTE_3PC), 6);
    expect(p.channelTickEvery).toBeCloseTo(baseTick / (1 + SET_HASTE_3PC), 6);
  });
});

describe('melee / ranged haste shorten the swing interval', () => {
  it('melee haste shortens the next melee swing timer', () => {
    const { sim, p } = player('swordman');
    const meta = sim.players.get(p.id)!;
    spawnDummy(sim, p);
    p.autoAttack = true;
    // v0.27.1: meleeHaste lives in swingIntervalMult's one additive haste
    // bucket, so the interval mult itself carries the set bonus (the timer no
    // longer divides by it a second time in auto_attack).
    const baseMult = sim.swingIntervalMult(p);
    p.meleeHaste = SET_HASTE_3PC;
    expect(sim.swingIntervalMult(p)).toBeCloseTo(baseMult / (1 + SET_HASTE_3PC), 6);
    p.swingTimer = 0;
    updatePlayerAutoAttack(sim.ctx, p, meta);
    expect(p.swingTimer).toBeCloseTo(p.weapon.speed * sim.swingIntervalMult(p), 6);
  });

  it('ranged haste shortens the next auto-shot timer (archer)', () => {
    const { sim, p } = player('archer');
    const meta = sim.players.get(p.id)!;
    spawnDummy(sim, p, 12); // inside ranged max, outside the dead zone
    p.autoAttack = true;
    p.rangedHaste = SET_HASTE_3PC;
    p.swingTimer = 0;
    updatePlayerAutoAttack(sim.ctx, p, meta);
    expect(p.swingTimer).toBeGreaterThan(0);
    // the timer equals ranged.speed * mult / (1 + rangedHaste); cross-check the lift
    const unhasted = p.swingTimer * (1 + SET_HASTE_3PC);
    p.rangedHaste = 0;
    p.swingTimer = 0;
    updatePlayerAutoAttack(sim.ctx, p, meta);
    expect(p.swingTimer).toBeCloseTo(unhasted, 6);
  });
});
