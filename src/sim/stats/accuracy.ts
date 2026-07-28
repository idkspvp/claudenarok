// Landing a hit, dodging one, and critting.
//
// Transcribed from docs/design/spiritvale-engine-formulas.md (Formula$$Hit,
// Formula$$Flee, Formula$$PerfectDodge, Formula$$CriticalChance,
// Formula$$CriticalDamage, Formula$$CriticalDefence). Every constant is read
// from that file.
//
//   Hit            round( (Lv + 2*DEX + LUK/5 + flatHit + 25) * (1 + Hit%) )
//   Flee           ( Lv + FLOOR(AGI/2) + flatFlee ) * (1 + Flee%)
//                  -10% per attacker beyond the FOURTH
//   Perfect dodge  clamp(0, 100, PerfectDodge)        a plain stat, not derived
//   Crit rate      ( FLOOR(LUK/3) + FLOOR(LUK/10) + flatCrit ) * (1 + Crit%)
//   Crit damage    120 + FLOOR(LUK/5) + CritDamage%
//   Crit defence   FLOOR(LUK/5) + CritDef
//
// Three things here differ from the model this replaces and are easy to get
// backwards, so each has its own test:
//
//   - Dexterity is worth TWO Hit per point, and everyone starts from a flat +25.
//   - Agility is worth HALF a Flee per point, so evasion is far harder to stack
//     than accuracy. The reference gives a full point of each.
//   - Criticals MULTIPLY damage here (120% and up). Pre-renewal's critical does
//     not multiply at all; it takes the top of the weapon range and ignores
//     defence. Two different designs, and this file implements the multiplying
//     one.
//
// Crit rate is UNCAPPED by design. What bounds it is the defender's crit
// defence, so the arms race resolves between two characters rather than against
// a ceiling.
//
// Pure leaf: resolved numbers in, no Entity, no rng. Deciding whether a roll
// lands is the caller's job; this module only says how likely it is.

/** Formula$$Hit: everyone starts from this, before any attribute. */
export const BASE_HIT = 25;
/** Dexterity is worth two Hit per point. */
export const HIT_PER_DEX = 2;
/** Luck contributes a fifth of a point to Hit, and a fifth to crit defence. */
export const LUK_HIT_DIVISOR = 5;
/** Agility is worth half a Flee per point, floored. */
export const FLEE_AGI_DIVISOR = 2;
/** The crowd penalty starts at the FIFTH attacker, not the third. */
export const FLEE_PENALTY_FREE_ATTACKERS = 4;
/** Each attacker past the free count removes a tenth of Flee. */
export const FLEE_PENALTY_PER_ATTACKER = 0.1;
/** Formula$$CriticalDamage: a critical starts at 120% of the hit. */
export const BASE_CRIT_DAMAGE_PERCENT = 120;
/** Luck's two crit-rate divisors, summed: FLOOR(LUK/3) + FLOOR(LUK/10). */
export const CRIT_LUK_MAJOR_DIVISOR = 3;
export const CRIT_LUK_MINOR_DIVISOR = 10;
/** Luck's divisor for crit damage and crit defence alike. */
export const CRIT_DAMAGE_LUK_DIVISOR = 5;

/**
 * Accuracy. Rounded, because the engine rounds: two characters a fraction apart
 * must land on the same integer.
 */
export function hit(input: {
  level: number;
  dex: number;
  luk: number;
  flatHit?: number;
  hitPercent?: number;
}): number {
  const raw =
    input.level +
    HIT_PER_DEX * input.dex +
    input.luk / LUK_HIT_DIVISOR +
    (input.flatHit ?? 0) +
    BASE_HIT;
  return Math.round(raw * (1 + (input.hitPercent ?? 0)));
}

/**
 * The multiplier a defender's Flee keeps once `attackerCount` enemies are on
 * it. Full value through the fourth attacker, then a tenth off each, floored at
 * zero so a mob pile never inverts into bonus evasion.
 */
export function fleeCrowdMultiplier(attackerCount: number): number {
  const excess = Math.max(0, Math.floor(attackerCount) - FLEE_PENALTY_FREE_ATTACKERS);
  return Math.max(0, 1 - excess * FLEE_PENALTY_PER_ATTACKER);
}

/**
 * Evasion. Agility enters floored and halved, which is what makes stacking it
 * much weaker here than in the model this replaces.
 */
export function flee(input: {
  level: number;
  agi: number;
  flatFlee?: number;
  fleePercent?: number;
  attackerCount?: number;
}): number {
  const raw = input.level + Math.floor(input.agi / FLEE_AGI_DIVISOR) + (input.flatFlee ?? 0);
  return raw * (1 + (input.fleePercent ?? 0)) * fleeCrowdMultiplier(input.attackerCount ?? 1);
}

/**
 * Perfect dodge, as a percentage in [0, 100].
 *
 * A plain stat here, NOT derived from Luck. The model this replaces computes it
 * as (1 + LUK/10)%, so a character converted across will lose it unless the
 * stat is granted by gear.
 */
export function perfectDodge(perfectDodgeStat: number): number {
  return Math.min(100, Math.max(0, perfectDodgeStat));
}

/** Critical rate, as a percentage. Uncapped: crit defence is what bounds it. */
export function critRate(input: { luk: number; flatCrit?: number; critPercent?: number }): number {
  const luk = Math.max(0, input.luk);
  const raw =
    Math.floor(luk / CRIT_LUK_MAJOR_DIVISOR) +
    Math.floor(luk / CRIT_LUK_MINOR_DIVISOR) +
    (input.flatCrit ?? 0);
  return raw * (1 + (input.critPercent ?? 0));
}

/** Critical defence, as a percentage subtracted from an attacker's crit rate. */
export function critDefence(input: { luk: number; critDefStat?: number }): number {
  return Math.floor(Math.max(0, input.luk) / CRIT_DAMAGE_LUK_DIVISOR) + (input.critDefStat ?? 0);
}

/**
 * The crit rate that actually applies when `attacker` swings at `defender`:
 * the attacker's rate less the defender's crit defence, floored at zero.
 */
export function effectiveCritRate(attackerCritRate: number, defenderCritDefence: number): number {
  return Math.max(0, attackerCritRate - defenderCritDefence);
}

/**
 * Critical damage as a PERCENTAGE of the hit: 120 means the critical deals
 * 120% of what it otherwise would.
 */
export function critDamagePercent(input: { luk: number; critDamageStat?: number }): number {
  return (
    BASE_CRIT_DAMAGE_PERCENT +
    Math.floor(Math.max(0, input.luk) / CRIT_DAMAGE_LUK_DIVISOR) +
    (input.critDamageStat ?? 0)
  );
}

/** The same number as a multiplier, which is what a damage line wants. */
export function critDamageMultiplier(input: { luk: number; critDamageStat?: number }): number {
  return critDamagePercent(input) / 100;
}
