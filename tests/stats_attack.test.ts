// The attack formulas, pinned against docs/design/spiritvale-engine-formulas.md.
//
// Every expectation here is computed by hand from the published expression and
// written as a literal, not by re-running the implementation's own arithmetic.
// A test that recomputes the formula it is testing proves only that the file
// parses.

import { describe, expect, it } from 'vitest';
import {
  type AttackAttributes,
  BREAKPOINT_PER_TEN,
  breakpointMultiplier,
  flatAmplifier,
  magicAttack,
  meleeAttack,
  rangedAttack,
  statusDamagePerTick,
  TWO_HANDED_STANCE_BONUS,
} from '../src/sim/stats/attack';

const attrs = (over: Partial<AttackAttributes> = {}): AttackAttributes => ({
  str: 0,
  agi: 0,
  vit: 0,
  int: 0,
  dex: 0,
  luk: 0,
  ...over,
});

describe('the per-ten breakpoint', () => {
  it('is worth one percent per ten points, floored', () => {
    expect(BREAKPOINT_PER_TEN).toBe(0.01);
    expect(breakpointMultiplier(0)).toBe(1);
    expect(breakpointMultiplier(9)).toBe(1);
    expect(breakpointMultiplier(10)).toBeCloseTo(1.01, 10);
    expect(breakpointMultiplier(19)).toBeCloseTo(1.01, 10);
    expect(breakpointMultiplier(20)).toBeCloseTo(1.02, 10);
  });

  it('reaches only 1.09x at 99, which is the whole point of the model', () => {
    // The reference this replaces squares the term: at 99 Strength its square
    // alone adds 81. Here the entire 1-to-99 range buys nine percent.
    expect(breakpointMultiplier(99)).toBeCloseTo(1.09, 10);
    expect(breakpointMultiplier(150)).toBeCloseTo(1.15, 10);
  });

  it('clamps a negative attribute to no bonus rather than a penalty', () => {
    expect(breakpointMultiplier(-40)).toBe(1);
  });
});

describe('the flat-weapon amplifier', () => {
  it('is 1 + secondary/200', () => {
    expect(flatAmplifier(0)).toBe(1);
    expect(flatAmplifier(100)).toBeCloseTo(1.5, 10);
    expect(flatAmplifier(200)).toBeCloseTo(2, 10);
  });
});

describe('melee attack', () => {
  it('matches a hand-computed level-100 case', () => {
    // Lv 100, STR 60, DEX 30, LUK 20, flat 150.
    //   base = 100/4 + 60*1.5 + 30/5 + 20/5 + 150*(1 + 30/200)
    //        = 25 + 90 + 6 + 4 + 150*1.15
    //        = 125 + 172.5 = 297.5
    //   breakpoint = 1 + floor(60/10)/100 = 1.06
    //   297.5 * 1.06 = 315.35
    const got = meleeAttack({
      level: 100,
      attributes: attrs({ str: 60, dex: 30, luk: 20 }),
      flatAtk: 150,
    });
    expect(got).toBeCloseTo(315.35, 8);
  });

  it('carries the level term, so levelling is never inert', () => {
    const at1 = meleeAttack({ level: 1, attributes: attrs({ str: 40 }) });
    const at150 = meleeAttack({ level: 150, attributes: attrs({ str: 40 }) });
    // Lv/4 with the same 1.04 breakpoint: (150 - 1)/4 * 1.04 = 38.74
    expect(at150 - at1).toBeCloseTo(38.74, 8);
  });

  it('applies the percentage bonus and the two-handed stance multiplicatively', () => {
    const plain = meleeAttack({ level: 100, attributes: attrs({ str: 50 }), flatAtk: 100 });
    const boosted = meleeAttack({
      level: 100,
      attributes: attrs({ str: 50 }),
      flatAtk: 100,
      atkPercent: 0.2,
      twoHandedStance: true,
    });
    expect(boosted).toBeCloseTo(plain * 1.2 * TWO_HANDED_STANCE_BONUS, 8);
    expect(TWO_HANDED_STANCE_BONUS).toBe(1.25);
  });
});

