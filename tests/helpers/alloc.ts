// A status-point allocation for tests that need a character with real
// attributes rather than the six 1s a fresh character actually carries.
//
// This is deliberately TEST-ONLY. The game spends none of a character's points
// for them (Ragnarok hands them over and the player decides), so there is no
// production equivalent to import; a suite that wants a level-50 body with
// numbers on it has to say so itself.
//
// It spends the level's whole budget round-robin across the six, which is not a
// build anyone would choose and is not meant to be. Tests that care about a
// SPECIFIC attribute should pass their own allocation instead.

import {
  BASE_STAT,
  MAX_STAT,
  STATUS_STATS,
  type StatAllocation,
  statRaiseCost,
  totalStatusPointsAt,
} from '../../src/sim/types';

/** An even spread of everything a character at `level` has ever been granted. */
export function spreadAllocation(level: number): StatAllocation {
  const alloc: StatAllocation = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  let budget = totalStatusPointsAt(level);
  // Round-robin so the six stay within one point of each other and no single
  // attribute runs away into the expensive bands early.
  let progress = true;
  while (budget > 0 && progress) {
    progress = false;
    for (const stat of STATUS_STATS) {
      const current = BASE_STAT + alloc[stat];
      if (current >= MAX_STAT) continue;
      const cost = statRaiseCost(current);
      if (cost > budget) continue;
      alloc[stat]++;
      budget -= cost;
      progress = true;
    }
  }
  return alloc;
}

/** Level a sim's player AND spend their points, then refresh derived stats.
 *
 *  `sim.setPlayerLevel` alone leaves the new points UNSPENT, which is the real
 *  game behaviour and leaves the character sitting on 1 in every attribute. Any
 *  suite that wants a level-N character with numbers on it wants this instead. */
export function levelWithStats(
  // biome-ignore lint/suspicious/noExplicitAny: reaches sim internals, as sim suites do
  sim: any,
  level: number,
  pid?: number,
): void {
  sim.setPlayerLevel(level, pid);
  const id = pid ?? sim.player.id;
  const meta = sim.players.get(id);
  if (!meta) throw new Error(`no player meta for ${id}`);
  meta.statAllocation = spreadAllocation(level);
  sim.recalcPlayer(sim.entities.get(id));
}
