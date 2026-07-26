// The suggested status-point spread.
//
// This is the allocation a character gets when nobody is around to choose one: a
// dev level jump, a test fixture, the "recommended" button. Two properties carry
// everything: it must SPEND the budget (a preset that leaves points on the table
// hands back the unplayable character it exists to prevent), and it must never
// EXCEED it (an over-budget preset is a save the sanitizer would reject wholesale,
// which would silently zero the character instead).

import { describe, expect, it } from 'vitest';
import { defaultAllocationFor, statWeightsFor } from '../src/sim/stat_preset';
import { statValue, unspentStatusPoints } from '../src/sim/status_points';
import {
  ALL_CLASSES,
  BASE_STAT,
  MAX_LEVEL,
  MAX_STAT,
  STATUS_STATS,
  statRaiseCost,
  statusPointsSpent,
  totalStatusPointsAt,
} from '../src/sim/types';

const LEVELS = [1, 10, 20, 50, MAX_LEVEL];

describe('the suggested spread', () => {
  for (const cls of ALL_CLASSES) {
    it(`${cls}: spends the budget without ever exceeding it`, () => {
      for (const level of LEVELS) {
        const alloc = defaultAllocationFor(cls, level);
        const budget = totalStatusPointsAt(level);
        const left = unspentStatusPoints(alloc, level);
        expect(statusPointsSpent(alloc), `${cls} L${level}`).toBeLessThanOrEqual(budget);
        expect(left, `${cls} L${level}`).toBeGreaterThanOrEqual(0);
        // What is left over must be smaller than the cheapest thing it could have
        // bought. Anything more means the spender stopped early with money in hand.
        // Only the attributes this class is WILLING to buy count: a Mage declining
        // to put its last 2 points into Strength is the preset working.
        const weights = statWeightsFor(cls);
        const cheapest = Math.min(
          ...STATUS_STATS.filter((s) => weights[s] > 0 && statValue(alloc, s) < MAX_STAT).map((s) =>
            statRaiseCost(statValue(alloc, s)),
          ),
        );
        expect(left, `${cls} L${level} left ${left}, cheapest step ${cheapest}`).toBeLessThan(
          cheapest,
        );
      }
    });

    it(`${cls}: buys nothing in the attributes its weights zero out`, () => {
      // A Mage spending points on Strength is the failure this catches: a zero
      // weight has to mean never, not merely last.
      const weights = statWeightsFor(cls);
      const alloc = defaultAllocationFor(cls, MAX_LEVEL);
      for (const stat of STATUS_STATS) {
        if (weights[stat] > 0) continue;
        expect(statValue(alloc, stat), `${cls} ${stat}`).toBe(BASE_STAT);
      }
    });

    it(`${cls}: ranks its attributes in weight order`, () => {
      // The spread has to actually track the weights, not merely stay in budget: a
      // heavier-weighted attribute never ends below a lighter one.
      const weights = statWeightsFor(cls);
      const alloc = defaultAllocationFor(cls, MAX_LEVEL);
      for (const a of STATUS_STATS) {
        for (const b of STATUS_STATS) {
          if (weights[a] <= weights[b]) continue;
          expect(
            statValue(alloc, a),
            `${cls}: ${a} (w${weights[a]}) vs ${b} (w${weights[b]})`,
          ).toBeGreaterThanOrEqual(statValue(alloc, b));
        }
      }
    });
  }

  it('is deterministic: the same class and level always give the same spread', () => {
    for (const cls of ALL_CLASSES) {
      for (const level of LEVELS) {
        expect(defaultAllocationFor(cls, level)).toEqual(defaultAllocationFor(cls, level));
      }
    }
  });

  it('grows monotonically with level, so a ding never takes a point away', () => {
    for (const cls of ALL_CLASSES) {
      let prev = defaultAllocationFor(cls, 1);
      for (let level = 2; level <= MAX_LEVEL; level++) {
        const next = defaultAllocationFor(cls, level);
        for (const stat of STATUS_STATS) {
          expect(statValue(next, stat), `${cls} L${level} ${stat}`).toBeGreaterThanOrEqual(
            statValue(prev, stat),
          );
        }
        prev = next;
      }
    }
  });

  it('gives two different classes genuinely different characters', () => {
    // The whole reason the per-class stat blocks are gone. If every preset landed
    // in the same place, manual allocation would have bought nothing.
    const warrior = defaultAllocationFor('warrior', MAX_LEVEL);
    const mage = defaultAllocationFor('mage', MAX_LEVEL);
    expect(statValue(warrior, 'str')).toBeGreaterThan(statValue(mage, 'str'));
    expect(statValue(mage, 'int')).toBeGreaterThan(statValue(warrior, 'int'));
  });
});
