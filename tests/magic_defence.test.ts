// Ragnarok's magic attack and its two defence layers, pinned as RELATIONSHIPS.
//
// Physical and magical defence have the same SHAPE (capped percentage, then a
// flat subtraction, floored at 1) and are read from the same pre-renewal arms of
// rAthena. The cases that matter most here are the ones that pin where the two
// DIVERGE, because a reader who knows `defence.ts` will assume they do not:
// soft MDEF has no random term, the randomness lives in the attack instead, and
// Vitality is worth only half as much against magic as against a weapon.

import { describe, expect, it } from 'vitest';
import { applyDefence, playerSoftDef } from '../src/sim/combat/defence';
import {
  applyMagicDefence,
  hardMagicDefenceMultiplier,
  MAX_HARD_MDEF,
  MIN_MAGIC_DAMAGE,
  magicAttackRange,
  magicAttackRoll,
  softMagicDefence,
} from '../src/sim/combat/magic_defence';

describe('status MATK: the range Intelligence buys', () => {
  it('WIDENS with Intelligence rather than sliding upward intact', () => {
    // The two ends use different divisors (sevenths and fifths), so the gap
    // between them grows quadratically. This is the property that makes a
    // high-Intelligence caster swingy as well as strong, and it is the reason
    // MATK is a range at all instead of a number.
    const low = magicAttackRange(20);
    const high = magicAttackRange(99);
    expect(high.max - high.min).toBeGreaterThan(low.max - low.min);
    expect(high.min).toBeGreaterThan(low.max);
  });

  it('squares the FLOORED quotient, not the fraction', () => {
    // C integer division at every step. Getting this wrong reads as a small
    // rounding difference at low Intelligence and a large one at 99, so it is
    // pinned against literals computed the same way the source computes them.
    for (const int of [1, 7, 34, 50, 99]) {
      expect(magicAttackRange(int)).toEqual({
        min: int + Math.floor(int / 7) ** 2,
        max: int + Math.floor(int / 5) ** 2,
      });
    }
  });

  it('has no spread at all below 5 Intelligence, where both squares are zero', () => {
    for (const int of [0, 1, 4]) {
      const { min, max } = magicAttackRange(int);
      expect(min).toBe(max);
      expect(magicAttackRoll(int, 0)).toBe(min);
      expect(magicAttackRoll(int, 1)).toBe(min);
    }
  });

  it('never returns a negative range', () => {
    expect(magicAttackRange(-40)).toEqual({ min: 0, max: 0 });
    expect(magicAttackRoll(-40, 1)).toBe(0);
  });
});

describe('the MATK roll', () => {
  it('is HALF-OPEN, so the ceiling itself is unreachable', () => {
    // rAthena rolls `min + rnd() % (max - min)`, an integer modulo that can never
    // land on max. Reproducing that from a continuous fraction is the whole
    // reason the clamp exists; without it a roll of exactly 1.0 would produce a
    // value the source cannot.
    const { min, max } = magicAttackRange(99);
    expect(magicAttackRoll(99, 0)).toBe(min);
    expect(magicAttackRoll(99, 1)).toBe(max - 1);
    expect(magicAttackRoll(99, 1)).toBeLessThan(max);
  });

  it('covers the whole span monotonically', () => {
    const { min, max } = magicAttackRange(70);
    let prev = -1;
    for (let r = 0; r <= 1; r += 0.01) {
      const value = magicAttackRoll(70, r);
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThan(max);
      expect(value).toBeGreaterThanOrEqual(prev);
      prev = value;
    }
    expect(prev).toBe(max - 1);
  });

  it('clamps a roll outside 0..1 instead of extrapolating off the formula', () => {
    expect(magicAttackRoll(99, -3)).toBe(magicAttackRoll(99, 0));
    expect(magicAttackRoll(99, 7)).toBe(magicAttackRoll(99, 1));
  });

  it('draws no randomness of its own, so the same inputs always agree', () => {
    // `src/sim/` routes every draw through the sim's Rng; a leaf reaching for
    // Math.random would fork the three hosts and break the parity gate.
    expect(magicAttackRoll(88, 0.42)).toBe(magicAttackRoll(88, 0.42));
  });
});

