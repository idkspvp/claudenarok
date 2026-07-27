// Ragnarok's two-layer defence, pinned as RELATIONSHIPS rather than as damage
// numbers. The shapes here (a capped percentage, then a flat subtraction, in
// that order) are the mechanic and are read from rAthena's pre-renewal branch;
// the one conversion constant is deliberately tested for its consequences (never
// immune, monotone, ordered) rather than for its value, so retuning it stays a
// one-line change instead of a test rewrite.

import { describe, expect, it } from 'vitest';
import {
  ARMOR_TO_HARD_DEF,
  applyDefence,
  hardDefFrom,
  hardDefMultiplier,
  MAX_HARD_DEF,
  monsterSoftDef,
  playerSoftDef,
  REACHABLE_ARMOR_CEILING,
} from '../src/sim/combat/defence';

describe('hard DEF: the percentage layer', () => {
  it('is a straight percentage, not a diminishing curve', () => {
    // The tell that separates the two eras: pre-renewal DEF is linear, so twice
    // the DEF removes exactly twice the damage. Renewal's `(4000 + DEF) / (4000 +
    // DEF x 10)` curve does not, and a search for "pre-renewal DEF" returns it.
    const twenty = 20 * ARMOR_TO_HARD_DEF;
    const forty = 40 * ARMOR_TO_HARD_DEF;
    expect(1 - hardDefMultiplier(twenty)).toBeCloseTo(0.2, 10);
    expect(1 - hardDefMultiplier(forty)).toBeCloseTo(0.4, 10);
  });

  it('caps, so no amount of equipment reaches immunity', () => {
    expect(hardDefFrom(ARMOR_TO_HARD_DEF * 10_000)).toBe(MAX_HARD_DEF);
    expect(hardDefMultiplier(ARMOR_TO_HARD_DEF * 10_000)).toBe(0);
  });

  it('keeps the armour this game actually reaches below the cap', () => {
    // The conversion exists because armour here is unbounded and level-scaled
    // while Ragnarok's DEF stops at 100. If the divisor ever saturates at a
    // reachable value, a geared character is literally immune to physical
    // damage, and that is the failure this pins. Retuning the divisor or
    // rebuilding the item tables has to keep this true.
    expect(hardDefFrom(REACHABLE_ARMOR_CEILING)).toBeLessThan(MAX_HARD_DEF);
    expect(hardDefMultiplier(REACHABLE_ARMOR_CEILING)).toBeGreaterThan(0);
  });

  it('is monotone and floors at zero armour', () => {
    expect(hardDefFrom(0)).toBe(0);
    expect(hardDefFrom(-500)).toBe(0);
    let prev = -1;
    for (let armor = 0; armor <= 2_000; armor += 50) {
      const def = hardDefFrom(armor);
      expect(def).toBeGreaterThanOrEqual(prev);
      prev = def;
    }
  });
});

