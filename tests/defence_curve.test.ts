// The defence curve, pinned against docs/design/spiritvale-engine-formulas.md.
//
// The immunity test is the point of this file. The model this replaces had a
// hard ceiling at 100 that a Fiesta augment walked straight through, so the
// assertion that matters is not "the arithmetic is right" but "no input reaches
// zero damage taken", checked across a range that includes the values that
// broke the old model.

import { describe, expect, it } from 'vitest';
import {
  applyDefence,
  DEFENCE_HALF_POINT,
  damageReductionFraction,
  damageTakenFraction,
  defenceForReduction,
} from '../src/sim/stats/defence_curve';

describe('the defence curve', () => {
  it('matches the published landmarks', () => {
    // 100 / (DEF + 100), read straight off the reference.
    expect(damageTakenFraction(0)).toBe(1);
    expect(damageTakenFraction(100)).toBeCloseTo(0.5, 10);
    expect(damageTakenFraction(300)).toBeCloseTo(0.25, 10);
    expect(damageTakenFraction(900)).toBeCloseTo(0.1, 10);
    expect(DEFENCE_HALF_POINT).toBe(100);
  });

  it('reports reduction as the complement, which is what a sheet shows', () => {
    expect(damageReductionFraction(0)).toBe(0);
    expect(damageReductionFraction(100)).toBeCloseTo(0.5, 10);
    expect(damageReductionFraction(300)).toBeCloseTo(0.75, 10);
  });

  it('NEVER reaches immunity, at any defence, including the values that broke the old model', () => {
    // 250 to 600 is the Fiesta augment range that made a player immune under the
    // capped-percentage model. 1e6 and 1e12 stand in for "anything a bug could
    // ever produce". Every one must still let damage through.
    for (const def of [100, 250, 400, 600, 1_000, 10_000, 1e6, 1e12]) {
      const through = damageTakenFraction(def);
      expect(through, `defence ${def} must not be immune`).toBeGreaterThan(0);
      expect(applyDefence(1_000_000, def), `defence ${def} must take damage`).toBeGreaterThan(0);
    }
  });

  it('is strictly decreasing, so a point of defence is never wasted or harmful', () => {
    let previous = damageTakenFraction(0);
    for (let def = 1; def <= 2_000; def++) {
      const current = damageTakenFraction(def);
      expect(current, `defence ${def} must take strictly less than ${def - 1}`).toBeLessThan(
        previous,
      );
      previous = current;
    }
  });

  it('clamps negative defence rather than amplifying the hit', () => {
    expect(damageTakenFraction(-500)).toBe(1);
    expect(applyDefence(200, -500)).toBe(200);
  });

  it('applies to a raw hit and never returns a negative number', () => {
    expect(applyDefence(200, 100)).toBeCloseTo(100, 10);
    expect(applyDefence(0, 100)).toBe(0);
    expect(applyDefence(-50, 100)).toBe(0);
  });

  it('inverts, and answers Infinity for immunity because that is the truth', () => {
    expect(defenceForReduction(0.5)).toBeCloseTo(100, 10);
    expect(defenceForReduction(0.75)).toBeCloseTo(300, 10);
    expect(defenceForReduction(0.9)).toBeCloseTo(900, 10);
    expect(defenceForReduction(1)).toBe(Number.POSITIVE_INFINITY);
    expect(defenceForReduction(2)).toBe(Number.POSITIVE_INFINITY);
    // Round trip: any reduction resolves to a defence that produces it back.
    for (const f of [0.1, 0.33, 0.5, 0.8, 0.95]) {
      expect(damageReductionFraction(defenceForReduction(f))).toBeCloseTo(f, 10);
    }
  });
});
