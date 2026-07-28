// The tail of a physical hit: everything that happens AFTER the attack power is
// assembled, in the order the reference does it.
//
// Order is the whole point of this module. Read from `battle.cpp`, pre-renewal
// arm, in `battle_calc_weapon_attack`:
//
//   defence reduction      battle_calc_defense_reduction   :5625
//   refine, then floor 1   battle_calc_attack_post_defense :5627 (body at :4901)
//   the attribute chart    battle_calc_element_damage      :5643
//   cards                  battle_calc_cardfix             :5741
//
// Three consequences that are easy to get backwards, and that this file exists
// to keep straight:
//
//   1. The attribute chart runs AFTER defence, not before. A fire weapon against
//      a water monster is not "weaker damage that then meets armour"; it is the
//      armoured result, halved.
//   2. Post-defence damage is allowed to go NEGATIVE, and the refine bonus is
//      added against that negative value before the floor. Digging out of a
//      negative is the entire reason over-refining a weapon is worth anything
//      against a high-defence target.
//   3. The floor of 1 sits between refine and the attribute chart, so it does
//      NOT stop the chart from turning a hit into a heal. A caller that clamps
//      the final number at zero erases absorption, which is a build-defining
//      interaction, not an edge case.
//
// A pure leaf: resolved numbers in, one number out, no world and no rng (the
// defence roll is drawn by the caller and passed in).

/** A landed hit takes at least this much off, applied between refine and the
 *  attribute chart. */
export const MIN_DAMAGE_AFTER_REFINE = 1;

export interface PhysicalTail {
  /** Damage after attack power, size and any skill ratio, before defence. */
  damage: number;
  /** What defence leaves, as a fraction: the hard-defence percentage. */
  hardDefMultiplier: number;
  /** The flat amount soft defence subtracts, after the percentage. */
  softDef: number;
  /** Flat attack power from the weapon's refine. Added AFTER defence, against a
   *  possibly negative value. */
  refineFlat?: number;
  /** The attribute chart, as a fraction. May be negative: the hit heals. */
  elementMultiplier?: number;
  /** Everything the attacker's cards add against this defender, as a fraction. */
  cardMultiplier?: number;
  /** A critical ignores BOTH defence layers outright pre-renewal. */
  ignoreDefence?: boolean;
}

/** The final damage of a physical hit. NEGATIVE means the attribute chart turned
 *  it into a heal; the caller decides what to do with that rather than having it
 *  silently clamped here. */
export function resolvePhysicalTail(tail: PhysicalTail): number {
  const afterDefence = tail.ignoreDefence
    ? tail.damage
    : tail.damage * tail.hardDefMultiplier - tail.softDef;
  // Deliberately not floored yet: the refine bonus gets to work against a
  // negative, which is the only thing that makes it matter to a heavily
  // armoured target.
  const afterRefine = Math.max(MIN_DAMAGE_AFTER_REFINE, afterDefence + (tail.refineFlat ?? 0));
  const afterElement = afterRefine * (tail.elementMultiplier ?? 1);
  return afterElement * (tail.cardMultiplier ?? 1);
}
