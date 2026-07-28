// How often you swing, and how fast you cast.
//
// Transcribed from docs/design/spiritvale-engine-formulas.md
// (Formula$$AttackSpeed, Formula$$AttackSpeedLimit, Formula$$AttackDelay,
// Formula$$CastSpeed, Formula$$MaxCastTimeReduction). Every constant, and every
// row of the weapon table, is read from that file.
//
//   ASPD          round( 200 - 50*BAD*(1 - (AGI + FLOOR(DEX/4))/250)/(1 + ASPD%)
//                        + 0.5*FLOOR(AGI/10) + AtkSpdFlat )
//   ASPD cap      min( 193, 185 + FLOOR(AGI/30) + AtkSpdLimit )
//   Attack delay  (200 - ASPD) / 50   seconds
//   Dual wield    BAD = (BAD1 + BAD2) * 0.8
//
//   Cast speed    200 - 50*(1 - (DEX + INT/2)/400)/(1 + CastSpd%)
//                 + 0.5*(FLOOR(DEX/10) + CastTimeReduction)
//   CTR           round( (1 - (200 - CastSpeed)/50) * 100 )
//   CTR cap       min( 90 + CastTimeReductionLimit, CTR )
//   Cast mult     (100 - CTR) / 100
//
// Cast speed reuses the attack-speed shape one scale down: Dexterity and half of
// Intelligence over 400 rather than (Agility + a quarter of Dexterity) over 250.
// One idea, two applications, which is why they share a file.
//
// The weapon table is the other reason. It is per WEAPON, a single column: the
// model this replaces indexes a two-dimensional job-and-weapon table, so a
// converted character's swing timer changes for reasons that have nothing to do
// with its class.
//
// Pure leaf: resolved numbers in, no Entity, no rng.

/** Every weapon's base attack delay. Lower is faster. */
export const WEAPON_BASE_ATTACK_DELAY = {
  Unarmed: 0.9,
  Dagger: 1.0,
  Katar: 1.0,
  Sword: 1.1,
  Sword2H: 1.1,
  Book: 1.1,
  Mace: 1.15,
  Mace2H: 1.15,
  Instrument: 1.15,
  Spear: 1.2,
  Spear2H: 1.2,
  Wand: 1.2,
  Wand2H: 1.2,
  Scythe: 1.2,
  Pistol: 1.2,
  Twinblade: 1.2,
  Axe: 1.3,
  Axe2H: 1.3,
  Bow: 1.4,
  GatlingGun: 1.4,
  Rifle: 1.5,
  Shotgun: 2.0,
  Launcher: 2.0,
} as const;

export type WeaponSpeedClass = keyof typeof WEAPON_BASE_ATTACK_DELAY;

/** The 200-point scale both speeds are expressed on. */
export const SPEED_SCALE = 200;
/** The span of the scale one unit of base delay costs. */
export const SPEED_SPAN = 50;
/** ASPD divides its attribute term by this. */
export const ASPD_ATTRIBUTE_DIVISOR = 250;
/** Cast speed divides its attribute term by this: the same idea, one scale down. */
export const CAST_ATTRIBUTE_DIVISOR = 400;
/** Dual wield sums both base delays and takes this share. */
export const DUAL_WIELD_MULTIPLIER = 0.8;
/** The hard ASPD ceiling. */
export const ASPD_HARD_CAP = 193;
/** The soft ceiling before Agility and gear raise it. */
export const ASPD_SOFT_CAP_BASE = 185;
/** Agility raises the soft cap by one per this many points. */
export const ASPD_CAP_AGI_DIVISOR = 30;
/** Cast-time reduction cannot exceed this percentage without gear raising it. */
export const CAST_TIME_REDUCTION_CAP = 90;

/**
 * The base attack delay a swing uses. One weapon is its own row; two weapons sum
 * and take four fifths, which is what makes dual wield fast without being twice
 * as fast.
 */
