// Ragnarok's two-layer defence: a percentage from equipment, then a flat
// subtraction from Vitality.
//
// Verified against the pre-renewal branch of rAthena's battle.cpp
// (`battle_calc_defense_reduction`, the `#else` arm) rather than reconstructed.
// This matters here more than usual: a search for "pre-renewal DEF" returns
// `damage x (4000 + DEF) / (4000 + DEF x 10)`, which is Renewal's, sitting under
// `#ifdef RENEWAL` with the comment "RE DEF Reduction". Pre-renewal is far
// simpler and behaves completely differently at the top end. See
// `docs/design/ro-reference-source.md`.
//
//   hard DEF  equipment. Capped at 100 and applied as a straight percentage.
//   soft DEF  Vitality. A FLAT amount subtracted AFTER the percentage.
//
// The order is what gives the two layers their distinct feel. A percentage is
// worth more the harder you are hit; a flat subtraction is worth more the more
// often you are hit for a little. Stacking Vitality is how you stop being
// chipped to death, and it is why a Vitality build survives a swarm that a
// pure-armour build does not.
//
// Soft DEF carries a RANDOM component in Ragnarok, so the caller passes a roll
// in rather than this module reaching for one: `src/sim/` routes every draw
// through the sim's `Rng` (root CLAUDE.md, Invariants), and a leaf that called
// Math.random would fork the world between hosts and break the parity gate.

/** Hard DEF is capped before it is applied, so no amount of equipment makes a
 *  target immune. The cap is the whole reason Vitality is worth buying. */
import { reachableDefCeiling } from './armor_slot_def';

export const MAX_HARD_DEF = 100;

/** Equipment armour IS hard DEF now, one to one.
 *
 *  This was 50 while the item records still carried the inherited unbounded
 *  armour pool and the two scales had to be divided into each other. The records
 *  are authored on Ragnarok's own scale since the equipment pass, so there is
 *  nothing left to convert: a chest piece reads 15 and removes fifteen percent.
 *  The constant survives as a named 1 rather than disappearing, because the
 *  guard test uses it to prove no future rescale reintroduces a hidden divisor.
 *
 *  The ladder stays back-loaded, which is the shape Ragnarok has: a fresh
 *  character has no DEF at all, and high DEF is bought entirely with gear. The
 *  class term, the level term and the Vitality term all went with D1: Vitality
 *  buys soft DEF below instead of being counted twice. */
export const ARMOR_TO_HARD_DEF = 1;

/** The armour a character can actually reach: best-in-slot equipment, and only
 *  that. Derived from the per-slot ceilings rather than transcribed, so it
 *  cannot silently stop meaning anything when the bands move. */
export const REACHABLE_ARMOR_CEILING = reachableDefCeiling();

/** Equipment armour as a Ragnarok hard DEF value. */
export function hardDefFrom(armor: number): number {
  return Math.min(MAX_HARD_DEF, Math.floor(Math.max(0, armor) / ARMOR_TO_HARD_DEF));
}

/** The fraction of damage that survives hard DEF. */
export function hardDefMultiplier(armor: number): number {
  return (100 - hardDefFrom(armor)) / 100;
}

/** A player's soft DEF, the flat amount Vitality subtracts.
 *
 *  Three terms: three tenths of VIT, a random slice up to the quadratic term,
 *  and half of VIT. The quadratic is why Vitality accelerates: the last points
 *  of a 99 are worth several of the first, the same shape the attack formula
 *  has.
 *
 *  `roll` is a 0..1 fraction from the caller's Rng. Pass 0 for the floor and 1
 *  for the ceiling; the sim passes a real draw. */
export function playerSoftDef(vit: number, roll: number): number {
  const v = Math.max(0, Math.floor(vit));
  const low = Math.floor((3 * v) / 10);
  const span = Math.max(0, Math.floor((v * v) / 150) - low - 1);
  const random = Math.floor(Math.max(0, Math.min(1, roll)) * span);
  return low + random + Math.floor(v / 2);
}

/** A monster's soft DEF, which uses a different and much flatter shape than a
 *  player's: Vitality plus a random slice of a twentieth of it, squared. */
export function monsterSoftDef(vit: number, roll: number): number {
  const v = Math.max(0, Math.floor(vit));
  const span = Math.floor(v / 20) ** 2;
  return v + Math.floor(Math.max(0, Math.min(1, roll)) * span);
}

export interface DefenceInput {
  /** Equipment armour, this game's scale. */
  armor: number;
  /** The defender's Vitality. */
  vit: number;
  /** Whether the defender is a monster, which uses the flatter soft-DEF shape. */
  isMonster?: boolean;
  /** A 0..1 draw from the sim's Rng for the soft-DEF random term. */
  roll: number;
}

/** A landed hit always takes at least this much off. Ragnarok floors post-defence
 *  damage at 1, not 0: soft DEF is a flat subtraction and would otherwise let a
 *  high-Vitality target become literally unhittable by a weak attacker, which is
 *  what the hard-DEF cap already exists to prevent. */
export const MIN_DAMAGE_AFTER_DEF = 1;

/** Damage after both layers. Percentage first, then the flat subtraction:
 *  reversing them would make soft DEF scale with armour, which is not what
 *  either layer is for.
 *
 *  The floor is applied HERE, which is a simplification of Ragnarok's real
 *  order. There, post-defence damage is allowed to go NEGATIVE, the weapon's
 *  refine bonus is added against that negative value, and only then is the total
 *  capped to 1 (`battle_calc_attack_post_defense`, whose comment says exactly
 *  that). Being able to dig out of a negative is what makes over-refining a
 *  weapon worth anything against a high-DEF target. Refining is authored
 *  (`combat/refine.ts`) but is not yet a term in the physical damage pipeline, so
 *  there is nothing to apply between the subtraction and the floor; when it is
 *  wired in, the floor moves to the call site and this returns the raw value. */
export function applyDefence(damage: number, def: DefenceInput): number {
  const afterHard = damage * hardDefMultiplier(def.armor);
  const soft = def.isMonster ? monsterSoftDef(def.vit, def.roll) : playerSoftDef(def.vit, def.roll);
  return Math.max(MIN_DAMAGE_AFTER_DEF, afterHard - soft);
}
