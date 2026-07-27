// Ragnarok's weapon damage roll, pinned as the three properties that are easy to
// get wrong from memory: the floor comes from Dexterity and not the weapon, a
// critical takes the top instead of multiplying, and the ordinary roll never
// reaches the top.

import { describe, expect, it } from 'vitest';
import {
  ARROW_WEAPONS,
  DEX_LEADING_WEAPONS,
  dexFloorPercent,
  weaponRange,
  weaponSwingDamage,
} from '../src/sim/combat/weapon_damage';

describe("a player's damage floor comes from Dexterity", () => {
  it('raises the floor without touching the ceiling', () => {
    // The point of Dexterity as a damage stat: it does not make the big hits
    // bigger, it deletes the small ones.
    const lowDex = weaponRange({ atkMax: 200, dex: 10, weaponLevel: 1 });
    const highDex = weaponRange({ atkMax: 200, dex: 120, weaponLevel: 1 });
    expect(highDex.min).toBeGreaterThan(lowDex.min);
    expect(highDex.max).toBe(lowDex.max);
  });

  it('converts Dexterity better on a higher-level weapon', () => {
    expect(dexFloorPercent(1)).toBe(100);
    expect(dexFloorPercent(4)).toBe(160);
    const cheap = weaponRange({ atkMax: 300, dex: 100, weaponLevel: 1 });
    const fine = weaponRange({ atkMax: 300, dex: 100, weaponLevel: 4 });
    expect(fine.min).toBeGreaterThan(cheap.min);
  });

  it('never lets the floor pass the ceiling on a non-bow', () => {
    // A Dexterity build on a weak sword rolls a flat number, not a negative
    // span. 400 Dexterity against 50 attack power is the degenerate case.
    const r = weaponRange({ atkMax: 50, dex: 400, weaponLevel: 4 });
    expect(r.min).toBe(50);
    expect(r.max).toBe(50);
    expect(weaponSwingDamage({ atkMax: 50, dex: 400, weaponLevel: 4 }, 0.5)).toBe(50);
  });

  it('treats an unauthored weapon level as the lowest rung', () => {
    expect(weaponRange({ atkMax: 300, dex: 100 })).toEqual(
      weaponRange({ atkMax: 300, dex: 100, weaponLevel: 1 }),
    );
  });
});

describe('the bow rule', () => {
  it('re-expresses the floor as a percentage of the ceiling', () => {
    // A bow multiplies the Dexterity floor by the weapon's attack power rather
    // than capping it there, which is why an archer's damage compounds: the
    // stat and the weapon multiply instead of adding.
    const sword = weaponRange({ atkMax: 200, dex: 99, weaponType: 'sword', weaponLevel: 4 });
    const bow = weaponRange({ atkMax: 200, dex: 99, weaponType: 'bow', weaponLevel: 4 });
    expect(bow.min).toBeGreaterThan(sword.min);
  });

  it('lets a strong bow push the ceiling above the weapon itself', () => {
    // The floor is allowed to carry the ceiling up with it. Nothing else in the
    // formula can exceed the weapon's own attack power, which is what makes this
    // worth pinning rather than assuming.
    const r = weaponRange({ atkMax: 200, dex: 150, weaponType: 'bow', weaponLevel: 4 });
    expect(r.max).toBeGreaterThan(200);
    expect(r.min).toBe(r.max);
  });

  it('applies to bows only, not to every Dexterity-leading weapon', () => {
    // An instrument and a whip swap their attack stats but are not ammunition
    // weapons, so they take the plain floor. Confusing the two sets hands a bard
    // an archer's damage.
    for (const type of ['instrument', 'whip'] as const) {
      expect(DEX_LEADING_WEAPONS.has(type)).toBe(true);
      expect(ARROW_WEAPONS.has(type)).toBe(false);
      expect(weaponRange({ atkMax: 200, dex: 99, weaponType: type, weaponLevel: 4 })).toEqual(
        weaponRange({ atkMax: 200, dex: 99, weaponType: 'sword', weaponLevel: 4 }),
      );
    }
    expect(DEX_LEADING_WEAPONS.has('bow')).toBe(true);
    expect(ARROW_WEAPONS.has('bow')).toBe(true);
  });
});

