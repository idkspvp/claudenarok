// Funding a test character's SP pool.
//
// D1 put the HP and SP pools on Ragnarok's real per-job curves (src/sim/job_vitals.ts).
// Those pools are an order of magnitude smaller than the ones they replaced: a
// level-20 Mage carries 130 SP where it used to carry 1,228. The ability COST
// table is still on the old scale, so a caster runs dry almost immediately, and
// re-costing the kit is D4 (skill re-home), not this change.
//
// That leaves two kinds of test. One is about the pool itself and must read the
// real number. The other is about a MECHANIC that merely needs a cast to go off,
// where the pool is incidental and a cost-vs-pool failure says nothing about the
// behaviour under test. This helper is for the second kind: it says, in one
// place, "the pool is not what this case is measuring".
//
// Delete this helper when D4 re-costs the abilities: at that point the real pool
// funds the real kit and every call site should simply go away.

import type { Entity } from '../../src/sim/types';

/** Enough SP that no authored ability cost can be the reason a cast fails.
 *  Deliberately far above any real pool so the number never reads as a balance
 *  claim. */
const FUNDED_POOL = 10_000;

/** Fill `e`'s resource bar past every authored ability cost.
 *
 *  Writes maxResource as well as resource, because the pool itself is now
 *  smaller than a single spell. A later recalcPlayerStats (a level-up, a gear
 *  swap, an aura landing) recomputes both from the job curve and undoes this, so
 *  call it AFTER the last thing that would recalc, exactly as the existing
 *  `e.resource = e.maxResource` lines in these suites do. */
export function fundCasts(e: Entity): void {
  if (e.resourceType !== 'mana') return; // rage and energy still cap at 100
  e.maxResource = FUNDED_POOL;
  e.resource = FUNDED_POOL;
}
