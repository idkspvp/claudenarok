// The SpiritVale skill schema: what a generated skill, status, passive and
// summon record looks like.
//
// This is hand-written and reviewed; the RECORDS are generated
// (`npm run skills:content`, scripts/spiritvale/build_skills.mjs) from
// docs/design/data/spiritvale-raw/. Editing a generated file by hand is a
// mistake the freshness test will catch.
//
// WHY THIS IS NOT AN EXTENSION OF `AbilityDef`. The existing ability model
// scales on CHARACTER level: `learnLevel` gates the ability and `ranks[]` swaps
// its numbers as the character levels. SpiritVale scales on SKILL level: the
// player buys a skill up from 1 to its `maxLevel` with skill points, and every
// number is a `{base, per}` pair read at that level. Those are different axes,
// not different amounts of the same axis, so the two shapes coexist during the
// conversion rather than one pretending to be the other.
//
// One vocabulary runs through all of it: `{stat, base, per, q}`. The raw data
// spells that field three different ways depending on the record (`values` on a
// passive, `mods` on a status, `stats` on a summon) for what is byte-identically
// the same shape, so the generator normalizes all three onto `StatMod` here.

import type { Scaled } from '../../skills/scaling';

export type { Scaled };

/**
 * One stat line. `q` is an optional QUALIFIER naming what the line applies to:
 * a weapon type ("Axe"), an element ("Fire"), or another skill ("HolyLight").
 * Empty means it applies unconditionally.
 */
export interface StatMod {
  stat: string;
  base: number;
  per: number;
  q?: string;
}

/**
 * How a skill is AIMED. Orthogonal to `targetType`, which decides who it may
 * affect. Derived from the data rather than published: the 8x4 cross-tab of the
 * two leaves both forbidden cells empty (a Self skill is never given an aim mode
 * that requires picking something, 70 times out of 70).
 */
export type SkillCastType =
  /** No aim. Cast at the caster's own position; `area` decides the footprint. */
  | 'none'
  /** Aimed at one unit. Projectiles live here and fly to the chosen unit. */
  | 'unit'
  /** Aimed at a world point. */
  | 'ground'
  /** A maintained state. Zero cast time, zero duration, zero cooldown, on all 37. */
  | 'toggle';

/**
 * WHO a skill may affect. Orthogonal to `castType`.
 *
 * `summon`, `summonOther` and `grave` are declared for completeness but no base
 * class uses them; they arrive with the advanced classes.
 */
export type SkillTargetType =
  | 'enemy'
  /** An ally, INCLUDING the caster. */
  | 'ally'
  /** An ally, excluding the caster. Only the two-party bond skills. */
  | 'allyOther'
  | 'self'
  /** No allegiance filter: the skill branches on what was clicked. */
  | 'any'
  | 'summon'
  | 'summonOther'
  | 'grave';

/**
 * A mutual-exclusion group. Activating one member cancels any active sibling.
 * `none` is by far the common case.
 */
export type SkillExclusiveGroup =
  | 'none'
  /** The weapon-element enchant slot. */
  | 'weaponEnchant'
  /** Stances and avatar states. */
  | 'stance'
  /** Shouts and radiated auras. */
  | 'aura'
  /** The summon slot: one pet at a time. */
  | 'summon'
  /** Weapon coatings. */
  | 'coating';

/** A status this skill applies, and for how long / how often / how many stacks. */
export interface SkillStatusRider {
  id: string;
  duration: Scaled;
  /** A fraction, not a percent. Absent means guaranteed. */
  chance?: Scaled;
  stacks?: Scaled;
}

/** What a skill summons. `exclusive` means one pet at a time. */
export interface SkillSummonRider {
  ref: string;
  count: Scaled;
  exclusive: boolean;
}

/**
 * One active skill.
 *
 * Every `Scaled` field is OPTIONAL and omitted when the source publishes
 * `{0, 0}`, so a generated record shows only what the skill actually does. Read
 * an absent field as zero.
 */
export interface SkillDef {
  /** The engine id, e.g. `Bash`. What every other record references. */
  id: string;
  /** The display slug, e.g. `bash`. Diverges from the id more often than not. */
  slug: string;
  name: string;
  description: string;
  /** How far the player may buy this skill up. */
  maxLevel: number;
  /** Which base classes place this skill. A few are shared by two or three. */
  classes: readonly string[];
  castType: SkillCastType;
  targetType: SkillTargetType;
  exclusiveGroup?: SkillExclusiveGroup;
  element: string;
  damageType: string;

