// The two weapon systems that sit on the element/race/size foundation: the size
// table a weapon class lands its damage through, and the refine ladder.
//
// Both pin SHAPE rather than reciting their own tables. What matters for the size
// table is that classes genuinely point at different targets (otherwise carrying
// two weapons is pointless, which is the whole mechanic); what matters for refine
// is that the ladder rises, that weapon level decides how fast, and that the
// risky end is where the reward is.

import { describe, expect, it } from 'vitest';
import { SIZES } from '../src/sim/combat/elements';
import {
  MAX_REFINE,
  nextRefineGain,
  overRefineBonus,
  overRefineMax,
  refineAttackBonus,
  refineFlatAtk,
  refineIsRisky,
  safeRefineLimit,
} from '../src/sim/combat/refine';
import {
  DEFAULT_WEAPON_TYPE,
  weaponBestSize,
  weaponSizeMultiplier,
  weaponSizePercent,
} from '../src/sim/combat/weapon_size';
import type { WeaponLevel, WeaponType } from '../src/sim/types';

const LEVELS: WeaponLevel[] = [1, 2, 3, 4];

describe('the weapon size table', () => {
  it('points a dagger at small targets and a spear at large ones', () => {
    // The trade that makes a player carry both. If these ever agree, the table
    // has stopped doing the one job it exists for.
    expect(weaponSizePercent('dagger', 'small')).toBeGreaterThan(
      weaponSizePercent('dagger', 'large'),
    );
    expect(weaponSizePercent('spear', 'large')).toBeGreaterThan(
      weaponSizePercent('spear', 'small'),
    );
    expect(weaponBestSize('dagger')).toBe('small');
    expect(weaponBestSize('spear')).toBe('large');
  });

  it('gives a dagger and an axe opposite answers to the same target', () => {
    expect(weaponSizePercent('dagger', 'large')).toBeLessThan(weaponSizePercent('axe', 'large'));
    expect(weaponSizePercent('axe', 'small')).toBeLessThan(weaponSizePercent('dagger', 'small'));
  });

  it('lets a mace ignore the question, which is its whole identity', () => {
    const mace = SIZES.map((s) => weaponSizePercent('mace', s));
    const dagger = SIZES.map((s) => weaponSizePercent('dagger', s));
    const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(spread(mace)).toBeLessThan(spread(dagger));
  });

  it('treats an unmarked weapon as the even trade, so an old item is unchanged', () => {
    for (const size of SIZES)
      expect(weaponSizePercent(undefined, size), size).toBe(
        weaponSizePercent(DEFAULT_WEAPON_TYPE, size),
      );
  });

  it('never leaves a class with no answer to a size', () => {
    // A zero here would make a weapon literally unusable against a third of the
    // world, which is a bug and not a trade-off.
    const types: WeaponType[] = [
      'dagger',
      'sword',
      'twohand_sword',
      'spear',
      'twohand_spear',
      'axe',
      'twohand_axe',
      'mace',
      'rod',
      'bow',
      'katar',
      'book',
      'knuckle',
      'instrument',
      'whip',
    ];
    for (const t of types)
      for (const size of SIZES) {
        expect(weaponSizePercent(t, size), `${t} vs ${size}`).toBeGreaterThan(0);
        expect(weaponSizePercent(t, size), `${t} vs ${size}`).toBeLessThanOrEqual(100);
      }
  });

  it('gives the multiplier as the percentage over a hundred', () => {
    expect(weaponSizeMultiplier('rod', 'small')).toBe(1);
    expect(weaponSizeMultiplier('dagger', 'large')).toBeCloseTo(0.5, 10);
  });
});

