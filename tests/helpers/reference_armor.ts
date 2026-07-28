// The defence a reference character can actually be wearing, derived from the
// live item tables.
//
// The mob melee-floor suites compare a swing against a fully geared player, and
// they used to do it through a transcribed armour literal. That literal was on
// the inherited unbounded armour pool; once equipment moved to Ragnarok's
// percentage defence, the stale number saturated the hard DEF cap and quietly
// reduced every mob swing in those files to zero. Deriving it means a defence
// rebalance moves the reference with the content instead of silently inverting
// what the suites measure.

import { ITEMS } from '../../src/sim/data';
import { requiredLevelFor } from '../../src/sim/item_level_req';
import type { PlayerClass } from '../../src/sim/types';

/** Best-in-slot equipment defence for a character of `level` in `cls`. */
export function referenceArmorAt(level: number, cls: PlayerClass = 'swordman'): number {
  const best = new Map<string, number>();
  for (const item of Object.values(ITEMS)) {
    const armor = item.stats?.armor ?? 0;
    if (!armor || !item.slot) continue;
    if ((requiredLevelFor(item) ?? 1) > level) continue;
    if (item.requiredClass && !item.requiredClass.includes(cls)) continue;
    best.set(item.slot, Math.max(best.get(item.slot) ?? 0, armor));
  }
  let total = 0;
  for (const value of best.values()) total += value;
  return total;
}
