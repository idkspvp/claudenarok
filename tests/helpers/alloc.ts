// A status-point allocation for tests that need a character with real
// attributes rather than the class opening block a fresh character carries.
//
// This is deliberately TEST-ONLY. The game spends none of a character's EARNED
// points for them (the player decides), so there is no production equivalent to
// import; a suite that wants a level-50 body with numbers on it has to say so
// itself.
//
// It spends the level's whole earned budget round-robin across the six, which is
// not a build anyone would choose and is not meant to be. Tests that care about
// a SPECIFIC attribute should pass their own allocation instead.
//
// Pass a CLASS wherever the other side of the comparison goes through
// sanitizeStatAllocation: that path repairs anything below the class opening
// block upward, so a blank-seeded spread would disagree with it on the class's
// own lead attributes and on nothing else, which is a maddening way to find out.

import { openingAllocation } from '../../src/sim/progression/class_blocks';
import type { PlayerClass } from '../../src/sim/types';
import {
  BASE_STAT,
  MAX_STAT,
  STATUS_STATS,
  type StatAllocation,
  type StatusStat,
  statRaiseCost,
  totalStatusPointsAt,
} from '../../src/sim/types';

/** An even spread of everything a character at `level` has EARNED, on top of
 *  its class opening block when a class is given. */
export function spreadAllocation(level: number, cls?: PlayerClass): StatAllocation {
  const alloc: StatAllocation = cls
    ? openingAllocation(cls)
    : { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
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
  meta.statAllocation = spreadAllocation(level, meta.cls);
  sim.recalcPlayer(sim.entities.get(id));
}

/** The attributes each first job's own players actually buy.
 *
 *  `spreadAllocation` gives every stat the same value, which makes a Mage and a
 *  Thief identical bodies. That is fine for a suite measuring one formula and
 *  useless for one asking whether a caster out-casts a rogue: with an even
 *  spread the answer is no, because nothing about the CLASS decides attributes
 *  any more. The player's spending does, and a suite that wants a class-shaped
 *  character has to spend like one.
 *
 *  Test-only, like everything else here. Deliberately NOT a revived
 *  `stat_preset`: the game must never spend a player's points for them, and this
 *  exists so tests can say what kind of build they mean, not so the game can. */
const CLASS_PRIORITY: Readonly<Record<PlayerClass, readonly StatusStat[]>> = {
  swordman: ['str', 'vit'],
  knight: ['vit', 'str'],
  summoner: ['int', 'vit'],
  thief: ['agi', 'str'],
  archer: ['dex', 'agi'],
  acolyte: ['int', 'vit'],
  mage: ['int', 'dex'],
};

/** Spend the level's whole budget into the job's primary attributes, in order,
 *  so a Mage reads as a caster and a Thief does not. */
export function classAllocation(cls: PlayerClass, level: number): StatAllocation {
  const alloc: StatAllocation = openingAllocation(cls);
  const priority = CLASS_PRIORITY[cls];
  let budget = totalStatusPointsAt(level);
  let progress = true;
  while (budget > 0 && progress) {
    progress = false;
    for (const stat of priority) {
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

/** `levelWithStats`, but spending like the job would. */
export function levelWithClassStats(
  // biome-ignore lint/suspicious/noExplicitAny: reaches sim internals, as sim suites do
  sim: any,
  cls: PlayerClass,
  level: number,
  pid?: number,
): void {
  sim.setPlayerLevel(level, pid);
  const id = pid ?? sim.player.id;
  const meta = sim.players.get(id);
  if (!meta) throw new Error(`no player meta for ${id}`);
  meta.statAllocation = classAllocation(cls, level);
  sim.recalcPlayer(sim.entities.get(id));
}
