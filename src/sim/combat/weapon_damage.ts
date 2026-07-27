// Ragnarok's weapon damage roll: the range a swing rolls in, before size,
// element, and defence.
//
// Verified against the pre-renewal branch of rAthena's `battle_calc_base_damage`
// rather than reconstructed. Three things in it are easy to get wrong from
// memory, and all three are load-bearing:
//
//   1. A player's damage FLOOR is not a weapon stat. It comes from DEXTERITY,
//      scaled by the weapon's level. A high-Dexterity character does not hit
//      harder at the top, they stop rolling low, which is why Dexterity is a
//      damage stat in Ragnarok and not only an accuracy one.
//   2. A critical does NOT multiply. It takes the top of the range and skips the
//      roll. That is the whole bonus. The x2 that most games apply is not here.
//   3. The non-critical roll EXCLUDES the top: `rnd() % (atkmax - atkmin) +
//      atkmin` never returns atkmax. Only a critical reaches it.
//
// Monsters use a different shape entirely: they carry an authored min and max
// pair and roll between them, with no Dexterity term at all. That maps onto this
// game's existing `weapon: {min, max}` records exactly.
//
// Status ATK (the STR/DEX/LUK formula in `entity.ts`) is NOT part of this. It is
// added AFTER the size modifier, so it is deliberately not a term here; see
// `weaponSwingDamage`'s callers.
//
// Randomness is passed in as a 0..1 roll rather than drawn, so this stays a pure
// leaf: `src/sim/` routes every draw through the sim's `Rng` (root CLAUDE.md,
// Invariants).

import type { WeaponLevel, WeaponType } from '../types';

/** Weapon classes whose status ATK swaps STR and DEX, so Dexterity leads and
 *  takes the squared term. Bows, instruments, and whips in this game; rAthena
 *  adds the gun family, which has no equivalent here. This is the ONLY reason a
 *  bow user's attack power differs from a swordsman's: there is no second
 *  formula, just the same one fed the two stats the other way round. */
export const DEX_LEADING_WEAPONS: ReadonlySet<WeaponType> = new Set(['bow', 'instrument', 'whip']);

/** Weapon classes that fire ammunition, which is a NARROWER set than the one
 *  above: an instrument and a whip swap their attack stats but do not take the
 *  arrow damage-floor rule. Getting these two sets confused hands a bard the
 *  damage floor of an archer. */
export const ARROW_WEAPONS: ReadonlySet<WeaponType> = new Set(['bow']);

/** A weapon with no authored level behaves as the lowest rung, which is the
 *  least generous reading of an unauthored record rather than the most. */
export const DEFAULT_WEAPON_LEVEL: WeaponLevel = 1;

/** The weapon-level term on a player's damage floor: a level-1 weapon converts
 *  Dexterity at 100%, a level-4 at 160%. This is the mechanic, not a tuning
 *  knob. */
export function dexFloorPercent(level: WeaponLevel = DEFAULT_WEAPON_LEVEL): number {
  return 80 + level * 20;
}

export interface WeaponRangeInput {
  /** The top of the range. A player's weapon ATK; a monster's authored max. */
  atkMax: number;
  /** A monster's authored min. Ignored for a player, whose floor comes from
   *  Dexterity instead. */
  monsterAtkMin?: number;
  /** The attacker's Dexterity. Unused for a monster. */
  dex?: number;
  weaponType?: WeaponType;
  weaponLevel?: WeaponLevel;
  /** Monsters roll their authored pair; players derive the floor from Dexterity. */
  isMonster?: boolean;
  /** A critical takes the top of the range instead of rolling. */
  crit?: boolean;
}

export interface WeaponRange {
  min: number;
  max: number;
}

/** The range a swing rolls in.
 *
 *  For a critical this collapses to a single value at the top, EXCEPT for a bow:
 *  rAthena still computes the Dexterity floor on an arrow critical, and the bow
 *  rule below can RAISE the ceiling, so an archer's critical is worth more than
 *  simply "the top of the normal range". */
export function weaponRange(input: WeaponRangeInput): WeaponRange {
  const max = Math.max(0, Math.floor(input.atkMax));
  if (input.isMonster) {
    const min = Math.max(0, Math.floor(input.monsterAtkMin ?? max));
    return { min: Math.min(min, max), max };
  }

  const isArrow = input.weaponType !== undefined && ARROW_WEAPONS.has(input.weaponType);
  // A non-arrow critical skips the floor entirely and sits on the ceiling. An
  // arrow critical does not: the source's condition is `!crit || arrow`.
  if (input.crit && !isArrow) return { min: max, max };

  let min = Math.floor(
    (Math.max(0, Math.floor(input.dex ?? 0)) * dexFloorPercent(input.weaponLevel)) / 100,
  );
  min = Math.min(min, max);
  if (isArrow) {
    // The bow rule. The floor is re-expressed as a PERCENTAGE OF THE CEILING,
    // which means a strong bow multiplies the Dexterity floor rather than
    // capping it: at 100 weapon ATK the floor is unchanged, above that it grows.
    min = Math.floor((min * max) / 100);
    // And it is allowed to push the ceiling up with it, so a high-Dexterity
    // archer on a strong bow rolls in a band that starts ABOVE the weapon's own
    // attack power. This is why archers scale the way they do.
    if (min > max) return { min, max: min };
  }
  return { min, max };
}

/** The rolled weapon damage.
 *
 *  `roll` is a 0..1 fraction from the caller's Rng. The non-critical roll is
 *  uniform over `[min, max)`, EXCLUDING the top: only a critical returns max. */
export function weaponSwingDamage(input: WeaponRangeInput, roll: number): number {
  const { min, max } = weaponRange(input);
  if (input.crit) return max;
  if (max <= min) return min;
  const span = max - min;
  const clamped = Math.max(0, Math.min(1, roll));
  // `Math.min(span - 1, ...)` reproduces the source's integer modulo: a roll of
  // exactly 1 must not reach `max`, which is the critical's reward.
  return min + Math.min(span - 1, Math.floor(clamped * span));
}
