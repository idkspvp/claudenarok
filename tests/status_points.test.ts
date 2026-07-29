// Status points: the budget rules the whole allocation system rests on.
//
// The pure module is the only thing that decides what a spend costs and whether a
// saved allocation is legal, and both the offline Sim and the server call it, so a
// rule that is wrong here is wrong in both places at once. These cases pin the
// arithmetic against literals rather than against the functions that produce it.
//
// Everything here is CLASS-AWARE, which is the shape the conversion brought back.
// A character does not start as a blank slate with a pile of points: it opens with
// its class block already spent, and the block is not reallocatable. That single
// fact is why every function in the module takes a `PlayerClass`, and why the
// budget adds the block's cost rather than excluding it from the spend.

import { describe, expect, it } from 'vitest';
import { openingAllocation, openingAllocationCost } from '../src/sim/progression/class_blocks';
import {
  lowerRefund,
  lowerStat,
  raiseCost,
  raiseStat,
  resetStatAllocation,
  sanitizeStatAllocation,
  statValue,
  unspentStatusPoints,
} from '../src/sim/status_points';
import {
  BASE_STAT,
  CREATION_STATUS_POINTS,
  MAX_LEVEL,
  MAX_STAT,
  type PlayerClass,
  type StatAllocation,
  statRaiseCost,
  statusPointsForLevel,
  statusPointsSpent,
  totalStatusPointsAt,
} from '../src/sim/types';

const CLASSES: readonly PlayerClass[] = ['swordman', 'thief', 'acolyte', 'archer', 'mage'];

/** A fresh character of `cls`: the opening block and nothing more. */
const fresh = (cls: PlayerClass): StatAllocation => openingAllocation(cls);

const raiseTo = (alloc: StatAllocation, level: number, cls: PlayerClass, stat: 'str' | 'agi') => {
  let a = alloc;
  for (let i = 0; i < 1000; i++) {
    const next = raiseStat(a, level, stat, cls);
    if (!next) break;
    a = next;
  }
  return a;
};

describe('the cost curve', () => {
  it('charges 1 through 50, 2 through 98, and 3 for the last step', () => {
    // Pinned to literals. The band is read off the value moved INTO, so the step
    // that LEAVES a band is charged at the new band's rate.
    expect(statRaiseCost(1)).toBe(1);
    expect(statRaiseCost(48)).toBe(1);
    expect(statRaiseCost(49)).toBe(1);
    expect(statRaiseCost(50)).toBe(2);
    expect(statRaiseCost(97)).toBe(2);
    expect(statRaiseCost(98)).toBe(3);
  });

  it('never charges more than 3, where the ladder it replaces reached 11', () => {
    // The old curve was `2 + (value-1)/10`, so the last point of a 99 cost 11 and
    // a 99 was a commitment a character could barely afford. Same escalating idea,
    // one third the punishment at the top.
    for (let v = BASE_STAT; v < MAX_STAT; v++) {
      expect(statRaiseCost(v), `raising from ${v}`).toBeLessThanOrEqual(3);
    }
    expect(statRaiseCost(98) / statRaiseCost(1)).toBe(3);
  });
});

