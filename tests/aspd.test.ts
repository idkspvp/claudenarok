// Ragnarok's attack speed, pinned as RELATIONSHIPS and as the three facts that
// do not survive being remembered: the base is per job AND weapon, Agility is
// worth exactly four Dexterity, and the swing interval is adelay (twice
// amotion), not amotion.
//
// The clamp bounds are pinned to literals because they are DERIVED values, not
// tuning knobs: both fall out of rAthena's config conversion, and a plausible
// wrong answer (95, or 200 for the floor) is what an unchecked memory produces.

import { describe, expect, it } from 'vitest';
import {
  ADELAY_PER_AMOTION,
  AGI_ASPD_WEIGHT,
  ASPD_STAT_DIVISOR,
  amotionFrom,
  aspdStatReduction,
  attackIntervalMs,
  attackIntervalSeconds,
  attackIntervalTicks,
  DEX_ASPD_WEIGHT,
  dualWieldBaseAmotion,
  MAX_AMOTION_MS,
  MIN_AMOTION_MS,
} from '../src/sim/combat/aspd';
import { DT } from '../src/sim/types';

const base = (baseAmotion: number, agi = 0, dex = 0) => ({ baseAmotion, agi, dex });

describe('the stat reduction', () => {
  it('makes one Agility worth exactly four Dexterity, with no curve', () => {
    // The single number that makes Agility THE attack-speed stat. Pinned as an
    // equivalence rather than against a percentage, so it stays decisive if the
    // divisor is ever retuned.
    expect(AGI_ASPD_WEIGHT / DEX_ASPD_WEIGHT).toBe(4);
    expect(aspdStatReduction(10, 0)).toBe(aspdStatReduction(0, 40));
    expect(aspdStatReduction(25, 0)).toBe(aspdStatReduction(0, 100));
  });

  it('is linear, so the last point of Agility is worth the first', () => {
    const early = aspdStatReduction(20, 0) - aspdStatReduction(10, 0);
    const late = aspdStatReduction(99, 0) - aspdStatReduction(89, 0);
    expect(early).toBeCloseTo(late, 12);
  });

  it('stops short of halving a swing even at 99 in both stats', () => {
    // `(4 x 99 + 99) / 1000` is 49.5%. Stats alone can never halve a cadence in
    // Ragnarok; the rest has to come from skills or gear. If this ever reaches
    // or passes 0.5, the divisor has drifted and every class's DPS with it.
    const capped = aspdStatReduction(99, 99);
    expect(capped).toBeCloseTo((4 * 99 + 99) / ASPD_STAT_DIVISOR, 12);
    expect(capped).toBeLessThan(0.5);
  });

  it('never exceeds 1 or goes negative', () => {
    expect(aspdStatReduction(10_000, 10_000)).toBe(1);
    expect(aspdStatReduction(-50, -50)).toBe(0);
  });
});

describe('amotion', () => {
  it('cuts a PERCENTAGE of the base, so a slow weapon gains more real time', () => {
    // The property that stops every build converging on one cadence: the ratio
    // between a fast and a slow weapon is preserved exactly, while the
    // milliseconds saved are not.
    const slowGain = amotionFrom(base(2000)) - amotionFrom(base(2000, 99, 0));
    const fastGain = amotionFrom(base(800)) - amotionFrom(base(800, 99, 0));
    expect(slowGain).toBeGreaterThan(fastGain);
    expect(amotionFrom(base(2000, 99, 0)) / amotionFrom(base(800, 99, 0))).toBeCloseTo(
      2000 / 800,
      1,
    );
  });

  it('truncates like the C rather than rounding a float', () => {
    // `base - floor(base * weighted / 1000)`. Computing it as `base * (1 -
    // fraction)` drifts by up to a millisecond per swing, which compounds over a
    // fight. Pinned against an odd base and an odd stat pair, where the two
    // methods actually disagree.
    const weighted = 4 * 37 + 13;
    expect(amotionFrom(base(1573, 37, 13))).toBe(1573 - Math.floor((1573 * weighted) / 1000));
  });

  it('clamps to the derived band, not to a picked one', () => {
    // 100 is `max_aspd` 190 run through rAthena's config conversion and halved;
    // 4000 is `MIN_ASPD / AMOTION_DIVIDER_PC`. Both are consequences of the
    // source's own constants, and 95 (a plausible misremembering) is not a value
    // any of them produce.
    expect(MIN_AMOTION_MS).toBe(100);
    expect(MAX_AMOTION_MS).toBe(4000);
    expect(amotionFrom(base(120, 99, 99))).toBe(MIN_AMOTION_MS);
    expect(amotionFrom(base(99_000))).toBe(MAX_AMOTION_MS);
  });

  it('applies the flat bonus BEFORE the clamp, so it cannot break the ceiling', () => {
    expect(amotionFrom({ ...base(1000), flatBonus: -200 })).toBe(800);
    expect(amotionFrom({ ...base(1000), flatBonus: 300 })).toBe(1300);
    expect(amotionFrom({ ...base(400, 99, 99), flatBonus: -5000 })).toBe(MIN_AMOTION_MS);
  });

  it('is monotone in both stats and never speeds up as a stat falls', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let agi = 0; agi <= 99; agi++) {
      const value = amotionFrom(base(1600, agi, 40));
      expect(value).toBeLessThanOrEqual(prev);
      prev = value;
    }
  });
});

