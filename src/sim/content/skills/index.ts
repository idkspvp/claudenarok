// The SpiritVale skill content: seven base-class trees and everything they reach.
//
// The public surface of this directory. Nothing outside it should import a
// `*.generated.ts` file directly; the barrel is the seam, and the generated
// files are free to be re-shaped by the generator without touching consumers.
//
// See ./CLAUDE.md for the join, the level convention, and what is deliberately
// out of scope.

export { SPIRITVALE_PASSIVES } from './passives.generated';
export { SPIRITVALE_SKILLS } from './skills.generated';
export { SPIRITVALE_STATUSES } from './statuses.generated';
export { SPIRITVALE_SUMMONS } from './summons.generated';
export { SPIRITVALE_TREES } from './trees.generated';
export type {
  Scaled,
  SkillCastType,
  SkillDef,
  SkillExclusiveGroup,
  SkillNode,
  SkillPassiveDef,
  SkillStatusRider,
  SkillSummonRider,
  SkillTargetType,
  SkillTree,
  StatMod,
  StatusDef,
  SummonDef,
  SummonSkillRef,
} from './types';

import { SPIRITVALE_PASSIVES } from './passives.generated';
import { SPIRITVALE_SKILLS } from './skills.generated';
import { SPIRITVALE_TREES } from './trees.generated';
import type { SkillDef, SkillNode, SkillPassiveDef, SkillTree } from './types';

/**
 * The tree a class buys from, or undefined for a class with none yet.
 *
 * Keyed by the repo's own class id (`swordman`), not the reference's archetype
 * name (`Warrior`), because that is what every caller already holds.
 */
export function treeFor(classId: string): SkillTree | undefined {
  return SPIRITVALE_TREES[classId];
}

/** Every node in a class's tree, in grid order (top-left to bottom-right). */
export function nodesFor(classId: string): readonly SkillNode[] {
  return SPIRITVALE_TREES[classId]?.nodes ?? [];
}

/**
 * The active or passive record behind a node.
 *
 * A node names exactly one of the two tables and never both, so a caller that
 * has a `SkillNode` can resolve it without re-checking `isPassive`.
 */
export function recordFor(node: SkillNode): SkillDef | SkillPassiveDef | undefined {
  return node.isPassive ? SPIRITVALE_PASSIVES[node.id] : SPIRITVALE_SKILLS[node.id];
}

/** How far a skill may be bought up, or 0 when the id is unknown. */
export function maxLevelOf(id: string): number {
  return SPIRITVALE_SKILLS[id]?.maxLevel ?? SPIRITVALE_PASSIVES[id]?.maxLevel ?? 0;
}
