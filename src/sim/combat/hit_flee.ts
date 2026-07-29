import { flee, hit } from '../stats/accuracy';

// HIT against FLEE: the contest every swing resolves through.
//
// A pure leaf, and a SPLIT one after the conversion, which is the thing to
// understand before editing it.
//
// The two RATINGS are SpiritVale's and are transcribed (Formula$$Hit,
// Formula$$Flee); they live in src/sim/stats/accuracy.ts and this module
// re-exports the thin wrappers our call sites use. The CONTEST that turns two
// ratings into a chance is NOT SpiritVale's, because SpiritVale does not publish
// one: its data gives Hit and Flee as numbers and says nothing about how they
// meet. So the contest below is the one this game already had, kept deliberately
// as a stand-in rather than invented, and recorded as an open unknown in
// docs/design/spiritvale-coverage.md.
//
// What changed with the ratings, and why each matters:
//
//   HIT   Dexterity is worth TWO per point now, plus a fifth of Luck, plus a
//         flat +25 everyone starts from. It used to be one per Dexterity with no
//         Luck term and no baseline.
//   FLEE  Agility is worth HALF a point, floored. It used to be a full point.
//         So accuracy is now four times easier to stack than evasion, which is
//         the reverse of the model this replaces.
//   FLEE  loses a tenth per attacker past the FOURTH. There was no crowd penalty
//         at all before.
//
// PERFECT DODGE is the one place the conversion is deliberately incomplete.
// SpiritVale reads it as a plain gear stat (clamp(0, 100, PerfectDodge)) with no
// attribute term at all. Nothing in this game's item records carries that stat
// yet, so switching now would silently delete the mechanic and one of Luck's
// three jobs. The Luck derivation stays until gear can grant the stat in phase
// 6; the decision is recorded in the progress file.

/** Attacker accuracy (stats/accuracy.ts). Level, twice Dexterity, a fifth of
 *  Luck, and a flat 25 everyone carries. */
export function hitRating(level: number, dex: number, luk = 0): number {
  return hit({
    level: Math.max(1, Math.floor(level)),
    dex: Math.max(0, dex),
    luk: Math.max(0, luk),
  });
}

/** Defender evasion (stats/accuracy.ts). Level plus HALF of Agility, floored,
 *  and a tenth off for each attacker past the fourth. No longer symmetric with
 *  HIT: two equally built characters of the same level no longer meet level, so
 *  the attacker starts ahead on purpose. */
export function fleeRating(level: number, agi: number, attackerCount = 1): number {
  return flee({
    level: Math.max(1, Math.floor(level)),
    agi: Math.max(0, agi),
    attackerCount,
  });
}

/** The floor and ceiling on the contest. Nothing is ever unhittable and nothing
 *  is ever certain: a defender who has out-scaled the attacker entirely still
 *  eats one swing in twenty. */
export const MIN_HIT_CHANCE = 0.05;
export const MAX_HIT_CHANCE = 1;

/** The contest's base, RECALIBRATED with the new ratings.
 *
 *  This is a stand-in, not a transcription: SpiritVale publishes Hit and Flee as
 *  ratings and says nothing about how they meet, so the relationship
 *  `clamp(5, 100, BASE + HIT - FLEE)` is the one this game already used and is
 *  kept rather than invented (recorded in docs/design/spiritvale-coverage.md).
 *
 *  The CONSTANT had to move, though, and leaving it at 80 would have been the
 *  real mistake. The old ratings were symmetric: two unbuilt characters of the
 *  same level had identical Hit and Flee, so the base WAS the even-fight chance.
 *  SpiritVale's are not. Hit carries a flat +25 that Flee has no answer to, so
 *  an unbuilt attacker is 25 points ahead before anyone spends a point, and
 *  `80 + HIT - FLEE` sends every swing straight to the 100% ceiling: at level 20
 *  with ten Dexterity each, the contest reads 80 + 65 - 25 = 120.
 *
 *  55 restores the property the stand-in was chosen for, that an unbuilt pair of
 *  the same level trades at 80% and one swing in five misses. It is our own
 *  calibration constant re-derived to keep its own invariant, not a balance
 *  number taken from anywhere.
 *
 *  What deliberately does NOT come back is symmetry once both sides spend:
 *  Dexterity buys two accuracy and Agility buys half an evasion, so an attacker
 *  who invests out-runs a defender who invests equally. That asymmetry is
 *  SpiritVale's and is meant to show. */
export const BASE_HIT_PERCENT = 55;
/** The flat lead SpiritVale's Hit formula gives every attacker. BASE_HIT_PERCENT
 *  is 80 minus this, which is what puts an unbuilt pair back at 80%. */
export const ATTACKER_FLAT_LEAD = 25;
/** The even-fight chance the calibration above preserves. */
export const EVEN_FIGHT_PERCENT = 80;

/** Chance this attack gets past FLEE, as a fraction. */
export function hitChance(hit: number, flee: number): number {
  const pct = BASE_HIT_PERCENT + hit - flee;
  return Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, pct / 100));
}

/** The complement, which is what the swing actually rolls against. */
export function missChanceFromContest(hit: number, flee: number): number {
  return 1 - hitChance(hit, flee);
}

/** Flat avoidance from Luck alone, as a fraction. STAND-IN: SpiritVale reads a
 *  plain PerfectDodge gear stat here with no attribute term, and no item in this
 *  game grants it yet. Rolled SEPARATELY from the contest and unaffected by the
 *  attacker's HIT, which is the whole point of the mechanic either way. */
export function perfectDodgeChance(luk: number): number {
  return (1 + Math.max(0, luk) * 0.1) / 100;
}
