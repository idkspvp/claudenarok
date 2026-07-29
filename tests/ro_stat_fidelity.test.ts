// Does what we built actually match its reference?
//
// MID-CONVERSION. This file was written when the reference was pre-renewal
// Ragnarok. The attack derivations below now check SpiritVale instead, and the
// assertions that used to prove a SQUARED per-ten term deliberately run the
// other way: proving it is LINEAR is how a future edit back toward the square
// gets caught. The accuracy section still checks Ragnarok and converts with the
// accuracy formula (phase 2); the status-point budget section still checks
// Ragnarok and converts with the attribute ladder (phase 3).
//
// The other stat tests check that our code is self-consistent. This one checks it
// against the GAME, using published pre-renewal figures as literals. It is the
// only place those numbers appear, so a drift shows up here as a named failure
// rather than as a vague feeling that combat is off.
//
// Sources for the figures below, all cited so a later reader can re-derive them:
//   - The three attribute-grant bands, the three-step cost ladder and the 27
//     pre-spent at creation come from docs/design/spiritvale-engine-formulas.md
//     (Progression), which took them from a community wiki.
//   - The attack, accuracy and pool formulas come from the same document's
//     transcription of the engine methods.
//
// Where an assertion pins a DIFFERENCE from pre-renewal Ragnarok it says so in
// place, because those are the numbers a reader is most likely to expect and
// most likely to "fix" back.

import { describe, expect, it } from 'vitest';
import { fleeRating, hitRating, perfectDodgeChance } from '../src/sim/combat/hit_flee';
import {
  type AttackAttributes,
  magicAttack,
  meleeAttack,
  rangedAttack,
} from '../src/sim/stats/attack';
import { intManaMultiplier, vitHealthMultiplier } from '../src/sim/stats/resources';
import {
  BASE_STAT,
  CREATION_STATUS_POINTS,
  MAX_LEVEL,
  MAX_STAT,
  statRaiseCost,
  statusPointsForLevel,
  totalStatusPointsAt,
} from '../src/sim/types';

describe('the status-point budget follows SpiritVale', () => {
  it('earns 377 across base levels 1 to 150, in three bands', () => {
    expect(MAX_LEVEL).toBe(150);
    expect(totalStatusPointsAt(MAX_LEVEL)).toBe(377);
    expect(totalStatusPointsAt(100)).toBe(297);
    expect(totalStatusPointsAt(130)).toBe(297 + 60);
  });

  it('pre-spends 27 at creation rather than handing out a free pool', () => {
    // This is the change with the largest practical effect on a new character.
    // The model it replaces handed out 48 UNSPENT points at level 1, so a fresh
    // character was a blank slate the player had to configure before playing.
    // Here the 27 arrive already spent into a class block and cannot be moved,
    // so the character is playable immediately and its class means something
    // again.
    expect(CREATION_STATUS_POINTS).toBe(27);
    // And they are NOT in the earned pool, which is what stops a player
    // reclaiming them.
    expect(totalStatusPointsAt(1)).toBe(0);
  });

  it('grants on the level being REACHED, and the bands make that unambiguous', () => {
    // The old curve had to distinguish reached from left, because a continuous
    // floor(level/5)+3 differs by one step either way. Flat bands do not: every
    // level inside a band grants the same amount, so only the two boundaries
    // could disagree and both are stated as inclusive ranges.
    let asReached = 0;
    for (let l = 2; l <= MAX_LEVEL; l++) asReached += statusPointsForLevel(l);
    expect(asReached).toBe(totalStatusPointsAt(MAX_LEVEL));
  });

  it('lets a capped character buy two 99s and keep 81 over', () => {
    // 148 per attribute against 377 earned. Compare the model this replaces: 628
    // per attribute against 1,273, which left 17. Both afford two caps; this one
    // leaves four times the change, which is the whole point of the gentler
    // ladder.
    let oneStatTo99 = 0;
    for (let v = BASE_STAT; v < MAX_STAT; v++) oneStatTo99 += statRaiseCost(v);
    expect(oneStatTo99).toBe(148);
    expect(oneStatTo99 * 2).toBe(296);
    expect(totalStatusPointsAt(MAX_LEVEL) - oneStatTo99 * 2).toBe(81);
  });

  it('charges 1 through 50, 2 through 98, and 3 for the last step', () => {
    // The band is read off the value moved INTO, so 50 to 51 leaves the cheap
    // band and is charged at 2. Getting this off by one is invisible in any
    // single raise and shows up only as a budget that does not add up.
    expect(statRaiseCost(1)).toBe(1);
    expect(statRaiseCost(49)).toBe(1);
    expect(statRaiseCost(50)).toBe(2);
    expect(statRaiseCost(97)).toBe(2);
    expect(statRaiseCost(98)).toBe(3);
  });

  it('never charges more than 3, where the old ladder reached 11', () => {
    for (let v = BASE_STAT; v < MAX_STAT; v++) {
      expect(statRaiseCost(v), `raising from ${v}`).toBeLessThanOrEqual(3);
    }
  });
});

