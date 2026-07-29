// The tail of a physical hit.
//
// Everything here is about ORDER. The values are trivial; the reason the module
// exists is that this game had them in the wrong sequence, with the attribute
// chart applied before defence and the floor applied inside it, and no test
// anywhere said what the sequence was supposed to be.
//
// Defence is now ONE multiplier (stats/defence_curve.ts, 100/(DEF + 100)) rather
// than a capped percentage followed by a flat subtraction. That removes the
// negative running total the old model produced, so the refine bonus is an
// ordinary addition instead of a dig out of a hole. The floor, the chart's
// position after defence, and the card step last are all unchanged.

import { describe, expect, it } from 'vitest';
import {
  MIN_DAMAGE_AFTER_REFINE,
  type PhysicalTail,
  resolvePhysicalTail,
} from '../src/sim/combat/damage_pipeline';
import { damageTakenFraction } from '../src/sim/stats/defence_curve';

const base = (over: Partial<PhysicalTail> = {}): PhysicalTail => ({
  damage: 1000,
  defenceMultiplier: 1,
  ...over,
});

describe('defence', () => {
  it('is a single multiplier on the incoming hit', () => {
    expect(resolvePhysicalTail(base({ defenceMultiplier: 0.5 }))).toBe(500);
    expect(resolvePhysicalTail(base({ defenceMultiplier: 0.25 }))).toBe(250);
  });

  it('is skipped outright when the hit ignores defence', () => {
    expect(resolvePhysicalTail(base({ defenceMultiplier: 0.1, ignoreDefence: true }))).toBe(1000);
  });

  it('never eats a hit entirely, at any defence the curve can produce', () => {
    // The reason the curve replaced the two-layer model. Under the old one, a
    // flat soft-defence amount larger than the hit drove the running total
    // negative and only the floor of 1 saved it; a capped percentage could take
    // 100% outright. Neither can happen now: feed the pipeline a real curve
    // value from any defence and something always lands.
    for (const def of [0, 100, 250, 600, 5_000, 1e9]) {
      const out = resolvePhysicalTail(
        base({ damage: 10, defenceMultiplier: damageTakenFraction(def) }),
      );
      expect(out, `defence ${def}`).toBeGreaterThan(0);
    }
  });
});

describe('refine, and the floor that follows it', () => {
  it('adds after defence, so it is worth more against a heavily armoured target', () => {
    // 100 damage through a 0.1 multiplier is 10; a +40 refine makes it 50. The
    // same refine added BEFORE defence would give (100 + 40) * 0.1 = 14.
    expect(resolvePhysicalTail(base({ damage: 100, defenceMultiplier: 0.1, refineFlat: 40 }))).toBe(
      50,
    );
  });

  it('floors a hit the curve reduced below one', () => {
    expect(resolvePhysicalTail(base({ damage: 10, defenceMultiplier: 0.01 }))).toBe(
      MIN_DAMAGE_AFTER_REFINE,
    );
  });
});

describe('the attribute chart', () => {
  it('runs AFTER defence, not before', () => {
    // (1000 * 0.5) * 0.5 = 250. Same number either way with a pure multiplier,
    // so the discriminating case is the one below, where refine sits between.
    expect(resolvePhysicalTail(base({ defenceMultiplier: 0.5, elementMultiplier: 0.5 }))).toBe(250);
  });

  it('runs after REFINE too, which is what actually distinguishes the order', () => {
    // (1000 * 0.5 + 100) * 0.5 = 300.
    // Chart before refine would give 1000 * 0.5 * 0.5 + 100 = 350.
    const out = resolvePhysicalTail(
      base({ defenceMultiplier: 0.5, refineFlat: 100, elementMultiplier: 0.5 }),
    );
    expect(out).toBe(300);
    expect(out).not.toBe(350);
  });

  it('is not stopped by the floor, so a hit can still turn into a heal', () => {
    // The floor sits between refine and the chart. A defender that absorbs the
    // attribute gets healed even from a hit defence had already reduced to the
    // floor: negative out, and the caller decides what that means.
    const healed = resolvePhysicalTail(
      base({ damage: 10, defenceMultiplier: 0.01, elementMultiplier: -0.25 }),
    );
    expect(healed).toBeLessThan(0);
    expect(healed).toBe(-0.25);
  });

  it('leaves immunity at exactly zero', () => {
    expect(resolvePhysicalTail(base({ elementMultiplier: 0 }))).toBe(0);
  });
});

describe('cards, last', () => {
  it('scale what the chart already decided', () => {
    // A card that hunts a race adds a fifth of the post-chart number, not a
    // fifth of the raw swing.
    expect(
      resolvePhysicalTail(
        base({ defenceMultiplier: 0.5, elementMultiplier: 2, cardMultiplier: 1.2 }),
      ),
    ).toBe(1200);
  });

  it('cannot rescue a hit the chart zeroed', () => {
    expect(resolvePhysicalTail(base({ elementMultiplier: 0, cardMultiplier: 5 }))).toBe(0);
  });

  it('deepen an absorption rather than reversing it', () => {
    const v = resolvePhysicalTail(base({ elementMultiplier: -0.5, cardMultiplier: 2 }));
    expect(v).toBeLessThan(0);
  });
});

describe('the defaults', () => {
  it('leave a plain hit alone when nothing optional is supplied', () => {
    expect(resolvePhysicalTail(base())).toBe(1000);
  });
});
