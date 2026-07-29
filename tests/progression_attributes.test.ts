// The attribute-point economy.
//
// Two of these tests exist to record that THE SOURCE DISAGREES WITH ITSELF, and
// which side this implementation took. That is more useful than a green tick:
// the next person to read the wiki will hit the same contradiction.

import { describe, expect, it } from 'vitest';
import {
  attributePointsForLevel,
  attributeRaiseCost,
  BASE_ATTRIBUTE,
  CREATION_ALLOCATED_POINTS,
  costToCapFromBase,
  costToRaise,
  earnedAttributePointsAt,
  MAX_ATTRIBUTE,
} from '../src/sim/progression/attributes';

describe('what a level grants', () => {
  it('grants nothing at level 1, because those 27 arrive pre-spent', () => {
    expect(attributePointsForLevel(1)).toBe(0);
    expect(earnedAttributePointsAt(1)).toBe(0);
    expect(CREATION_ALLOCATED_POINTS).toBe(27);
  });

  it('pays 3, then 2, then 1 across the three bands', () => {
    expect(attributePointsForLevel(2)).toBe(3);
    expect(attributePointsForLevel(100)).toBe(3);
    expect(attributePointsForLevel(101)).toBe(2);
    expect(attributePointsForLevel(130)).toBe(2);
    expect(attributePointsForLevel(131)).toBe(1);
    expect(attributePointsForLevel(150)).toBe(1);
    expect(attributePointsForLevel(151)).toBe(0);
  });

  it('matches each band total the source publishes', () => {
    // 99 levels at 3, then 30 at 2, then 20 at 1.
    expect(earnedAttributePointsAt(100)).toBe(297);
    expect(earnedAttributePointsAt(130)).toBe(297 + 60);
    expect(earnedAttributePointsAt(150)).toBe(297 + 60 + 20);
  });

  it('earns 377 by the cap, and the source calls the lifetime figure 404', () => {
    // Recorded because the source labels 404 "earned through leveling" while its
    // own three bands sum to 377. 404 is 377 plus the 27 pre-spent at creation,
    // so the figure is right and the label is wrong. This file implements the
    // bands.
    expect(earnedAttributePointsAt(150)).toBe(377);
    expect(earnedAttributePointsAt(150) + CREATION_ALLOCATED_POINTS).toBe(404);
  });
});

describe('what a point costs', () => {
  it('charges 1, then 2, then 3, reading the band off the value moved INTO', () => {
    expect(attributeRaiseCost(1)).toBe(1);
    expect(attributeRaiseCost(49)).toBe(1);
    // 50 to 51 leaves the 1-cost band, so it is charged at 1.
    expect(attributeRaiseCost(50)).toBe(2);
    expect(attributeRaiseCost(97)).toBe(2);
    // 98 to 99 is the single 3-cost step.
    expect(attributeRaiseCost(98)).toBe(3);
  });

  it('never charges more than 3, where the model it replaces reached 11', () => {
    // The old ladder was 2 + (value-1)/10, so the last point of a 99 cost 11.
    // Same escalating idea, one third the punishment at the top.
    for (let v = BASE_ATTRIBUTE; v < MAX_ATTRIBUTE; v++) {
      expect(attributeRaiseCost(v), `raising from ${v}`).toBeLessThanOrEqual(3);
    }
  });

  it('costs 148 to take one attribute from the base to the cap', () => {
    // 49 steps at 1, 48 at 2, 1 at 3.
    expect(costToCapFromBase()).toBe(49 + 96 + 3);
    expect(costToCapFromBase()).toBe(148);
  });

  it('refuses to go past the cap at any price', () => {
    expect(costToRaise(BASE_ATTRIBUTE, MAX_ATTRIBUTE + 1)).toBe(Number.POSITIVE_INFINITY);
    expect(attributeRaiseCost(MAX_ATTRIBUTE)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('the acceptance case: a level-150 character capping two attributes', () => {
  it('can afford both, from the base, with 81 points spare', () => {
    const budget = earnedAttributePointsAt(150);
    const two = costToCapFromBase() * 2;
    expect(two).toBe(296);
    expect(budget).toBeGreaterThan(two);
    expect(budget - two).toBe(81);
  });

  it('can afford both more cheaply from a class block, with 100 spare', () => {
    // A real character does not start at 1 across the board. A Warrior opens
    // 12 / 9 / 9 / 1 / 1 / 1, so capping its two lead attributes starts partway
    // up the ladder and the cheap band is already partly bought.
    const warrior = costToRaise(12, 99) + costToRaise(9, 99);
    expect(warrior).toBe(277);
    expect(earnedAttributePointsAt(150) - warrior).toBe(100);
  });

  it('records that the source claims 110 spare, which none of its own rules give', () => {
    // The plan's acceptance line asks for "the published remainder". The
    // published remainder cannot be reproduced from the published rules, and
    // this test is where that is written down rather than quietly rounded to.
    //
    //   from the base, 377 earned:            377 - 296 = 81
    //   from a Warrior block, 377 earned:     377 - 277 = 100
    //   from the base, 404 lifetime:          404 - 296 = 108
    //   from a Warrior block, 404 lifetime:   404 - 277 = 127
    //
    // The source says 110. No reading of its own bands and ladder produces it,
    // so the RULES are implemented and the worked EXAMPLE is treated as the
    // source's arithmetic slip, consistent with its 404 label.
    const SOURCE_CLAIMS = 110;
    const budget = earnedAttributePointsAt(150);
    const lifetime = budget + CREATION_ALLOCATED_POINTS;
    const fromBase = costToCapFromBase() * 2;
    const fromWarrior = costToRaise(12, 99) + costToRaise(9, 99);
    for (const [label, value] of [
      ['base, earned', budget - fromBase],
      ['warrior, earned', budget - fromWarrior],
      ['base, lifetime', lifetime - fromBase],
      ['warrior, lifetime', lifetime - fromWarrior],
    ] as const) {
      expect(value, `${label} must not accidentally equal the unreproducible claim`).not.toBe(
        SOURCE_CLAIMS,
      );
    }
  });
});
