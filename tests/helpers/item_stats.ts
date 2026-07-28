// One place that knows which contract an item's attributes are held to.
//
// Every item used to owe EXACTLY its item-level stat budget. That is still true
// of weapons, whose attributes are part of what makes them that weapon. It is no
// longer true of armour: under `src/sim/item_stat_policy.ts` ordinary armour
// grants no attributes at all, accessories carry small ones, and epics are the
// exception, so the budget has nothing to say about it.
//
// Roughly a dozen suites asserted the old contract. Routing them through here
// means the decision lives in one place, and a future change to it moves one
// file rather than twelve.

import { expect } from 'vitest';
import { expectedStatBudget, primaryStatSum } from '../../src/sim/item_level';
import { isLegalStatTotal } from '../../src/sim/item_stat_policy';
import type { ItemDef } from '../../src/sim/types';

const PRIMARY = ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const;

export function attributeTotal(item: ItemDef): number {
  return PRIMARY.reduce((sum, key) => sum + (item.stats?.[key] ?? 0), 0);
}

export function attributeCount(item: ItemDef): number {
  return PRIMARY.filter((key) => (item.stats?.[key] ?? 0) > 0).length;
}

/** Assert an item's attributes are legal under whichever rule governs it. */
export function expectAttributesLegal(item: ItemDef, label = item.id): void {
  if (item.kind === 'armor') {
    const total = attributeTotal(item);
    expect(
      isLegalStatTotal(item.quality, item.slot, total, attributeCount(item)),
      `${label} (${item.quality}/${item.slot}) grants ${total} over ${attributeCount(item)}`,
    ).toBe(true);
    return;
  }
  const budget = expectedStatBudget(item);
  expect(budget, `${label} has a derivable budget`).not.toBeUndefined();
  expect(primaryStatSum(item), `${label} stat sum == budget`).toBe(budget);
}

/** The same check as a predicate, for suites that collect offenders into a list
 *  rather than failing on the first one. */
export function attributesLegal(item: ItemDef): boolean {
  if (item.kind === 'armor') {
    return isLegalStatTotal(item.quality, item.slot, attributeTotal(item), attributeCount(item));
  }
  const budget = expectedStatBudget(item);
  return budget !== undefined && primaryStatSum(item) === budget;
}
