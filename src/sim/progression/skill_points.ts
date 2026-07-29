// The skill-point budget: which pool pays for which tree.
//
// The reference runs TWO pools, not one shared budget, and the evidence is its
// own two refusal messages: "No skill points left" and "No advanced skill points
// left" are distinct strings, which they would not be if one balance served both
// trees. Base points buy base-tree skills; advanced points buy advanced-tree
// skills. (docs/design/spiritvale-engine-formulas.md, "Skill points, from job
// level".)
//
// A SECOND community wiki says advanced points spend freely on either tree. The
// two sources disagree. This implements the simulator's rule, because the
// simulator is the one built against the data, and the disagreement is recorded
// here rather than resolved by preference. If it is ever settled the other way,
// this is the ONE function that changes.
//
// The refusal comes back as a REASON CODE, never a sentence. The sim is
// language-agnostic; whichever surface asks the question renders the answer.
//
// A pure leaf: a progress record in, a progress record out. No Sim, no rng.

import type { JobProgress } from './job_level';

/** Which tree a skill belongs to. Authored on the skill, not derived. */
export type SkillTier = 'base' | 'advanced';

/** Why a spend was refused. `null` from `refuseReason` means it is legal. */
export type SkillPointRefusal = 'noBasePoints' | 'noAdvancedPoints' | 'invalidCost';

/** The balance that pays for `tier`. The pools never cross. */
export function skillPointBalance(progress: JobProgress, tier: SkillTier): number {
  return tier === 'advanced'
    ? Math.max(0, Math.floor(progress.advancedSkillPoints))
    : Math.max(0, Math.floor(progress.skillPoints));
}

/** Why spending `cost` on a `tier` skill would be refused, or null when it is
 *  affordable. Separated from the spend so a UI can grey a row out and say why
 *  without attempting the purchase. */
export function refuseReason(
  progress: JobProgress,
  tier: SkillTier,
  cost: number,
): SkillPointRefusal | null {
  if (!Number.isFinite(cost) || Math.floor(cost) < 1) return 'invalidCost';
  if (skillPointBalance(progress, tier) >= Math.floor(cost)) return null;
  return tier === 'advanced' ? 'noAdvancedPoints' : 'noBasePoints';
}

/** Whether `cost` points can be spent on a skill in `tier`. */
export function canSpendSkillPoints(progress: JobProgress, tier: SkillTier, cost: number): boolean {
  return refuseReason(progress, tier, cost) === null;
}

/** Spend `cost` points from the pool that owns `tier`, or null when refused.
 *
 *  Returns a NEW record; callers assign it rather than mutating, so a refused
 *  spend cannot half-apply. A base-tier skill NEVER draws on the advanced pool,
 *  which is the rule the whole module exists to hold: a character sitting on 70
 *  advanced points cannot use one of them to finish its base tree. */
export function spendSkillPoints(
  progress: JobProgress,
  tier: SkillTier,
  cost: number,
): JobProgress | null {
  if (refuseReason(progress, tier, cost) !== null) return null;
  const spend = Math.floor(cost);
  return tier === 'advanced'
    ? { ...progress, advancedSkillPoints: progress.advancedSkillPoints - spend }
    : { ...progress, skillPoints: progress.skillPoints - spend };
}
