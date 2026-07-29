// The `{base, per}` level convention.
//
// This is the single most load-bearing piece of arithmetic in the SpiritVale
// data: every skill number, every status modifier and every passive line reads
// through it. Getting the off-by-one wrong would not crash anything, it would
// quietly make 105 skills deal zero damage at level 1, so the cases below pin
// the convention against the evidence rather than against the implementation.

import { describe, expect, it } from 'vitest';
import { SPIRITVALE_SKILLS } from '../src/sim/content/skills';
import {
  isEmpty,
  isFlat,
  nonNegativeAt,
  UNLEARNED_SKILL_LEVEL,
  valueAt,
} from '../src/sim/skills/scaling';

describe('valueAt', () => {
  it('reads base + per * level, not base + per * (level - 1)', () => {
    const p = { base: 1, per: 0.6 };
    expect(valueAt(p, 1)).toBeCloseTo(1.6, 10);
    expect(valueAt(p, 5)).toBeCloseTo(4, 10);
    // The wrong reading, spelled out so a future edit toward it is unmistakable.
    expect(valueAt(p, 1)).not.toBeCloseTo(1, 10);
  });

  it('reads level 0 as the unlearned base, with no special case', () => {
    expect(UNLEARNED_SKILL_LEVEL).toBe(0);
    expect(valueAt({ base: 7, per: 3 }, 0)).toBe(7);
    expect(valueAt({ base: 0, per: 3 }, 0)).toBe(0);
  });

  it('clamps a negative or corrupt level to unlearned rather than running backwards', () => {
    const p = { base: 10, per: 5 };
    expect(valueAt(p, -1)).toBe(10);
    expect(valueAt(p, -99)).toBe(10);
    // A fractional level floors, so a corrupt 2.9 buys level 2 and not level 3.
    expect(valueAt(p, 2.9)).toBe(20);
  });

  it('handles a negative per, which is how cooldowns shrink with level', () => {
    // Aegis of Light: 80 second cooldown falling 10 a level, max level 5.
    const cd = { base: 80, per: -10 };
    expect(valueAt(cd, 1)).toBe(70);
    expect(valueAt(cd, 5)).toBe(30);
  });
});

describe('the shape helpers', () => {
  it('calls a pair flat when it never varies, and empty when it says nothing', () => {
    expect(isFlat({ base: 4, per: 0 })).toBe(true);
    expect(isFlat({ base: 4, per: 1 })).toBe(false);
    expect(isEmpty({ base: 0, per: 0 })).toBe(true);
    // Empty implies flat, but flat does not imply empty.
    expect(isFlat({ base: 0, per: 0 })).toBe(true);
    expect(isEmpty({ base: 4, per: 0 })).toBe(false);
  });

  it('floors at zero only where a negative would be nonsense', () => {
    expect(nonNegativeAt({ base: 5, per: -3 }, 4)).toBe(0);
    expect(nonNegativeAt({ base: 5, per: -3 }, 1)).toBe(2);
  });
});

describe('the convention against the real content', () => {
  it('gives every damage skill a non-zero value at its first level', () => {
    // The decisive case. Under the (L-1) reading, every skill whose damage has
    // base 0 deals literally nothing at level 1. That set is not a curiosity: it
    // is most of the damage skills in the game.
    const damaging = Object.values(SPIRITVALE_SKILLS).filter((s) => s.damage);
    expect(damaging.length).toBeGreaterThan(20);
    const zeroBase = damaging.filter((s) => s.damage?.base === 0);
    expect(zeroBase.length).toBeGreaterThan(10);
    for (const s of damaging) {
      const atOne = valueAt(s.damage as { base: number; per: number }, 1);
      expect(atOne, `${s.id} deals nothing at level 1`).not.toBe(0);
    }
  });

  it('never drives a cost, cooldown or duration negative at max level', () => {
    for (const s of Object.values(SPIRITVALE_SKILLS)) {
      for (const field of ['cost', 'cooldown', 'duration', 'castTime'] as const) {
        const pair = s[field];
        if (!pair) continue;
        expect(valueAt(pair, s.maxLevel), `${s.id}.${field} at max`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps healing negative, because that is the only heal encoding there is', () => {
    // SpiritVale publishes no heal field. A heal is a skill with negative
    // damage, so any pass that clamps damage at zero silently deletes it.
    const heals = Object.values(SPIRITVALE_SKILLS).filter(
      (s) => s.damage && valueAt(s.damage, 1) < 0,
    );
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) {
      expect(h.targetType, `${h.id} heals but does not target an ally`).not.toBe('enemy');
    }
    // And the one helper that clamps is not reachable from damage by accident.
    const heal = heals[0];
    expect(valueAt(heal.damage as { base: number; per: number }, 3)).toBeLessThan(0);
  });
});
