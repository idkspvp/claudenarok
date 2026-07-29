import type { StatAllocation, StatusStat } from '../sim/types';

export interface IWorldStatusPoints {
  // The six status attributes. State is server-authoritative: the client reads
  // the allocation and the derived pool, and asks for a spend that the server
  // re-validates against the same budget rules (src/sim/status_points.ts).
  statAllocation: StatAllocation;
  /** Points left to place at this level. Derived, never stored. */
  statusPoints(): number;
  /** Cost of the next point in this attribute, or null when it cannot be bought. */
  statRaiseCost(stat: StatusStat): number | null;
  /** Spend one point. A rejected spend changes nothing. */
  raiseStat(stat: StatusStat): void;
  /** What lowering this attribute by one gives back, or null when it sits at
   *  the class opening block and cannot be lowered. */
  statLowerRefund(stat: StatusStat): number | null;
  /** Give one point back. Free and unlimited, and it stops at the class opening
   *  block: those 27 points were never the player's to move. */
  lowerStat(stat: StatusStat): void;
  /** Return every EARNED point to the pool, leaving the class opening block. */
  resetStats(): void;
}
