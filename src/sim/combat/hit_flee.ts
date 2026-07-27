// HIT against FLEE: the contest Ragnarok resolves every swing through.
//
// A pure leaf. It replaces a flat dodge fraction with an opposed check, which is
// the difference between "AGI is a small percentage" and "AGI is the reason that
// monster is untouchable". It also gives DEX a job it did not have: nothing in
// this game bought accuracy before, so a Dexterity build had no defensive answer
// to an evasive target.
//
// Three numbers, and they are deliberately separate:
//
//   HIT   what the attacker brings. Level and DEX, and nothing else.
//   FLEE  what the defender brings. Level and AGI, and nothing else.
//   PERFECT DODGE  a flat chance from LUK alone that HIT cannot overcome. This is
//                  why a high-HIT attacker still never lands every blow, and it is
//                  the only avoidance in the model that does not scale against
//                  the attacker.
//
// SOURCING: a reimplementation of a published mechanic, authored from the
// documented relationships. Nothing copied from a GPL server's db/.
//
// VERIFIED against the pre-renewal arm of rAthena's `status_calc_bl_main`,
// which guards its two eras at lines 2617 (`#ifdef RENEWAL`), 2700 (`#else`)
// and 2720 (`#endif`). This file has now been corrected twice off that one
// pair of lines, and both errors came from reading the RENEWAL arm:
//
//   RENEWAL       hit  += level + dex + (PC ? luk/3 + 175 : 150)
//                 flee += level + agi + (PC ? luk/5 : 0) + 100
//   PRE-RENEWAL   hit  += level + dex
//                 flee += level + agi
//
// The first pass carried the +175 and +100 baselines, which handed every
// attacker a permanent 75-point advantage and made two equally built characters
// of the same level connect every single time. Removing them was right but only
// half the line: the `luk/3` and `luk/5` terms are Renewal's too, and they
// survived the first correction. LUCK IS NOT AN ACCURACY STAT in pre-renewal. It
// buys criticals, denies them (combat/crit.ts), and grants perfect dodge below.
// That is the whole of its job.

/** Attacker accuracy: level and Dexterity. No Luck term and no baseline: the
 *  80% floor in the contest below is what carries an even fight, and adding
 *  either here would hand the attacker a permanent free advantage. */
export function hitRating(level: number, dex: number): number {
  return Math.max(1, Math.floor(level)) + Math.max(0, dex);
}

/** Defender evasion: level and Agility. Symmetric with HIT, so two equally
 *  built characters of the same level meet at the 80% base rather than one of
 *  them starting ahead. */
export function fleeRating(level: number, agi: number): number {
  return Math.max(1, Math.floor(level)) + Math.max(0, agi);
}

/** The floor and ceiling on the contest. Nothing is ever unhittable and nothing
 *  is ever certain: a defender who has out-scaled the attacker entirely still
 *  eats one swing in twenty. */
export const MIN_HIT_CHANCE = 0.05;
export const MAX_HIT_CHANCE = 1;

/** Where the contest sits when HIT and FLEE are equal, and the number that does
 *  all the work: two equally built characters of the same level trade at 80%, so
 *  one swing in five misses no matter how the fight is going. Every point of
 *  advantage moves it one point. */
export const BASE_HIT_PERCENT = 80;

/** Chance this attack gets past FLEE, as a fraction. */
export function hitChance(hit: number, flee: number): number {
  const pct = BASE_HIT_PERCENT + hit - flee;
  return Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, pct / 100));
}

/** The complement, which is what the swing actually rolls against. */
export function missChanceFromContest(hit: number, flee: number): number {
  return 1 - hitChance(hit, flee);
}

/** Flat avoidance from Luck alone, as a fraction. Rolled SEPARATELY from the
 *  contest and unaffected by the attacker's HIT, which is the whole point: it is
 *  the one thing accuracy cannot buy its way through. */
export function perfectDodgeChance(luk: number): number {
  return (1 + Math.max(0, luk) * 0.1) / 100;
}