describe('ranged attack', () => {
  it('matches a hand-computed case, with Dexterity leading at weight 1', () => {
    // Lv 100, DEX 60, STR 30, LUK 20, flat 150.
    //   base = 100/4 + 60 + 30/5 + 20/5 + 150*(1 + 60/200)
    //        = 25 + 60 + 6 + 4 + 150*1.3
    //        = 95 + 195 = 290
    //   breakpoint keys off DEX: 1 + floor(60/10)/100 = 1.06
    //   290 * 1.06 = 307.4
    const got = rangedAttack({
      level: 100,
      attributes: attrs({ dex: 60, str: 30, luk: 20 }),
      flatAtk: 150,
    });
    expect(got).toBeCloseTo(307.4, 8);
  });

  it('is driven by Dexterity where melee is driven by Strength', () => {
    // Same attribute block, both branches: the difference is which one leads.
    const a = attrs({ str: 60, dex: 20 });
    const melee = meleeAttack({ level: 100, attributes: a });
    const ranged = rangedAttack({ level: 100, attributes: a });
    // melee: (25 + 90 + 4 + 0) * 1.06 = 119 * 1.06 = 126.14
    expect(melee).toBeCloseTo(126.14, 8);
    // ranged: (25 + 20 + 12 + 0) * 1.02 = 57 * 1.02 = 58.14
    expect(ranged).toBeCloseTo(58.14, 8);
  });
});

describe('magic attack', () => {
  it('matches a hand-computed case', () => {
    // Lv 100, INT 60, DEX 30, LUK 20, flatMatk 150.
    //   base = 100/4 + 60*1.5 + 30/5 + 20/5 + 0 + 150*(1 + 60/200)
    //        = 25 + 90 + 6 + 4 + 195 = 320
    //   breakpoint keys off INT: 1.06  ->  320 * 1.06 = 339.2
    const got = magicAttack({
      level: 100,
      attributes: attrs({ int: 60, dex: 30, luk: 20 }),
      flatMatk: 150,
    });
    expect(got).toBeCloseTo(339.2, 8);
  });

  it('lets Strength feed magic through MatkPerStr, which is what a mace grants', () => {
    const without = magicAttack({ level: 100, attributes: attrs({ int: 40, str: 50 }) });
    const withMace = magicAttack({
      level: 100,
      attributes: attrs({ int: 40, str: 50 }),
      matkPerStr: 1,
    });
    // 50 STR enters the base at weight 1, then rides the 1.04 INT breakpoint.
    expect(withMace - without).toBeCloseTo(50 * 1.04, 8);
  });

  it('amplifies its flat term with Intelligence, not Dexterity', () => {
    const dexy = magicAttack({ level: 1, attributes: attrs({ dex: 200 }), flatMatk: 100 });
    const inty = magicAttack({ level: 1, attributes: attrs({ int: 200 }), flatMatk: 100 });
    // DEX only reaches the /5 support term and does not touch the amplifier.
    expect(inty).toBeGreaterThan(dexy);
  });
});

describe('status damage per tick', () => {
  it('sums level and three attributes over ten, with no breakpoint', () => {
    // (100 + 40 + 30 + 20) / 10 = 19
    expect(statusDamagePerTick(100, attrs({ str: 40, agi: 30, int: 20 }))).toBeCloseTo(19, 10);
  });

  it('scales with stacks, and treats a zero stack count as one application', () => {
    const one = statusDamagePerTick(100, attrs({ str: 40, agi: 30, int: 20 }));
    expect(statusDamagePerTick(100, attrs({ str: 40, agi: 30, int: 20 }), 3)).toBeCloseTo(
      one * 3,
      10,
    );
    expect(statusDamagePerTick(100, attrs({ str: 40, agi: 30, int: 20 }), 0)).toBeCloseTo(one, 10);
  });

  it('ignores Dexterity, Vitality and Luck, unlike every other attack formula', () => {
    const base = statusDamagePerTick(50, attrs({ str: 10, agi: 10, int: 10 }));
    const padded = statusDamagePerTick(
      50,
      attrs({ str: 10, agi: 10, int: 10, dex: 99, vit: 99, luk: 99 }),
    );
    expect(padded).toBe(base);
  });
});
