// The element triangle.
//
// These pin the RELATIONSHIPS rather than reciting the table back at itself: a
// test that asserts LEVEL_1.fire.earth === 150 by reading LEVEL_1.fire.earth
// proves nothing. What matters is that fire beats earth, that the ring closes,
// that holy and shadow answer each other, and that a defender's attribute level
// sharpens the chart in both directions rather than only resisting more.

import { describe, expect, it } from 'vitest';
import {
  ELEMENT_LEVELS,
  ELEMENTS,
  type Element,
  type ElementLevel,
  elementAbsorbs,
  elementMultiplier,
  elementPercent,
  RACES,
  SIZES,
} from '../src/sim/combat/elements';

const pct = (a: Element, d: Element, l: ElementLevel = 1) => elementPercent(a, d, l);

describe('the closed vocabularies', () => {
  it('carries ten elements, ten races, three sizes, and no duplicates', () => {
    expect(ELEMENTS).toHaveLength(10);
    expect(new Set(ELEMENTS).size).toBe(10);
    expect(RACES).toHaveLength(10);
    expect(new Set(RACES).size).toBe(10);
    expect([...SIZES]).toEqual(['small', 'medium', 'large']);
    expect(ELEMENT_LEVELS).toEqual([1, 2, 3, 4]);
  });
});

describe('the element ring', () => {
  it('closes: water beats fire beats earth beats wind beats water', () => {
    expect(pct('water', 'fire')).toBeGreaterThan(100);
    expect(pct('fire', 'earth')).toBeGreaterThan(100);
    expect(pct('earth', 'wind')).toBeGreaterThan(100);
    expect(pct('wind', 'water')).toBeGreaterThan(100);
  });

  it('runs the other way too: each is resisted by the one it beats', () => {
    expect(pct('fire', 'water')).toBeLessThan(100);
    expect(pct('earth', 'fire')).toBeLessThan(100);
    expect(pct('wind', 'earth')).toBeLessThan(100);
    expect(pct('water', 'wind')).toBeLessThan(100);
  });

  it('makes an element resist itself, with three named exceptions', () => {
    // Neutral is the plain trade and resists nothing. Earth is an even trade
    // against itself at level 1 and only starts resisting from level 2. Ghost
    // is the one element that takes MORE from its own kind, pinned below.
    const evenAtLevelOne: readonly Element[] = ['neutral', 'earth', 'ghost'];
    for (const e of ELEMENTS) {
      if (evenAtLevelOne.includes(e)) continue;
      expect(pct(e, e), `${e} vs ${e}`).toBeLessThan(100);
    }
    expect(pct('neutral', 'neutral')).toBe(100);
    // Earth is the slow one: even at level 1, then down through immunity into
    // absorption. Missing this is what an invented per-level rule gets wrong.
    expect([1, 2, 3, 4].map((l) => pct('earth', 'earth', l as ElementLevel))).toEqual([
      100, 50, 0, -25,
    ]);
  });

  it('makes ghost the answer to ghost: the chart has one self-weakness', () => {
    // Every other element shrugs off its own kind. Ghost takes MORE from ghost,
    // and that single exception is the whole reason a ghost-property weapon is
    // what a player brings to a ghost-property monster: nothing else works and
    // the monster does not resist the one thing that does.
    expect(pct('ghost', 'ghost')).toBeGreaterThan(100);
    expect(pct('ghost', 'ghost')).toBeGreaterThan(pct('neutral', 'ghost'));
    // And it sharpens with level like any other weakness.
    expect(pct('ghost', 'ghost', 4)).toBeGreaterThan(pct('ghost', 'ghost', 1));
  });
});

describe('the answers outside the ring', () => {
  it('sets holy and shadow against each other', () => {
    expect(pct('holy', 'shadow')).toBeGreaterThan(100);
    expect(pct('shadow', 'holy')).toBeGreaterThan(100);
  });

  it('makes holy and fire the answer to the undead, and shadow the opposite', () => {
    expect(pct('holy', 'undead')).toBeGreaterThan(100);
    expect(pct('fire', 'undead')).toBeGreaterThan(100);
    // Shadow does not merely fail against the undead: they FEED on it. This is
    // the single most build-relevant cell in the chart and the easiest to get
    // backwards, so it is pinned to its literal values at every level.
    expect([1, 2, 3, 4].map((l) => pct('shadow', 'undead', l as ElementLevel))).toEqual([
      -25, -50, -75, -100,
    ]);
  });

  it('leaves poison useless against poison and healing to the undead', () => {
    expect(pct('poison', 'poison')).toBe(0);
    expect([1, 2, 3, 4].map((l) => pct('poison', 'undead', l as ElementLevel))).toEqual([
      -25, -50, -75, -100,
    ]);
  });

  it('makes ghost the answer to neutral, and neutral almost no answer to ghost', () => {
    expect(pct('ghost', 'neutral')).toBeLessThan(100);
    expect(pct('neutral', 'ghost')).toBeLessThan(100);
    // The pairing that makes a ghost-property monster a wall to an unarmed hit:
    // a plain neutral swing is the WORST thing to bring to it.
    expect(pct('neutral', 'ghost')).toBeLessThan(pct('fire', 'ghost'));
  });

  it('leaves a neutral attack an even trade against everything but ghost', () => {
    for (const d of ELEMENTS) {
      if (d === 'ghost') continue;
      expect(pct('neutral', d), `neutral vs ${d}`).toBe(100);
    }
  });
});

