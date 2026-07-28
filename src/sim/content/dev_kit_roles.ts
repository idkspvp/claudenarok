// Stat weightings for the /dev kit presets: one record per class-and-spec pair, all
// 27 of them.
//
// DATA, not logic. The selection itself lives in src/sim/dev_kit.ts; this table only
// says what a given spec VALUES, so the picker can argmax a slot without any
// spec-specific branching.
//
// These weights are a testing convenience, NOT a balance statement. They exist so a
// tester lands in gear that is coherent for their spec, not so the game can claim an
// optimal set. They deliberately do not encode rotation, set bonuses, or breakpoints.
//
// The role for each spec is taken from the declared SpecDef.role in
// src/sim/content/talents.ts and is pinned by a test, so this table cannot silently
// drift away from the talent tree. Two of those declared roles are worth noting
// because they are not the genre default: mage/arcane is a HEALER in this game, and
// druid/feral is a TANK.

import type { PlayerClass } from '../types';

// A weight of 0 (or an absent key) means the stat does not count toward the score at
// all, which is what keeps a caster from hoarding strength plate it can equip.
export interface DevKitRole {
  // Spec id exactly as declared in talents.ts. Equip legality is evaluated under this
  // spec, so dual-wield and Titan's Grip rules resolve correctly.
  spec: string;
  weights: Partial<Record<'str' | 'agi' | 'vit' | 'int' | 'luk', number>>;
  // Melee specs value weapon dps far more than casters, who mostly want the stats on
  // the stick. Drives the weapon term in the scorer.
  melee: boolean;
  // Tanks value stamina and armor over raw output, and take a shield when the class
  // can hold one.
  tank?: boolean;
  hands?: 'shield' | 'dualWield';
}

// Physical damage: strength or agility leads, stamina is a real but secondary term.
const PHYS_STR = { str: 1, agi: 0.5, vit: 0.6 } as const;
const PHYS_AGI = { agi: 1, str: 0.4, vit: 0.6 } as const;
// Tanks: survivability first. Stamina leads outright.
const TANK_STR = { vit: 1, str: 0.7, agi: 0.4 } as const;
const TANK_AGI = { vit: 1, agi: 0.8, str: 0.3 } as const;
// Casters: intellect leads; a little spirit for regen, a little stamina to live.
const CASTER = { int: 1, luk: 0.35, vit: 0.4 } as const;
// Healers: intellect still leads but spirit matters far more than for a nuker.
const HEALER = { int: 1, luk: 0.7, vit: 0.4 } as const;

export const DEV_KIT_ROLES: Readonly<Record<PlayerClass, readonly DevKitRole[]>> = Object.freeze({
  swordman: [
    { spec: 'arms', weights: PHYS_STR, melee: true },
    // Fury dual-wields (and with Titan's Grip can hold two two-handers), so the
    // picker must fill BOTH hands rather than leaving an empty offhand.
    { spec: 'fury', weights: PHYS_STR, melee: true, hands: 'dualWield' },
    { spec: 'prot', weights: TANK_STR, melee: true, tank: true, hands: 'shield' },
  ],
  archer: [
    { spec: 'beast_mastery', weights: PHYS_AGI, melee: false },
    { spec: 'marksmanship', weights: PHYS_AGI, melee: false },
    { spec: 'survival', weights: PHYS_AGI, melee: false },
  ],
  thief: [
    { spec: 'assassination', weights: PHYS_AGI, melee: true, hands: 'dualWield' },
    { spec: 'combat', weights: PHYS_AGI, melee: true, hands: 'dualWield' },
    { spec: 'subtlety', weights: PHYS_AGI, melee: true, hands: 'dualWield' },
  ],
  acolyte: [
    { spec: 'discipline', weights: HEALER, melee: false },
    { spec: 'holy', weights: HEALER, melee: false },
    { spec: 'shadow', weights: CASTER, melee: false },
  ],
  mage: [
    // Declared HEALER in talents.ts (this game's arcane mage heals), so it is
    // weighted as one. Not a mistake, and not the genre default.
    { spec: 'arcane', weights: HEALER, melee: false },
    { spec: 'fire', weights: CASTER, melee: false },
    { spec: 'frost', weights: CASTER, melee: false },
  ],
});

// Every class-and-spec pair, flattened. 15 entries: the five first jobs times
// three specs each (D1 cut the other four classes and their twelve pairs).
export const DEV_KIT_ROLE_COUNT = 15;

export function devKitRole(cls: PlayerClass, spec: string): DevKitRole | null {
  return DEV_KIT_ROLES[cls]?.find((role) => role.spec === spec) ?? null;
}