  /**
   * Damage as a MULTIPLIER of the caster's attack (1 = 100%), not a flat amount.
   * NEGATIVE MEANS HEALING: SpiritVale has no separate heal field, so Heal is
   * `{-0.25, -0.25}`. Never clamp this at zero.
   */
  damage?: Scaled;
  /** Damage packets per cast. Absent means the default single packet. */
  hits?: Scaled;
  castTime?: Scaled;
  cooldown?: Scaled;
  cost?: Scaled;
  /** Radius. Zero on every self-targeted skill. */
  area?: Scaled;
  duration?: Scaled;
  /** Projectile speed. Only the two Mage bolts that travel. */
  velocity?: Scaled;
  threat?: Scaled;
  comboReady?: Scaled;
  comboFinisher?: Scaled;

  /** Scales off ATK and MATK together. */
  hybrid?: boolean;
  ignoreBlock?: boolean;
  triggerMultistrike?: boolean;
  cloneCast?: boolean;
  /** The effect follows the caster instead of staying where it landed. */
  attached?: boolean;
  /** Weighting when cast by an autocast proc rather than by the player. */
  autocastMultiplier?: number;
  /** Weapon types this skill requires. Empty means any. */
  weaponTypes?: readonly string[];

  /** Statuses applied to the RESOLVED target. For a self-targeted skill that IS
   *  the caster, which is why most self buffs live here and not below. */
  statuses?: readonly SkillStatusRider[];
  /** Statuses applied to the caster by a skill aimed at someone else. */
  selfStatuses?: readonly SkillStatusRider[];
  summon?: SkillSummonRider;
}

/** One passive skill: no cast, just stat lines that grow with its level. */
export interface SkillPassiveDef {
  id: string;
  slug: string;
  name: string;
  description: string;
  maxLevel: number;
  classes: readonly string[];
  values: readonly StatMod[];
  /** The source's own human-readable rendering of `values`. Kept because it is
   *  the only published statement of what a passive DOES, and it is the check on
   *  whether the stat vocabulary was read correctly. */
  effects: readonly string[];
}

/** A status a skill can apply. */
export interface StatusDef {
  id: string;
  name: string;
  description: string;
  element: string;
  /** Flat damage per tick, and damage as a fraction of max HP per tick. */
  damage: number;
  damagePercent: number;
  /** Seconds between ticks. Zero means it does not tick. */
  tick: number;
  isDot: boolean;
  stackable: boolean;
  /** Zero means uncapped. */
  maxStacks: number;
  /** A refreshed stack resets the whole duration. */
  stacksRefresh: boolean;
  category: number;
  /** On a STACKABLE status `base` is the per-stack amount; on a scaling one it
   *  is the flat part and `per` the per-level step. */
  mods: readonly StatMod[];
  /** Statuses this status applies in turn. */
  procs?: readonly SkillStatusRider[];
  /** The source's own rendering of `mods`. */
  effect: string;
}

/** One skill a summon knows. */
export interface SummonSkillRef {
  id: string;
  level: number;
  chance: number;
  castTime: number;
  cooldown: number;
  targetStatus?: string;
  castType: SkillCastType;
}

/**
 * A summoned pet. Its combat numbers are derived entirely from the six
 * attributes: the source publishes no HP, MP or ATK field for a summon.
 */
export interface SummonDef {
  id: string;
  name: string;
  hostile: boolean;
  /** Always the six, in order. `base` is the level-1 value, `per` the growth. */
  stats: readonly StatMod[];
  skills: readonly SummonSkillRef[];
}

/** One placed node in a class's tree. */
export interface SkillNode {
  /** The engine id, resolving in `SKILLS` or `SKILL_PASSIVES`. */
  id: string;
  isPassive: boolean;
  /** 1-based, as published. */
  row: number;
  col: number;
  /** Every one must be at the given level before this node may be bought. */
  requires: readonly { id: string; level: number }[];
}

/** One class's whole tree, laid out on the published grid. */
export interface SkillTree {
  /** The repo's own class id, e.g. `swordman`. */
  classId: string;
  /** The reference's name for the same class, e.g. `Warrior`. */
  archetype: string;
  maxJobLevel: number;
  rows: number;
  cols: number;
  nodes: readonly SkillNode[];
}