describe('the swing interval', () => {
  it('is adelay, which is TWICE amotion', () => {
    // Reading the interval off amotion instead would make every character in the
    // game attack exactly twice as fast as Ragnarok does. unit.cpp schedules the
    // auto-attack timer at `tick + adelay`, and `adelay = 2 x amotion`.
    expect(ADELAY_PER_AMOTION).toBe(2);
    const input = base(1400, 60, 30);
    expect(attackIntervalMs(input)).toBe(2 * amotionFrom(input));
    expect(attackIntervalSeconds(input)).toBe(attackIntervalMs(input) / 1000);
  });

  it('bottoms out at 200ms, which is four whole sim ticks', () => {
    // The tick rate must not be the binding constraint anywhere in the legal
    // band, or a build would be quantised into a slower cadence than it paid
    // for. At 20 Hz the fastest legal swing is exactly four ticks, with room to
    // spare across the rest of the range.
    const fastest = { ...base(1400, 99, 99), flatBonus: -5000 };
    expect(attackIntervalMs(fastest)).toBe(200);
    expect(attackIntervalTicks(fastest)).toBe(4);
    expect(attackIntervalSeconds(fastest) / DT).toBe(4);
  });

  it('cannot be reached by attributes alone from any real base', () => {
    // Worth pinning because it is easy to assume the floor is a build target. It
    // is not: stats remove at most 49.5%, so hitting a 100ms motion needs a base
    // under about 198, faster than any weapon would be authored at. A character
    // that reaches the ceiling got there through gear or a skill, which is
    // exactly the division of labour Ragnarok intends.
    for (const baseAmotion of [700, 1000, 1400, 2000]) {
      expect(amotionFrom(base(baseAmotion, 99, 99))).toBeGreaterThan(MIN_AMOTION_MS);
    }
  });

  it('never resolves to a free swing', () => {
    expect(attackIntervalTicks(base(0, 99, 99))).toBeGreaterThanOrEqual(1);
  });

  it('lands in a cadence a player would recognise across the real band', () => {
    // A sanity band rather than a balance pin: an ungeared character with a
    // middling base swings in seconds, and a capped-Agility one is roughly twice
    // as fast, never instant.
    const slow = attackIntervalSeconds(base(1400));
    const fast = attackIntervalSeconds(base(1400, 99, 99));
    expect(slow).toBeCloseTo(2.8, 5);
    expect(fast).toBeGreaterThan(slow / 2);
    expect(fast).toBeLessThan(slow);
  });
});

describe('dual wielding', () => {
  it('takes seven tenths of the two bases ADDED, not their average', () => {
    // Averaging is the intuitive reading and it is wrong: two one-handers are
    // SLOWER than either alone, which is the cost that pays for two damage
    // sources. Asserting against the average is what makes this decisive.
    const combined = dualWieldBaseAmotion(1000, 1200);
    expect(combined).toBe(Math.floor((2200 * 7) / 10));
    expect(combined).toBeGreaterThan(1200);
    expect(combined).not.toBe(1100);
  });

  it('is symmetric in the two weapons', () => {
    expect(dualWieldBaseAmotion(900, 1500)).toBe(dualWieldBaseAmotion(1500, 900));
  });

  it('feeds the ordinary pipeline, so Agility still cuts the combined base', () => {
    const combined = dualWieldBaseAmotion(1000, 1000);
    expect(amotionFrom(base(combined, 99, 0))).toBeLessThan(combined);
  });
});

describe('purity', () => {
  it('draws no randomness, so the same inputs always agree', () => {
    // `src/sim/` routes every draw through the sim's Rng; attack speed has no
    // random term in Ragnarok at all, so this module takes no roll and must stay
    // that way.
    const input = base(1234, 55, 44);
    expect(amotionFrom(input)).toBe(amotionFrom(input));
    expect(attackIntervalTicks(input)).toBe(attackIntervalTicks(input));
  });
});
