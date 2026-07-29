// How a skill's numbers grow with its skill level.
//
// Almost every value in SpiritVale's data is a `{base, per}` pair, and the
// single most load-bearing fact about the whole data set is how those two
// combine:
//
//     value(L) = base + per * L
//
// NOT `base + per * (L - 1)`. The distinction is not cosmetic and it is not a
// guess. Four independent checks settle it:
//
//   1. 105 of the 279 published active skills carry `dmg = {base: 0, per: > 0}`.
//      Under the (L-1) reading every one of them deals exactly ZERO damage at
//      skill level 1, which no damage skill does.
//   2. Nothing goes negative at max level under this reading. Cooldowns with a
//      negative `per` (Aegis {80, -10} at maxLv 5) land on 30, not below zero.
//   3. The two independently exported raw files agree: `spiritvale-all-classes`
//      publishes Bash as `damage {base: 100, level: 60}` and `skills-combat`
//      publishes it as `dmg {base: 1, per: 0.6}`. Same numbers, one as a percent
//      and one as a multiplier, across 150 cross-checked records with zero
//      disagreements.
//   4. Skill level 0 means NOT LEARNED, and `base + per * 0` is exactly `base`,
//      which is the unlearned value. The formula degrades correctly at zero.
//
// `docs/design/spiritvale-data-schema.md` asserted the opposite ("base is the
// level-1 value") and was corrected when this module landed; if the two ever
// disagree again, the checks above are the tiebreak.
//
// A pure leaf: numbers in, numbers out. No Entity, no rng, no SimContext.

/** The shape nearly every published number takes. */
export interface Scaled {
  base: number;
  per: number;
}

/** Skill level 0 is the unlearned state, and reads as `base`. */
export const UNLEARNED_SKILL_LEVEL = 0;

/**
 * The value of a `{base, per}` pair at skill level `level`.
 *
 * Negative levels clamp to 0 rather than running the formula backwards: a
 * corrupt saved level must read as unlearned, not as a bonus.
 */
export function valueAt(pair: Scaled, level: number): number {
  const lv = Math.max(UNLEARNED_SKILL_LEVEL, Math.floor(level));
  return pair.base + pair.per * lv;
}

/** A pair that never varies: `per` is zero, so every level reads the same. */
export function isFlat(pair: Scaled): boolean {
  return pair.per === 0;
}

/** A pair that contributes nothing at any level. Generated content omits these
 *  rather than emitting a field of zeroes. */
export function isEmpty(pair: Scaled): boolean {
  return pair.base === 0 && pair.per === 0;
}

/**
 * The value clamped to be non-negative.
 *
 * For the fields where a negative result would be nonsense (a cooldown, a cost,
 * a duration). Deliberately NOT applied to damage: SpiritVale encodes HEALING as
 * negative damage (Heal is `{-0.25, -0.25}`), so clamping damage at zero would
 * silently delete every heal in the game.
 */
export function nonNegativeAt(pair: Scaled, level: number): number {
  return Math.max(0, valueAt(pair, level));
}
