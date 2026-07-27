// Ragnarok's critical strike. Every case here pins a way it differs from the
// genre default, because the differences are the whole mechanic: it is a
// reliability tool (always hits, ignores defence) rather than a damage
// multiplier, and Luck works on both sides of the swing.

import { describe, expect, it } from 'vitest';
import {
  ABILITY_CAN_CRIT_BY_DEFAULT,
  BASE_CRIT_PERMILLE,
  canCrit,
  critChance,
  critRateFrom,
  LUK_CRIT_PERMILLE,
  MAGIC_CAN_CRIT,
  MIN_CRIT_PERMILLE,
  MONSTER_ON_PLAYER_TARGET_LUK_PERMILLE,
  TARGET_LUK_CRIT_PERMILLE,
} from '../src/sim/combat/crit';

describe('the rate from Luck', () => {
  it('starts at 1% and adds a third of a percent per point', () => {
    expect(critRateFrom(0)).toBeCloseTo(0.01, 10);
    expect(critRateFrom(3)).toBeCloseTo(0.02, 10);
    expect(critRateFrom(99)).toBeCloseTo(0.01 + 99 / 300, 10);
  });

  it('keeps the third exact rather than rounding to 0.3%', () => {
    // The source writes `luk * 10 / 3` in integer per mille. Flattening it to
    // 0.3% costs a capped Luck build a full 3 points of critical rate, which is
    // more than the base rate everyone starts with.
    expect(LUK_CRIT_PERMILLE).toBeGreaterThan(3);
    expect(critRateFrom(99) - (0.01 + 99 * 0.003)).toBeGreaterThan(0.03);
  });

  it('adds gear and talent bonuses on top as a plain fraction', () => {
    expect(critRateFrom(30, 0.05)).toBeCloseTo(critRateFrom(30) + 0.05, 10);
  });
});

describe("the target's Luck denies criticals", () => {
  it('subtracts a fifth of a percent per point of defending Luck', () => {
    const open = critChance({ luk: 60, targetLuk: 0 });
    const guarded = critChance({ luk: 60, targetLuk: 50 });
    expect(open - guarded).toBeCloseTo((50 * TARGET_LUK_CRIT_PERMILLE) / 1000, 10);
  });

  it('denies a monster attacking a player harder than anyone else', () => {
    // The source says the official equation is x2 and that x3 exists only for
    // this case. It is a deliberate thumb on the scale for the player.
    const args = { luk: 60, targetLuk: 40 };
    const monsterOnPlayer = critChance({ ...args, attackerIsMonster: true, targetIsPlayer: true });
    const playerOnAnything = critChance(args);
    expect(monsterOnPlayer).toBeLessThan(playerOnAnything);
    expect(MONSTER_ON_PLAYER_TARGET_LUK_PERMILLE).toBeGreaterThan(TARGET_LUK_CRIT_PERMILLE);
  });

  it('does not apply the harsher rate to a monster attacking a monster', () => {
    const args = { luk: 60, targetLuk: 40, attackerIsMonster: true };
    expect(critChance(args)).toBe(critChance({ ...args, targetIsPlayer: false }));
  });

  it('never reaches zero, however much Luck the target stacks', () => {
    // `cap_value(stat, 1, SHRT_MAX)` floors the derived stat at 1 per mille, so
    // a Luck-stacking target can suppress criticals but never switch them off.
    const crushed = critChance({ luk: 1, targetLuk: 10_000 });
    expect(crushed).toBe(MIN_CRIT_PERMILLE / 1000);
    expect(crushed).toBeGreaterThan(0);
  });

  it('caps at certainty rather than exceeding it', () => {
    expect(critChance({ luk: 99, bonus: 5 })).toBe(1);
  });
});

describe('what is even allowed to crit', () => {
  it('never lets magic crit', () => {
    // battle_calc_magic_attack never calls is_attack_critical; all seven call
    // sites are on the weapon path. This is an absence in the source, which is
    // exactly the kind of thing that gets missed, so it is pinned here.
    expect(MAGIC_CAN_CRIT).toBe(false);
    expect(canCrit({ isSpell: true })).toBe(false);
    expect(canCrit({ isSpell: true, abilityCanCrit: true })).toBe(false);
  });

  it('always lets an ordinary weapon swing crit', () => {
    expect(canCrit({ abilityId: null })).toBe(true);
    expect(canCrit({})).toBe(true);
  });

  it('makes a skill opt IN, because the default is no', () => {
    // `if (skill_id && !skill_get_nk(skill_id, NK_CRITICAL)) return false` is the
    // second line of is_attack_critical. Most skills in Ragnarok simply cannot
    // crit, which is the opposite of this genre's usual default and the single
    // biggest reason a Ragnarok rotation feels the way it does.
    expect(ABILITY_CAN_CRIT_BY_DEFAULT).toBe(false);
    expect(canCrit({ abilityId: 'bash' })).toBe(false);
    expect(canCrit({ abilityId: 'bash', abilityCanCrit: false })).toBe(false);
    expect(canCrit({ abilityId: 'sonic_blow', abilityCanCrit: true })).toBe(true);
  });
});

describe('the pieces line up with the base rate', () => {
  it('agrees between the sheet rate and a contest against a Luckless target', () => {
    for (const luk of [0, 1, 33, 99]) {
      expect(critChance({ luk, targetLuk: 0 })).toBeCloseTo(critRateFrom(luk), 10);
    }
  });

  it('floors a negative Luck rather than paying it out', () => {
    expect(critChance({ luk: -50 })).toBe(BASE_CRIT_PERMILLE / 1000);
    expect(critChance({ luk: 30, targetLuk: -50 })).toBe(critChance({ luk: 30, targetLuk: 0 }));
  });
});