describe('the budget', () => {
  it('earns nothing at level 1, because the creation points arrive pre-spent', () => {
    expect(totalStatusPointsAt(1)).toBe(0);
    expect(CREATION_STATUS_POINTS).toBe(27);
    // And the block costs exactly what creation grants, for every class.
    for (const cls of CLASSES) {
      expect(openingAllocationCost(cls), cls).toBe(CREATION_STATUS_POINTS);
    }
  });

  it('grants 3, then 2, then 1 across the three level bands', () => {
    expect(statusPointsForLevel(2)).toBe(3);
    expect(statusPointsForLevel(100)).toBe(3);
    expect(statusPointsForLevel(101)).toBe(2);
    expect(statusPointsForLevel(130)).toBe(2);
    expect(statusPointsForLevel(131)).toBe(1);
    expect(statusPointsForLevel(MAX_LEVEL)).toBe(1);
    expect(totalStatusPointsAt(MAX_LEVEL)).toBe(377);
  });

  it('grows strictly with level all the way to the cap', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(totalStatusPointsAt(l), `level ${l}`).toBeGreaterThan(totalStatusPointsAt(l - 1));
    }
  });

  it('leaves a brand new character with nothing to place', () => {
    // The block IS the level-1 budget: 27 granted, 27 already spent. This is the
    // whole point of the class-block model and the thing that reads as a bug if
    // the budget forgets to acknowledge paying for the block.
    for (const cls of CLASSES) {
      expect(unspentStatusPoints(fresh(cls), 1, cls), cls).toBe(0);
      expect(raiseCost(fresh(cls), 1, 'luk', cls), cls).toBeNull();
    }
  });

  it('cannot afford a 99 in everything, or anything close to it', () => {
    // The budget has to be the binding constraint, not the per-stat cap: if a
    // capped character could max all six there would be no build to speak of.
    let costOfOne99 = 0;
    for (let v = BASE_STAT; v < MAX_STAT; v++) costOfOne99 += statRaiseCost(v);
    expect(costOfOne99).toBe(148);
    const budget = totalStatusPointsAt(MAX_LEVEL) + CREATION_STATUS_POINTS;
    expect(budget).toBeGreaterThan(costOfOne99 * 2);
    expect(budget).toBeLessThan(costOfOne99 * 3);
  });
});

describe('spending', () => {
  it('charges the step price and draws the pool down by it', () => {
    const start = fresh('swordman');
    const before = unspentStatusPoints(start, 2, 'swordman');
    expect(before).toBe(3);
    // A Warrior opens with 12 Strength, so the next step is charged in the
    // cheap band and costs 1.
    expect(statValue(start, 'str')).toBe(12);
    expect(raiseCost(start, 2, 'str', 'swordman')).toBe(1);

    const next = raiseStat(start, 2, 'str', 'swordman');
    expect(next).not.toBeNull();
    expect(statValue(next as StatAllocation, 'str')).toBe(13);
    expect(unspentStatusPoints(next as StatAllocation, 2, 'swordman')).toBe(before - 1);
  });

  it('leaves the source allocation untouched, so a refused spend cannot half-apply', () => {
    const start = fresh('swordman');
    const str = start.str;
    raiseStat(start, 50, 'str', 'swordman');
    expect(start.str).toBe(str);
  });

  it('refuses a spend the pool cannot cover', () => {
    // Spend a level-20 budget into one attribute until the next step is
    // unaffordable. It stops one point SHORT rather than empty, because the
    // climb crosses into the 2-cost band and the last point cannot pay for a
    // 2-cost step. That leftover is the case worth pinning: the refusal has to
    // come from the price of the step, not from the pool being at zero.
    const a = raiseTo(fresh('swordman'), 20, 'swordman', 'str');
    const left = unspentStatusPoints(a, 20, 'swordman');
    expect(statValue(a, 'str')).toBeGreaterThan(50);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(statRaiseCost(statValue(a, 'str')));
    expect(raiseCost(a, 20, 'str', 'swordman')).toBeNull();
    expect(raiseStat(a, 20, 'str', 'swordman')).toBeNull();

    // A cheaper attribute is still buyable with that leftover, which is correct:
    // the pool is not stuck, only this attribute is.
    expect(raiseCost(a, 20, 'agi', 'swordman')).toBe(1);
    const spent = raiseStat(a, 20, 'agi', 'swordman') as StatAllocation;
    expect(unspentStatusPoints(spent, 20, 'swordman')).toBe(0);
    // At zero, every attribute is refused.
    for (const stat of ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const) {
      expect(raiseCost(spent, 20, stat, 'swordman'), stat).toBeNull();
      expect(raiseStat(spent, 20, stat, 'swordman'), stat).toBeNull();
    }
  });

  it('refuses to push an attribute past 99 even with points to spare', () => {
    const capped = { ...fresh('swordman'), str: MAX_STAT - BASE_STAT };
    expect(statValue(capped, 'str')).toBe(MAX_STAT);
    expect(raiseCost(capped, MAX_LEVEL, 'str', 'swordman')).toBeNull();
    expect(raiseStat(capped, MAX_LEVEL, 'str', 'swordman')).toBeNull();
    // …and the pool it could not spend is still there for another attribute.
    expect(unspentStatusPoints(capped, MAX_LEVEL, 'swordman')).toBeGreaterThan(0);
    expect(raiseCost(capped, MAX_LEVEL, 'agi', 'swordman')).not.toBeNull();
  });
});

