// How much of an incoming hit survives the defender's armour.
//
// The reference (docs/design/spiritvale-engine-formulas.md, Formula$$DamageReduction)
// is one hyperbola:
//
//   damageTaken = 100 / (DEF + 100)
//
// and that shape is the whole reason this module exists. The model it replaces
// treated hard defence as a straight percentage capped at 100 and then
// subtracted soft defence as a flat amount, which makes 100 defence a CLIFF: a
// character who reaches it takes nothing at all. This game drove off that cliff
// in July 2026, when Fiesta augments granting 250 to 600 armour on a scale whose
// ceiling was 100 made an augmented player physically immune (fixed in f134970
// by rescaling the augments, which treated the symptom).
//
// A hyperbola cannot produce immunity at any finite defence, so the class of bug
// disappears rather than being tuned around. 100 defence halves the hit, 300
// quarters it, 900 leaves a tenth, and nothing ever reaches zero.
//
// Pure leaf: no Entity, no SimContext, no rng. Callers resolve the numbers.

/** The engine constant. Defence equal to this value halves the incoming hit. */
export const DEFENCE_HALF_POINT = 100;

/**
 * The fraction of an incoming hit that gets through `defence`.
 *
 * Always in (0, 1]: 1 at zero defence, approaching but never reaching 0.
 * Negative defence is clamped to zero rather than amplifying the hit, because
 * the reference has no negative-defence arm and a debuff that inverted the
 * curve would be a different mechanic, not this one.
 */
export function damageTakenFraction(defence: number): number {
  const def = Math.max(0, defence);
  return DEFENCE_HALF_POINT / (def + DEFENCE_HALF_POINT);
}

/**
 * The share of an incoming hit that `defence` removes: the complement of
 * `damageTakenFraction`, in [0, 1).
 *
 * This is the number to show a player. It is the one the reference's own
 * character sheet displays as "Damage Reduction".
 */
export function damageReductionFraction(defence: number): number {
  return 1 - damageTakenFraction(defence);
}

/** Apply `defence` to a raw hit. Never returns a negative number. */
export function applyDefence(rawDamage: number, defence: number): number {
  return Math.max(0, rawDamage) * damageTakenFraction(defence);
}

/**
 * The defence needed to remove `fraction` of an incoming hit, inverting the
 * curve. Useful for authoring a target ("what defence is a 75% reduction?") and
 * for asserting the curve in tests.
 *
 * Returns Infinity at fraction >= 1, which is the honest answer: no finite
 * defence reaches immunity.
 */
export function defenceForReduction(fraction: number): number {
  if (fraction >= 1) return Number.POSITIVE_INFINITY;
  const f = Math.max(0, fraction);
  return (DEFENCE_HALF_POINT * f) / (1 - f);
}
