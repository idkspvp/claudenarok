// The per-slot defence bands.
//
// Written during an audit that found this module was the one addition in the
// equipment work without a paired test: its rules were only exercised through
// the content that happens to obey them, so a change to the bands would have
// shown up as a confusing content failure rather than as itself.

import { describe, expect, it } from 'vitest';
import {
  defCeilingFor,
  isLegalSlotDef,
  MIN_SLOT_DEF,
  reachableDefCeiling,
  SLOT_DEF_CEILING,
  slotDefends,
} from '../src/sim/combat/armor_slot_def';
import { damageReductionFraction } from '../src/sim/stats/defence_curve';

describe('which slots defend', () => {
  it('gives every armour slot a ceiling and every other slot none', () => {
    for (const slot of ['helmet', 'face', 'chest', 'back', 'legs', 'feet', 'offhand'] as const) {
      expect(slotDefends(slot), slot).toBe(true);
      expect(defCeilingFor(slot), slot).toBeGreaterThan(MIN_SLOT_DEF);
    }
    // An accessory defends nothing, which is what makes it about its bonus. A
    // weapon is not armour.
    for (const slot of ['ring', 'ring1', 'ring2', 'mainhand'] as const) {
      expect(slotDefends(slot), slot).toBe(false);
      expect(defCeilingFor(slot), slot).toBe(0);
    }
  });

  it('makes the body piece the anchor of a set', () => {
    // Chest above every other single slot: if a helmet ever out-defends body
    // armour, the whole shape of a defensive set has quietly inverted.
    for (const slot of ['helmet', 'face', 'back', 'legs', 'feet', 'offhand'] as const) {
      expect(SLOT_DEF_CEILING.chest, slot).toBeGreaterThan(SLOT_DEF_CEILING[slot]);
    }
  });
});

describe('legality', () => {
  it('accepts the endpoints of a defending slot and rejects a step outside', () => {
    const ceiling = defCeilingFor('chest');
    expect(isLegalSlotDef('chest', MIN_SLOT_DEF)).toBe(true);
    expect(isLegalSlotDef('chest', ceiling)).toBe(true);
    expect(isLegalSlotDef('chest', ceiling + 1)).toBe(false);
    expect(isLegalSlotDef('chest', MIN_SLOT_DEF - 1)).toBe(false);
  });

  it('requires exactly zero on a slot that does not defend', () => {
    expect(isLegalSlotDef('ring', 0)).toBe(true);
    expect(isLegalSlotDef('ring', 1)).toBe(false);
  });

  it('rejects a fraction and a negative, which a content typo produces', () => {
    expect(isLegalSlotDef('chest', 2.5)).toBe(false);
    expect(isLegalSlotDef('chest', -1)).toBe(false);
  });
});

describe('what a character can reach', () => {
  it('buys a real but partial reduction, nowhere near immunity', () => {
    // This used to assert the best-in-slot total stayed under a hard cap of
    // 100, because defence was a capped percentage and reaching the cap meant
    // taking nothing. The curve has no cap, so the question is no longer "does
    // it exceed a ceiling" but "is the reachable total in a sane band": enough
    // to matter, far from the asymptote.
    const reachable = reachableDefCeiling();
    expect(reachable).toBeGreaterThan(0);
    const reduction = damageReductionFraction(reachable);
    expect(reduction, 'best-in-slot armour is worth having').toBeGreaterThan(0.1);
    expect(reduction, 'and is nowhere near immunity').toBeLessThan(0.75);
  });

  it('is the sum of the worn slots, so it moves when a band moves', () => {
    const worn = ['helmet', 'face', 'chest', 'offhand', 'back', 'legs', 'feet'] as const;
    const sum = worn.reduce((total, slot) => total + SLOT_DEF_CEILING[slot], 0);
    // Accessories contribute nothing, so the worn sum IS the reachable total.
    expect(reachableDefCeiling()).toBe(sum);
  });
});
