// Accuracy, evasion and criticals, pinned against
// docs/design/spiritvale-engine-formulas.md.
//
// The three tests that matter most are the ones asserting the DIFFERENCES from
// the model this replaces, because those are the places a reader's instinct is
// wrong: two Hit per Dexterity, half a Flee per Agility, and a crowd penalty
// that starts at the fifth attacker rather than the third.

import { describe, expect, it } from 'vitest';
import {
  BASE_CRIT_DAMAGE_PERCENT,
  BASE_HIT,
  critDamageMultiplier,
  critDamagePercent,
  critDefence,
  critRate,
  effectiveCritRate,
  flee,
  fleeCrowdMultiplier,
  hit,
  perfectDodge,
} from '../src/sim/stats/accuracy';

describe('hit', () => {
  it('matches a hand-computed case', () => {
    // Lv 100, DEX 50, LUK 30:  100 + 2*50 + 30/5 + 0 + 25 = 231
    expect(hit({ level: 100, dex: 50, luk: 30 })).toBe(231);
  });

  it('gives everyone a flat 25 before any attribute', () => {
    expect(BASE_HIT).toBe(25);
    expect(hit({ level: 1, dex: 0, luk: 0 })).toBe(26);
  });

  it('is worth TWO per Dexterity, not one', () => {
    const a = hit({ level: 100, dex: 40, luk: 0 });
    const b = hit({ level: 100, dex: 50, luk: 0 });
    expect(b - a).toBe(20);
  });

  it('rounds, so two characters a fraction apart land on the same integer', () => {
    // LUK 1 adds 0.2; LUK 2 adds 0.4. Both round back to the same total.
    expect(hit({ level: 100, dex: 0, luk: 1 })).toBe(hit({ level: 100, dex: 0, luk: 2 }));
    expect(Number.isInteger(hit({ level: 77, dex: 33, luk: 7 }))).toBe(true);
  });

  it('applies the percentage bonus to the whole sum', () => {
    // (100 + 100 + 6 + 25) * 1.1 = 231 * 1.1 = 254.1 -> 254
    expect(hit({ level: 100, dex: 50, luk: 30, hitPercent: 0.1 })).toBe(254);
  });
});

describe('flee', () => {
  it('matches a hand-computed case', () => {
    // Lv 100, AGI 51: 100 + floor(51/2) = 100 + 25 = 125
    expect(flee({ level: 100, agi: 51 })).toBeCloseTo(125, 10);
  });

  it('is worth HALF per Agility, floored, which is the opposite of hit', () => {
    // Ten Agility buys five Flee; ten Dexterity buys twenty Hit.
    const a = flee({ level: 100, agi: 40 });
    const b = flee({ level: 100, agi: 50 });
    expect(b - a).toBeCloseTo(5, 10);
    // And the floor means an odd point buys nothing.
    expect(flee({ level: 1, agi: 4 })).toBe(flee({ level: 1, agi: 5 }));
  });

  it('penalises from the FIFTH attacker, not the third', () => {
    expect(fleeCrowdMultiplier(1)).toBe(1);
    expect(fleeCrowdMultiplier(4)).toBe(1);
    expect(fleeCrowdMultiplier(5)).toBeCloseTo(0.9, 10);
    expect(fleeCrowdMultiplier(8)).toBeCloseTo(0.6, 10);
  });

  it('floors the crowd penalty at zero rather than inverting into bonus evasion', () => {
    expect(fleeCrowdMultiplier(14)).toBe(0);
    expect(fleeCrowdMultiplier(100)).toBe(0);
    expect(flee({ level: 100, agi: 100, attackerCount: 100 })).toBe(0);
  });
});

describe('perfect dodge', () => {
  it('is a plain stat, clamped to 0..100, NOT derived from Luck', () => {
    expect(perfectDodge(0)).toBe(0);
    expect(perfectDodge(37)).toBe(37);
    expect(perfectDodge(-5)).toBe(0);
    expect(perfectDodge(250)).toBe(100);
  });
});

describe('criticals', () => {
  it('rate matches a hand-computed case', () => {
    // LUK 30: floor(30/3) + floor(30/10) = 10 + 3 = 13
    expect(critRate({ luk: 30 })).toBeCloseTo(13, 10);
    // LUK 99: 33 + 9 = 42
    expect(critRate({ luk: 99 })).toBeCloseTo(42, 10);
  });

  it('rate is uncapped, because crit defence is what bounds it', () => {
    // Nothing in the formula clamps. A very high Luck simply keeps climbing.
    expect(critRate({ luk: 900 })).toBeCloseTo(390, 10);
    expect(critRate({ luk: 30, flatCrit: 500 })).toBeCloseTo(513, 10);
  });

  it('resolves against a defender rather than against a ceiling', () => {
    const attacker = critRate({ luk: 60 }); // 20 + 6 = 26
    const defender = critDefence({ luk: 50 }); // floor(50/5) = 10
    expect(attacker).toBeCloseTo(26, 10);
    expect(defender).toBe(10);
    expect(effectiveCritRate(attacker, defender)).toBeCloseTo(16, 10);
  });

  it('never lets crit defence push the effective rate negative', () => {
    expect(effectiveCritRate(5, 40)).toBe(0);
  });

  it('MULTIPLIES damage, which pre-renewal criticals do not', () => {
    // The reference this replaces takes the top of the weapon range and ignores
    // defence, with no multiplier at all. Here a critical is at least 1.2x.
    expect(BASE_CRIT_DAMAGE_PERCENT).toBe(120);
    expect(critDamagePercent({ luk: 0 })).toBe(120);
    expect(critDamageMultiplier({ luk: 0 })).toBeCloseTo(1.2, 10);
    // LUK 50: 120 + floor(50/5) = 130
    expect(critDamagePercent({ luk: 50 })).toBe(130);
    expect(critDamageMultiplier({ luk: 50 })).toBeCloseTo(1.3, 10);
  });

  it('adds the CritDamage stat on top of the Luck term', () => {
    expect(critDamagePercent({ luk: 50, critDamageStat: 45 })).toBe(175);
  });
});