describe('soft MDEF: where magic diverges from physical', () => {
  it('is PURELY DETERMINISTIC, unlike soft DEF', () => {
    // The single most surprising difference between the two, and the reason this
    // module takes no roll at all. Pre-renewal `status->mdef2` is a plain
    // `INT + VIT/2` with no rnd() anywhere in the magic branch, where the
    // physical branch rolls a quadratic span. Mitigation against magic does not
    // vary; mitigation against weapons does.
    expect(playerSoftDef(99, 0)).toBeLessThan(playerSoftDef(99, 1));
    expect(softMagicDefence(99, 99)).toBe(softMagicDefence(99, 99));
  });

  it('is LINEAR, with no quadratic acceleration', () => {
    // Soft DEF accelerates because its random term is quadratic in Vitality.
    // Soft MDEF does not, so the last ten points of Intelligence are worth
    // exactly the same as the first ten. Equal steps must produce equal gains.
    const lowStep = softMagicDefence(30, 0) - softMagicDefence(20, 0);
    const highStep = softMagicDefence(99, 0) - softMagicDefence(89, 0);
    expect(lowStep).toBe(highStep);
  });

  it('pays Intelligence in full and Vitality by half', () => {
    // The asymmetry that stops one defensive attribute from answering both damage
    // types: a Vitality build is only half as resistant to spells as it is
    // durable against weapons, and a caster is incidentally its own best shield.
    expect(softMagicDefence(40, 0)).toBe(40);
    expect(softMagicDefence(0, 40)).toBe(20);
    expect(softMagicDefence(40, 40)).toBe(60);
  });

  it('makes Vitality worth strictly less against magic than against a weapon', () => {
    for (const vit of [20, 50, 99]) {
      expect(softMagicDefence(0, vit)).toBeLessThan(playerSoftDef(vit, 0));
    }
  });

  it('floors at zero and never goes negative', () => {
    expect(softMagicDefence(0, 0)).toBe(0);
    expect(softMagicDefence(-50, -50)).toBe(0);
  });
});

describe('hard MDEF: the percentage layer', () => {
  it('is a straight percentage, not a diminishing curve', () => {
    // The era tell, identical to hard DEF's: a search for "MDEF" returns
    // Renewal's `(1000 + eMDEF) / (1000 + eMDEF x 10)`, which is not linear and
    // is not ours.
    expect(1 - hardMagicDefenceMultiplier(20)).toBeCloseTo(0.2, 10);
    expect(1 - hardMagicDefenceMultiplier(40)).toBeCloseTo(0.4, 10);
  });

  it('caps, so no amount of equipment reaches magic immunity', () => {
    expect(hardMagicDefenceMultiplier(MAX_HARD_MDEF)).toBe(0);
    expect(hardMagicDefenceMultiplier(10_000)).toBe(0);
  });

  it('is a no-op at zero, which is what every caller passes today', () => {
    // This engine has no magic-armour field to derive hard MDEF from, so until
    // the gear records carry one the percentage layer must be exactly inert
    // rather than quietly eating damage.
    expect(hardMagicDefenceMultiplier(0)).toBe(1);
    expect(hardMagicDefenceMultiplier(-40)).toBe(1);
    expect(applyMagicDefence(500, { mdef: 0, int: 0, vit: 0 })).toBe(500);
  });
});

describe('applyMagicDefence: the order of the two layers', () => {
  it('takes the percentage first and the flat amount second', () => {
    // Reversing them would make Intelligence scale with equipment, which is what
    // the two layers exist to keep separate. Computing it both ways and pinning
    // the one that differs is what makes this decisive.
    const soft = softMagicDefence(30, 20);
    const percentThenFlat = 1000 * hardMagicDefenceMultiplier(40) - soft;
    const flatThenPercent = (1000 - soft) * hardMagicDefenceMultiplier(40);
    expect(percentThenFlat).not.toBeCloseTo(flatThenPercent, 5);
    expect(applyMagicDefence(1000, { mdef: 40, int: 30, vit: 20 })).toBeCloseTo(
      percentThenFlat,
      10,
    );
  });

  it('floors at 1, so a landed spell always takes something off', () => {
    // Pre-renewal battle.cpp ends the magic branch with `if (ad.damage < 1)
    // ad.damage = 1`, the same floor the physical branch has. Flooring at 0
    // instead would let a high-Intelligence target become literally immune to a
    // weak caster, which is the bug the physical side already shipped once.
    expect(applyMagicDefence(5, { mdef: 40, int: 99, vit: 99 })).toBe(MIN_MAGIC_DAMAGE);
    expect(applyMagicDefence(0, { mdef: 0, int: 0, vit: 0 })).toBe(MIN_MAGIC_DAMAGE);
  });

  it('makes the flat layer matter more against small hits than large ones', () => {
    const def = { mdef: 40, int: 60, vit: 40 };
    const smallLoss = 1 - applyMagicDefence(120, def) / (120 * hardMagicDefenceMultiplier(40));
    const largeLoss = 1 - applyMagicDefence(4000, def) / (4000 * hardMagicDefenceMultiplier(40));
    expect(smallLoss).toBeGreaterThan(largeLoss);
  });

  it('answers the two damage types with DIFFERENT attributes, both ways round', () => {
    // The end-to-end consequence of the divergences above, and the reason both
    // formulas are worth having. A pure-Vitality body is the softer target for a
    // spell, because Vitality pays half there and in full against a weapon. Give
    // the same body Intelligence and it flips: Intelligence is worth one for one
    // against magic and nothing at all against a swing.
    //
    // Pinning BOTH directions is what makes this decisive. Asserting only the
    // first would pass just as happily if soft MDEF ignored Intelligence
    // entirely, which is the mistake this case exists to catch.
    const bruiser = applyMagicDefence(600, { mdef: 0, int: 0, vit: 60 });
    const versusWeapon = applyDefence(600, { armor: 0, vit: 60, roll: 0 });
    expect(bruiser).toBeGreaterThan(versusWeapon);

    const caster = applyMagicDefence(600, { mdef: 0, int: 40, vit: 60 });
    expect(caster).toBeLessThan(versusWeapon);
  });
});