const attributes = (over: Partial<AttackAttributes> = {}): AttackAttributes => ({
  str: 0,
  agi: 0,
  vit: 0,
  int: 0,
  dex: 0,
  luk: 0,
  ...over,
});
const melee = (str: number, over: Partial<AttackAttributes> = {}): number =>
  meleeAttack({ level: 1, attributes: attributes({ str, ...over }) });

describe('the attack derivations follow SpiritVale', () => {
  it('scales HP by 1% a point of VIT and SP by 1% a point of INT', () => {
    expect(vitHealthMultiplier(1)).toBeCloseTo(1.01, 10);
    expect(vitHealthMultiplier(99)).toBeCloseTo(1.99, 10);
    expect(intManaMultiplier(1)).toBeCloseTo(1.01, 10);
    expect(intManaMultiplier(99)).toBeCloseTo(1.99, 10);
  });

  it('carries a LINEAR per-ten breakpoint where pre-renewal squared it', () => {
    // The single most consequential difference between the two models. Ragnarok
    // adds floor(STR/10)^2, so at 99 the square alone contributes 81 on top of
    // the 99 and the last ten points beat the first fifty. SpiritVale makes the
    // same breakpoint one percent, reaching 1.09x across the entire range.
    const firstFifty = melee(50) - melee(0);
    const lastTen = melee(99) - melee(89);
    expect(lastTen).toBeGreaterThan(0);
    // Under the old model this read lastTen > firstFifty. It now reads the other
    // way round by a wide margin, and that is the point.
    expect(firstFifty).toBeGreaterThan(lastTen * 4);
  });

  it('pays a fifth of DEX and LUK into melee attack, and Strength one and a half', () => {
    // Lv 1: base = 1/4 + STR*1.5 + DEX/5 + LUK/5, then the breakpoint.
    expect(melee(0, { dex: 25 })).toBeCloseTo(0.25 + 5, 10);
    expect(melee(0, { luk: 25 })).toBeCloseTo(0.25 + 5, 10);
    // Strength leads at 1.5, not 1.0 as the model it replaced had it.
    expect(melee(10) - melee(0)).toBeCloseTo(15 * 1.01 + 0.25 * 0.01, 8);
  });

  it('swaps which attribute LEADS for a ranged weapon rather than paying one twice', () => {
    // The bug this has always pinned: reusing the melee shape with Dexterity in
    // both slots pays a bow user a second time for Dexterity and nothing for
    // their Strength. Ranged puts Dexterity at full weight and Strength at a
    // support fifth, so the two branches disagree on the same attribute block.
    const attrs = attributes({ str: 50, dex: 99 });
    expect(rangedAttack({ level: 1, attributes: attrs })).not.toBeCloseTo(
      meleeAttack({ level: 1, attributes: attrs }),
      6,
    );
    // Dexterity at weight 1 on the ranged branch, a fifth on the melee one.
    const dexOnly = attributes({ dex: 50 });
    expect(rangedAttack({ level: 1, attributes: dexOnly })).toBeGreaterThan(
      meleeAttack({ level: 1, attributes: dexOnly }),
    );
  });

  it('carries a LEVEL term in every attack formula, which pre-renewal has nowhere', () => {
    // Ragnarok's status attack has no level term at all, which is why a
    // high-level character there with poor Strength hits like a beginner. Every
    // branch here carries Lv/4.
    const attrs = attributes({ str: 30, int: 30, dex: 30 });
    for (const [name, fn] of [
      ['melee', meleeAttack],
      ['ranged', rangedAttack],
      ['magic', magicAttack],
    ] as const) {
      const low = fn({ level: 1, attributes: attrs });
      const high = fn({ level: 150, attributes: attrs });
      expect(high, name).toBeGreaterThan(low);
    }
  });

  it('gives magic attack the same shape as melee, led by Intelligence', () => {
    // Not a range any more: Ragnarok rolls MATK between an INT/7 and an INT/5
    // end, and this model produces one number.
    const attrs = attributes({ int: 99 });
    // 1/4 + 99*1.5 = 148.75, breakpoint 1 + floor(99/10)/100 = 1.09
    expect(magicAttack({ level: 1, attributes: attrs })).toBeCloseTo(148.75 * 1.09, 8);
  });

  it('floors the pool multipliers at zero so a drain cannot invert them', () => {
    expect(vitHealthMultiplier(-50)).toBe(1);
    expect(intManaMultiplier(-50)).toBe(1);
    // The attack formulas clamp their BREAKPOINT and AMPLIFIER inputs but not
    // the attribute terms themselves, so a drained attribute genuinely subtracts
    // and the raw formula can go negative. That is deliberate: the floor lives in
    // recalcPlayerStats, which is the one place a derived stat is finalised, and
    // duplicating it in the leaf would hide a drain from a caller that wants to
    // see it. Lv 100 gives 25 from the level term; -50 in three attributes takes
    // 95 off it.
    const drained = attributes({ str: -50, dex: -50, luk: -50 });
    expect(meleeAttack({ level: 100, attributes: drained })).toBeCloseTo(-70, 10);
  });
});

