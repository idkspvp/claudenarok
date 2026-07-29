// What a character opens with, per class.
//
// The reference gives every base class the same shape: 12 in its lead attribute,
// 9 in two supports, 1 in the other three. Six attributes summing to 33, which
// is 27 points spent on top of the base 1 each. Nobody starts with Luck.
//
//   Warrior   STR 12  VIT  9  AGI  9  DEX  1  INT  1  LUK 1
//   Knight    VIT 12  STR  9  DEX  9  AGI  1  INT  1  LUK 1
//   Rogue     AGI 12  STR  9  DEX  9  VIT  1  INT  1  LUK 1
//   Acolyte   INT 12  VIT  9  DEX  9  STR  1  AGI  1  LUK 1
//   Scout     DEX 12  AGI  9  INT  9  STR  1  VIT  1  LUK 1
//   Summoner  INT 12  STR  9  VIT  9  AGI  1  DEX  1  LUK 1
//   Mage      INT 12  AGI  9  DEX  9  STR  1  VIT  1  LUK 1
//
// This game has five of those seven, and the mapping is the same one the health
// multipliers use (combat/class_health_map.ts): our classes ARE the first jobs
// the reference's base classes were built from. Knight and Summoner arrive in
// phase 4 with the rest of the class set.
//
// The block is NOT reallocatable. That is the point of it: the model this
// replaces handed a new character 48 unspent points and made them configure a
// blank slate before they could play, and the class meant nothing mechanically.
// Here the class IS the opening block.
//
// Pure data plus one lookup. `StatAllocation` counts points SPENT ABOVE the base
// of 1, so the numbers below are the published values minus one.

import type { PlayerClass, StatAllocation } from '../types';

/** The published opening attributes, before the base of 1 is subtracted. */
export const CLASS_OPENING_ATTRIBUTES: Readonly<
  Record<PlayerClass, Readonly<Record<keyof StatAllocation, number>>>
> = {
  // Warrior
  swordman: { str: 12, vit: 9, agi: 9, dex: 1, int: 1, luk: 1 },
  // Rogue
  thief: { agi: 12, str: 9, dex: 9, vit: 1, int: 1, luk: 1 },
  // Acolyte
  acolyte: { int: 12, vit: 9, dex: 9, str: 1, agi: 1, luk: 1 },
  // Scout
  archer: { dex: 12, agi: 9, int: 9, str: 1, vit: 1, luk: 1 },
  // Mage
  mage: { int: 12, agi: 9, dex: 9, str: 1, vit: 1, luk: 1 },
};

/** What an unknown class opens with: nothing above the base of 1. */
const NO_OPENING_BLOCK: Readonly<Record<keyof StatAllocation, number>> = {
  str: 1,
  agi: 1,
  vit: 1,
  int: 1,
  dex: 1,
  luk: 1,
};

/**
 * The opening block as an ALLOCATION, which counts points above the base of 1.
 * Sums to 27 for every class, by construction.
 */
export function openingAllocation(cls: PlayerClass): StatAllocation {
  // An unrecognized class opens with NO block rather than crashing or silently
  // borrowing another class's. A caller holding no class yet (a client mirror
  // built before its hello frame) then reads a character with nothing pre-spent,
  // which is wrong but harmless and self-corrects the moment the class arrives.
  const opening = CLASS_OPENING_ATTRIBUTES[cls] ?? NO_OPENING_BLOCK;
  return {
    str: opening.str - 1,
    agi: opening.agi - 1,
    vit: opening.vit - 1,
    int: opening.int - 1,
    dex: opening.dex - 1,
    luk: opening.luk - 1,
  };
}

/** How many points the opening block spends. 27 for every class. */
export function openingAllocationCost(cls: PlayerClass): number {
  const a = openingAllocation(cls);
  return a.str + a.agi + a.vit + a.int + a.dex + a.luk;
}
