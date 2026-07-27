// Ragnarok's critical strike, whole. The chance, what beats it, and what it is
// actually worth.
//
// Verified against the pre-renewal branches of rAthena's `status_calc_bl_main`
// (the chance) and `is_attack_critical` / `is_attack_hitting` /
// `attack_ignores_def` (the rules). Nothing here is reconstructed, because a
// critical in Ragnarok behaves almost nothing like the one this genre defaults
// to and every difference points the same way: it is a RELIABILITY tool, not a
// damage multiplier.
//
//   1. It does NOT multiply damage. It takes the top of the weapon range and
//      skips the roll (combat/weapon_damage.ts). The x1.4 sits under
//      `#ifdef RENEWAL`.
//   2. It CANNOT MISS. `is_attack_hitting` returns true for a critical before it
//      ever reaches the accuracy contest, so Flee does not apply.
//   3. It IGNORES DEFENCE outright, both layers. `attack_ignores_def` returns
//      true for any critical under `#ifndef RENEWAL`.
//   4. The TARGET'S LUCK reduces it. Luck is not a one-way offensive stat: it
//      buys criticals and it denies them, and a monster attacking a player is
//      denied harder than a player attacking anything.
//   5. MAGIC CANNOT CRIT AT ALL. `battle_calc_magic_attack` never calls
//      `is_attack_critical`; all seven call sites are on the weapon path.
//   6. A SKILL cannot crit unless its record says it can. `if (skill_id &&
//      !skill_get_nk(skill_id, NK_CRITICAL)) return false` is the second line of
//      the function, so the default for every skill in the game is NO.
//
// Rules 1 to 3 together are why removing the multiplier is not the nerf it
// reads as: against an armoured target a critical is worth far more than double,
// and against a high-Flee one it is the only thing that lands.
//
// Chances are computed in Ragnarok's own unit, PER MILLE (tenths of a percent),
// because that is what the source's integer arithmetic is written in and
// converting first loses the `10/3` term's exact value. The public functions
// return ordinary 0..1 fractions.

/** Everyone starts at 1%. */
export const BASE_CRIT_PERMILLE = 10;

/** Each point of Luck adds a third of a percent. The source writes this as
 *  `luk * 10 / 3` in integer per mille; keeping the division here rather than
 *  rounding to a flat 0.3% preserves it. */
export const LUK_CRIT_PERMILLE = 10 / 3;

/** Each point of the TARGET's Luck removes a fifth of a percent. */
export const TARGET_LUK_CRIT_PERMILLE = 2;

/** Except when a monster attacks a player, where it removes three tenths. The
 *  source calls this out: the official equation is x2, and x3 is used only for
 *  the monster-on-player case, which is a deliberate thumb on the scale in the
 *  player's favour. */
export const MONSTER_ON_PLAYER_TARGET_LUK_PERMILLE = 3;

/** The floor. `cap_value(stat, 1, SHRT_MAX)` never lets the derived stat reach
 *  zero, so no amount of enemy Luck makes a character literally unable to crit. */
export const MIN_CRIT_PERMILLE = 1;

/** Magic never crits in pre-renewal. Exported as a named constant rather than
 *  left implicit so a caller reads a decision instead of an absence. */
export const MAGIC_CAN_CRIT = false;

/** A skill crits only if its record opts in. This is the default the source
 *  applies to every skill that does not carry the flag. */
export const ABILITY_CAN_CRIT_BY_DEFAULT = false;

export interface CritInput {
  /** The attacker's Luck. */
  luk: number;
  /** The defender's Luck, which is subtracted. */
  targetLuk?: number;
  /** A monster attacking a player is denied harder. */
  attackerIsMonster?: boolean;
  targetIsPlayer?: boolean;
  /** Gear, talent, and aura bonuses, as an ordinary 0..1 fraction. */
  bonus?: number;
}

/** The attacker's own critical rate from Luck alone, before the target is
 *  considered. This is the number a character sheet shows. */
export function critRateFrom(luk: number, bonus = 0): number {
  const permille = BASE_CRIT_PERMILLE + Math.max(0, luk) * LUK_CRIT_PERMILLE;
  return Math.max(MIN_CRIT_PERMILLE / 1000, permille / 1000 + bonus);
}

/** The chance this attacker crits THIS target. */
export function critChance(input: CritInput): number {
  const denial =
    input.attackerIsMonster && input.targetIsPlayer
      ? MONSTER_ON_PLAYER_TARGET_LUK_PERMILLE
      : TARGET_LUK_CRIT_PERMILLE;
  const permille =
    BASE_CRIT_PERMILLE +
    Math.max(0, input.luk) * LUK_CRIT_PERMILLE -
    Math.max(0, input.targetLuk ?? 0) * denial;
  const withBonus = permille / 1000 + (input.bonus ?? 0);
  return Math.min(1, Math.max(MIN_CRIT_PERMILLE / 1000, withBonus));
}

/** Whether a hit of this shape is even allowed to crit. `abilityId` null means
 *  an ordinary weapon swing, which always may; anything else has to opt in. */
export function canCrit(opts: {
  isSpell?: boolean;
  abilityId?: string | null;
  abilityCanCrit?: boolean;
}): boolean {
  if (opts.isSpell) return MAGIC_CAN_CRIT;
  if (opts.abilityId == null) return true;
  return opts.abilityCanCrit ?? ABILITY_CAN_CRIT_BY_DEFAULT;
}
