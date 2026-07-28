// What a piece of gear does beyond its numbers: the pure half.
//
// The rules under test are the ones a content typo or a refactor would silently
// break: that two stunning items give two chances rather than one bigger one,
// that resistance can reach immunity but never turns into a bonus, and that the
// rolls come from the caller so the sim keeps its one rng stream.

import { describe, expect, it } from 'vitest';
import {
  aggregateGearEffects,
  autoCastsThisHit,
  emptyGearEffects,
  GEAR_STATUSES,
  type GearEffects,
  inflictsThisHit,
  resistedChance,
  STATUS_AURA,
  STATUS_DURATION,
} from '../src/sim/combat/gear_effects';
import type { AuraKind } from '../src/sim/types';

const stunner: GearEffects = { inflictOnHit: { status: 'stun', chance: 0.05 } };

describe('the status table', () => {
  it('gives every status an aura and a duration', () => {
    // A status with no aura would be inflicted and then do nothing at all,
    // which is the failure this catches: silent, and only in play.
    for (const status of GEAR_STATUSES) {
      expect(STATUS_AURA[status], status).toBeTruthy();
      expect(STATUS_DURATION[status], status).toBeGreaterThan(0);
    }
  });

  it('maps the hard disables onto hard-disable auras', () => {
    const hard: AuraKind[] = ['stun', 'incapacitate', 'stasis'];
    expect(hard).toContain(STATUS_AURA.stun);
    expect(hard).toContain(STATUS_AURA.sleep);
    expect(hard).toContain(STATUS_AURA.freeze);
    // And the ones a player fights through are not hard disables.
    expect(hard).not.toContain(STATUS_AURA.poison);
    expect(hard).not.toContain(STATUS_AURA.bleeding);
    expect(hard).not.toContain(STATUS_AURA.curse);
  });

  it('keeps a hard disable shorter than a status you can fight through', () => {
    expect(STATUS_DURATION.stun).toBeLessThan(STATUS_DURATION.poison);
    expect(STATUS_DURATION.freeze).toBeLessThan(STATUS_DURATION.curse);
  });
});

describe('aggregating a worn set', () => {
  it('is empty for a character wearing nothing that carries one', () => {
    expect(aggregateGearEffects([undefined, undefined])).toEqual(emptyGearEffects());
  });

  it('keeps two inflict entries separate rather than summing them', () => {
    // The load-bearing one. Summed, two 5% items would read as one 10% roll and
    // could never stun twice in a swing; kept separate they are two chances.
    const agg = aggregateGearEffects([stunner, stunner]);
    expect(agg.inflict).toHaveLength(2);
    expect(agg.inflict.every((e) => e.chance === 0.05)).toBe(true);
  });

  it('sums resistance for the same status and keeps different ones apart', () => {
    const agg = aggregateGearEffects([
      { resistStatus: { status: 'stun', fraction: 0.2 } },
      { resistStatus: { status: 'stun', fraction: 0.3 } },
      { resistStatus: { status: 'blind', fraction: 0.1 } },
    ]);
    expect(agg.resist.stun).toBeCloseTo(0.5);
    expect(agg.resist.blind).toBeCloseTo(0.1);
    expect(agg.resist.poison).toBeUndefined();
  });

  it('sums the flat numbers and stacks auto-casts as separate rolls', () => {
    const agg = aggregateGearEffects([
      { maxHp: 100, maxSp: 20, attackSpeed: 0.03, autoCast: { abilityId: 'heal', chance: 0.05 } },
      { maxHp: 50, attackSpeed: 0.02, autoCast: { abilityId: 'firebolt', chance: 0.1 } },
    ]);
    expect(agg.maxHp).toBe(150);
    expect(agg.maxSp).toBe(20);
    expect(agg.attackSpeed).toBeCloseTo(0.05);
    expect(agg.autoCast.map((a) => a.abilityId)).toEqual(['heal', 'firebolt']);
  });
});

describe('resistance', () => {
  it('reduces a chance in proportion', () => {
    expect(resistedChance(0.5, { stun: 0.4 }, 'stun')).toBeCloseTo(0.3);
  });

  it('reaches immunity but never turns into a bonus', () => {
    expect(resistedChance(0.5, { stun: 1 }, 'stun')).toBe(0);
    // Over-stacked resistance is immunity, not a chance the attacker gains.
    expect(resistedChance(0.5, { stun: 2.5 }, 'stun')).toBe(0);
  });

  it('leaves an unrelated status and a bare defender alone', () => {
    expect(resistedChance(0.5, { blind: 1 }, 'stun')).toBe(0.5);
    expect(resistedChance(0.5, undefined, 'stun')).toBe(0.5);
  });
});

describe('what fires on one hit', () => {
  const two = aggregateGearEffects([stunner, { inflictOnHit: { status: 'blind', chance: 0.05 } }]);

  it('fires an entry whose roll is under its chance, and only that entry', () => {
    expect(inflictsThisHit(two.inflict, [0.01, 0.9])).toEqual(['stun']);
    expect(inflictsThisHit(two.inflict, [0.9, 0.01])).toEqual(['blind']);
    expect(inflictsThisHit(two.inflict, [0.01, 0.01])).toEqual(['stun', 'blind']);
    expect(inflictsThisHit(two.inflict, [0.9, 0.9])).toEqual([]);
  });

  it('treats the chance as exclusive, so a roll exactly at it misses', () => {
    expect(inflictsThisHit(two.inflict, [0.05, 1])).toEqual([]);
  });

  it('drops an entry the defender is immune to and keeps the rest', () => {
    // A winning roll on both, but stun is resisted away entirely.
    expect(inflictsThisHit(two.inflict, [0.01, 0.01], { stun: 1 })).toEqual(['blind']);
  });

  it('misses when there are fewer rolls than entries rather than firing free', () => {
    // A caller bug must fail closed: a missing roll is a miss, never a hit.
    expect(inflictsThisHit(two.inflict, [])).toEqual([]);
  });

  it('picks auto-casts the same way, one roll each', () => {
    const casts = [
      { abilityId: 'heal', chance: 0.05 },
      { abilityId: 'firebolt', chance: 0.5 },
    ];
    expect(autoCastsThisHit(casts, [0.9, 0.1]).map((c) => c.abilityId)).toEqual(['firebolt']);
    expect(autoCastsThisHit(casts, [0.9, 0.9])).toEqual([]);
    expect(autoCastsThisHit(casts, [])).toEqual([]);
  });
});
