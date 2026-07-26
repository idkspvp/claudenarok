// Status points: the one place that decides what a character may spend and what a
// saved allocation is allowed to be.
//
// Ragnarok's model, and the reason it needs a module rather than a couple of
// helpers: the budget is not a stored counter. A character's total points are a
// function of its level, and its spend is a function of its allocation, so the
// unspent pool is always derived. Nothing can drift out of sync because there is
// nothing to sync — but it does mean every read has to cost the allocation, and
// every write has to prove the result still fits the budget.
//
// Pure and host-free: no SimContext, no DOM. Both the offline Sim and the server
// call the same functions, which is what keeps an online spend and an offline one
// from disagreeing.

import {
  BASE_STAT,
  CREATION_STATUS_POINTS,
  MAX_STAT,
  type StatAllocation,
  type StatusStat,
  STATUS_STATS,
  emptyStatAllocation,
  statRaiseCost,
  statusPointsSpent,
  totalStatusPointsAt,
} from './types';

/** Points a character at `level` has left to place. Never negative: an
 *  over-budget allocation reads as zero rather than as a debt. */
export function unspentStatusPoints(alloc: StatAllocation, level: number): number {
  return Math.max(0, totalStatusPointsAt(level) - statusPointsSpent(alloc));
}

/** What the next point in `stat` costs, or null when it cannot be bought: either
 *  the attribute is already at 99 or the character cannot afford the step. */
export function raiseCost(alloc: StatAllocation, level: number, stat: StatusStat): number | null {
  const current = BASE_STAT + alloc[stat];
  if (current >= MAX_STAT) return null;
  const cost = statRaiseCost(current);
  return cost <= unspentStatusPoints(alloc, level) ? cost : null;
}

/** Spend one point on `stat`, or null when the spend is illegal. Returns a NEW
 *  allocation; callers assign it rather than mutating, so a rejected spend cannot
 *  half-apply. */
export function raiseStat(
  alloc: StatAllocation,
  level: number,
  stat: StatusStat,
): StatAllocation | null {
  if (raiseCost(alloc, level, stat) === null) return null;
  return { ...alloc, [stat]: alloc[stat] + 1 };
}

/** Reset every attribute to base, returning the whole budget to the pool. */
export function resetStatAllocation(): StatAllocation {
  return emptyStatAllocation();
}

/** Normalize a loaded allocation. Never throws and never trusts the input.
 *
 *  Three things can be wrong with a stored allocation: it can be missing entirely
 *  (a save from before the conversion), it can carry junk for an attribute, or it
 *  can exceed the budget its level affords — a tampered save, or a legitimate one
 *  whose character was de-levelled. The first two are clamped per attribute. The
 *  third is refused WHOLESALE rather than trimmed: there is no honest way to pick
 *  which points to take back, and silently keeping an over-budget build is exactly
 *  the case a client would try to manufacture. */
export function sanitizeStatAllocation(
  raw: Partial<Record<string, unknown>> | undefined,
  level: number,
): StatAllocation {
  const alloc = emptyStatAllocation();
  if (!raw || typeof raw !== 'object') return alloc;
  const maxPoints = MAX_STAT - BASE_STAT;
  for (const stat of STATUS_STATS) {
    const value = raw[stat];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    alloc[stat] = Math.max(0, Math.min(maxPoints, Math.floor(value)));
  }
  if (statusPointsSpent(alloc) > totalStatusPointsAt(level)) return emptyStatAllocation();
  return alloc;
}

/** The resolved value of an attribute: its base plus what has been spent. */
export function statValue(alloc: StatAllocation, stat: StatusStat): number {
  return BASE_STAT + alloc[stat];
}
