import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { raisePool } from './helpers/sp';

// The barrier COSTS are read off the resolved ability rather than measured as a
// before/after delta on the bar. D1 put the SP pool on Ragnarok's curve, where a
// level-5 mage carries 40 SP against a 45 SP barrier, so the low ranks cannot be
// cast at all until D4 re-costs the kit; raising the pool to reach them is what
// makes the delta unreadable. The authored cost is the claim either way.

function castBarrier(
  level: number,
  spec: 'fire' | 'frost',
  abilityId: 'blazing_barrier' | 'ice_barrier',
  spellPower?: number,
): { absorb: number; cost: number; maxHp: number; spellPower: number } {
  const sim = new Sim({ seed: 707, playerClass: 'mage', autoEquip: true });
  sim.setPlayerLevel(level);
  if (spellPower !== undefined) sim.player.spellPower = spellPower;
  raisePool(sim.player);
  const cost = sim.resolvedAbility(abilityId)?.cost ?? 0;

  sim.castAbility(abilityId);

  const barrier = sim.player.auras.find((aura) => aura.id === abilityId);
  expect(barrier?.kind).toBe('absorb');
  return {
    absorb: barrier?.value ?? 0,
    cost,
    maxHp: sim.player.maxHp,
    spellPower: sim.player.spellPower,
  };
}

function castTemporalBarrier(
  level: number,
  spellPower: number,
): { absorb: number; cost: number; spellPower: number } {
  const sim = new Sim({ seed: 708, playerClass: 'mage', autoEquip: true });
  sim.setPlayerLevel(level);
  raisePool(sim.player);
  const cost = sim.resolvedAbility('temporal_barrier')?.cost ?? 0;
  const allyId = sim.addPlayer('swordman', 'Barrier Target');
  const ally = sim.entities.get(allyId);
  if (!ally) throw new Error('missing barrier target');
  sim.targetEntity(allyId);
  sim.player.spellPower = spellPower;

  sim.castAbility('temporal_barrier');

  const barrier = ally.auras.find((aura) => aura.id === 'temporal_barrier');
  expect(barrier?.kind).toBe('absorb');
  return {
    absorb: barrier?.value ?? 0,
    cost,
    spellPower: sim.player.spellPower,
  };
}

describe('mage personal barrier rank scaling', () => {
  it.each([
    ['frost', 'ice_barrier'],
    ['fire', 'blazing_barrier'],
  ] as const)('%s uses an early-game barrier instead of the level-20 absorb value', (spec, id) => {
    const level7 = castBarrier(7, spec, id);
    const expected = 50 + Math.round(level7.spellPower * 0.5);

    expect(level7.absorb).toBe(expected);
    expect(level7.cost).toBe(45);
    // The old "a rank-1 barrier is worth less than half your health" claim is not
    // true any more and is deliberately not re-pinned at a new ratio: the absorb
    // values are authored against the pre-D1 HP scale and the pool shrank under
    // them, so any number here would pin the mismatch rather than a rule. It comes
    // back when D4 re-tunes the kit against the real pools.
  });

  it.each([
    ['frost', 'ice_barrier'],
    ['fire', 'blazing_barrier'],
  ] as const)('%s adds 50% Spell Power to every barrier rank', (spec, id) => {
    expect(castBarrier(5, spec, id, 0)).toMatchObject({ absorb: 50, cost: 45 });
    expect(castBarrier(11, spec, id, 123)).toMatchObject({ absorb: 112, cost: 45 });
    expect(castBarrier(12, spec, id, 0)).toMatchObject({ absorb: 90, cost: 65 });
    expect(castBarrier(17, spec, id, 123)).toMatchObject({ absorb: 152, cost: 65 });
    expect(castBarrier(18, spec, id, 0)).toMatchObject({ absorb: 130, cost: 90 });
    expect(castBarrier(20, spec, id, 123)).toMatchObject({ absorb: 192, cost: 90 });
  });

  it('adds 25% Spell Power to every Temporal Barrier rank', () => {
    for (const [level, cost] of [
      [5, 50],
      [12, 75],
      [18, 105],
    ] as const) {
      const baseline = castTemporalBarrier(level, 0);
      const scaled = castTemporalBarrier(level, 123);
      expect(scaled.spellPower).toBe(123);
      expect(scaled.absorb - baseline.absorb).toBe(Math.round(scaled.spellPower * 0.25));
      expect(scaled.cost).toBe(cost);
    }
  });
});