describe('the refine ladder', () => {
  it('is worth nothing at +0 and rises with every step', () => {
    for (const lv of LEVELS) {
      expect(refineAttackBonus(lv, 0), `level ${lv}`).toBe(0);
      for (let r = 1; r <= MAX_REFINE; r++)
        expect(refineAttackBonus(lv, r), `level ${lv} +${r}`).toBeGreaterThan(
          refineAttackBonus(lv, r - 1),
        );
    }
  });

  it('pays a heavier weapon class more for the same refine', () => {
    for (let r = 1; r <= MAX_REFINE; r++)
      for (let i = 1; i < LEVELS.length; i++)
        expect(refineAttackBonus(LEVELS[i], r), `+${r}`).toBeGreaterThan(
          refineAttackBonus(LEVELS[i - 1], r),
        );
  });

  it('puts the reward on the far side of the safe limit', () => {
    // A step inside the safe range and a step past it must not be worth the
    // same, or there is no reason to take the risk.
    for (const lv of LEVELS) {
      const safe = safeRefineLimit(lv);
      const insideStep = nextRefineGain(lv, safe - 2);
      const riskyStep = nextRefineGain(lv, safe);
      expect(riskyStep, `level ${lv}`).toBeGreaterThan(insideStep);
    }
  });

  it('calls an attempt risky exactly past the safe limit, and never at the top', () => {
    for (const lv of LEVELS) {
      const safe = safeRefineLimit(lv);
      expect(refineIsRisky(lv, safe - 1), `level ${lv} below`).toBe(false);
      expect(refineIsRisky(lv, safe), `level ${lv} at`).toBe(true);
      // At +10 there is no next attempt to be risky about.
      expect(refineIsRisky(lv, MAX_REFINE), `level ${lv} top`).toBe(false);
      expect(nextRefineGain(lv, MAX_REFINE), `level ${lv} top gain`).toBe(0);
    }
  });

  it('gives a heavier class a SHORTER safe range, so its ladder is the riskier one', () => {
    for (let i = 1; i < LEVELS.length; i++)
      expect(safeRefineLimit(LEVELS[i])).toBeLessThan(safeRefineLimit(LEVELS[i - 1]));
  });

  it('clamps a refine outside the ladder instead of running off it', () => {
    expect(refineAttackBonus(4, -5)).toBe(0);
    expect(refineAttackBonus(4, 999)).toBe(refineAttackBonus(4, MAX_REFINE));
    // An unmarked weapon level falls back to the gentlest ladder rather than throwing.
    expect(refineAttackBonus(undefined, 5)).toBe(refineAttackBonus(1, 5));
  });
});

describe('the two halves of a refine, which land on opposite sides of defence', () => {
  it('pays the flat rate the reference pays, per weapon level', () => {
    // db/pre-re/refine.yml, the Weapon group: Bonus is 200/300/500/700 per 100
    // at every step, so a +10 is ten of them.
    expect([1, 2, 3, 4].map((lv) => refineFlatAtk(lv as 1 | 2 | 3 | 4, 10))).toEqual([
      20, 30, 50, 70,
    ]);
    expect(refineFlatAtk(1, 0)).toBe(0);
  });

  it('opens the over-refine range only past the safe limit', () => {
    // Safe limits 7/6/5/4. At the limit there is no range at all; one step past
    // it opens the first band.
    expect(overRefineMax(1, 7)).toBe(0);
    expect(overRefineMax(1, 8)).toBe(3);
    expect(overRefineMax(2, 6)).toBe(0);
    expect(overRefineMax(2, 7)).toBe(5);
    expect(overRefineMax(3, 5)).toBe(0);
    expect(overRefineMax(3, 6)).toBe(8);
    expect(overRefineMax(4, 4)).toBe(0);
    expect(overRefineMax(4, 5)).toBe(13);
  });

  it('reaches the reference top-of-ladder values exactly', () => {
    // The RandomBonus column at +10: 900/2000/4000/7800 per 100. The level-4
    // figure is the one that was wrong (14 per step gives 84, not 78).
    expect([1, 2, 3, 4].map((lv) => overRefineMax(lv as 1 | 2 | 3 | 4, 10))).toEqual([
      9, 20, 40, 78,
    ]);
  });

  it('rolls the over-refine as 1 to the maximum, never zero and never over', () => {
    // The reference adds `rnd() % max + 1`, so the floor is 1, not 0: an
    // over-refined weapon always gets something.
    expect(overRefineBonus(4, 10, 0)).toBe(1);
    expect(overRefineBonus(4, 10, 0.999999)).toBe(78);
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const v = overRefineBonus(3, 10, roll);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(40);
    }
    // No over-refine means no bonus at all, not a guaranteed 1.
    expect(overRefineBonus(1, 7, 0.999999)).toBe(0);
  });

  it('keeps the combined figure an average, for a tooltip and nothing else', () => {
    // Flat 70 plus the midpoint of a 1-to-78 range.
    expect(refineAttackBonus(4, 10)).toBeCloseTo(70 + 39.5, 10);
    expect(refineAttackBonus(1, 7)).toBe(refineFlatAtk(1, 7));
  });
});