describe('soft DEF: the flat layer from Vitality', () => {
  it('accelerates, because the random term is quadratic in Vitality', () => {
    // Ragnarok's Vitality is worth more the more of it you buy. Comparing the
    // ceilings rather than the floors is what exposes it: the floor terms are
    // linear and the quadratic lives entirely in the roll.
    const at50 = playerSoftDef(50, 1) - playerSoftDef(25, 1);
    const at99 = playerSoftDef(99, 1) - playerSoftDef(74, 1);
    expect(at99).toBeGreaterThan(at50);
  });

  it('has no random span at all until the quadratic term overtakes the floor', () => {
    // Below roughly 60 Vitality the span clamps to zero, so soft DEF is exactly
    // predictable. This is a real property of the formula, not a rounding
    // artefact, and it is why low-Vitality characters feel no variance.
    expect(playerSoftDef(20, 0)).toBe(playerSoftDef(20, 1));
    expect(playerSoftDef(99, 0)).toBeLessThan(playerSoftDef(99, 1));
  });

  it('gives monsters a higher floor than players at the same Vitality', () => {
    // Monsters use `VIT + rnd(0, (VIT/20)^2)`, which is near-linear, against the
    // player formula's `(3xVIT)/10 + roll + VIT/2`. A monster gets its whole
    // Vitality where a player gets four fifths of it, so a monster is ahead
    // across the entire 1..99 range. Two formulas, not one, is the mechanic; the
    // player one is the weaker of the two on purpose.
    for (const vit of [1, 20, 50, 99]) {
      expect(monsterSoftDef(vit, 0)).toBeGreaterThanOrEqual(playerSoftDef(vit, 0));
    }
  });

  it('is bounded by its roll and never negative', () => {
    for (const vit of [0, 1, 20, 50, 99, 150]) {
      expect(playerSoftDef(vit, 0)).toBeLessThanOrEqual(playerSoftDef(vit, 1));
      expect(monsterSoftDef(vit, 0)).toBeLessThanOrEqual(monsterSoftDef(vit, 1));
      expect(playerSoftDef(vit, 0)).toBeGreaterThanOrEqual(0);
      expect(monsterSoftDef(vit, 0)).toBeGreaterThanOrEqual(0);
    }
    expect(playerSoftDef(-10, 1)).toBe(0);
    expect(monsterSoftDef(-10, 1)).toBe(0);
  });

  it('clamps a roll outside 0..1 instead of extrapolating off the formula', () => {
    expect(playerSoftDef(99, -3)).toBe(playerSoftDef(99, 0));
    expect(playerSoftDef(99, 7)).toBe(playerSoftDef(99, 1));
  });
});

describe('applyDefence: the order of the two layers', () => {
  const heavyArmor = 40 * ARMOR_TO_HARD_DEF; // 40 hard DEF

  it('takes the percentage first and the flat amount second', () => {
    // Reversing the order would make Vitality scale with armour, which is
    // exactly what the two layers exist to keep separate. Computing the expected
    // value both ways and asserting the smaller one is what makes this decisive:
    // the two differ by the hard-DEF fraction of the soft-DEF value.
    const soft = playerSoftDef(30, 0);
    const percentThenFlat = 1000 * hardDefMultiplier(heavyArmor) - soft;
    const flatThenPercent = (1000 - soft) * hardDefMultiplier(heavyArmor);
    expect(percentThenFlat).not.toBeCloseTo(flatThenPercent, 5);
    expect(applyDefence(1000, { armor: heavyArmor, vit: 30, roll: 0 })).toBeCloseTo(
      percentThenFlat,
      10,
    );
  });

  it('routes monsters and players to their own soft-DEF shape', () => {
    const args = { armor: heavyArmor, vit: 40, roll: 1 };
    expect(applyDefence(1000, { ...args, isMonster: true })).toBeCloseTo(
      1000 * hardDefMultiplier(heavyArmor) - monsterSoftDef(40, 1),
      10,
    );
    expect(applyDefence(1000, args)).toBeCloseTo(
      1000 * hardDefMultiplier(heavyArmor) - playerSoftDef(40, 1),
      10,
    );
  });

  it('floors at zero rather than healing the target', () => {
    expect(applyDefence(5, { armor: heavyArmor, vit: 99, roll: 1 })).toBe(0);
  });

  it('makes the flat layer matter more against small hits than large ones', () => {
    // The whole reason both layers exist. A flat subtraction is a rounding error
    // on a big hit and most of a small one, which is why stacking Vitality is
    // how a character stops being chipped down by a swarm.
    const def = { armor: heavyArmor, vit: 60, roll: 0 };
    const smallLoss = 1 - applyDefence(60, def) / (60 * hardDefMultiplier(heavyArmor));
    const largeLoss = 1 - applyDefence(2000, def) / (2000 * hardDefMultiplier(heavyArmor));
    expect(smallLoss).toBeGreaterThan(largeLoss);
  });

  it('draws no randomness of its own, so the same inputs always agree', () => {
    // `src/sim/` routes every draw through the sim's Rng; a leaf that reached for
    // Math.random would fork the three hosts and break the parity gate. Passing
    // the roll in is what keeps this module a pure leaf.
    const def = { armor: 300, vit: 99, roll: 0.42 };
    expect(applyDefence(750, def)).toBe(applyDefence(750, def));
  });
});
