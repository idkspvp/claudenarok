// v0.27.1 two-hand re-budget: a two-handed weapon differentiates on weapon ATTACK,
// never on stats. Every dual-wield or weapon-and-shield setup must out-stat a
// two-hander of the same item level; the 2H's compensation is raw attack. Born
// from the v0.27.0 fury incident: the old 2x stat budget assumed the offhand slot
// was sacrificed, and Titan's Grip filled BOTH slots with double-budget
// two-handers (86 weapon stat points vs 38 for a dual-1H pair).
//
// The STAT half of the re-budget is untouched and still pinned below. Only the
// compensation changed: it used to be a TWOHAND_DPS_MULT premium over one
// universal item-level dps curve, and is now the weapon's own class band.
import { describe, expect, it } from 'vitest';
import { weaponAtkBand } from '../src/sim/combat/weapon_class_atk';
import { ITEMS } from '../src/sim/data';
import { SLOT_STAT_MULT, TWOHAND_STAT_MULT } from '../src/sim/item_budget';
import { expectedStatBudget, itemLevel, primaryStatSum } from '../src/sim/item_level';
import type { WeaponItemDef, WeaponType } from '../src/sim/types';

const twoHanders = (): WeaponItemDef[] =>
  Object.values(ITEMS).filter(
    (i): i is WeaponItemDef => i.kind === 'weapon' && i.hand === 'twohand',
  );

describe('v0.27.1 two-hand re-budget', () => {
  it('pins the re-budget constants', () => {
    expect(TWOHAND_STAT_MULT).toBe(1.3);
  });

  it('keeps a two-hander strictly below every mainhand + offhand pair budget', () => {
    // The structural invariant behind the re-budget: the stat premium must never
    // reach the combined slot weights of the pair it displaces, whatever the tier.
    expect(TWOHAND_STAT_MULT).toBeLessThan(SLOT_STAT_MULT.mainhand + SLOT_STAT_MULT.offhand);
  });

  it('every leveled two-hander carries exactly its re-budgeted stat total', () => {
    let checked = 0;
    for (const item of twoHanders()) {
      if (itemLevel(item) === undefined) continue;
      expect(primaryStatSum(item), item.id).toBe(expectedStatBudget(item));
      checked++;
    }
    // The four authored epics at minimum; generated heroic variants join the
    // sweep automatically as they exist.
    expect(checked).toBeGreaterThanOrEqual(4);
  });

  it('pays the two-hander its premium in attack, family by family', () => {
    // The re-budget's compensation used to be one universal dps curve times
    // TWOHAND_DPS_MULT. Ragnarok pays it per weapon FAMILY instead: a two-handed
    // sword outranges a one-handed sword, a greatstaff outranges a rod, and each
    // pair is a separate ladder. Stated as whole bands so a mis-typed record
    // fails here rather than passing on a curve it was never on.
    const ceiling = (type: WeaponType) =>
      Math.max(
        0,
        ...Object.values(ITEMS)
          .filter((i) => i.weapon?.weaponType === type && !i.heroicOf)
          .map((i) => i.weapon!.max),
      );
    const FAMILIES: [WeaponType, WeaponType][] = [
      ['twohand_sword', 'sword'],
      ['twohand_mace', 'mace'],
      ['twohand_rod', 'rod'],
    ];
    for (const [two, one] of FAMILIES) {
      expect(ceiling(two), `${two} vs ${one}`).toBeGreaterThan(ceiling(one));
    }
  });

  it('never lets a two-hander leave its class band', () => {
    let checked = 0;
    for (const item of twoHanders()) {
      const type = item.weapon.weaponType;
      if (!type) continue;
      const band = weaponAtkBand(type);
      expect(item.weapon.max, `${item.id} (${type})`).toBeGreaterThanOrEqual(band.min);
      expect(item.weapon.max, `${item.id} (${type})`).toBeLessThanOrEqual(band.max);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });
});