describe('giving points back', () => {
  it('refunds exactly what the last point cost, so a raise is reversible', () => {
    // Reversibility is the property that matters: if the refund read the band at
    // the value BELOW the step, a player could launder points across a band
    // boundary by raising and lowering repeatedly.
    const start = fresh('mage');
    for (const level of [2, 60, MAX_LEVEL]) {
      const before = unspentStatusPoints(start, level, 'mage');
      const up = raiseStat(start, level, 'int', 'mage');
      expect(up, `level ${level}`).not.toBeNull();
      const down = lowerStat(up as StatAllocation, 'int', 'mage');
      expect(down).toEqual(start);
      expect(unspentStatusPoints(down as StatAllocation, level, 'mage')).toBe(before);
    }
  });

  it('reports the refund as the cost of the step being undone', () => {
    // A Mage opens with 12 Intelligence; raising to 13 costs 1, so lowering 13
    // gives 1 back. Crossing the band is the interesting case: the step onto 51
    // costs 2, and lowering off 51 must give 2 back, not 1.
    const start = fresh('mage');
    const up = raiseStat(start, 2, 'int', 'mage') as StatAllocation;
    expect(lowerRefund(up, 'int', 'mage')).toBe(1);

    const at51 = { ...start, int: 50 };
    expect(statValue(at51, 'int')).toBe(51);
    expect(lowerRefund(at51, 'int', 'mage')).toBe(2);
    expect(statRaiseCost(50)).toBe(2);

    const at99 = { ...start, int: MAX_STAT - BASE_STAT };
    expect(lowerRefund(at99, 'int', 'mage')).toBe(3);
  });

  it('stops at the class block, which was never the player s to move', () => {
    // The block is the class. Letting a Warrior lower its opening Strength would
    // let it launder those 27 points into Intelligence and arrive at a Mage.
    for (const cls of CLASSES) {
      const opening = fresh(cls);
      for (const stat of ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const) {
        expect(lowerStat(opening, stat, cls), `${cls} ${stat}`).toBeNull();
        expect(lowerRefund(opening, stat, cls), `${cls} ${stat}`).toBeNull();
      }
    }
  });

  it('cannot mint points by lowering below the block on another class s reading', () => {
    // A tampered client asking to lower a Warrior's Strength while claiming to be
    // a Mage: the floor is read from the class the SERVER holds, so the answer is
    // the same either way for the attribute the block actually filled.
    const warrior = fresh('swordman');
    expect(lowerStat(warrior, 'str', 'swordman')).toBeNull();
    // A Mage's Strength floor is 0, and a Warrior's block sits well above it, so
    // the mis-claimed class would ALLOW the lower. That is exactly why the class
    // is never taken from the wire.
    expect(lowerStat(warrior, 'str', 'mage')).not.toBeNull();
  });

  it('returns the earned budget on reset, and only the earned budget', () => {
    const spent = { ...fresh('swordman'), str: 40, vit: 20 };
    const reset = resetStatAllocation('swordman');
    expect(reset).toEqual(fresh('swordman'));
    expect(statusPointsSpent(reset)).toBe(CREATION_STATUS_POINTS);
    expect(unspentStatusPoints(reset, 50, 'swordman')).toBe(totalStatusPointsAt(50));
    expect(statusPointsSpent(spent)).toBeGreaterThan(statusPointsSpent(reset));
  });
});

