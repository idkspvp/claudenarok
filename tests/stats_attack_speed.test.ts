// Attack and cast speed, pinned against
// docs/design/spiritvale-engine-formulas.md.
//
// The weapon table is pinned row by row as literals. It is the kind of data
// that gets "tidied" by someone reasoning about balance rather than reading the
// source, and a single changed row silently retimes every swing in the game.

import { describe, expect, it } from 'vitest';
import {
  ASPD_HARD_CAP,
  attackDelaySeconds,
  attackSpeed,
  attackSpeedCap,
  attacksPerSecond,
  baseAttackDelay,
  castSpeed,
  castTimeMultiplier,
  castTimeReductionPercent,
  DUAL_WIELD_MULTIPLIER,
  WEAPON_BASE_ATTACK_DELAY,
  type WeaponSpeedClass,
} from '../src/sim/stats/attack_speed';

describe('the weapon base-delay table', () => {
  it('pins all 23 rows as published', () => {
    expect(WEAPON_BASE_ATTACK_DELAY).toEqual({
      Unarmed: 0.9,
      Dagger: 1.0,
      Katar: 1.0,
      Sword: 1.1,
      Sword2H: 1.1,
      Book: 1.1,
      Mace: 1.15,
      Mace2H: 1.15,
      Instrument: 1.15,
      Spear: 1.2,
      Spear2H: 1.2,
      Wand: 1.2,
      Wand2H: 1.2,
      Scythe: 1.2,
      Pistol: 1.2,
      Twinblade: 1.2,
      Axe: 1.3,
      Axe2H: 1.3,
      Bow: 1.4,
      GatlingGun: 1.4,
      Rifle: 1.5,
      Shotgun: 2.0,
      Launcher: 2.0,
    });
    expect(Object.keys(WEAPON_BASE_ATTACK_DELAY)).toHaveLength(23);
  });

  it('is one column, so a two-handed weapon is not automatically slower', () => {
    // Sword and Sword2H share a row, as do Mace/Mace2H, Spear/Spear2H,
    // Wand/Wand2H and Axe/Axe2H. The model this replaces indexes a
    // job-and-weapon table where that is not true.
    for (const [one, two] of [
      ['Sword', 'Sword2H'],
      ['Mace', 'Mace2H'],
      ['Spear', 'Spear2H'],
      ['Wand', 'Wand2H'],
      ['Axe', 'Axe2H'],
    ] as [WeaponSpeedClass, WeaponSpeedClass][]) {
      expect(WEAPON_BASE_ATTACK_DELAY[one], `${one} vs ${two}`).toBe(WEAPON_BASE_ATTACK_DELAY[two]);
    }
  });
});

describe('dual wield', () => {
  it('sums both delays and takes four fifths', () => {
    expect(DUAL_WIELD_MULTIPLIER).toBe(0.8);
    // Dagger + Dagger: (1.0 + 1.0) * 0.8 = 1.6
    expect(baseAttackDelay('Dagger', 'Dagger')).toBeCloseTo(1.6, 10);
    // Sword + Dagger: (1.1 + 1.0) * 0.8 = 1.68
    expect(baseAttackDelay('Sword', 'Dagger')).toBeCloseTo(1.68, 10);
  });

  it('is slower per swing than one weapon, which is why it lands two packets', () => {
    expect(baseAttackDelay('Dagger', 'Dagger')).toBeGreaterThan(baseAttackDelay('Dagger'));
  });

  it('a single weapon is its own row untouched', () => {
    expect(baseAttackDelay('Bow')).toBe(1.4);
  });
});

describe('the attack-speed cap', () => {
  it('is 193 hard, 185 soft, and Agility raises the soft one per thirty points', () => {
    expect(ASPD_HARD_CAP).toBe(193);
    expect(attackSpeedCap(0)).toBe(185);
    expect(attackSpeedCap(29)).toBe(185);
    expect(attackSpeedCap(30)).toBe(186);
    expect(attackSpeedCap(240)).toBe(193); // 185 + 8 = 193
  });

  it('never exceeds 193 no matter how much Agility or gear', () => {
    expect(attackSpeedCap(9_000)).toBe(193);
    expect(attackSpeedCap(9_000, 500)).toBe(193);
    expect(attackSpeed({ agi: 9_000, dex: 9_000, bad: 0.9, aspdFlat: 500 })).toBe(193);
  });
});

describe('attack speed', () => {
  it('matches a hand-computed case', () => {
    // AGI 60, DEX 40, Dagger (BAD 1.0), no percent, no flat.
    //   attribute = (60 + floor(40/4)) / 250 = 70/250 = 0.28
    //   200 - 50*1.0*(1 - 0.28)/1 = 200 - 36 = 164
    //   + 0.5*floor(60/10) = +3   ->  167
    //   cap = 185 + floor(60/30) = 187, so no clamp
    expect(attackSpeed({ agi: 60, dex: 40, bad: 1.0 })).toBe(167);
  });

  it('a slower weapon lands a lower number on the same character', () => {
    const fast = attackSpeed({ agi: 60, dex: 40, bad: baseAttackDelay('Dagger') });
    const slow = attackSpeed({ agi: 60, dex: 40, bad: baseAttackDelay('Shotgun') });
    expect(slow).toBeLessThan(fast);
  });

  it('converts to a delay and a rate on the 200-point scale', () => {
    // (200 - 150) / 50 = 1 second
    expect(attackDelaySeconds(150)).toBeCloseTo(1, 10);
    expect(attacksPerSecond(150)).toBeCloseTo(1, 10);
    // At the hard cap: (200 - 193) / 50 = 0.14 s
    expect(attackDelaySeconds(193)).toBeCloseTo(0.14, 10);
    expect(attacksPerSecond(193)).toBeCloseTo(1 / 0.14, 8);
  });
});

describe('cast speed', () => {
  it('matches a hand-computed case', () => {
    // DEX 100, INT 100:
    //   attribute = (100 + 50) / 400 = 0.375
    //   200 - 50*(1 - 0.375)/1 = 200 - 31.25 = 168.75
    //   + 0.5*(floor(100/10) + 0) = +5  ->  173.75
    expect(castSpeed({ dex: 100, int: 100 })).toBeCloseTo(173.75, 10);
  });

  it('divides by 400 where attack speed divides by 250, the same idea one scale down', () => {
    // Equal attribute totals reach a smaller share of the cast scale.
    const cast = castSpeed({ dex: 250, int: 0 });
    // 250/400 = 0.625 -> 200 - 50*0.375 = 181.25, + 0.5*25 = 193.75
    expect(cast).toBeCloseTo(193.75, 10);
  });

  it('caps cast-time reduction at 90 percent unless gear raises the limit', () => {
    const fast = { dex: 400, int: 400, castSpeedPercent: 5, castTimeReduction: 90 };
    expect(castTimeReductionPercent(fast)).toBe(90);
    expect(castTimeReductionPercent({ ...fast, castTimeReductionLimit: 5 })).toBe(95);
  });

  it('never returns a negative reduction', () => {
    expect(castTimeReductionPercent({ dex: 0, int: 0 })).toBeGreaterThanOrEqual(0);
  });

  it('turns the reduction into a cast-time multiplier', () => {
    // A 90% reduction leaves a tenth of the cast time.
    const capped = { dex: 400, int: 400, castSpeedPercent: 5, castTimeReduction: 90 };
    expect(castTimeMultiplier(capped)).toBeCloseTo(0.1, 10);
    // No reduction leaves the cast time alone.
    expect(castTimeMultiplier({ dex: 0, int: 0 })).toBeCloseTo(1, 10);
  });
});
