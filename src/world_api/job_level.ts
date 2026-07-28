import type { JobProgress } from '../sim/progression/job_level';

export interface IWorldJobLevel {
  // The second progression track. Base level buys status points and the pools;
  // job level buys SKILL points, one per level, and nothing else
  // (src/sim/progression/job_level.ts). Read-only from here: the client shows
  // the bar and the unspent count, and spending a point is a separate command
  // that the server re-validates.
  jobProgress(): JobProgress;
  /** Job experience the next job level costs, or null at the cap. */
  jobXpToNext(): number | null;
}
