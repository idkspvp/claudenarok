// Status points: the budget rules the whole allocation system rests on.
//
// The pure module is the only thing that decides what a spend costs and whether a
// saved allocation is legal, and both the offline Sim and the server call it, so a
// rule that is wrong here is wrong in both places at once. These cases pin the
// arithmetic against literals rather than against the functions that produce it.

import { describe, expect, it } from 'vitest';
import {
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
  emptyStatAllocation,
  MAX_LEVEL,
  MAX_STAT,
  type StatAllocation,
  statRaiseCost,
  statusPointsForLevel,
  statusPointsSpent,
  totalStatusPointsAt,
} from '../src/sim/types';

const alloc = (over: Partial<StatAllocation> = {}): StatAllocation => ({
  ...emptyStatAllocation(),
  ...over,
});

describe('the cost curve', () => {
  it('steps up every ten points, starting at 2', () => {
    // Pinned to literals: this curve is the reason a 99 in one attribute is a
    // commitment rather than something a character drifts into.
    expect(statRaiseCost(1)).toBe(2);
    expect(statRaiseCost(9)).toBe(2);
    expect(statRaiseCost(10)).toBe(3);
    expect(statRaiseCost(19)).toBe(3);
    expect(statRaiseCost(20)).toBe(4);
    expect(statRaiseCost(90)).toBe(11);
    expect(statRaiseCost(98)).toBe(11);
  });

  it('makes the last ten points of a 99 cost more than the first fifty', () => {
    let firstFifty = 0;
    for (let v = 1; v < 51; v++) firstFifty += statRaiseCost(v);
    let lastTen = 0;
    for (let v = 89; v < 99; v++) lastTen += statRaiseCost(v);
    expect(lastTen).toBeGreaterThan(0);
    expect(firstFifty).toBeGreaterThan(lastTen);
    // …but a point up there is worth five down here, which is the shape that
    // makes a specialised build beat a spread one.
    expect(statRaiseCost(98) / statRaiseCost(1)).toBe(5.5);
  });
});

describe('the budget', () => {
  it('grants the creation points and then floor(level/5)+3 a level', () => {
    expect(totalStatusPointsAt(1)).toBe(CREATION_STATUS_POINTS);
    expect(statusPointsForLevel(2)).toBe(3);
    expect(statusPointsForLevel(5)).toBe(4);
    expect(statusPointsForLevel(50)).toBe(13);
    expect(statusPointsForLevel(99)).toBe(22);
    expect(totalStatusPointsAt(2)).toBe(CREATION_STATUS_POINTS + 3);
  });

  it('grows strictly with level all the way to the cap', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(totalStatusPointsAt(l), `level ${l}`).toBeGreaterThan(totalStatusPointsAt(l - 1));
    }
  });

  it('cannot afford a 99 in everything, or anything close to it', () => {
    // The budget has to be the binding constraint, not the per-stat cap: if a
    // capped character could max all six there would be no build to speak of.
    let costOfOne99 = 0;
    for (let v = BASE_STAT; v < MAX_STAT; v++) costOfOne99 += statRaiseCost(v);
    const budget = totalStatusPointsAt(MAX_LEVEL);
    expect(budget).toBeGreaterThan(costOfOne99);
    expect(budget).toBeLessThan(costOfOne99 * 6);
  });
});

describe('spending', () => {
  it('charges the step price and draws the pool down by it', () => {
    const fresh = emptyStatAllocation();
    const before = unspentStatusPoints(fresh, 1);
    expect(before).toBe(CREATION_STATUS_POINTS);
    expect(raiseCost(fresh, 1, 'str')).toBe(2);

    const next = raiseStat(fresh, 1, 'str');
    expect(next).not.toBeNull();
    expect(statValue(next as StatAllocation, 'str')).toBe(BASE_STAT + 1);
    expect(unspentStatusPoints(next as StatAllocation, 1)).toBe(before - 2);
  });

  it('leaves the source allocation untouched, so a refused spend cannot half-apply', () => {
    const fresh = emptyStatAllocation();
    raiseStat(fresh, 1, 'str');
    expect(fresh.str).toBe(0);
  });

  it('refuses a spend the pool cannot cover', () => {
    // Spend the level-1 budget into one attribute until the next step is
    // unaffordable, then prove nothing else can be bought either.
    let a = emptyStatAllocation();
    for (let i = 0; i < 100; i++) {
      const next = raiseStat(a, 1, 'str');
      if (!next) break;
      a = next as StatAllocation;
    }
    expect(unspentStatusPoints(a, 1)).toBeLessThan(2);
    expect(statValue(a, 'str')).toBeGreaterThan(BASE_STAT);
    expect(raiseCost(a, 1, 'agi')).toBeNull();
    expect(raiseStat(a, 1, 'agi')).toBeNull();
  });

  it('refuses to push an attribute past 99 even with points to spare', () => {
    const capped = alloc({ str: MAX_STAT - BASE_STAT });
    expect(statValue(capped, 'str')).toBe(MAX_STAT);
    expect(raiseCost(capped, MAX_LEVEL, 'str')).toBeNull();
    expect(raiseStat(capped, MAX_LEVEL, 'str')).toBeNull();
  });

  it('returns the whole budget on reset', () => {
    const spent = alloc({ str: 10, vit: 5 });
    const reset = resetStatAllocation();
    expect(statusPointsSpent(reset)).toBe(0);
    expect(unspentStatusPoints(reset, 20)).toBe(totalStatusPointsAt(20));
    expect(statusPointsSpent(spent)).toBeGreaterThan(0);
  });
});

describe('loading a stored allocation', () => {
  it('treats a missing allocation as unspent', () => {
    expect(sanitizeStatAllocation(undefined, 20)).toEqual(emptyStatAllocation());
  });

  it('clamps junk per attribute instead of throwing', () => {
    const cleaned = sanitizeStatAllocation(
      { str: -5, agi: 3.7, vit: Number.NaN, int: 'ten', dex: Number.POSITIVE_INFINITY },
      MAX_LEVEL,
    );
    expect(cleaned.str).toBe(0);
    expect(cleaned.agi).toBe(3);
    expect(cleaned.vit).toBe(0);
    expect(cleaned.int).toBe(0);
    expect(cleaned.dex).toBe(0);
  });

  it('refuses an over-budget allocation WHOLESALE rather than trimming it', () => {
    // A level-1 character claiming a level-99 build. Trimming would leave the
    // tamperer whatever survived the trim; the honest answer is that the save is
    // not a legal one, so none of it stands.
    const cheat = alloc({ str: 60, agi: 60, vit: 60 });
    expect(sanitizeStatAllocation(cheat, 1)).toEqual(emptyStatAllocation());
    // The same allocation is fine once the level actually affords it.
    expect(statusPointsSpent(cheat)).toBeLessThanOrEqual(totalStatusPointsAt(MAX_LEVEL));
    expect(sanitizeStatAllocation(cheat, MAX_LEVEL)).toEqual(cheat);
  });

  it('never reports a negative pool for an allocation it did let through', () => {
    for (const level of [1, 20, 50, MAX_LEVEL]) {
      const loaded = sanitizeStatAllocation({ str: 99, agi: 99, vit: 99 }, level);
      expect(unspentStatusPoints(loaded, level), `level ${level}`).toBeGreaterThanOrEqual(0);
    }
  });
});