export function baseAttackDelay(mainhand: WeaponSpeedClass, offhand?: WeaponSpeedClass): number {
  const main = WEAPON_BASE_ATTACK_DELAY[mainhand];
  if (!offhand) return main;
  return (main + WEAPON_BASE_ATTACK_DELAY[offhand]) * DUAL_WIELD_MULTIPLIER;
}

/** `min(193, 185 + FLOOR(AGI/30) + AtkSpdLimit)`. */
export function attackSpeedCap(agi: number, atkSpdLimit = 0): number {
  const soft =
    ASPD_SOFT_CAP_BASE + Math.floor(Math.max(0, agi) / ASPD_CAP_AGI_DIVISOR) + atkSpdLimit;
  return Math.min(ASPD_HARD_CAP, soft);
}

export interface AttackSpeedInput {
  agi: number;
  dex: number;
  /** From `baseAttackDelay`. */
  bad: number;
  /** Additive percentage, as a fraction: 0.2 is +20%. */
  aspdPercent?: number;
  /** The AtkSpdFlat stat, added after the scale term. */
  aspdFlat?: number;
  /** The AtkSpdLimit stat, which raises the soft cap. */
  aspdLimit?: number;
}

/** Attack speed on the 200-point scale, capped. */
export function attackSpeed(input: AttackSpeedInput): number {
  const attributeTerm =
    (Math.max(0, input.agi) + Math.floor(Math.max(0, input.dex) / 4)) / ASPD_ATTRIBUTE_DIVISOR;
  const raw =
    SPEED_SCALE -
    (SPEED_SPAN * input.bad * (1 - attributeTerm)) / (1 + (input.aspdPercent ?? 0)) +
    0.5 * Math.floor(Math.max(0, input.agi) / 10) +
    (input.aspdFlat ?? 0);
  return Math.min(attackSpeedCap(input.agi, input.aspdLimit), Math.round(raw));
}

/** Seconds between auto-attacks: `(200 - ASPD) / 50`. */
export function attackDelaySeconds(aspd: number): number {
  return (SPEED_SCALE - aspd) / SPEED_SPAN;
}

/** Swings per second, the number a player actually feels. */
export function attacksPerSecond(aspd: number): number {
  const delay = attackDelaySeconds(aspd);
  return delay > 0 ? 1 / delay : Number.POSITIVE_INFINITY;
}

export interface CastSpeedInput {
  dex: number;
  int: number;
  /** Additive percentage, as a fraction. */
  castSpeedPercent?: number;
  /** The CastTimeReduction stat: flat points, one point per percent. */
  castTimeReduction?: number;
  /** The CastTimeReductionLimit stat, which raises the 90% cap. */
  castTimeReductionLimit?: number;
}

/** Cast speed on the same 200-point scale. */
export function castSpeed(input: CastSpeedInput): number {
  const attributeTerm =
    (Math.max(0, input.dex) + Math.max(0, input.int) / 2) / CAST_ATTRIBUTE_DIVISOR;
  return (
    SPEED_SCALE -
    (SPEED_SPAN * (1 - attributeTerm)) / (1 + (input.castSpeedPercent ?? 0)) +
    0.5 * (Math.floor(Math.max(0, input.dex) / 10) + (input.castTimeReduction ?? 0))
  );
}

/**
 * Cast-time reduction as a percentage, capped. `castTimeReductionLimit` raises
 * the 90% ceiling; nothing lowers it.
 */
export function castTimeReductionPercent(input: CastSpeedInput): number {
  const raw = Math.round((1 - (SPEED_SCALE - castSpeed(input)) / SPEED_SPAN) * 100);
  const cap = CAST_TIME_REDUCTION_CAP + (input.castTimeReductionLimit ?? 0);
  return Math.max(0, Math.min(cap, raw));
}

/** What a cast time is multiplied by: `(100 - CTR) / 100`. */
export function castTimeMultiplier(input: CastSpeedInput): number {
  return (100 - castTimeReductionPercent(input)) / 100;
}
