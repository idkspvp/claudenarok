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
// The two halves land in DIFFERENT places in the damage line, which is the part
// that matters and the part a single combined number gets wrong:
//
//   the flat rate    goes into the weapon's second attack accumulator and is
//                    added AFTER defence (`status.cpp:3957` fills it,
//                    `battle.cpp:4906` adds it), where it can dig the hit out of
//                    a negative before the floor.
//   the over-refine  is a RANDOM 1 to N added to base attack power BEFORE
//                    defence (`battle.cpp:2419`; the source comment says the
//                    over-refine bonus is part of base attack).
//
// So this module exposes them separately and never as one total.

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
const OVER_REFINE_BONUS: Readonly<Record<WeaponLevel, number>> = { 1: 3, 2: 5, 3: 8, 4: 13 };

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

/** The flat attack power this refine level is worth, added AFTER defence.
 *
 *  Monotonic in refine and in weapon level, so a higher-class weapon at the same
 *  refine is never worth less. */
export function refineFlatAtk(weaponLevel: WeaponLevel | undefined, refine: number): number {
  return clampRefine(refine) * ATK_PER_REFINE[level(weaponLevel)];
}

/** The TOP of the over-refine range for this refine level: the reward for going
 *  past the safe limit. Zero at or below it.
 *
 *  The actual bonus is a random 1 to this, drawn by the caller and added to base
 *  attack power BEFORE defence. Returning the ceiling rather than a rolled value
 *  is what keeps this a leaf: every draw in the sim goes through its Rng. */
export function overRefineMax(weaponLevel: WeaponLevel | undefined, refine: number): number {
  const lv = level(weaponLevel);
  const overSteps = Math.max(0, clampRefine(refine) - SAFE_LIMIT[lv]);
  return overSteps * OVER_REFINE_BONUS[lv];
}

/** The rolled over-refine bonus: 1 to `overRefineMax`, or zero when there is no
 *  over-refine. `roll` is a 0..1 draw from the caller's Rng. */
export function overRefineBonus(
  weaponLevel: WeaponLevel | undefined,
  refine: number,
  roll: number,
): number {
  const max = overRefineMax(weaponLevel, refine);
  if (max <= 0) return 0;
  return Math.floor(Math.max(0, Math.min(0.999999, roll)) * max) + 1;
}

/** Both halves at their expected value, for a tooltip that has to show the
 *  weapon's power as one number. NEVER the damage line: the two halves land on
 *  opposite sides of defence. */
export function refineAttackBonus(weaponLevel: WeaponLevel | undefined, refine: number): number {
  const max = overRefineMax(weaponLevel, refine);
  return refineFlatAtk(weaponLevel, refine) + (max > 0 ? (max + 1) / 2 : 0);
}

/** What the NEXT refine would add, for the upgrade window's preview line. Zero
 *  at the top of the ladder, where there is no next. */
export function nextRefineGain(weaponLevel: WeaponLevel | undefined, refine: number): number {
  const at = clampRefine(refine);
  if (at >= MAX_REFINE) return 0;
  return refineAttackBonus(weaponLevel, at + 1) - refineAttackBonus(weaponLevel, at);
}
