// The weapon size table: how much of its damage a weapon class lands on a
// small, medium, or large target.
//
// A pure leaf, like the element chart it sits beside. This is the mechanic with
// no equivalent in the game this codebase grew out of, and the one that most
// changes how combat plays: a dagger shreds small targets and glances off large
// ones, a spear is the reverse, and a mace does not care. It is why a Ragnarok
// player carries several weapons and swaps them by what they are hunting, rather
// than carrying whichever has the highest number.
//
// SOURCING: a reimplementation of a published mechanic, authored from the
// documented relationships. Nothing was copied from a GPL server's db/.

import type { Size, WeaponType } from '../types';

// Percentage of weapon attack power landed, by weapon class against each size.
// Read a row as the weapon's shape: where it is at its best and where it is
// wasted. Every row sums to a similar total, so no class is simply better; they
// are pointed at different things.
const SIZE_TABLE: Readonly<Record<WeaponType, Readonly<Record<Size, number>>>> = {
  // Small, fast, and precise: made for things smaller than you.
  dagger: { small: 100, medium: 75, large: 50 },
  katar: { small: 75, medium: 100, large: 75 },
  // The even trade, and the default an unmarked weapon falls back to.
  sword: { small: 75, medium: 100, large: 75 },
  twohand_sword: { small: 75, medium: 75, large: 100 },
  // Reach: made for things bigger than you.
  spear: { small: 75, medium: 75, large: 100 },
  twohand_spear: { small: 75, medium: 75, large: 100 },
  axe: { small: 50, medium: 75, large: 100 },
  twohand_axe: { small: 50, medium: 75, large: 100 },
  // Blunt force does not care what shape it hits.
  mace: { small: 75, medium: 100, large: 100 },
  knuckle: { small: 100, medium: 75, large: 50 },
  // Caster and support arms: they are not what the wielder fights with.
  rod: { small: 100, medium: 100, large: 100 },
  book: { small: 100, medium: 100, large: 75 },
  instrument: { small: 75, medium: 100, large: 75 },
  whip: { small: 75, medium: 100, large: 50 },
  // A bow's arrow does the work, so the size penalty is mild and even.
  bow: { small: 100, medium: 100, large: 75 },
};

/** The weapon class an unmarked weapon is treated as: the even-trade shape, so
 *  an item authored before weapon classes existed is neither buffed nor nerfed
 *  by the table's arrival. */
export const DEFAULT_WEAPON_TYPE: WeaponType = 'sword';

/** Share of weapon attack power this class lands on that size, as a PERCENTAGE. */
export function weaponSizePercent(type: WeaponType | undefined, size: Size): number {
  return SIZE_TABLE[type ?? DEFAULT_WEAPON_TYPE][size];
}

/** The same as a multiplier, which is what the damage line multiplies by. */
export function weaponSizeMultiplier(type: WeaponType | undefined, size: Size): number {
  return weaponSizePercent(type, size) / 100;
}

/** The size this weapon class is built for, for a tooltip line. Ties resolve to
 *  the larger size, since reach weapons are the ones that tie at the top. */
export function weaponBestSize(type: WeaponType | undefined): Size {
  const row = SIZE_TABLE[type ?? DEFAULT_WEAPON_TYPE];
  let best: Size = 'small';
  for (const size of ['small', 'medium', 'large'] as const) if (row[size] >= row[best]) best = size;
  return best;
}
