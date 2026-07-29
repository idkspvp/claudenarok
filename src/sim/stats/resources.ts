// Health, spell points, and the two regeneration curves.
//
// Transcribed from docs/design/spiritvale-engine-formulas.md
// (Formula$$MaxHealth, Formula$$MaxMana, Formula$$HealthRegen,
// Formula$$ManaRegen). Every constant is read from that file.
//
//   Max HP   max(1, round( ((Tri(L)*Arch% + 10*Lv + 200) * (1 + VIT/100) + flatHP)
//                          * (1 + HP%) ))          Tri(n) = n(n+1)/2, L = clamp(Lv, 1, 130)
//   Max MP   [ (45 + 5*Lv) * (1 + INT/100) + flatMP ] * (1 + MP%)
//
//   HP regen round( (MaxHP/200 + VIT/5 + flatRegen) * (1 + VIT/200 + HpRegen%/2)
//                   + MaxHP * MaxHpRegen% )
//   MP regen round( ( (MaxMP/100 + INT/5 + flatRegen) * (1 + INT/200 + MpRegen%/2)
//                     + MaxMP * MaxMpRegen% ) * (1 + MpRegen%) )
//
// Health is QUADRATIC in level through the triangular number, scaled by a
// per-class multiplier; spell points are linear. Vitality and Intelligence are
// plain percentage multipliers on their own pool, which is far simpler than the
// per-job tables in the model this replaces.
//
// The level input to Max HP is clamped at 130 even though the cap is 150: past
// that point health stops growing quadratically and only the linear 10*Lv term
// continues. That is in the source and is easy to mistake for a typo.
//
// Three details in the regen block are counter-intuitive enough to have their
// own tests:
//
//   - The regen PERCENTAGE stats enter HALVED, because the engine averages
//     (1 + VIT/100) with (1 + HpRegenMult/100).
//   - On the mana side that same stat then applies a SECOND time in full on the
//     finished total, so mana regeneration percentage is worth appreciably more
//     than its health twin.
//   - The health side divides max health by 200; the mana side divides by 100.
//
// Pure leaf: resolved numbers in, no Entity, no rng.

/** Max HP stops growing quadratically past this level, though the cap is 150. */
export const HP_TRIANGULAR_LEVEL_CAP = 130;
/** The flat base every character carries. */
export const HP_BASE = 200;
/** The linear per-level term that keeps growing past the triangular cap. */
export const HP_PER_LEVEL = 10;
/** Max MP base and per-level. */
export const MP_BASE = 45;
export const MP_PER_LEVEL = 5;
/** Health regen divides max health by this; mana regen divides by 100. */
export const HP_REGEN_POOL_DIVISOR = 200;
export const MP_REGEN_POOL_DIVISOR = 100;
/** Both regens take a fifth of their attribute as a flat term. */
export const REGEN_ATTRIBUTE_DIVISOR = 5;
/** The averaged factor's attribute divisor. */
export const REGEN_FACTOR_DIVISOR = 200;

/** `Tri(n) = n(n+1)/2`, the triangular number Max HP is quadratic through. */
export function triangular(n: number): number {
  const v = Math.max(0, n);
  return (v * (v + 1)) / 2;
}

export interface MaxHealthInput {
  level: number;
  vit: number;
  /** The class health multiplier: 1.3 for a Warrior, 0.5 for a Mage. */
  archetypeMultiplier: number;
  flatHp?: number;
  /** Additive percentage, as a fraction. */
  hpPercent?: number;
}

/** Max health. Never below 1, because a zero pool is a dead character on spawn. */
export function maxHealth(input: MaxHealthInput): number {
  const clamped = Math.min(HP_TRIANGULAR_LEVEL_CAP, Math.max(1, input.level));
  const base =
    triangular(clamped) * input.archetypeMultiplier + HP_PER_LEVEL * input.level + HP_BASE;
  const withVit = base * (1 + input.vit / 100) + (input.flatHp ?? 0);
  return Math.max(1, Math.round(withVit * (1 + (input.hpPercent ?? 0))));
}

export interface MaxManaInput {
  level: number;
  int: number;
  flatMp?: number;
  mpPercent?: number;
}

/** Max spell points. Linear in level, unlike health. */
export function maxMana(input: MaxManaInput): number {
  const base = MP_BASE + MP_PER_LEVEL * input.level;
  return (base * (1 + input.int / 100) + (input.flatMp ?? 0)) * (1 + (input.mpPercent ?? 0));
}

export interface HealthRegenInput {
  maxHp: number;
  vit: number;
  flatRegen?: number;
  /** The HpRegenMult stat as a fraction. It enters HALVED, by averaging. */
  hpRegenPercent?: number;
  /** The MaxHpRegen stat as a fraction of the pool, added outside the factor. */
  maxHpRegenPercent?: number;
}

/** Health regenerated per tick of the regen clock. */
export function healthRegen(input: HealthRegenInput): number {
  const flat =
    input.maxHp / HP_REGEN_POOL_DIVISOR +
    input.vit / REGEN_ATTRIBUTE_DIVISOR +
    (input.flatRegen ?? 0);
  const factor = 1 + input.vit / REGEN_FACTOR_DIVISOR + (input.hpRegenPercent ?? 0) / 2;
  return Math.round(flat * factor + input.maxHp * (input.maxHpRegenPercent ?? 0));
}

export interface ManaRegenInput {
  maxMp: number;
  int: number;
  flatRegen?: number;
  /** The MpRegenMult stat as a fraction. It applies TWICE: halved, then in full. */
  mpRegenPercent?: number;
  maxMpRegenPercent?: number;
}

/**
 * Spell points regenerated per tick of the regen clock.
 *
 * `mpRegenPercent` deliberately appears twice, which is not a transcription
 * slip: the engine halves it inside the averaged factor and then applies it
 * again in full to the finished total.
 */
export function manaRegen(input: ManaRegenInput): number {
  const pct = input.mpRegenPercent ?? 0;
  const flat =
    input.maxMp / MP_REGEN_POOL_DIVISOR +
    input.int / REGEN_ATTRIBUTE_DIVISOR +
    (input.flatRegen ?? 0);
  const factor = 1 + input.int / REGEN_FACTOR_DIVISOR + pct / 2;
  const inner = flat * factor + input.maxMp * (input.maxMpRegenPercent ?? 0);
  return Math.round(inner * (1 + pct));
}

/** The Vitality multiplier the health pool carries: `1 + VIT/100`.
 *
 *  Exported separately from `maxHealth` because the character sheet shows it as
 *  its own line. Same relationship, one definition. */
export function vitHealthMultiplier(vit: number): number {
  return 1 + Math.max(0, vit) / 100;
}

/** The Intelligence twin, on the spell-point pool. */
export function intManaMultiplier(int: number): number {
  return 1 + Math.max(0, int) / 100;
}
