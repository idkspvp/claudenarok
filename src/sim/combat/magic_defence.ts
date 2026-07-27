// Ragnarok's magic attack and the two layers that stop it.
//
// Verified against the pre-renewal arms of rAthena rather than reconstructed:
// `status_base_matk_min`/`_max` under `#ifndef RENEWAL` in status.cpp, the
// `status->mdef2` derivation in the same file's `#else` arm, and the magic
// reduction in battle.cpp's `battle_calc_magic_attack` (again the `#else`).
// The trap is the same one hard DEF has: a search for "MDEF" returns
// `damage x (1000 + eMDEF) / (1000 + eMDEF x 10) - sMDEF`, which sits under
// `#ifdef RENEWAL` beside the comment "RE MDEF Reduction" and is not ours.
//
// The shape mirrors physical defence exactly:
//
//   hard MDEF  equipment. Capped at 100 and applied as a straight percentage.
//   soft MDEF  Intelligence. A FLAT amount subtracted AFTER the percentage.
//
// One real difference from `combat/defence.ts`, and it is easy to miss because
// everything else lines up: **soft MDEF has no random term.** Soft DEF rolls
// (`playerSoftDef` draws), soft MDEF does not; `status->mdef2` is a plain
// `INT + VIT/2` and battle.cpp subtracts it as-is. The randomness on the magic
// side lives entirely in the ATTACK, where soft DEF's lives in the defence. So a
// caster's damage varies and the target's mitigation does not, which is the
// reverse of a melee exchange and is why magic reads as more reliable against a
// tanky target than a weapon does.
//
// Where the numbers come from on OUR side is deliberately not decided here. INT
// and VIT are real entity stats, so the attack range and soft MDEF are complete
// and correct. Hard MDEF is taken as an argument because this engine has no
// magic-armour field to convert from: `Entity.armor` is a single physical value
// and no `ItemDef` carries a magic counterpart. Inventing a divisor against a
// field that does not exist would be a guess, and the item records that will
// carry a real MDEF are the gear rebalance (roadmap B3). Until then every caller
// passes 0 and only the flat layer bites, which is honest rather than silently
// wrong.

/** Hard MDEF is capped before it is applied, exactly as hard DEF is, so no
 *  amount of equipment makes a target immune to magic. */
export const MAX_HARD_MDEF = 100;

/** A magic hit always takes at least this much off. Pre-renewal battle.cpp ends
 *  the magic branch with a bare `if (ad.damage < 1) ad.damage = 1`, the same
 *  floor the physical branch has and for the same reason: soft MDEF is a flat
 *  subtraction and would otherwise make a high-Intelligence target literally
 *  unhittable by a weak caster. */
export const MIN_MAGIC_DAMAGE = 1;

/** The two ends of a caster's status MATK.
 *
 *  Both are Intelligence plus a squared term, and only the divisor differs:
 *  sevenths for the floor, fifths for the ceiling. That is what makes the range
 *  WIDEN as Intelligence grows rather than sliding upward intact, so a caster's
 *  damage gets both bigger and swingier. At INT 99 the spread is 196 to 460.
 *
 *  Integer division at each step, and the square is of the FLOORED quotient, not
 *  of the fraction: `(INT/7)^2` in the source is C integer arithmetic. */
export function magicAttackRange(int: number): { min: number; max: number } {
  const i = Math.max(0, Math.floor(int));
  return {
    min: i + Math.floor(i / 7) ** 2,
    max: i + Math.floor(i / 5) ** 2,
  };
}

/** A single cast's status MATK, rolled between the two ends.
 *
 *  `roll` is a 0..1 fraction from the caller's Rng; the module never reaches for
 *  one, because `src/sim/` routes every draw through the sim's `Rng` (root
 *  CLAUDE.md, Invariants) and a leaf calling Math.random would fork the world
 *  between hosts and break the parity gate.
 *
 *  The range is HALF-OPEN. rAthena rolls `matk_min + rnd() % (max - min)`, an
 *  integer modulo that can never produce `max`, and falls back to `min` when the
 *  two are equal. The clamp reproduces that from a continuous fraction: a roll of
 *  exactly 1.0 lands on `max - 1`, not `max`. Reaching the ceiling would need the
 *  span widened by one, which is not what the source does. */
export function magicAttackRoll(int: number, roll: number): number {
  const { min, max } = magicAttackRange(int);
  const span = max - min;
  if (span <= 0) return min;
  const clamped = Math.max(0, Math.min(1, roll));
  return min + Math.min(span - 1, Math.floor(clamped * span));
}

/** Soft MDEF: the flat amount Intelligence, and half of Vitality, subtract.
 *
 *  No quadratic and no roll, which is the whole difference in feel from soft
 *  DEF. Intelligence pays one for one and Vitality pays half, and the asymmetry
 *  runs both ways: a Vitality build is only half as resistant to spells as it is
 *  durable against weapons, while a caster's offensive attribute doubles as its
 *  own magic shield and buys it nothing at all against a weapon. That is what
 *  stops either defensive attribute from answering both damage types, and it is
 *  why a caster is the WORST target to answer with magic and the best to answer
 *  with a sword. */
export function softMagicDefence(int: number, vit: number): number {
  return Math.max(0, Math.floor(int)) + Math.floor(Math.max(0, Math.floor(vit)) / 2);
}

/** The fraction of magic damage that survives hard MDEF. */
export function hardMagicDefenceMultiplier(mdef: number): number {
  return (MAX_HARD_MDEF - Math.min(MAX_HARD_MDEF, Math.max(0, Math.floor(mdef)))) / MAX_HARD_MDEF;
}

export interface MagicDefenceInput {
  /** Hard MDEF from equipment, already on Ragnarok's 0..100 scale. This engine
   *  has no item field to derive it from yet, so callers pass 0 until the gear
   *  records carry one. */
  mdef: number;
  /** The defender's Intelligence. */
  int: number;
  /** The defender's Vitality. */
  vit: number;
}

/** Magic damage after both layers. Percentage first, then the flat subtraction,
 *  for the same reason the physical order is fixed: reversing them would make
 *  soft MDEF scale with equipment, which is not what either layer is for. */
export function applyMagicDefence(damage: number, def: MagicDefenceInput): number {
  const afterHard = damage * hardMagicDefenceMultiplier(def.mdef);
  return Math.max(MIN_MAGIC_DAMAGE, afterHard - softMagicDefence(def.int, def.vit));
}
