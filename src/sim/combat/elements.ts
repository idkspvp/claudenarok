// The element triangle: the attribute chart every Ragnarok fight runs through.
//
// A pure leaf (no SimContext, no rng, no clock) so a Vitest drives it directly and
// both the offline Sim and the server share one answer. It owns three closed
// vocabularies and one table:
//
//   Element  what an attack is made of, and what a monster is made of
//   Race     what a monster IS, for the cards and skills that key off it
//   Size     small / medium / large, which is what weapon type keys off
//
// This is the foundation the weapon size table, monster records, and cards all
// sit on: three of the five terms in Ragnarok's damage line are functions of
// these, and none of them existed here. `school` on an Aura is a damage LABEL
// with no resistance behind it; it is NOT this and the two should not be merged
// (a Fire BOLT is a fire-element attack, but a bleed is `physical` school and
// neutral element).
//
// SOURCING: the multipliers below are a reimplementation of a published game
// mechanic, authored here from the documented relationships. No table was copied
// from rAthena or Hercules, whose db/ is GPL-3.0 and incompatible with this MIT
// codebase. The level-1 row values and the level-scaling rule are stated
// explicitly so a reviewer can check them against a reference; see
// `docs/design/ro-weapons-maps-monsters.md`.

/** The ten attributes. `neutral` is the default for an unmarked attack. */
export const ELEMENTS = [
  'neutral',
  'water',
  'earth',
  'fire',
  'wind',
  'poison',
  'holy',
  'shadow',
  'ghost',
  'undead',
] as const;
export type Element = (typeof ELEMENTS)[number];

/** A defender's attribute level, 1 to 4. Higher levels do NOT simply resist more:
 *  they sharpen the chart in BOTH directions, so a level-4 defender takes far more
 *  from what beats it and can absorb what it resists. */
export type ElementLevel = 1 | 2 | 3 | 4;
export const ELEMENT_LEVELS: readonly ElementLevel[] = [1, 2, 3, 4];

/** The ten races. Cards and several skills modify damage against a race. */
export const RACES = [
  'formless',
  'undead',
  'brute',
  'plant',
  'insect',
  'fish',
  'demon',
  'demihuman',
  'angel',
  'dragon',
] as const;
export type Race = (typeof RACES)[number];

/** The three sizes. A weapon type deals a different share to each. */
export const SIZES = ['small', 'medium', 'large'] as const;
export type Size = (typeof SIZES)[number];

// The chart at defender attribute level 1, as PERCENTAGES. Rows are the ATTACK
// element, columns the DEFENDER's. 100 is neutral trade, 0 is immune.
//
// The relationships this encodes, which are the part worth checking:
//   - the four-way ring: water beats fire beats earth beats wind beats water
//   - holy and shadow answer each other, and holy is what undead fear
//   - poison does nothing to poison and little to the undead
//   - ghost is the answer to neutral, and neutral barely touches ghost
//   - an element always resists itself
const LEVEL_1: Readonly<Record<Element, Readonly<Record<Element, number>>>> = {
  neutral: {
    neutral: 100,
    water: 100,
    earth: 100,
    fire: 100,
    wind: 100,
    poison: 100,
    holy: 100,
    shadow: 100,
    ghost: 25,
    undead: 100,
  },
  water: {
    neutral: 100,
    water: 25,
    earth: 100,
    fire: 150,
    wind: 50,
    poison: 100,
    holy: 75,
    shadow: 100,
    ghost: 100,
    undead: 100,
  },
  earth: {
    neutral: 100,
    water: 100,
    earth: 25,
    fire: 50,
    wind: 150,
    poison: 100,
    holy: 75,
    shadow: 100,
    ghost: 100,
    undead: 100,
  },
  fire: {
    neutral: 100,
    water: 50,
    earth: 150,
    fire: 25,
    wind: 100,
    poison: 100,
    holy: 75,
    shadow: 100,
    ghost: 100,
    undead: 150,
  },
  wind: {
    neutral: 100,
    water: 150,
    earth: 50,
    fire: 100,
    wind: 25,
    poison: 100,
    holy: 75,
    shadow: 100,
    ghost: 100,
    undead: 100,
  },
  poison: {
    neutral: 100,
    water: 100,
    earth: 100,
    fire: 100,
    wind: 100,
    poison: 0,
    holy: 75,
    shadow: 50,
    ghost: 100,
    undead: 50,
  },
  holy: {
    neutral: 100,
    water: 100,
    earth: 100,
    fire: 100,
    wind: 100,
    poison: 100,
    holy: 0,
    shadow: 125,
    ghost: 100,
    undead: 150,
  },
  shadow: {
    neutral: 100,
    water: 100,
    earth: 100,
    fire: 100,
    wind: 100,
    poison: 50,
    holy: 125,
    shadow: 0,
    ghost: 100,
    undead: 0,
  },
  ghost: {
    neutral: 25,
    water: 100,
    earth: 100,
    fire: 100,
    wind: 100,
    poison: 100,
    holy: 100,
    shadow: 100,
    ghost: 125,
    undead: 100,
  },
  undead: {
    neutral: 100,
    water: 100,
    earth: 100,
    fire: 100,
    wind: 100,
    poison: 50,
    holy: 100,
    shadow: 0,
    ghost: 100,
    undead: 0,
  },
};

// How a defender's attribute LEVEL bends its row. Each level above 1 pushes the
// cell 25 further in the direction it already leans: what already hurt hurts
// more, what was already resisted is resisted harder, and a deep enough
// resistance turns into absorption (a negative multiplier heals the target).
// A cell sitting exactly at 100 is a neutral trade and never moves.
const PER_LEVEL_STEP = 25;
const MAX_PCT = 200;
const MIN_PCT = -25;

/** The damage multiplier for `attack` element against a defender of `defend`
 *  element at `level`, as a FRACTION (1 = full damage, 0 = immune, negative =
 *  the hit heals). */
export function elementMultiplier(
  attack: Element,
  defend: Element,
  level: ElementLevel = 1,
): number {
  return elementPercent(attack, defend, level) / 100;
}

/** The same value as a percentage, which is how the chart is normally read and
 *  how a tooltip should show it. */
export function elementPercent(attack: Element, defend: Element, level: ElementLevel = 1): number {
  const base = LEVEL_1[attack][defend];
  if (base === 100) return 100;
  const steps = (Math.max(1, Math.min(4, level)) - 1) * PER_LEVEL_STEP;
  const moved = base > 100 ? base + steps : base - steps;
  return Math.max(MIN_PCT, Math.min(MAX_PCT, moved));
}

/** Does this attack heal the target instead of hurting it? The chart reaches
 *  absorption at the deep end, and a caller that clamps damage at 0 would turn a
 *  build-defining interaction into a no-op. */
export function elementAbsorbs(attack: Element, defend: Element, level: ElementLevel = 1): boolean {
  return elementPercent(attack, defend, level) < 0;
}
