// The attribute-point economy: what a level grants, what a point costs, and
// where a character starts.
//
// From docs/design/spiritvale-engine-formulas.md (Progression), which took it
// from a second community wiki rather than from the binary, so it sits one notch
// below the combat formulas in confidence. It self-checks in one place, though,
// and that check is worth stating: the wiki says 27 points are pre-spent at
// creation, and the archetype table independently sums to 33 across six
// attributes that all start at 1. 33 minus 6 is 27. Two sources that did not
// derive from each other agreeing on a number.
//
//   level 1            27 points pre-spent by class, NOT reallocatable
//   levels 2 to 100    3 per level    297
//   levels 101 to 130  2 per level     60
//   levels 131 to 150  1 per level     20
//                                     ---
//   earned by the cap                 377
//
//   value 1 to 50      1 point per step
//   value 51 to 98     2 points per step
//   value 99           3 points
//   maximum allocation 99; past that only gear
//
// THE SOURCE'S OWN TOTAL IS 404, and that is 377 + 27: it labels the figure
// "earned through leveling" while including the pre-spent block. The three bands
// it lists sum to 377, so the bands are what this file implements and 404 is the
// lifetime figure including creation.
//
// Compared with the model this replaces, which charged `2 + (value-1)/10` and
// reached 11 points per point near 99: the same escalating-cost idea with a far
// gentler slope, never charging more than 3.
//
// Pure leaf: numbers in, numbers out, no Entity and no rng.

/** Every attribute starts here, before the class block is spent on top. */
export const BASE_ATTRIBUTE = 1;
/** Points can raise an attribute no higher than this; gear goes past it. */
export const MAX_ATTRIBUTE = 99;
/** Pre-spent into the class block at creation. Not reallocatable. */
export const CREATION_ALLOCATED_POINTS = 27;

/** The three grant bands, as [lastLevelOfBand, pointsPerLevel]. */
export const GRANT_BANDS: readonly (readonly [number, number])[] = [
  [100, 3],
  [130, 2],
  [150, 1],
];

/** The three cost bands, as [lastValueOfBand, pointsPerStep]. */
export const COST_BANDS: readonly (readonly [number, number])[] = [
  [50, 1],
  [98, 2],
  [99, 3],
];

/**
 * Points granted for REACHING `level`. Level 1 grants none through this
 * function: its 27 arrive pre-spent in the class block instead.
 *
 * Reaching, not leaving. The distinction decides whether the top band covers
 * levels 131 to 150 or 130 to 149, which is one point of lifetime budget.
 */
export function attributePointsForLevel(level: number): number {
  if (level <= 1) return 0;
  for (const [last, points] of GRANT_BANDS) if (level <= last) return points;
  return 0;
}

/** Points EARNED by levelling to `level`. 377 at the cap; creation is separate. */
export function earnedAttributePointsAt(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += attributePointsForLevel(l);
  return total;
}

/**
 * What raising an attribute FROM `current` by one costs.
 *
 * The band is read off the value being moved INTO, so the last step of a band is
 * charged at that band's rate: 50 to 51 costs 1 (it leaves the 1-cost band), and
 * 98 to 99 costs 3.
 */
export function attributeRaiseCost(current: number): number {
  const target = Math.max(BASE_ATTRIBUTE, Math.floor(current)) + 1;
  for (const [last, cost] of COST_BANDS) if (target <= last) return cost;
  return Number.POSITIVE_INFINITY;
}

/** What it costs to take one attribute from `from` to `to`. Infinity past the cap. */
export function costToRaise(from: number, to: number): number {
  if (to > MAX_ATTRIBUTE) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let v = Math.max(BASE_ATTRIBUTE, Math.floor(from)); v < to; v++) {
    total += attributeRaiseCost(v);
  }
  return total;
}

/** What it costs to take an attribute from the base all the way to the cap. */
export function costToCapFromBase(): number {
  return costToRaise(BASE_ATTRIBUTE, MAX_ATTRIBUTE);
}
