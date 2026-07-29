// Status points: the one place that decides what a character may spend and what a
// saved allocation is allowed to be.
//
// Ragnarok's model, and the reason it needs a module rather than a couple of
// helpers: the budget is not a stored counter. A character's total points are a
// function of its level, and its spend is a function of its allocation, so the
// unspent pool is always derived. Nothing can drift out of sync because there is
// nothing to sync, but it does mean every read has to cost the allocation, and
// every write has to prove the result still fits the budget.
//
// Pure and host-free: no SimContext, no DOM. Both the offline Sim and the server
// call the same functions, which is what keeps an online spend and an offline one
// from disagreeing.

import { openingAllocation, openingAllocationCost } from './progression/class_blocks';
import type { PlayerClass } from './types';
import {
  BASE_STAT,
  MAX_STAT,
  STATUS_STATS,
  type StatAllocation,
  type StatusStat,
  statRaiseCost,
  statusPointsSpent,
  totalStatusPointsAt,
} from './types';

/** Points a character at `level` has left to place. Never negative: an
 *  over-budget allocation reads as zero rather than as a debt.
 *
 *  The class OPENING BLOCK is added to the budget rather than excluded from the
 *  spend, which is the only way to make it both pre-spent and unreallocatable
 *  with one number per attribute: those 27 points are already inside `alloc`, so
 *  the pool has to acknowledge paying for them or every character would read as
 *  27 points overdrawn on creation. */
export function unspentStatusPoints(
  alloc: StatAllocation,
  level: number,
  cls: PlayerClass,
): number {
  const budget = totalStatusPointsAt(level) + openingAllocationCost(cls);
  return Math.max(0, budget - statusPointsSpent(alloc));
}

/** What the next point in `stat` costs, or null when it cannot be bought: either
 *  the attribute is already at 99 or the character cannot afford the step. */
export function raiseCost(
  alloc: StatAllocation,
  level: number,
  stat: StatusStat,
  cls: PlayerClass,
): number | null {
  const current = BASE_STAT + alloc[stat];
  if (current >= MAX_STAT) return null;
  const cost = statRaiseCost(current);
  return cost <= unspentStatusPoints(alloc, level, cls) ? cost : null;
}

/** Spend one point on `stat`, or null when the spend is illegal. Returns a NEW
 *  allocation; callers assign it rather than mutating, so a rejected spend cannot
 *  half-apply. */
export function raiseStat(
  alloc: StatAllocation,
  level: number,
  stat: StatusStat,
  cls: PlayerClass,
): StatAllocation | null {
  if (raiseCost(alloc, level, stat, cls) === null) return null;
  return { ...alloc, [stat]: alloc[stat] + 1 };
}

/** Give one point back, refunding what the LAST point in `stat` cost.
 *
 *  Free and unlimited, which is the reference's own rule: its build UI lowers an
 *  attribute on shift or right click with no cost and no confirmation. A player
 *  experiments by clicking, not by paying a respec vendor.
 *
 *  Refuses to go below the class opening block, because those 27 points were
 *  never the player's to move. */
export function lowerStat(
  alloc: StatAllocation,
  stat: StatusStat,
  cls: PlayerClass,
): StatAllocation | null {
  const floor = openingAllocation(cls)[stat];
  if (alloc[stat] <= floor) return null;
  return { ...alloc, [stat]: alloc[stat] - 1 };
}

/** What lowering `stat` by one gives back, or null when it cannot be lowered. */
export function lowerRefund(
  alloc: StatAllocation,
  stat: StatusStat,
  cls: PlayerClass,
): number | null {
  const floor = openingAllocation(cls)[stat];
  if (alloc[stat] <= floor) return null;
  // The refund is what the step INTO the current value cost, so raising and
  // lowering are exactly reversible and no point can be laundered across a band.
  return statRaiseCost(BASE_STAT + alloc[stat] - 1);
}

/** Reset to the class OPENING BLOCK, returning the earned budget to the pool.
 *
 *  Not to zero. The 27 points the class opens with are not reallocatable, so a
 *  reset that cleared them would let a player launder a Warrior's Strength into
 *  Intelligence, which the reference does not allow. */
export function resetStatAllocation(cls: PlayerClass): StatAllocation {
  return openingAllocation(cls);
}

/** Normalize a loaded allocation. Never throws and never trusts the input.
 *
 *  Three things can be wrong with a stored allocation: it can be missing entirely
 *  (a save from before the conversion), it can carry junk for an attribute, or it
 *  can exceed the budget its level affords, a tampered save, or a legitimate one
 *  whose character was de-levelled. The first two are clamped per attribute. The
 *  third is refused WHOLESALE rather than trimmed: there is no honest way to pick
 *  which points to take back, and silently keeping an over-budget build is exactly
 *  the case a client would try to manufacture. */
export function sanitizeStatAllocation(
  raw: Partial<Record<string, unknown>> | undefined,
  level: number,
  cls: PlayerClass,
): StatAllocation {
  // A missing or unreadable allocation falls back to the class opening block,
  // not to nothing: a save written before the conversion has no allocation at
  // all, and loading it as six ones would hand the player a character weaker
  // than a brand new one.
  const opening = openingAllocation(cls);
  const alloc = { ...opening };
  if (!raw || typeof raw !== 'object') return alloc;
  const maxPoints = MAX_STAT - BASE_STAT;
  for (const stat of STATUS_STATS) {
    const value = raw[stat];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    // Never below the opening block: those points are not the player's to
    // spend, so a save claiming less than its class opens with is repaired
    // upward rather than trusted.
    alloc[stat] = Math.max(opening[stat], Math.min(maxPoints, Math.floor(value)));
  }
  if (statusPointsSpent(alloc) > totalStatusPointsAt(level) + openingAllocationCost(cls)) {
    return { ...opening };
  }
  return alloc;
}

/** The resolved value of an attribute: its base plus what has been spent. */
export function statValue(alloc: StatAllocation, stat: StatusStat): number {
  return BASE_STAT + alloc[stat];
}
