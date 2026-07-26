// Refine: the +0 to +10 upgrade ladder, and the attack power it buys.
//
// A pure leaf. Refine is a property of the item COPY, not the item definition:
// two of the same sword refined differently are different items to their owners,
// which is why it belongs on `ItemInstancePayload` beside `rolled` and `boundTo`
// rather than on `ItemDef`.
//
// What makes the ladder interesting, and what this module encodes:
//   - How much a refine is worth depends on the WEAPON LEVEL, not the item level.
//     A level-1 weapon gains little per refine; a level-4 weapon gains a lot.
//   - Each weapon level has a SAFE limit. Below it a refine cannot fail. Above
//     it, it can, and the risk is the point.
//   - Refines past the safe limit pay a bonus on top of the flat rate, so the
//     dangerous end of the ladder is where the power is.
//
// This module owns the VALUE of a refine and the shape of the ladder. It does
// not own the attempt: whether a refine succeeds is an rng draw, and that
// belongs to a system module with a SimContext, never to a leaf.
//
// SOURCING: a reimplementation of a published mechanic, authored from the
// documented relationships. Nothing copied from a GPL server's db/.

import type { WeaponLevel } from '../types';

export const MAX_REFINE = 10;

/** Attack power a single refine step adds, by weapon level. A heavier weapon
 *  class gains more from the same +1, which is what makes a low-level weapon a
 *  poor thing to pour materials into. */
const ATK_PER_REFINE: Readonly<Record<WeaponLevel, number>> = { 1: 2, 2: 3, 3: 5, 4: 7 };

/** The highest refine that cannot fail, by weapon level. Past this the attempt
 *  is a gamble, and the ladder above it is where the bonus lives. */
const SAFE_LIMIT: Readonly<Record<WeaponLevel, number>> = { 1: 7, 2: 6, 3: 5, 4: 4 };

/** Extra attack power per refine BEYOND the safe limit, by weapon level: the
 *  reward for taking the risk, on top of the flat rate. */
const OVER_REFINE_BONUS: Readonly<Record<WeaponLevel, number>> = { 1: 3, 2: 5, 3: 8, 4: 14 };

const clampRefine = (refine: number): number =>
  Math.max(0, Math.min(MAX_REFINE, Math.floor(refine)));

const level = (weaponLevel: WeaponLevel | undefined): WeaponLevel =>
  weaponLevel && weaponLevel >= 1 && weaponLevel <= 4 ? weaponLevel : 1;

/** The refine that cannot fail for this weapon level. */
export function safeRefineLimit(weaponLevel: WeaponLevel | undefined): number {
  return SAFE_LIMIT[level(weaponLevel)];
}

/** Would this attempt (going from `refine` to `refine + 1`) be a gamble? */
export function refineIsRisky(weaponLevel: WeaponLevel | undefined, refine: number): boolean {
  const at = clampRefine(refine);
  return at >= safeRefineLimit(weaponLevel) && at < MAX_REFINE;
}

/** Total attack power this refine level is worth on a weapon of this class.
 *
 *  Flat rate for every step, plus the over-refine bonus for each step past the
 *  safe limit. Monotonic in refine and in weapon level, so a higher-class weapon
 *  at the same refine is never worth less. */
export function refineAttackBonus(weaponLevel: WeaponLevel | undefined, refine: number): number {
  const lv = level(weaponLevel);
  const at = clampRefine(refine);
  const safe = SAFE_LIMIT[lv];
  const overSteps = Math.max(0, at - safe);
  return at * ATK_PER_REFINE[lv] + overSteps * OVER_REFINE_BONUS[lv];
}

/** What the NEXT refine would add, for the upgrade window's preview line. Zero
 *  at the top of the ladder, where there is no next. */
export function nextRefineGain(weaponLevel: WeaponLevel | undefined, refine: number): number {
  const at = clampRefine(refine);
  if (at >= MAX_REFINE) return 0;
  return refineAttackBonus(weaponLevel, at + 1) - refineAttackBonus(weaponLevel, at);
}
