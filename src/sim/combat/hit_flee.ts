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
//   HIT   what the attacker brings. Rises with level and DEX, a little with LUK.
//   FLEE  what the defender brings. Rises with level and AGI, a little with LUK.
//   PERFECT DODGE  a flat chance from LUK alone that HIT cannot overcome. This is
//                  why a high-HIT attacker still never lands every blow, and it is
//                  the only avoidance in the model that does not scale against
//                  the attacker.
//
// SOURCING: a reimplementation of a published mechanic, authored from the
// documented relationships. Nothing copied from a GPL server's db/.
//
// CONFIDENCE, stated plainly so a reviewer knows where to spend their checking:
//   HIGH   that perfect dodge exists at all, comes from LUK alone, and ignores
//          the attacker's accuracy. It is the number Ragnarok shows in
//          parentheses beside FLEE in the status window.
//   HIGH   the two rating formulas below.
//   MEDIUM the perfect dodge coefficient.
//   LOWEST BASE_HIT_PERCENT. Both 80 and 100 appear in circulation for it, and
//          this file has not resolved which is right.
// Every one of those is a NAMED CONSTANT here rather than a number inlined at a
// call site, and the tests pin RELATIONSHIPS rather than values, so correcting
// any of them against a reference is a one-line change that breaks nothing.

/** Attacker accuracy. The 175 is the baseline every combatant carries, which is
 *  what makes a same-level fight land most of its blows rather than whiff. */
export function hitRating(level: number, dex: number, luk: number): number {
  return 175 + Math.max(1, Math.floor(level)) + Math.max(0, dex) + Math.floor(Math.max(0, luk) / 3);
}

/** Defender evasion. Its baseline is 75 below the attacker's on purpose: at equal
 *  level and equal attributes the attacker is ahead, and FLEE has to be BOUGHT
 *  with Agility before it starts refusing hits. */
export function fleeRating(level: number, agi: number, luk: number): number {
  return 100 + Math.max(1, Math.floor(level)) + Math.max(0, agi) + Math.floor(Math.max(0, luk) / 5);
}

/** The floor and ceiling on the contest. Nothing is ever unhittable and nothing
 *  is ever certain: a defender who has out-scaled the attacker entirely still
 *  eats one swing in twenty. */
export const MIN_HIT_CHANCE = 0.05;
export const MAX_HIT_CHANCE = 1;

/** Where the contest sits when HIT and FLEE are equal. With the 175/100 split
 *  above, equal attributes at equal level put the attacker 75 ahead, so this
 *  matters only once a defender has actually invested in Agility. */
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