describe('loading a stored allocation', () => {
  it('treats a missing allocation as a fresh character of its class', () => {
    // Not as six zeroes. A save written before the conversion has no allocation
    // at all, and loading it as a blank slate would hand the player a character
    // weaker than a brand new one.
    for (const cls of CLASSES) {
      expect(sanitizeStatAllocation(undefined, 20, cls), cls).toEqual(fresh(cls));
    }
  });

  it('clamps junk per attribute instead of throwing', () => {
    const cleaned = sanitizeStatAllocation(
      { str: -5, agi: 30, vit: Number.NaN, int: 'ten', dex: Number.POSITIVE_INFINITY },
      MAX_LEVEL,
      'swordman',
    );
    const opening = fresh('swordman');
    // Junk and out-of-range values fall back to the class floor, never below it.
    expect(cleaned.str).toBe(opening.str);
    expect(cleaned.vit).toBe(opening.vit);
    expect(cleaned.int).toBe(opening.int);
    expect(cleaned.dex).toBe(opening.dex);
    // A legal value is kept.
    expect(cleaned.agi).toBe(30);
  });

  it('repairs an allocation that claims LESS than its class opens with', () => {
    // The direction a naive clamp gets wrong. A save at zero Strength for a
    // Warrior is not a legal cheap build, it is a corrupt one.
    const stripped = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
    expect(sanitizeStatAllocation(stripped, 50, 'swordman')).toEqual(fresh('swordman'));
  });

  it('refuses an over-budget allocation WHOLESALE rather than trimming it', () => {
    // A level-1 character claiming a level-150 build. Trimming would leave the
    // tamperer whatever survived the trim; the honest answer is that the save is
    // not a legal one, so none of it stands.
    const cheat = { ...fresh('swordman'), str: 60, agi: 60, vit: 60 };
    expect(sanitizeStatAllocation(cheat, 1, 'swordman')).toEqual(fresh('swordman'));
    // The same allocation is fine once the level actually affords it.
    expect(statusPointsSpent(cheat)).toBeLessThanOrEqual(
      totalStatusPointsAt(MAX_LEVEL) + CREATION_STATUS_POINTS,
    );
    expect(sanitizeStatAllocation(cheat, MAX_LEVEL, 'swordman')).toEqual(cheat);
  });

  it('never reports a negative pool for an allocation it did let through', () => {
    for (const cls of CLASSES) {
      for (const level of [1, 20, 50, MAX_LEVEL]) {
        const loaded = sanitizeStatAllocation({ str: 99, agi: 99, vit: 99 }, level, cls);
        expect(
          unspentStatusPoints(loaded, level, cls),
          `${cls} at ${level}`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the acceptance case: capping two attributes at the level cap', () => {
  it('lets a Warrior cap Strength and Vitality with 100 points spare', () => {
    // Driven through the real spend path rather than by arithmetic, so it proves
    // the module agrees with the ladder rather than proving the ladder twice.
    let a = fresh('swordman');
    for (const stat of ['str', 'vit'] as const) {
      for (let i = 0; i < 200; i++) {
        const next = raiseStat(a, MAX_LEVEL, stat, 'swordman');
        if (!next) break;
        a = next;
      }
    }
    expect(statValue(a, 'str')).toBe(MAX_STAT);
    expect(statValue(a, 'vit')).toBe(MAX_STAT);
    expect(unspentStatusPoints(a, MAX_LEVEL, 'swordman')).toBe(100);
  });

  it('cannot reach a third 99, which is what makes a build a choice', () => {
    let a = fresh('swordman');
    for (const stat of ['str', 'vit', 'agi'] as const) {
      for (let i = 0; i < 200; i++) {
        const next = raiseStat(a, MAX_LEVEL, stat, 'swordman');
        if (!next) break;
        a = next;
      }
    }
    expect(statValue(a, 'agi')).toBeLessThan(MAX_STAT);
    expect(raiseCost(a, MAX_LEVEL, 'agi', 'swordman')).toBeNull();
    // One point survives, too small to buy a step in the 2-cost band the third
    // attribute has climbed into. Not zero, and pinning it as zero would be
    // pinning an arithmetic coincidence rather than the rule.
    const left = unspentStatusPoints(a, MAX_LEVEL, 'swordman');
    expect(left).toBeLessThan(statRaiseCost(statValue(a, 'agi')));
  });
});
