// The tail of a physical hit: everything that happens AFTER the attack power is
// assembled, in the order the reference does it.
//
// Order is the whole point of this module. Read from `battle.cpp`, pre-renewal
// arm, in `battle_calc_weapon_attack`:
//
//   defence reduction      stats/defence_curve.ts, 100/(DEF + 100)
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
//   2. Post-defence damage can no longer go negative. The two-layer model this
//      replaced subtracted a flat soft-defence amount after the percentage, so
//      a heavily armoured target pushed the running total below zero and the
//      refine bonus earned its keep by digging back out. SpiritVale's curve is
//      a single multiplier on a non-negative number, so the refine bonus is now
//      an ordinary addition. The floor stays because a multiplied-down hit can
//      still round to nothing.
//   3. The floor of 1 sits between refine and the attribute chart, so it does
//      NOT stop the chart from turning a hit into a heal. A caller that clamps
//      the final number at zero erases absorption, which is a build-defining
//      interaction, not an edge case.
//
// A pure leaf: resolved numbers in, one number out, no world and no rng.
// Defence used to need a roll (its flat layer had a random span); the curve that
// replaced it is deterministic, so the draw is gone from the caller too.

/** A landed hit takes at least this much off, applied between refine and the
 *  attribute chart. */
export const MIN_DAMAGE_AFTER_REFINE = 1;

export interface PhysicalTail {
  /** Damage after attack power, size and any skill ratio, before defence. */
  damage: number;
  /** What defence leaves, as a fraction, from stats/defence_curve.ts:
   *  100/(DEF + 100). One layer, not two: SpiritVale's defence has no flat
   *  subtraction and no Vitality term. */
  defenceMultiplier: number;
  /** Flat attack power from the weapon's refine. Added AFTER defence. */
  refineFlat?: number;
  /** The attribute chart, as a fraction. May be negative: the hit heals. */
  elementMultiplier?: number;
  /** Everything the attacker's cards add against this defender, as a fraction. */
  cardMultiplier?: number;
  /** A skill or effect that bypasses defence entirely. */
  ignoreDefence?: boolean;
}

/** The final damage of a physical hit. NEGATIVE means the attribute chart turned
 *  it into a heal; the caller decides what to do with that rather than having it
 *  silently clamped here. */
export function resolvePhysicalTail(tail: PhysicalTail): number {
  const afterDefence = tail.ignoreDefence ? tail.damage : tail.damage * tail.defenceMultiplier;
  // Refine lands before the floor so a hit the curve reduced to a fraction can
  // still be brought back over 1 by the weapon.
  const afterRefine = Math.max(MIN_DAMAGE_AFTER_REFINE, afterDefence + (tail.refineFlat ?? 0));
  const afterElement = afterRefine * (tail.elementMultiplier ?? 1);
  return afterElement * (tail.cardMultiplier ?? 1);
}
