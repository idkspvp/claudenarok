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
  /** Return every spent point to the pool. */
  resetStats(): void;
}
