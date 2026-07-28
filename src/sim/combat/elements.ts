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

// The attribute chart, verbatim from the reference's pre-renewal table (its
// db/pre-re/attr_fix.yml, four Level blocks of ten rows by ten columns). Rows are
// the ATTACKING element, columns the DEFENDER's, values PERCENTAGES: 100 is a
// neutral trade, 0 is immunity, above 100 is extra damage, and BELOW ZERO means
// the hit heals the target.
//
// This is a literal, not a generated one. An earlier version derived levels 2 to
// 4 from level 1 by pushing each cell 25 further in the direction it already
// leaned; that rule is an invention and it got 68.5% of the 400 cells right.
// The real table does not behave that way: it saturates at 200 and floors at
// -100, and around twenty cells that sit at exactly 100 at level 1 DO move with
// level (holy against water goes 100/100/100/75, water against undead
// 100/100/125/150). Ten level-1 cells were wrong on their own as well.
//
// The relationships worth knowing while reading it:
//   - the four-way ring: water beats fire beats earth beats wind beats water
//   - holy and shadow answer each other, and holy is what the undead fear
//   - poison does nothing to poison, and at level 1 the undead ABSORB it
//   - ghost is the answer to neutral, and neutral barely touches ghost
//   - an element resists itself, except earth, which does not
const ATTRIBUTE_TABLE: Readonly<
  Record<ElementLevel, Readonly<Record<Element, Readonly<Record<Element, number>>>>>
