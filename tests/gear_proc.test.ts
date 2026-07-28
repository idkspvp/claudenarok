// Firing gear effects in a live world.
//
// `gear_effects.test.ts` pins the rules; this pins that they are actually
// REACHED: that recalcPlayerStats aggregates a worn piece into one place, that
// flat health and attack speed land on the character, and that a swing with a
// status weapon eventually applies the aura. The failure this exists to catch is
// the one that has happened repeatedly in this codebase: machinery built,
// correct, and never wired to anything.

import { beforeEach, describe, expect, it } from 'vitest';
import { CARDS } from '../src/sim/content/cards';
import { ITEMS } from '../src/sim/data';
import { recalcPlayerStats } from '../src/sim/entity';

// Put an item straight into a worn slot and re-derive, bypassing the equip
// gates (level, class) so the assertion is about the effect, not the gate.
function equipOn(sim: Sim, p: Entity, slot: string, itemId: string): void {
  const inner = sim as unknown as {
    players: Map<number, Record<string, never>>;
    playerMods: (m: unknown) => never;
  };
  const meta = inner.players.get(p.id) as unknown as {
    cls: never;
    equipment: Record<string, string>;
    equipmentInstance: never;
    statAllocation: never;
  };
  meta.equipment[slot] = itemId;
  recalcPlayerStats(
    p,
    meta.cls,
    meta.equipment as never,
    inner.playerMods(meta),
    meta.equipmentInstance,
    meta.statAllocation,
  );
}

import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

const gearItems = () =>
  (Object.values(ITEMS) as { id: string; gear?: unknown; kind: string; slot?: string }[]).filter(
    (i) => i.gear,
  );

describe('the authored content', () => {
  it('puts effects on real equipment and nowhere else', () => {
    const carriers = gearItems();
    expect(carriers.length).toBeGreaterThan(0);
    for (const item of carriers) {
      expect(['weapon', 'armor'], item.id).toContain(item.kind);
    }
  });

  it('only inflicts a status from a weapon', () => {
    // A helmet that stuns on hit would fire on someone else's swing shell in a
    // way the reference never does.
    for (const item of gearItems()) {
      const gear = (item as { gear: { inflictOnHit?: unknown } }).gear;
      if (gear.inflictOnHit) expect(item.kind, item.id).toBe('weapon');
    }
  });

  it('names an ability that exists for every auto-cast', () => {
    // A typo here is silent: the auto-cast resolves to null and simply never
    // fires, which reads in play as "this item does nothing".
    const seen: string[] = [];
    for (const src of [
      ...gearItems().map((i) => (i as { gear: { autoCast?: { abilityId: string } } }).gear),
      ...Object.values(CARDS).map((c) => c.effect.gear),
    ]) {
      if (src?.autoCast) seen.push(src.autoCast.abilityId);
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const id of seen) expect(ABILITY_IDS, id).toContain(id);
  });
});

// Imported here rather than at the top so the assertion above reads as a pin on
// the real ability table.
import { ABILITIES } from '../src/sim/data';

const ABILITY_IDS = Object.keys(ABILITIES);

describe('wearing a piece with effects', () => {
  let sim: Sim;
  let p: Entity;

  beforeEach(() => {
    sim = new Sim({ seed: 7, playerClass: 'swordman', autoEquip: true });
    p = sim.player;
  });

  const equipDirect = (slot: string, itemId: string) => equipOn(sim, p, slot, itemId);

  it('leaves a character in ordinary gear with no aggregate at all', () => {
    // The load-bearing one for determinism: an undefined aggregate is what makes
    // the swing path skip its rng draws entirely.
    const bare = new Sim({ seed: 7, playerClass: 'swordman', autoEquip: false });
    expect(bare.player.gearEffects).toBeUndefined();
  });

  it('aggregates a worn piece into one place on the entity', () => {
    const stunner = gearItems().find(
      (i) => (i as { gear: { inflictOnHit?: unknown } }).gear.inflictOnHit,
    );
    expect(stunner).toBeDefined();
    equipDirect('mainhand', stunner!.id);
    expect(p.gearEffects?.inflict.length).toBe(1);
  });

  it('adds flat health on top of every multiplier', () => {
    const hpPiece = gearItems().find((i) => (i as { gear: { maxHp?: number } }).gear.maxHp);
    expect(hpPiece).toBeDefined();
    const slot = (hpPiece as { slot: string }).slot;
    const before = p.maxHp;
    equipDirect(slot, hpPiece!.id);
    const bonus = (hpPiece as unknown as { gear: { maxHp: number } }).gear.maxHp;
    // The item's own stats may add health too, so the floor is the flat grant.
    expect(p.maxHp - before).toBeGreaterThanOrEqual(bonus);
  });

  it('makes the swing interval shorter, never longer', () => {
    const fast = gearItems().find(
      (i) => (i as { gear: { attackSpeed?: number } }).gear.attackSpeed,
    );
    expect(fast).toBeDefined();
    const before = sim.swingIntervalMult(p);
    equipDirect((fast as { slot: string }).slot, fast!.id);
    expect(sim.swingIntervalMult(p)).toBeLessThan(before);
  });
});

describe('a status weapon in combat', () => {
  it('eventually lands its status on the target, and never without the gear', () => {
    // Driven through the real swing shell rather than the pure helper: this is
    // the assertion that would fail if the hook were removed from auto_attack.
    const run = (withGear: boolean): boolean => {
      const sim = new Sim({ seed: 11, playerClass: 'swordman', autoEquip: true });
      const p = sim.player;
      // The highest-chance stun weapon, so the run converges in a bounded number
      // of swings; the assertion is that it lands at all, not how often.
      const stunner = gearItems()
        .filter(
          (i) =>
            (i as { gear: { inflictOnHit?: { status: string } } }).gear.inflictOnHit?.status ===
            'stun',
        )
        .sort(
          (a, b) =>
            (b as { gear: { inflictOnHit: { chance: number } } }).gear.inflictOnHit.chance -
            (a as { gear: { inflictOnHit: { chance: number } } }).gear.inflictOnHit.chance,
        )[0];
      // recalcPlayerStats treats over-level gear as inert, so the wearer has to
      // actually be able to wear it.
      sim.setPlayerLevel(99);
      if (withGear) equipOn(sim, p, 'mainhand', stunner.id);
      // A dummy target that cannot die, so the swings keep coming.
      const target = [...(sim as unknown as { entities: Map<number, Entity> }).entities.values()]
        .filter((e) => e.kind === 'mob' && !e.dead)
        .sort((a, b) => a.id - b.id)[0];
      expect(target).toBeDefined();
      target.pos = { ...p.pos };
      target.maxHp = 10_000_000;
      target.hp = target.maxHp;
      sim.targetEntity(target.id, p.id);
      sim.startAutoAttack(p.id);
      expect(p.autoAttack).toBe(true);
      for (let i = 0; i < 20 * 90; i++) {
        sim.tick();
        target.hp = target.maxHp;
        p.hp = p.maxHp;
        if (target.auras.some((a) => a.id === 'gear_stun')) return true;
      }
      return false;
    };
    expect(run(false)).toBe(false);
    expect(run(true)).toBe(true);
  }, 30_000);
});
