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

/** Fill `e`'s resource bar to the top of its REAL pool.
 *
 *  Exactly what `e.resource = e.maxResource` did, named so the intent is legible
 *  and so there is one place to change if the pools move again. Use this by
 *  default: it leaves maxResource alone, so a case that measures a cost as a
 *  before/after delta still measures the real thing. */
export function fundCasts(e: Entity): void {
  e.resource = e.maxResource;
}

/** Raise the pool ITSELF past every authored ability cost, for a case whose
 *  subject is a mechanic the caster can no longer afford to reach.
 *
 *  Separate from fundCasts on purpose. It writes maxResource, so a later
 *  recalcPlayerStats (a level-up, a gear swap, an aura landing) recomputes the
 *  pool from the job curve and silently undoes it: call it AFTER the last thing
 *  that would recalc, and never in a case that measures cost as a delta, which
 *  would then read the clamp rather than the spend. */
export function raisePool(e: Entity): void {
  if (e.resourceType !== 'mana') return; // rage and energy still cap at 100
  e.maxResource = FUNDED_POOL;
  e.resource = FUNDED_POOL;
}
