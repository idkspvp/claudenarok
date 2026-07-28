// Which pieces of equipment carry attribute bonuses at all, and how large they
// may be.
//
// Ragnarok makes the character, not the gear, the thing a player builds. Ninety
// nine levels grant 1,273 status points, and where those go is the whole
// identity of a build. Equipment answers with defence: only about a third of the
// armour in the reference data grants any attribute at all, and the median grant
// is a single point.
//
// This tree inherited the opposite arrangement, where 91% of equipment granted
// attributes averaging four points each. A fully dressed level-20 character drew
// 131 attribute points from gear against the 59 the whole climb to 20 had earned,
// so what you found mattered more than twice as much as what you built, and the
// manual allocation this game is moving to would have been decorative.
//
// The rule below restores the reference shape: ordinary armour defends and
// nothing more, ACCESSORIES are where small bonuses live, and a genuinely rare
// piece is the exception that carries a real one.

import type { ItemDef, ItemSlot } from './types';

type ItemQuality = NonNullable<ItemDef['quality']>;

/** Accessories are the slot kind Ragnarok concentrates attribute bonuses in. */
export function isAccessorySlot(slot: ItemSlot | undefined): boolean {
  return slot === 'ring' || slot === 'face';
}

export interface StatGrant {
  /** Total attribute points the piece may carry across all attributes. */
  min: number;
  max: number;
  /** How many distinct attributes it may spread them over. */
  maxAttributes: number;
}

const NONE: StatGrant = { min: 0, max: 0, maxAttributes: 0 };

/** What a piece of this quality, in this slot kind, is allowed to grant.
 *
 *  Ordinary armour grants nothing: a Cotton Shirt in the reference game is
 *  defence and a weight class, and that is the piece a levelling character
 *  actually wears. Only epic and legendary armour buys attributes, and then a
 *  handful rather than a dozen. */
export function statGrantFor(
  quality: ItemQuality | undefined,
  slot: ItemSlot | undefined,
): StatGrant {
  const q = quality ?? 'common';
  if (isAccessorySlot(slot)) {
    // An accessory defends nothing (see armor_slot_def.ts), so its bonus IS the
    // item. Even here the grants stay small; the reference game's ordinary
    // accessory is a single point.
    if (q === 'common') return NONE;
    if (q === 'uncommon') return { min: 1, max: 2, maxAttributes: 1 };
    if (q === 'rare') return { min: 2, max: 4, maxAttributes: 2 };
    return { min: 3, max: 5, maxAttributes: 2 };
  }
  if (q === 'epic' || q === 'legendary') return { min: 3, max: 6, maxAttributes: 2 };
  return NONE;
}

export function grantsStats(quality: ItemQuality | undefined, slot: ItemSlot | undefined): boolean {
  return statGrantFor(quality, slot).max > 0;
}

/** Whether an authored total is legal for the piece carrying it. */
export function isLegalStatTotal(
  quality: ItemQuality | undefined,
  slot: ItemSlot | undefined,
  total: number,
  attributeCount: number,
): boolean {
  const grant = statGrantFor(quality, slot);
  if (grant.max === 0) return total === 0 && attributeCount === 0;
  if (total < grant.min || total > grant.max) return false;
  return attributeCount >= 1 && attributeCount <= grant.maxAttributes;
}
