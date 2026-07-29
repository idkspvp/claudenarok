// This game's weapon types, mapped onto the reference's speed table.
//
// OURS, not transcribed. `src/sim/stats/attack_speed.ts` holds SpiritVale's
// table verbatim and keeps its own vocabulary; this file is the join between
// that vocabulary and `WeaponType`, and it is the only place a judgement call
// about a weapon's speed lives.
//
// Most rows are the same weapon under a different name and need no explanation.
// Two do:
//
//   knuckle  The reference has no knuckle row. A knuckle IS the fist slot, so it
//            maps to Unarmed, which is the fastest row in the table.
//   whip     The reference has no whip row either. In the game both vocabularies
//            descend from, whip and instrument are the paired weapons of one
//            class (dancer and bard), so whip takes Instrument's row.
//
// Neither is reachable today: no item in `src/sim/content/` carries `knuckle`,
// `whip`, `instrument`, `katar` or `book`. They are mapped anyway so the union
// stays exhaustive and a future item cannot land on an undefined delay.
//
// An empty hand maps to Unarmed. That is a real row in the reference, not a
// fallback: at 0.9 it is faster than every weapon in the table.

import { WEAPON_BASE_ATTACK_DELAY, type WeaponSpeedClass } from '../stats/attack_speed';
import type { WeaponType } from '../types';

export const WEAPON_SPEED_CLASS: Readonly<Record<WeaponType, WeaponSpeedClass>> = {
  dagger: 'Dagger',
  sword: 'Sword',
  twohand_sword: 'Sword2H',
  spear: 'Spear',
  twohand_spear: 'Spear2H',
  axe: 'Axe',
  twohand_axe: 'Axe2H',
  mace: 'Mace',
  twohand_mace: 'Mace2H',
  rod: 'Wand',
  twohand_rod: 'Wand2H',
  bow: 'Bow',
  katar: 'Katar',
  book: 'Book',
  // See the header: no counterpart in the reference table.
  knuckle: 'Unarmed',
  instrument: 'Instrument',
  whip: 'Instrument',
};

/** The reference speed class for a weapon, or Unarmed for an empty hand. */
export function speedClassFor(weapon: WeaponType | null | undefined): WeaponSpeedClass {
  return weapon ? WEAPON_SPEED_CLASS[weapon] : 'Unarmed';
}

/** The base attack delay for a weapon, straight off the reference table. */
export function baseDelayFor(weapon: WeaponType | null | undefined): number {
  return WEAPON_BASE_ATTACK_DELAY[speedClassFor(weapon)];
}
