// The equipment attribute-grant policy.
//
// The point of this module is a RATIO, not a table: the character a player
// builds has to matter more than the gear they find. So the cases below pin the
// ratio against the real item tables and the real status-point curve, and the
// shape of the rule that produces it, rather than restating its numbers.

import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import {
  grantsStats,
  isAccessorySlot,
  isLegalStatTotal,
  statGrantFor,
} from '../src/sim/item_stat_policy';
import { totalStatusPointsAt } from '../src/sim/types';

const PRIMARY = ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const;
const equipment = () => Object.values(ITEMS).filter((i) => i.kind === 'armor' && !i.heroicOf);
const attrTotal = (item: (typeof ITEMS)[string]) =>
  PRIMARY.reduce((sum, k) => sum + (item.stats?.[k] ?? 0), 0);
const attrCount = (item: (typeof ITEMS)[string]) =>
  PRIMARY.filter((k) => (item.stats?.[k] ?? 0) > 0).length;

describe('the rule', () => {
  it('gives ordinary armour defence and nothing else', () => {
    // The load-bearing one. A levelling character's chest piece is armour and a
    // weight class, the way a Cotton Shirt is in the reference game.
    for (const quality of ['common', 'uncommon', 'rare'] as const) {
      expect(grantsStats(quality, 'chest'), quality).toBe(false);
      expect(grantsStats(quality, 'legs'), quality).toBe(false);
    }
    expect(grantsStats('epic', 'chest')).toBe(true);
    expect(grantsStats('legendary', 'chest')).toBe(true);
  });

  it('puts the small bonuses on accessories, where the reference game keeps them', () => {
    expect(isAccessorySlot('ring')).toBe(true);
    expect(isAccessorySlot('face')).toBe(true);
    expect(isAccessorySlot('chest')).toBe(false);
    // An uncommon accessory beats an uncommon chest piece for attributes, which
    // is the inversion the whole module exists to state.
    expect(grantsStats('uncommon', 'ring')).toBe(true);
    expect(grantsStats('uncommon', 'chest')).toBe(false);
  });

  it('keeps every grant small enough to be a bonus rather than a build', () => {
    for (const quality of ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const) {
      for (const slot of ['ring', 'face', 'chest', 'helmet', 'feet'] as const) {
        const grant = statGrantFor(quality, slot);
        expect(grant.max, `${quality}/${slot}`).toBeLessThanOrEqual(6);
        if (grant.max > 0) {
          expect(grant.min, `${quality}/${slot}`).toBeGreaterThan(0);
          expect(grant.min).toBeLessThanOrEqual(grant.max);
          expect(grant.maxAttributes).toBeGreaterThan(0);
        }
      }
    }
  });

  it('rises with quality inside one slot kind', () => {
    const ladder = (['uncommon', 'rare', 'epic'] as const).map((q) => statGrantFor(q, 'ring').max);
    expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    expect(ladder[0]).toBeLessThan(ladder[2]);
  });
});

describe('legality, the arm the content check uses', () => {
  it('rejects any attribute at all on a piece that grants none', () => {
    expect(isLegalStatTotal('uncommon', 'chest', 0, 0)).toBe(true);
    expect(isLegalStatTotal('uncommon', 'chest', 1, 1)).toBe(false);
  });

  it('rejects a total over the ceiling and a spread over too many attributes', () => {
    const grant = statGrantFor('epic', 'chest');
    expect(isLegalStatTotal('epic', 'chest', grant.max, 1)).toBe(true);
    expect(isLegalStatTotal('epic', 'chest', grant.max + 1, 1)).toBe(false);
    expect(isLegalStatTotal('epic', 'chest', grant.max, grant.maxAttributes + 1)).toBe(false);
  });

  it('rejects a piece that grants nothing while claiming an attribute', () => {
    expect(isLegalStatTotal('epic', 'chest', 0, 1)).toBe(false);
  });
});

describe('what the rule produces over the real tables', () => {
  it('leaves most equipment granting no attribute at all', () => {
    const all = equipment();
    const withStat = all.filter((i) => attrTotal(i) > 0);
    // The reference data sits at 35%. Ours runs a little higher because our
    // accessory count is a larger share of a much smaller catalogue; what
    // matters is that the MAJORITY of equipment is defence only, which is the
    // reversal from the 91% this tree inherited.
    expect(withStat.length / all.length).toBeLessThan(0.5);
    expect(withStat.length / all.length).toBeGreaterThan(0.2);
  });

  it('holds every authored piece inside its own grant', () => {
    for (const item of equipment()) {
      expect(
        isLegalStatTotal(item.quality, item.slot, attrTotal(item), attrCount(item)),
        `${item.id} (${item.quality}/${item.slot}) total ${attrTotal(item)} over ${attrCount(item)}`,
      ).toBe(true);
    }
  });

  it('keeps what a player BUILDS ahead of what they find', () => {
    // The ratio the module exists for, measured the way a player experiences it:
    // best-in-slot gear against the attributes the climb itself granted. Gear
    // used to win this comparison more than two to one.
    const best = new Map<string, number>();
    for (const item of equipment()) {
      if (!item.slot) continue;
      best.set(item.slot, Math.max(best.get(item.slot) ?? 0, attrTotal(item)));
    }
    const fromGear = [...best.values()].reduce((a, b) => a + b, 0);
    // Status points are not attribute points one for one (raising a stat costs
    // more as it climbs), so compare against the budget, which is the figure a
    // player is handed and the one that grows with the level cap.
    expect(fromGear).toBeLessThan(totalStatusPointsAt(20));
    expect(fromGear).toBeLessThan(totalStatusPointsAt(99) / 4);
  });
});
