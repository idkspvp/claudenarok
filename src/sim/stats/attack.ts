// Attack power and magic attack power.
//
// Transcribed from docs/design/spiritvale-engine-formulas.md (Formula$$GetAttack,
// Formula$$MagicAttack, Formula$$GetStatusDamage). Every constant here is read
// from that file; none is invented.
//
//   ATK melee   ( Lv/4 + STR*1.5 + DEX/5 + LUK/5 + ATKflat*(1 + DEX/200) )
//               * (1 + FLOOR(STR/10)/100) * (1 + ATK%)
//   ATK ranged  ( Lv/4 + DEX + STR/5 + LUK/5 + ATKflat*(1 + DEX/200) )
//               * (1 + FLOOR(DEX/10)/100) * (1 + ATK%)
//   MATK        ( Lv/4 + INT*1.5 + DEX/5 + LUK/5 + MatkPerStr*STR
//                 + MATKflat*(1 + INT/200) )
//               * (1 + FLOOR(INT/10)/100) * (1 + MATK%)
//
// Three shapes, one skeleton: a lead attribute at 1.5 (or 1.0 on the ranged
// branch, where Dexterity leads), two supports at a fifth each, a flat weapon
// term amplified by a secondary attribute, then a per-ten breakpoint worth ONE
// PERCENT and a percentage bonus.
//
// The breakpoint is the whole character of this model and the reason it plays
// flatter than the reference it replaces. Ragnarok SQUARES the per-ten term, so
// at 99 Strength the square alone adds 81 on top of the 99 and the last ten
// points are worth more than the first fifty. Here the same breakpoint reaches
// 1.09x across the entire range, which is what makes spreading points
// reasonable instead of pouring everything into one attribute.
//
// Pure leaf: takes resolved numbers, no Entity, no rng.

/** The six attributes, as the attack formulas read them. */
export interface AttackAttributes {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
}

export interface AttackInput {
  level: number;
  attributes: AttackAttributes;
  /** Weapon attack plus mastery plus flat gear attack. */
  flatAtk?: number;
  /** Additive percentage bonuses, as a fraction: 0.15 is +15%. */
  atkPercent?: number;
  /**
   * A two-handed weapon in an empty off-hand multiplies by
   * TWO_HANDED_STANCE_BONUS. The caller decides whether the stance applies; this
   * module does not inspect equipment.
   */
  twoHandedStance?: boolean;
}

export interface MagicAttackInput extends AttackInput {
  /** Flat magic attack from the weapon and gear. */
  flatMatk?: number;
  /** The MatkPerStr stat: every mace grants 1, which is how Strength gets magic. */
  matkPerStr?: number;
  /** Additive percentage bonuses, as a fraction. */
  matkPercent?: number;
}

/** Formula$$GetAttack / Formula$$MagicAttack: the per-ten breakpoint is 1%. */
export const BREAKPOINT_PER_TEN = 0.01;
/** The flat-attack amplifier divisor: ATKflat * (1 + DEX/200). */
export const FLAT_AMPLIFIER_DIVISOR = 200;
/** TwohandedStanceBonus. */
export const TWO_HANDED_STANCE_BONUS = 1.25;
/** The level term: every attack formula carries Lv/4. */
export const LEVEL_DIVISOR = 4;
/** The lead attribute's weight on the melee and magic branches. */
export const LEAD_ATTRIBUTE_WEIGHT = 1.5;
/** The two support attributes' weight: a fifth each. */
export const SUPPORT_ATTRIBUTE_DIVISOR = 5;

/** `1 + FLOOR(value / 10) / 100`, the per-ten breakpoint multiplier. */
export function breakpointMultiplier(value: number): number {
  return 1 + Math.floor(Math.max(0, value) / 10) * BREAKPOINT_PER_TEN;
}

/** `1 + secondary / 200`, the amplifier the flat weapon term rides. */
export function flatAmplifier(secondary: number): number {
  return 1 + Math.max(0, secondary) / FLAT_AMPLIFIER_DIVISOR;
}

function stance(twoHanded: boolean | undefined): number {
  return twoHanded ? TWO_HANDED_STANCE_BONUS : 1;
}

/** Melee attack power. Strength leads and drives the breakpoint. */
export function meleeAttack(input: AttackInput): number {
  const { level, attributes: a } = input;
  const base =
    level / LEVEL_DIVISOR +
    a.str * LEAD_ATTRIBUTE_WEIGHT +
    a.dex / SUPPORT_ATTRIBUTE_DIVISOR +
    a.luk / SUPPORT_ATTRIBUTE_DIVISOR +
    (input.flatAtk ?? 0) * flatAmplifier(a.dex);
  return (
    base *
    breakpointMultiplier(a.str) *
    (1 + (input.atkPercent ?? 0)) *
    stance(input.twoHandedStance)
  );
}

/**
 * Ranged attack power: Dexterity leads at weight 1 and drives the breakpoint,
 * Strength drops to a support fifth. Selected for Bow, Pistol, Rifle, Shotgun,
 * Gatling and Launcher; the caller decides which branch to call.
 */
export function rangedAttack(input: AttackInput): number {
  const { level, attributes: a } = input;
  const base =
    level / LEVEL_DIVISOR +
    a.dex +
    a.str / SUPPORT_ATTRIBUTE_DIVISOR +
    a.luk / SUPPORT_ATTRIBUTE_DIVISOR +
    (input.flatAtk ?? 0) * flatAmplifier(a.dex);
  return (
    base *
    breakpointMultiplier(a.dex) *
    (1 + (input.atkPercent ?? 0)) *
    stance(input.twoHandedStance)
  );
}

/** Magic attack power. Intelligence leads, drives the breakpoint, and amplifies the flat term. */
export function magicAttack(input: MagicAttackInput): number {
  const { level, attributes: a } = input;
  const base =
    level / LEVEL_DIVISOR +
    a.int * LEAD_ATTRIBUTE_WEIGHT +
    a.dex / SUPPORT_ATTRIBUTE_DIVISOR +
    a.luk / SUPPORT_ATTRIBUTE_DIVISOR +
    (input.matkPerStr ?? 0) * a.str +
    (input.flatMatk ?? 0) * flatAmplifier(a.int);
  return (
    base *
    breakpointMultiplier(a.int) *
    (1 + (input.matkPercent ?? 0)) *
    stance(input.twoHandedStance)
  );
}

/**
 * The damage-over-time coefficient, per tick: `(Lv + STR + AGI + INT) / 10`,
 * optionally multiplied by the stack count.
 *
 * Note the shape is unlike the three above: no breakpoint, no percentage, and
 * three attributes summed at full weight rather than one leading.
 */
export const STATUS_DAMAGE_DIVISOR = 10;

export function statusDamagePerTick(
  level: number,
  attributes: AttackAttributes,
  stacks = 1,
): number {
  const sum = level + attributes.str + attributes.agi + attributes.int;
  return (sum / STATUS_DAMAGE_DIVISOR) * Math.max(1, stacks);
}
