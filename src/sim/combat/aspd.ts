// Ragnarok's attack speed: a base delay chosen by JOB and WEAPON, cut by a
// percentage that Agility and Dexterity buy.
//
// Verified against the `#else` (pre-renewal) arm of `status_base_amotion_pc` in
// rAthena's status.cpp, its clamp in `status_calc_pc_`, and the auto-attack
// timer in unit.cpp rather than reconstructed. The renewal arm a few lines above
// is a completely different calculation built around an `aspd_base` READ as a
// display value, and it is what a search returns.
//
// Three things about it are worth stating plainly, because none of them survives
// being remembered rather than read:
//
//   1. **The base is per JOB and per WEAPON TYPE, not per weapon record.** An
//      Archer and an Acolyte holding the same mace swing at different speeds.
//      Attack speed is a property of who is holding the thing, which is why this
//      game's authored per-weapon `speed` cannot express it and has to go.
//   2. **Agility is worth exactly four Dexterity**, from the literal
//      `(4 * agi + dex) / 1000`. There is no second term and no curve; the
//      reduction is linear and shared between the two stats at 4 to 1.
//   3. **The swing interval is `adelay`, which is TWICE `amotion`.** amotion is
//      the animation and gates movement; the auto-attack timer is scheduled at
//      `attackabletime = tick + adelay` (unit.cpp `unit_set_attackdelay`). Using
//      amotion as the interval would make every character attack twice as fast
//      as Ragnarok does.
//
// The reduction is a PERCENTAGE of the base, so a slow weapon gains more real
// time per point of Agility than a fast one, while the RATIO is identical. That
// is what keeps a two-handed sword slow relative to a dagger no matter how much
// Agility is stacked, instead of every build converging on the same cadence.
//
// The per-job, per-weapon base table is deliberately NOT here. It is ours to
// author, not Gravity's to copy (`docs/design/ro-reference-source.md`), and it
// cannot be written until `PlayerClass` is the five first jobs, so this module
// takes the base as an argument and the table lands with that migration.

import { DT } from '../types';

/** The fastest a character may ever swing, in milliseconds of attack motion.
 *
 *  Derived, not picked: rAthena clamps amotion to `pc_maxaspd(sd) /
 *  AMOTION_DIVIDER_PC`, and `battle_adjust_conf` converts the `max_aspd` config
 *  default of 190 into `(2000 - 190 x 10) x 2 = 200`, which halves to 100. In
 *  display terms that is ASPD 190, the familiar pre-renewal ceiling. */
export const MIN_AMOTION_MS = 100;

/** The slowest, from `MIN_ASPD / AMOTION_DIVIDER_PC` = `8000 / 2`. Reachable
 *  only by a base slower than any real weapon, so in practice it is a guard
 *  against a bad authored value rather than a cadence anyone plays at. */
export const MAX_AMOTION_MS = 4000;

/** The swing interval is twice the attack motion (`AMOTION_DIVIDER_PC`). */
export const ADELAY_PER_AMOTION = 2;

/** Agility's weight in the delay reduction. Four times Dexterity's, which is the
 *  single number that makes Agility the attack-speed stat and Dexterity a
 *  secondary one that happens to also help. */
export const AGI_ASPD_WEIGHT = 4;
export const DEX_ASPD_WEIGHT = 1;

/** The reduction is `(4 x AGI + DEX) / 1000`, so the two stats together can
 *  remove at most a fixed fraction of the base. At the 99 cap on both that is
 *  `(396 + 99) / 1000`, a 49.5% cut: Ragnarok never lets stats alone more than
 *  halve a swing, and everything past that has to come from skills or gear. */
export const ASPD_STAT_DIVISOR = 1000;

/** Dual wielding takes seven tenths of the two bases ADDED, not the average, so
 *  two one-handers are slower than either alone and faster than the two in
 *  sequence. */
export const DUAL_WIELD_NUMERATOR = 7;
export const DUAL_WIELD_DIVISOR = 10;

/** The combined base delay of two wielded weapons. */
export function dualWieldBaseAmotion(first: number, second: number): number {
  const sum = Math.max(0, first) + Math.max(0, second);
  return Math.floor((sum * DUAL_WIELD_NUMERATOR) / DUAL_WIELD_DIVISOR);
}

export interface AspdInput {
  /** The job's base attack motion for the weapon being held, in milliseconds.
   *  Use `dualWieldBaseAmotion` first when two weapons are equipped. */
  baseAmotion: number;
  agi: number;
  dex: number;
  /** A flat millisecond adjustment from gear or skills (rAthena's
   *  `bonus.aspd_add`). NEGATIVE is faster. Applied before the clamp, so a
   *  bonus can never push a character past the ceiling. */
  flatBonus?: number;
}

/** The fraction of the base delay that Agility and Dexterity remove, 0..1.
 *
 *  Exposed on its own because it is the number a character sheet wants to show
 *  and the one a balance question is usually really about. */
export function aspdStatReduction(agi: number, dex: number): number {
  const weighted =
    AGI_ASPD_WEIGHT * Math.max(0, Math.floor(agi)) + DEX_ASPD_WEIGHT * Math.max(0, Math.floor(dex));
  return Math.min(1, weighted / ASPD_STAT_DIVISOR);
}

/** Attack motion in milliseconds, clamped to the reachable band.
 *
 *  Integer arithmetic at every step, matching the C: the product is taken before
 *  the division by 1000 and the quotient truncates, so the result is a whole
 *  millisecond rather than a rounded float. Doing it as `base * (1 - fraction)`
 *  drifts by up to a millisecond, which compounds over a long fight. */
export function amotionFrom(input: AspdInput): number {
  const base = Math.max(0, Math.floor(input.baseAmotion));
  const weighted =
    AGI_ASPD_WEIGHT * Math.max(0, Math.floor(input.agi)) +
    DEX_ASPD_WEIGHT * Math.max(0, Math.floor(input.dex));
  const reduced =
    base - Math.floor((base * Math.min(ASPD_STAT_DIVISOR, weighted)) / ASPD_STAT_DIVISOR);
  const adjusted = reduced + Math.floor(input.flatBonus ?? 0);
  return Math.min(MAX_AMOTION_MS, Math.max(MIN_AMOTION_MS, adjusted));
}

/** The interval between auto-attacks, in milliseconds. This is `adelay`, the
 *  value the attack timer is actually scheduled at, NOT `amotion`. */
export function attackIntervalMs(input: AspdInput): number {
  return ADELAY_PER_AMOTION * amotionFrom(input);
}

/** The same interval in seconds, which is the unit this game's `WeaponInfo.speed`
 *  and every swing timer already use. */
export function attackIntervalSeconds(input: AspdInput): number {
  return attackIntervalMs(input) / 1000;
}

/** The interval rounded to whole sim ticks, which is the resolution a swing can
 *  actually land on at 20 Hz.
 *
 *  Worth having explicitly: the fastest legal interval is 200ms, exactly four
 *  ticks, so the tick rate is not the binding constraint anywhere in the band
 *  and no reachable Agility build is quantised into a slower cadence than it
 *  paid for. Floored at one tick so a swing can never be free. */
export function attackIntervalTicks(input: AspdInput): number {
  return Math.max(1, Math.round(attackIntervalSeconds(input) / DT));
}