describe('the defender attribute level', () => {
  it('sharpens a weakness rather than softening it', () => {
    // The counter-intuitive half, and the reason a level-4 monster is not simply
    // "tougher": what already beat it beats it harder.
    let prev = pct('fire', 'earth', 1);
    for (const level of [2, 3, 4] as ElementLevel[]) {
      const now = pct('fire', 'earth', level);
      expect(now, `fire vs earth L${level}`).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(pct('fire', 'earth', 4)).toBeGreaterThan(pct('fire', 'earth', 1));
  });

  it('deepens a resistance as the level rises', () => {
    let prev = pct('fire', 'water', 1);
    for (const level of [2, 3, 4] as ElementLevel[]) {
      const now = pct('fire', 'water', level);
      expect(now, `fire vs water L${level}`).toBeLessThanOrEqual(prev);
      prev = now;
    }
    // Fire bottoms out at immunity against water, not absorption: a resistance
    // deepening does NOT automatically become a heal.
    expect(pct('fire', 'water', 4)).toBe(0);
    expect(elementAbsorbs('fire', 'water', 4)).toBe(false);
  });

  it('turns the three deep resistances into an outright heal', () => {
    // A caller clamping damage at zero erases this entirely, so it gets its own
    // predicate rather than living as a sign check somewhere.
    expect(elementAbsorbs('shadow', 'undead', 1)).toBe(true);
    expect(elementAbsorbs('poison', 'undead', 1)).toBe(true);
    expect(elementAbsorbs('earth', 'earth', 4)).toBe(true);
    expect(elementMultiplier('shadow', 'undead', 4)).toBe(-1);
    // The complete set, pinned as a literal. Every element that resists itself
    // hard enough ends up absorbing itself at level 4; on top of that the
    // poison/shadow/undead cluster feeds on each other from level 1. Any edit to
    // the table that adds or removes an absorbing pair has to come here first.
    const absorbing = new Set<string>();
    for (const a of ELEMENTS)
      for (const d of ELEMENTS)
        for (const level of ELEMENT_LEVELS)
          if (elementAbsorbs(a, d, level)) absorbing.add(`${a}->${d}`);
    expect([...absorbing].sort()).toEqual([
      'earth->earth',
      'fire->fire',
      'holy->holy',
      'poison->shadow',
      'poison->undead',
      'shadow->poison',
      'shadow->shadow',
      'shadow->undead',
      'undead->poison',
      'water->water',
      'wind->wind',
    ]);
    // Neutral never absorbs anything, at any level: it is the plain trade.
    for (const d of ELEMENTS)
      for (const level of ELEMENT_LEVELS)
        expect(elementAbsorbs('neutral', d, level), `neutral vs ${d} L${level}`).toBe(false);
  });

  it('leaves the plain neutral trade even at every level', () => {
    for (const level of ELEMENT_LEVELS) expect(pct('neutral', 'fire', level)).toBe(100);
  });

  it('does NOT freeze every cell that sits at 100 at level 1', () => {
    // The trap an invented per-level rule falls into: "a cell at 100 is a
    // neutral trade and never moves" is false. Around twenty of them move.
    expect([1, 2, 3, 4].map((l) => pct('holy', 'water', l as ElementLevel))).toEqual([
      100, 100, 100, 75,
    ]);
    expect([1, 2, 3, 4].map((l) => pct('water', 'undead', l as ElementLevel))).toEqual([
      100, 100, 125, 150,
    ]);
  });

  it('never runs past the ends of the chart', () => {
    for (const a of ELEMENTS)
      for (const d of ELEMENTS)
        for (const level of ELEMENT_LEVELS) {
          const v = pct(a, d, level);
          expect(v, `${a} vs ${d} L${level}`).toBeLessThanOrEqual(200);
          expect(v, `${a} vs ${d} L${level}`).toBeGreaterThanOrEqual(-100);
        }
  });

  it('clamps a level outside 1 to 4 instead of running off the table', () => {
    expect(pct('fire', 'earth', 0 as ElementLevel)).toBe(pct('fire', 'earth', 1));
    expect(pct('fire', 'earth', 9 as ElementLevel)).toBe(pct('fire', 'earth', 4));
  });
});

describe('the multiplier a caller actually uses', () => {
  it('is the percentage as a fraction', () => {
    expect(elementMultiplier('neutral', 'fire')).toBe(1);
    expect(elementMultiplier('fire', 'earth')).toBeCloseTo(1.5, 10);
    expect(elementMultiplier('poison', 'poison')).toBe(0);
  });

  it('is defined for all 400 combinations', () => {
    for (const a of ELEMENTS)
      for (const d of ELEMENTS)
        for (const level of ELEMENT_LEVELS)
          expect(Number.isFinite(elementMultiplier(a, d, level)), `${a}/${d}/${level}`).toBe(true);
  });
});
