// A suggested status-point spread for a class, and the greedy spender that fills it.
//
// Points are the player's to spend: nothing here ever overrides a build a player
// actually chose. This exists for the characters that have no player behind the
// decision, and for the one where the player has not made it yet:
//   - a dev/GM level jump, which would otherwise hand back a level-80 character
//     still sitting at 1 in all six and unable to kill anything,
//   - the balance and ability-scaling tests, which need a character whose numbers
//     resemble a real one at that level,
//   - the "recommended" button the allocation window offers a new player.
// The onboarding case is why the spread is a suggestion and not a class property:
// two characters of the same class being genuinely different is the point of
// manual allocation, and a class that came with a stat block would undo it.
//
// Pure and deterministic: no rng, no clock. Same class and level always yield the
// same allocation, which is what lets the parity goldens and the RL env rely on it.

import { raiseCost, raiseStat, statValue } from './status_points';
import {
  emptyStatAllocation,
  MAX_LEVEL,
  type PlayerClass,
  STATUS_STATS,
  type StatAllocation,
  type StatusStat,
} from './types';

// Relative pull, not a target value. A 0 means the class never buys that attribute
// at all: a Swordman spends nothing on INT, and a Mage nothing on STR. Everything
// else is proportional, so the spread keeps its shape at every level rather than
// dumping the whole budget into one attribute the way a strict priority order does.
const CLASS_STAT_WEIGHTS: Readonly<Record<PlayerClass, Readonly<Record<StatusStat, number>>>> = {
  warrior: { str: 5, agi: 2, vit: 4, int: 0, dex: 3, luk: 1 },
  paladin: { str: 5, agi: 1, vit: 5, int: 2, dex: 2, luk: 1 },
  rogue: { str: 4, agi: 5, vit: 2, int: 0, dex: 3, luk: 2 },
  hunter: { str: 2, agi: 4, vit: 2, int: 1, dex: 5, luk: 1 },
  mage: { str: 0, agi: 1, vit: 2, int: 5, dex: 4, luk: 1 },
  priest: { str: 1, agi: 1, vit: 3, int: 5, dex: 3, luk: 1 },
  warlock: { str: 0, agi: 1, vit: 2, int: 5, dex: 4, luk: 1 },
  shaman: { str: 4, agi: 1, vit: 4, int: 3, dex: 3, luk: 1 },
  druid: { str: 3, agi: 2, vit: 3, int: 4, dex: 2, luk: 1 },
};

export function statWeightsFor(cls: PlayerClass): Readonly<Record<StatusStat, number>> {
  return CLASS_STAT_WEIGHTS[cls];
}

/** Spend a level's whole status-point budget along the class's suggested spread.
 *
 *  Points are spent AS THEY ARRIVE, one level at a time, which is both what a player
 *  actually does and the thing that makes the result monotone: a preset recomputed at
 *  a higher level can only ever be a superset of the lower one, so a ding never moves
 *  a point a character already had. Recomputing the whole budget in one pass instead
 *  looks equivalent and is not: the proportional ordering shifts as the pool grows,
 *  and a Swordman leveling 25 to 26 lost a point of LUK.
 *
 *  Within a level, each step buys the attribute furthest behind its share of the
 *  weights, so the spread keeps its shape rather than maxing one attribute before
 *  starting the next. Ties break in a fixed attribute order, so the result is
 *  reproducible. */
export function defaultAllocationFor(cls: PlayerClass, level: number): StatAllocation {
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  let alloc = emptyStatAllocation();
  for (let l = 1; l <= target; l++) alloc = spendBudgetAt(alloc, cls, l);
  return alloc;
}

/** Is this allocation still exactly the suggestion for that level, untouched?
 *
 *  The question a level jump has to answer before it re-spreads anything. "Has the
 *  player spent nothing" cannot answer it, because a new character starts ON the
 *  suggestion, so from the first moment it has spent everything. This asks the real
 *  question instead: has the player made a decision here yet. Once they move a
 *  single point, the answer is no forever, and their build is theirs. */
export function isSuggestedSpread(alloc: StatAllocation, cls: PlayerClass, level: number): boolean {
  const suggested = defaultAllocationFor(cls, level);
  return STATUS_STATS.every((stat) => alloc[stat] === suggested[stat]);
}

/** Buy until this level's pool can no longer afford anything. The leftover is
 *  therefore always smaller than the cheapest remaining step, and it carries into
 *  the next level rather than being lost. */
function spendBudgetAt(from: StatAllocation, cls: PlayerClass, level: number): StatAllocation {
  const weights = CLASS_STAT_WEIGHTS[cls];
  const wanted = (Object.keys(weights) as StatusStat[]).filter((s) => weights[s] > 0);
  let alloc = from;
  for (;;) {
    let pick: StatusStat | null = null;
    let pickRatio = Number.POSITIVE_INFINITY;
    for (const stat of wanted) {
      const ratio = statValue(alloc, stat) / weights[stat];
      if (ratio >= pickRatio) continue;
      if (raiseCost(alloc, level, stat) === null) continue; // unaffordable, or already at 99
      pick = stat;
      pickRatio = ratio;
    }
    if (!pick) return alloc;
    alloc = raiseStat(alloc, level, pick) as StatAllocation;
  }
}
