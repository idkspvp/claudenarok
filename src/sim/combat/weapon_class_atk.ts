// What a weapon of a given class is allowed to hit for.
//
// Ragnarok does not derive weapon attack from an item-level budget. It derives
// it from the weapon CLASS: every dagger in the game sits in one attack band and
// every two-handed sword sits in a much higher one, and a caster's rod sits in
// the lowest band of all because a caster's damage comes from MATK, not from the
// thing in its hand. Two items of the same tier are not meant to hit for the
// same amount; the class is the tradeoff.
//
// The medians below are measured over the 707 pre-renewal weapons in the
// reference server's equipment table (see docs/design/ro-reference-source.md).
// They are aggregate statistics, not transcribed records.

import type { WeaponType } from '../types';

// Median attack per weapon class.
export const CLASS_ATK_MEDIAN: Record<WeaponType, number> = {
  dagger: 90,
  sword: 120,
  twohand_sword: 160,
  axe: 110,
  twohand_axe: 185,
  mace: 120,
  twohand_mace: 130,
  rod: 60,
  twohand_rod: 120,
  spear: 120,
  twohand_spear: 160,
  bow: 100,
  katar: 130,
  book: 100,
  knuckle: 80,
  instrument: 110,
  whip: 110,
};

// How far above and below its median a class ranges. The spread is what makes a
// tier ladder inside a class: the humblest dagger in the game and the best one
// are both daggers, and both are weaker than the humblest two-handed sword.
export const ATK_BAND_LOW = 0.45;
export const ATK_BAND_HIGH = 1.4;

export interface AtkBand {
  min: number;
  max: number;
}

export function weaponAtkBand(type: WeaponType): AtkBand {
  const median = CLASS_ATK_MEDIAN[type];
  return { min: Math.round(median * ATK_BAND_LOW), max: Math.round(median * ATK_BAND_HIGH) };
}

export function isInAtkBand(type: WeaponType, atk: number): boolean {
  const band = weaponAtkBand(type);
  return atk >= band.min && atk <= band.max;
}

// Which rung of the refine ladder a weapon sits on, from where it falls in its
// own class band. Ragnarok's weapon level drives refine cost and refine risk, so
// it has to follow the weapon's power rather than its tier.
export function weaponLevelFor(type: WeaponType, atk: number): 1 | 2 | 3 | 4 {
  const band = weaponAtkBand(type);
  const t = (atk - band.min) / (band.max - band.min);
  if (t < 0.25) return 1;
  if (t < 0.55) return 2;
  if (t < 0.85) return 3;
  return 4;
}
