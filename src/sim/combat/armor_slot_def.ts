// What a piece of armour is allowed to contribute, slot by slot.
//
// Ragnarok's defence is a PERCENTAGE, not a pool: hard DEF 10 removes a tenth of
// the incoming hit. That is why its armour numbers look so small next to a
// WoW-shaped game's, and why they barely move across ninety-nine levels: the
// reference data's armour sits at a median of 2 to 3 for the whole game, and the
// single strongest body piece in it is 15. Progression comes from refining,
// cards, and Vitality, not from a defence ladder.
//
// The ceilings below are the measured maxima per equipment location over the
// reference server's 2,017 equipment records (see
// docs/design/ro-reference-source.md). They are aggregate statistics; no
// individual record was carried across.

import type { EquipSlot, ItemSlot } from '../types';

// The highest defence any single piece in that slot may carry.
export const SLOT_DEF_CEILING: Record<EquipSlot | 'ring', number> = {
  // Headgear is the slot Ragnarok cares most about, and the top hats really do
  // out-defend a garment.
  helmet: 12,
  face: 10,
  // Body armour is the one big piece.
  chest: 15,
  // A shield, taking the 90th percentile rather than the one 100-defence
  // outlier the reference data carries for a quest reward.
  offhand: 9,
  back: 10,
  feet: 10,
  // Ragnarok has no legs slot: it spends that slot on a third headgear instead.
  // We keep legs, so it gets a band of its own, under body armour because the
  // chest piece should stay the anchor of a set.
  legs: 8,
  // An accessory defends nothing. In the reference data the median accessory is
  // 0 and the 90th percentile is 1, which makes the slot about its bonus rather
  // than about mitigation. Belts and gloves live here, so they defend nothing
  // either.
  ring: 0,
  ring1: 0,
  ring2: 0,
  // A weapon is not armour.
  mainhand: 0,
};

// The floor a piece that defends at all may not go under, so a slot that is
// meant to mitigate never rounds down to nothing.
export const MIN_SLOT_DEF = 1;

export function defCeilingFor(slot: ItemSlot): number {
  return SLOT_DEF_CEILING[slot] ?? 0;
}

export function slotDefends(slot: ItemSlot): boolean {
  return defCeilingFor(slot) > 0;
}

// Whether a piece's authored defence is legal for the slot it occupies. The
// content check calls this; it is the rule an authoring mistake breaks.
export function isLegalSlotDef(slot: ItemSlot, def: number): boolean {
  if (!Number.isInteger(def) || def < 0) return false;
  const ceiling = defCeilingFor(slot);
  if (ceiling === 0) return def === 0;
  return def >= MIN_SLOT_DEF && def <= ceiling;
}

// The best defence a character could wear at once, summed over the slots that
// mitigate. Used to assert the ceiling stays under total immunity rather than
// hardcoding a number that stops meaning anything when the bands move.
export function reachableDefCeiling(): number {
  const worn: EquipSlot[] = [
    'helmet',
    'face',
    'chest',
    'offhand',
    'back',
    'legs',
    'feet',
    'ring1',
    'ring2',
  ];
  return worn.reduce((sum, slot) => sum + SLOT_DEF_CEILING[slot], 0);
}
