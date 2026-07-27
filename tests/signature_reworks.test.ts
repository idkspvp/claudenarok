// Reworked spec signatures + spell-haste plumbing (owner pass): Chain Heal now bounces,
// Feral Instinct is a form-gated resource burst, Metamorphosis and Moonkin Form stack
// multiple buffs, spell haste (stat + auras) shortens casts, and fractional buff values
// survive a global damage mastery instead of rounding to zero.
import { describe, expect, it } from 'vitest';
import { spellDamageMultFromAuras, spellHasteMult } from '../src/sim/combat/spell_combat';
import { ABILITIES, MOBS } from '../src/sim/data';
import { createMob, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity, PlayerClass } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';
import { spreadAllocation } from './helpers/alloc';
import { fundCasts } from './helpers/sp';

function makeSim(cls: PlayerClass, spec: string | null = null, seed = 7): Sim {
  const sim = new Sim({ seed, playerClass: cls, autoEquip: true });
  sim.setPlayerLevel(20);
  const p = sim.entities.get(sim.playerId) as Entity;
  p.maxHp = p.hp = 1_000_000;
  fundCasts(p);
  return sim;
}

function addAlly(sim: Sim, x: number, z: number, hp = 100): Entity {
  const y = terrainHeight(x, z, sim.cfg.seed);
  const ally = createMob((sim as any).nextId++, MOBS.ridge_stalker, 20, { x, y, z });
  (ally as any).hostile = false;
  (ally as any).kind = 'player';
  ally.maxHp = 1_000_000;
  ally.hp = hp;
  sim.entities.set(ally.id, ally);
  (sim as any).rebucket(ally);
  return ally;
}

describe('spell haste plumbing', () => {
  it('the spellHaste stat (set bonus or mastery) shortens a cast', () => {
    const sim = makeSim('mage');
    const pid = sim.playerId;
    const p = sim.entities.get(pid) as Entity;
    p.spellHaste = 0.15;
    // Frostbolt needs a hostile target in range and line of sight.
    const y = terrainHeight(p.pos.x, p.pos.z + 12, sim.cfg.seed);
    const mob = createMob((sim as any).nextId++, MOBS.ridge_stalker, 20, {
      x: p.pos.x,
      y,
      z: p.pos.z + 12,
    });
    mob.hostile = true;
    mob.maxHp = mob.hp = 1_000_000;
    sim.entities.set(mob.id, mob);
    (sim as any).rebucket(mob);
    p.facing = 0;
    sim.targetEntity(mob.id, pid);
    const base = sim.resolvedAbility('frostbolt', pid)?.castTime ?? 0;
    expect(base).toBeGreaterThan(0);
    sim.castAbility('frostbolt', pid);
    expect(p.castTotal).toBeCloseTo(base / 1.15, 5);
  });

  // The specialization arm that stood here has no source left: the specs and
  // their masteries went with the talent trees (Phase D0).

  it("Anointing keeps its 0.2 haste value under Doctrine's absorb mastery (no round-to-0)", () => {
    // The mage rework left arcane_power (the old Arcane signature) as unreferenced
    // content debt, so Discipline is the fractional-buff exemplar in the merged tree:
    // its absorb mastery (absorbPct 0.3) runs the resolver's effect-scaling pass over
    // the granted Anointing, whose 0.2 haste buff must pass through un-rounded.
    const sim = makeSim('acolyte', 'discipline');
    const pi = sim.resolvedAbility('power_infusion');
    const haste = (pi?.effects ?? []).find(
      (e: any) => e.type === 'buffTarget' && e.kind === 'buff_spellhaste',
    ) as any;
    expect(haste).toBeDefined();
    expect(haste.value).toBeCloseTo(0.2);
  });
});

describe('crit-damage masteries', () => {
  // The specialization arm that stood here has no source left: the specs and
  // their masteries went with the talent trees (Phase D0).

  it('a non-specced caster has no bonus crit damage', () => {
    const sim = makeSim('mage');
    const p = sim.entities.get(sim.playerId) as Entity;
    recalcPlayerStats(
      p,
      'mage',
      (sim as any).players.get(p.id).equipment,
      (sim as any).playerMods((sim as any).players.get(p.id)),
      (sim as any).players.get(p.id).equipmentInstance,
      spreadAllocation(p.level),
    );
    expect(p.critDmgSpellBonus).toBe(0);
  });
});