> = {
  1: {
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
      earth: 100,
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
      undead: 125,
    },
    wind: {
      neutral: 100,
      water: 175,
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
      earth: 125,
      fire: 125,
      wind: 125,
      poison: 0,
      holy: 75,
      shadow: 50,
      ghost: 100,
      undead: -25,
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
      undead: -25,
    },
    ghost: {
      neutral: 25,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 100,
      holy: 75,
      shadow: 75,
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
  },
  2: {
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
      water: 0,
      earth: 100,
      fire: 175,
      wind: 25,
      poison: 100,
      holy: 50,
      shadow: 75,
      ghost: 100,
      undead: 100,
    },
    earth: {
      neutral: 100,
      water: 100,
      earth: 50,
      fire: 25,
      wind: 175,
      poison: 100,
      holy: 50,
      shadow: 75,
      ghost: 100,
      undead: 100,
    },
    fire: {
      neutral: 100,
      water: 25,
      earth: 175,
      fire: 0,
      wind: 100,
      poison: 100,
      holy: 50,
      shadow: 75,
      ghost: 100,
      undead: 150,
    },
    wind: {
      neutral: 100,
      water: 175,
      earth: 25,
      fire: 100,
      wind: 0,
      poison: 100,
      holy: 50,
      shadow: 75,
      ghost: 100,
      undead: 100,
    },
    poison: {
      neutral: 100,
      water: 75,
      earth: 125,
      fire: 125,
      wind: 125,
      poison: 0,
      holy: 50,
      shadow: 25,
      ghost: 75,
      undead: -50,
    },
    holy: {
      neutral: 100,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 100,
      holy: -25,
      shadow: 150,
      ghost: 100,
      undead: 175,
    },
    shadow: {
      neutral: 100,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 25,
      holy: 150,
      shadow: -25,
      ghost: 100,
      undead: -50,
    },
    ghost: {
      neutral: 0,
      water: 75,
      earth: 75,
      fire: 75,
      wind: 75,
      poison: 75,
      holy: 50,
      shadow: 50,
      ghost: 150,
      undead: 125,
    },
    undead: {
      neutral: 100,
      water: 75,
      earth: 75,
      fire: 75,
      wind: 75,
      poison: 25,
      holy: 125,
      shadow: 0,
      ghost: 100,
      undead: 0,
    },
  },
  3: {
    neutral: {
      neutral: 100,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 100,
      holy: 100,
      shadow: 100,
      ghost: 0,
      undead: 100,
    },
    water: {
      neutral: 100,
      water: -25,
      earth: 100,
      fire: 200,
      wind: 0,
      poison: 100,
      holy: 25,
      shadow: 50,
      ghost: 100,
      undead: 125,
    },
    earth: {
      neutral: 100,
      water: 100,
      earth: 0,
      fire: 0,
      wind: 200,
      poison: 100,
      holy: 25,
      shadow: 50,
      ghost: 100,
      undead: 75,
    },
    fire: {
      neutral: 100,
      water: 0,
      earth: 200,
      fire: -25,
      wind: 100,
      poison: 100,
      holy: 25,
      shadow: 50,
      ghost: 100,
      undead: 175,
    },
    wind: {
      neutral: 100,
      water: 200,
      earth: 0,
      fire: 100,
      wind: -25,
      poison: 100,
      holy: 25,
      shadow: 50,
      ghost: 100,
      undead: 100,
    },
    poison: {
      neutral: 100,
      water: 50,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 0,
      holy: 25,
      shadow: 0,
      ghost: 50,
      undead: -75,
    },
    holy: {
      neutral: 100,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 125,
      holy: -50,
      shadow: 175,
      ghost: 100,
      undead: 200,
    },
    shadow: {
      neutral: 100,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 0,
      holy: 175,
      shadow: -50,
      ghost: 100,
      undead: -75,
    },
    ghost: {
      neutral: 0,
      water: 50,
      earth: 50,
      fire: 50,
      wind: 50,
      poison: 50,
      holy: 25,
      shadow: 25,
      ghost: 175,
      undead: 150,
    },
    undead: {
      neutral: 100,
      water: 50,
      earth: 50,
      fire: 50,
      wind: 50,
      poison: 0,
      holy: 150,
      shadow: 0,
      ghost: 100,
      undead: 0,
    },
  },
  4: {
    neutral: {
      neutral: 100,
      water: 100,
      earth: 100,
      fire: 100,
      wind: 100,
      poison: 100,
      holy: 100,
      shadow: 100,
      ghost: 0,
      undead: 100,
    },
    water: {
      neutral: 100,
      water: -50,
      earth: 100,
      fire: 200,
      wind: 0,
      poison: 75,
      holy: 0,
      shadow: 25,
      ghost: 100,
      undead: 150,
    },
    earth: {
      neutral: 100,
      water: 100,
      earth: -25,
      fire: 0,
      wind: 200,
      poison: 75,
      holy: 0,
      shadow: 25,
      ghost: 100,
      undead: 50,
    },
    fire: {
      neutral: 100,
      water: 0,
      earth: 200,
      fire: -50,
      wind: 100,
      poison: 75,
      holy: 0,
      shadow: 25,
      ghost: 100,
      undead: 200,
    },
    wind: {
      neutral: 100,
      water: 200,
      earth: 0,
      fire: 100,
      wind: -50,
      poison: 75,
      holy: 0,
      shadow: 25,
      ghost: 100,
      undead: 100,
    },
    poison: {
      neutral: 100,
      water: 25,
      earth: 75,
      fire: 75,
      wind: 75,
      poison: 0,
      holy: 0,
      shadow: -25,
      ghost: 25,
      undead: -100,
    },
    holy: {
      neutral: 100,
      water: 75,
      earth: 75,
      fire: 75,
      wind: 75,
      poison: 125,
      holy: -100,
      shadow: 200,
      ghost: 100,
      undead: 200,
    },
    shadow: {
      neutral: 100,
      water: 75,
      earth: 75,
      fire: 75,
      wind: 75,
      poison: -25,
      holy: 200,
      shadow: -100,
      ghost: 100,
      undead: -100,
    },
    ghost: {
      neutral: 0,
      water: 25,
      earth: 25,
      fire: 25,
      wind: 25,
      poison: 25,
      holy: 0,
      shadow: 0,
      ghost: 200,
      undead: 175,
    },
    undead: {
      neutral: 100,
      water: 25,
      earth: 25,
      fire: 25,
      wind: 25,
      poison: -25,
      holy: 175,
      shadow: 0,
      ghost: 100,
      undead: 0,
    },
  },
};

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
  const lvl = (Math.max(1, Math.min(4, Math.trunc(level))) || 1) as ElementLevel;
  return ATTRIBUTE_TABLE[lvl][attack][defend];
}

/** Does this attack heal the target instead of hurting it? The chart reaches
 *  absorption at the deep end, and a caller that clamps damage at 0 would turn a
 *  build-defining interaction into a no-op. */
export function elementAbsorbs(attack: Element, defend: Element, level: ElementLevel = 1): boolean {
  return elementPercent(attack, defend, level) < 0;
}
