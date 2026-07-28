// Staying alive: healing, siphon, leech and reflect.
//
// Transcribed from docs/design/spiritvale-engine-formulas.md
// (Formula$$GetHealing, Formula$$SiphonMult, Formula$$SiphonMpMult,
// CombatComponent$$ApplyLeech, Formula$$GetReflectDamage,
// Formula$$StatusResist). Every constant is read from that file.
//
//   Healing   (Lv + INT + VIT) * 2.5 * Healing%
//   Siphon    HP: Siphon * (Lv + VIT) / 50   ·   MP: Siphon * (Lv + INT) / 50
//   Leech     HP/hit = round( damage * HPLeech/100 * 0.2 * (1 + HealingReceived/100) )
//             MP/hit = round( damage * ManaLeech/100 * 0.02 )
//             the reserve pays out at most 20% of Max HP per second
//   Reflect   (Lv + DEF/2 + flatDEF/2 + ATK/2) * 4 * Reflect%
//   Resist    attribute * 0.66% per point, cutting both chance and duration
//
// Leech is the one worth reading twice. It is not "steal this share of the hit":
// it banks into a reserve that heals over time, converts only a FIFTH of the
// stat's face value, and the reserve pays out at most a fifth of max health per
// second. Past a certain attack speed that per-second ceiling, not the per-hit
// amount, is the real cap. Only Melee, Magic and Ranged hits that connect steal;
// Status and True damage never do, a miss banks nothing, a blocked hit still
// banks, and at most three targets per attack contribute.
//
// Vitality helping a healer is the other surprise: healing sums level,
// Intelligence AND Vitality, so a healer's survivability stat is also an output
// stat.
//
// Pure leaf: resolved numbers in, no Entity, no rng.

/** Healing multiplies the summed attributes by this. */
export const HEALING_COEFFICIENT = 2.5;
/** Both siphons divide by this. */
export const SIPHON_DIVISOR = 50;
/** In PvP the siphon level term is pinned here, so siphon is level-normalised. */
export const SIPHON_PVP_LEVEL = 100;
/** Health leech converts a fifth of the stat's face value. */
export const HP_LEECH_CONVERSION = 0.2;
/** Mana leech converts a fiftieth. */
export const MP_LEECH_CONVERSION = 0.02;
/** The reserve pays out at most this share of max health per second. */
export const LEECH_PAYOUT_CAP_FRACTION = 0.2;
/** At most this many targets per attack contribute to the reserve. */
export const LEECH_MAX_CONTRIBUTING_TARGETS = 3;
/** Reflect multiplies its summed term by this. */
export const REFLECT_COEFFICIENT = 4;
/** Each point of the mapped attribute is worth this much status resistance. */
export const STATUS_RESIST_PER_POINT = 0.66;
/** Status resistance is a percentage and stops here. */
export const STATUS_RESIST_CAP = 100;

/** The damage types that can steal. Status and True damage never do. */
export const LEECHABLE_DAMAGE_TYPES = ['Melee', 'Magic', 'Ranged'] as const;
export type LeechableDamageType = (typeof LEECHABLE_DAMAGE_TYPES)[number];

/** Healing output. Vitality contributes, so a healer's bulk stat is also output. */
export function healingOutput(input: {
  level: number;
  int: number;
  vit: number;
  /** Additive percentage, as a fraction. */
  healingPercent?: number;
}): number {
  return (
    (input.level + input.int + input.vit) * HEALING_COEFFICIENT * (1 + (input.healingPercent ?? 0))
  );
}

/**
 * Health restored per landed attack by the Siphon HP stat.
 *
 * `pvp` pins the level term to 100 so a level-150 attacker does not out-siphon a
 * level-40 one; that pin is in the engine, not a balance choice made here.
 */
export function siphonHealth(input: {
  siphonHp: number;
  level: number;
  vit: number;
  pvp?: boolean;
}): number {
  const level = input.pvp ? SIPHON_PVP_LEVEL : input.level;
  return (input.siphonHp * (level + input.vit)) / SIPHON_DIVISOR;
}

/** The mana twin: Intelligence in place of Vitality, same shape and same pin. */
export function siphonMana(input: {
  siphonMp: number;
  level: number;
  int: number;
  pvp?: boolean;
}): number {
  const level = input.pvp ? SIPHON_PVP_LEVEL : input.level;
  return (input.siphonMp * (level + input.int)) / SIPHON_DIVISOR;
}

/** Whether a hit of this damage type can bank into the leech reserve. */
export function isLeechable(damageType: string): damageType is LeechableDamageType {
  return (LEECHABLE_DAMAGE_TYPES as readonly string[]).includes(damageType);
}

/**
 * Health BANKED into the reserve by one landed hit. Not healing applied: the
 * reserve pays out over time, bounded by `leechPayoutCapPerSecond`.
 */
export function leechHealthBanked(input: {
  damage: number;
  hpLeech: number;
  /** The HealingReceived stat as a percentage, e.g. 25 for +25%. */
  healingReceivedPercent?: number;
}): number {
  return Math.round(
    Math.max(0, input.damage) *
      (input.hpLeech / 100) *
      HP_LEECH_CONVERSION *
      (1 + (input.healingReceivedPercent ?? 0) / 100),
  );
}

/** Mana banked by one landed hit. No HealingReceived arm on this side. */
export function leechManaBanked(input: { damage: number; manaLeech: number }): number {
  return Math.round(Math.max(0, input.damage) * (input.manaLeech / 100) * MP_LEECH_CONVERSION);
}

/**
 * The ceiling on what the reserve can actually pay out per second. Past a
 * certain attack speed this, not the per-hit amount, is what bounds leech.
 */
export function leechPayoutCapPerSecond(maxHp: number): number {
  return Math.max(0, maxHp) * LEECH_PAYOUT_CAP_FRACTION;
}

/** Damage reflected back at an attacker. */
export function reflectDamage(input: {
  level: number;
  def: number;
  flatDef: number;
  atk: number;
  /** The ReflectDamage stat as a fraction. */
  reflectPercent: number;
}): number {
  const summed = input.level + input.def / 2 + input.flatDef / 2 + input.atk / 2;
  return summed * REFLECT_COEFFICIENT * input.reflectPercent;
}

/**
 * Status resistance as a percentage, capped at 100. It cuts BOTH the chance a
 * status lands and how long it lasts.
 *
 * Which attribute maps to which status is content, not math, so the caller
 * resolves it and passes the value: Strength resists bleed and stagger, Agility
 * slow and freeze, Vitality stun and decay, Intelligence silence and burn,
 * Dexterity poison and blind, Luck curse and weaken.
 */
export function statusResistPercent(input: {
  mappedAttribute: number;
  /** The StatusResist stat, in points. Gear grants 50 per "immunity" line. */
  statusResistStat?: number;
}): number {
  const raw =
    Math.max(0, input.mappedAttribute) * STATUS_RESIST_PER_POINT + (input.statusResistStat ?? 0);
  return Math.min(STATUS_RESIST_CAP, Math.max(0, raw));
}