describe('the accuracy ratings follow SpiritVale', () => {
  it('pays TWO Hit per Dexterity, a fifth of Luck, and a flat 25 to everyone', () => {
    // Every one of those three is new. The model this replaces read level plus
    // Dexterity, full stop: one per point, no Luck term, no baseline.
    expect(hitRating(1, 0, 0)).toBe(1 + 25);
    expect(hitRating(50, 30, 0)).toBe(50 + 60 + 25);
    expect(hitRating(50, 30, 25)).toBe(50 + 60 + 5 + 25);
    // Dexterity is worth exactly twice what it was.
    expect(hitRating(50, 31, 0) - hitRating(50, 30, 0)).toBe(2);
  });

  it('pays HALF a Flee per Agility, floored, where it used to pay a full point', () => {
    expect(fleeRating(1, 0)).toBe(1);
    expect(fleeRating(50, 30)).toBe(50 + 15);
    // Floored, so an odd point buys nothing on its own.
    expect(fleeRating(50, 31)).toBe(fleeRating(50, 30));
  });

  it('makes accuracy four times easier to stack than evasion', () => {
    // The clearest statement of the change. Ten points into Dexterity buys
    // twenty Hit; ten into Agility buys five Flee. Under the old model both
    // bought ten, and the two sides met at parity.
    expect(hitRating(50, 10, 0) - hitRating(50, 0, 0)).toBe(20);
    expect(fleeRating(50, 10) - fleeRating(50, 0)).toBe(5);
  });

  it('gives LUCK a say in accuracy, which pre-renewal denies it', () => {
    // Pinned as a PRESENCE now. It used to be pinned as an absence, on the
    // grounds that the luk/5 term belonged to Renewal; SpiritVale has it.
    expect(hitRating(50, 30, 25)).toBeGreaterThan(hitRating(50, 30, 0));
    // A fifth of a point. The SOURCE DISAGREES WITH ITSELF here and this pin
    // records which side we took: the published expression is
    // round( (Lv + 2*DEX + LUK/5 + flatHit + 25) * (1 + Hit%) ), a real division
    // inside one round over the whole sum, but the prose note beside it says
    // "integer division, so 4 LUK adds nothing". Those cannot both be true.
    // We follow the EXPRESSION, because that is the transcribed formula and the
    // note is the site's gloss on it. Under the expression 4 Luck contributes
    // 0.8, which the round carries.
    expect(hitRating(50, 0, 4)).toBe(hitRating(50, 0, 0) + 1);
    expect(hitRating(50, 0, 5)).toBe(hitRating(50, 0, 0) + 1);
    // Two Luck contributes 0.4 and rounds away, so it is not simply "any Luck
    // rounds up" either.
    expect(hitRating(50, 0, 2)).toBe(hitRating(50, 0, 0));
  });

  it('does NOT meet at parity: the attacker starts ahead by 25 plus the split', () => {
    // Two equally built characters of the same level no longer trade evenly.
    // That is deliberate in this model, not an oversight in ours.
    expect(hitRating(20, 0, 0)).toBeGreaterThan(fleeRating(20, 0));
    expect(hitRating(20, 0, 0) - fleeRating(20, 0)).toBe(25);
  });

  it('penalises Flee from the FIFTH attacker, which the old model never did', () => {
    const alone = fleeRating(50, 40, 1);
    expect(fleeRating(50, 40, 4)).toBe(alone);
    expect(fleeRating(50, 40, 5)).toBeCloseTo(alone * 0.9, 10);
    expect(fleeRating(50, 40, 8)).toBeCloseTo(alone * 0.6, 10);
  });

  it('keeps the Luck perfect dodge as a STAND-IN, not as a transcription', () => {
    // SpiritVale reads a plain PerfectDodge gear stat with no attribute term.
    // No item in this game grants it yet, so switching now would delete the
    // mechanic outright. The Luck derivation stays until phase 6 can grant it.
    expect(perfectDodgeChance(0)).toBeCloseTo(0.01, 10);
    expect(perfectDodgeChance(50)).toBeCloseTo(0.06, 10);
  });
});