describe('a critical takes the top instead of multiplying', () => {
  it('collapses the range to the ceiling and skips the roll', () => {
    // Pre-renewal has NO critical damage multiplier. The x1.4 in rAthena sits
    // under `#ifdef RENEWAL`; the whole pre-renewal bonus is that a critical
    // rolls the maximum, cannot miss, and ignores the target's flee.
    const crit = weaponRange({ atkMax: 200, dex: 10, crit: true });
    expect(crit).toEqual({ min: 200, max: 200 });
    for (const roll of [0, 0.5, 1]) {
      expect(weaponSwingDamage({ atkMax: 200, dex: 10, crit: true }, roll)).toBe(200);
    }
  });

  it('still computes the Dexterity floor on a BOW critical', () => {
    // The source condition is `!crit || arrow`, so an arrow critical runs the
    // floor branch, and the bow rule can raise the ceiling with it. An archer's
    // critical therefore beats the plain top of the range, which a naive
    // "critical means max" reading gets wrong.
    const bowCrit = weaponSwingDamage(
      { atkMax: 200, dex: 150, weaponType: 'bow', weaponLevel: 4, crit: true },
      0,
    );
    const swordCrit = weaponSwingDamage(
      { atkMax: 200, dex: 150, weaponType: 'sword', weaponLevel: 4, crit: true },
      0,
    );
    expect(swordCrit).toBe(200);
    expect(bowCrit).toBeGreaterThan(swordCrit);
  });
});

describe('the ordinary roll', () => {
  const swing = { atkMax: 100, dex: 40, weaponLevel: 1 } as const;

  it('excludes the top, which is what a critical is worth', () => {
    // `rnd() % (atkmax - atkmin) + atkmin` cannot return atkmax. A roll of
    // exactly 1 must land one short of it.
    const { max } = weaponRange(swing);
    expect(weaponSwingDamage(swing, 1)).toBe(max - 1);
    expect(weaponSwingDamage({ ...swing, crit: true }, 0)).toBe(max);
  });

  it('starts at the floor and stays inside the range', () => {
    const { min, max } = weaponRange(swing);
    expect(weaponSwingDamage(swing, 0)).toBe(min);
    for (let i = 0; i <= 20; i++) {
      const d = weaponSwingDamage(swing, i / 20);
      expect(d).toBeGreaterThanOrEqual(min);
      expect(d).toBeLessThan(max);
    }
  });

  it('is monotone in the roll', () => {
    let prev = -1;
    for (let i = 0; i <= 50; i++) {
      const d = weaponSwingDamage(swing, i / 50);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it('clamps a roll outside 0..1 rather than leaving the range', () => {
    expect(weaponSwingDamage(swing, -5)).toBe(weaponSwingDamage(swing, 0));
    expect(weaponSwingDamage(swing, 5)).toBe(weaponSwingDamage(swing, 1));
  });
});

describe('monsters roll their authored pair, with no Dexterity term', () => {
  it('ignores Dexterity and the weapon level entirely', () => {
    const a = weaponRange({ atkMax: 80, monsterAtkMin: 40, isMonster: true, dex: 0 });
    const b = weaponRange({
      atkMax: 80,
      monsterAtkMin: 40,
      isMonster: true,
      dex: 200,
      weaponLevel: 4,
    });
    expect(a).toEqual({ min: 40, max: 80 });
    expect(b).toEqual(a);
  });

  it('clamps an inverted authored pair instead of producing a negative span', () => {
    expect(weaponRange({ atkMax: 30, monsterAtkMin: 90, isMonster: true })).toEqual({
      min: 30,
      max: 30,
    });
  });

  it('falls back to a flat hit when only a max is authored', () => {
    expect(weaponRange({ atkMax: 55, isMonster: true })).toEqual({ min: 55, max: 55 });
  });

  it('draws no randomness of its own, so the same inputs always agree', () => {
    const input = { atkMax: 80, monsterAtkMin: 40, isMonster: true };
    expect(weaponSwingDamage(input, 0.37)).toBe(weaponSwingDamage(input, 0.37));
  });
});
