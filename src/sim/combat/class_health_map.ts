// This game's classes, mapped onto the reference's health multipliers.
//
// OURS, not transcribed. `src/sim/stats/resources.ts` carries the Max HP formula
// verbatim and takes the multiplier as an argument; this file decides which
// number each of our five classes gets.
//
// The mapping is one to one and needs no invention: this game's five classes ARE
// the first jobs of the game the reference's own base classes were built from,
// so each has an obvious counterpart.
//
//   swordman -> Warrior   1.30   the tankiest, by a wide margin
//   thief    -> Rogue     0.85
//   acolyte  -> Acolyte   0.75
//   archer   -> Scout     0.70
//   mage     -> Mage      0.50   half a Warrior's pool at the same level
//
// The reference has seven base classes; Knight (1.00) and Summoner (0.70) have
// no counterpart here yet and arrive in phase 4 with the rest of the class set.
//
// The spread is the whole durability difference between the classes now. The
// per-job health TABLE this replaces gave each class its own curve; the
// reference gives every class the same quadratic and one multiplier on it, so a
// Warrior and a Mage differ by a constant factor rather than by shape.

import type { PlayerClass } from '../types';

/** Reference health multipliers, keyed by this game's classes. */
export const CLASS_HEALTH_MULTIPLIER: Readonly<Record<PlayerClass, number>> = {
  swordman: 1.3,
  knight: 1.0,
  summoner: 0.7,
  thief: 0.85,
  acolyte: 0.75,
  archer: 0.7,
  mage: 0.5,
};

/** The reference's Knight and Summoner rows, held for phase 4. Not reachable
 *  from `PlayerClass` yet, so they live here rather than in the record above. */
export const UNMAPPED_ARCHETYPE_HEALTH = { Knight: 1.0, Summoner: 0.7 } as const;

export function classHealthMultiplier(cls: PlayerClass): number {
  return CLASS_HEALTH_MULTIPLIER[cls];
}
