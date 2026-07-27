// The one seam every COMPLETED cast funnels through: instants, finished hard
// casts, and channel starts all report here.
//
// It used to be the talent proc engine's `onCastCompleted`. The proc loops went
// with the talent trees, but two riders were only ever hosted there because it
// is the single funnel, and they outlived the trees: Elemental Convergence's
// school-alternation memory and Phoenix Trance's Cinderfall restoke. Keeping
// the funnel is what stops those two from being pasted at eight call sites.
//
// Draws no rng.
//
// `src/sim`-pure: sibling sim modules + the SimContext seam only.

import type { SimContext } from '../sim_context';
import type { Entity } from '../types';
import { convergenceOnCast } from './convergence';
import { combustionRestokesCinderfall } from './fire_mage';

export function onCastCompleted(
  ctx: SimContext,
  player: Entity,
  abilityId: string,
  _target?: Entity | null,
): void {
  // The one-cast empower flag (set at the consume funnel in empower_next.ts)
  // covers exactly one cast: clear it here so it can never leak onto whatever
  // cast completes next.
  if (player.castConsumedEmpower !== undefined) player.castConsumedEmpower = undefined;
  // Elemental Convergence (mage): school-alternation memory, kept here because
  // every completed cast funnels through this hook. Draws no rng.
  convergenceOnCast(ctx, player, abilityId);
  // Phoenix Trance restokes one Cinderfall charge (designer rule 2026-07-25);
  // same reasoning: the one seam every completed cast passes. Draws no rng.
  combustionRestokesCinderfall(ctx, player, abilityId);
}
