// The world clock. Two properties carry the design and the rest guard them:
// the boolean is crisp while the light is smooth, and night never gets dark
// enough to hide something a player has to react to.

import { describe, expect, it } from 'vitest';
import {
  CYCLE_SECONDS,
  cyclePosition,
  DAY_SECONDS,
  dayCycleAt,
  daylight,
  isNight,
  MIN_NIGHT_LIGHT,
  NIGHT_SECONDS,
  TWILIGHT_SECONDS,
} from '../src/sim/day_cycle';

describe('the boolean', () => {
  it('is crisp: it flips in an instant, with no third state', () => {
    // The whole reason there is no dawn or dusk STATE. A caller branching on the
    // time of day gets a yes or a no and never a maybe.
    expect(isNight(DAY_SECONDS - 0.05)).toBe(false);
    expect(isNight(DAY_SECONDS)).toBe(true);
    expect(isNight(CYCLE_SECONDS - 0.05)).toBe(true);
    expect(isNight(CYCLE_SECONDS)).toBe(false);
  });

  it('gives day more of the cycle than night', () => {
    let nightTicks = 0;
    const N = CYCLE_SECONDS;
    for (let s = 0; s < N; s++) if (isNight(s)) nightTicks++;
    expect(nightTicks).toBe(NIGHT_SECONDS);
    expect(nightTicks).toBeLessThan(N - nightTicks);
  });

  it('repeats forever and handles a negative time without breaking', () => {
    for (const s of [0, 137, DAY_SECONDS + 5]) {
      expect(isNight(s)).toBe(isNight(s + CYCLE_SECONDS * 7));
    }
    expect(isNight(-1)).toBe(true); // one second before the wrap is late night
    expect(cyclePosition(-1)).toBeGreaterThan(0.99);
  });
});

describe('the light', () => {
  it('is smooth where the boolean is not', () => {
    // A hard cut is the thing this exists to avoid: the screen would jump a
    // brightness step in one frame. Across the flip the light must move by a
    // sliver, not by the whole range.
    const before = daylight(DAY_SECONDS - 0.05);
    const after = daylight(DAY_SECONDS + 0.05);
    expect(Math.abs(after - before)).toBeLessThan(0.02);
    expect(after).toBeLessThan(before);
  });

  it('puts the boundary in the MIDDLE of the ramp, which is what sunset means', () => {
    // Night begins halfway through the darkening rather than at the end of it,
    // so the sky is already going when the state changes.
    const mid = (1 + MIN_NIGHT_LIGHT) / 2;
    expect(daylight(DAY_SECONDS)).toBeCloseTo(mid, 5);
    expect(daylight(0)).toBeCloseTo(mid, 5);
  });

  it('reaches full day and full night away from the boundaries', () => {
    expect(daylight(DAY_SECONDS / 2)).toBe(1);
    expect(daylight(DAY_SECONDS + NIGHT_SECONDS / 2)).toBe(MIN_NIGHT_LIGHT);
  });

  it('moves monotonically through each ramp', () => {
    // Dusk only ever darkens and dawn only ever brightens. A non-monotone ramp
    // would read as a flicker.
    let prev = Number.POSITIVE_INFINITY;
    for (let s = DAY_SECONDS - TWILIGHT_SECONDS; s <= DAY_SECONDS + TWILIGHT_SECONDS; s += 0.5) {
      const v = daylight(s);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
    prev = Number.NEGATIVE_INFINITY;
    for (
      let s = CYCLE_SECONDS - TWILIGHT_SECONDS;
      s <= CYCLE_SECONDS + TWILIGHT_SECONDS;
      s += 0.5
    ) {
      const v = daylight(s);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('NEVER goes below the fairness floor, at any moment of any cycle', () => {
    // The load-bearing one. The repo forbids anything that hides information a
    // player acts on, and a night dark enough to lose a mob in is exactly that.
    // Sweeping the whole cycle rather than checking midnight is what makes this
    // decisive: the floor has to hold through both ramps too.
    for (let s = 0; s < CYCLE_SECONDS * 2; s += 0.5) {
      expect(daylight(s), `t=${s}`).toBeGreaterThanOrEqual(MIN_NIGHT_LIGHT);
      expect(daylight(s), `t=${s}`).toBeLessThanOrEqual(1);
    }
    // And the floor is high enough to still see by: a world at less than a third
    // of full light is not one you can fight in.
    expect(MIN_NIGHT_LIGHT).toBeGreaterThan(1 / 3);
  });
});

describe('the per-area override', () => {
  it('pins a town to daylight and an interior to night, whatever the clock says', () => {
    // Ragnarok's MF_NIGHTENABLED model: only the open world turns.
    for (const s of [0, DAY_SECONDS / 2, DAY_SECONDS, DAY_SECONDS + NIGHT_SECONDS / 2]) {
      expect(daylight(s, 'always_day')).toBe(1);
      expect(daylight(s, 'always_night')).toBe(MIN_NIGHT_LIGHT);
      expect(dayCycleAt(s, 'always_day').night).toBe(false);
      expect(dayCycleAt(s, 'always_night').night).toBe(true);
    }
  });

  it('leaves the cycle mode reading the clock', () => {
    const s = DAY_SECONDS + 10;
    expect(dayCycleAt(s).night).toBe(isNight(s));
    expect(dayCycleAt(s).light).toBe(daylight(s));
  });
});

describe('purity', () => {
  it('is a function of its argument alone, so the three hosts agree', () => {
    // `src/sim/` may not read a wall clock; the time comes in as a parameter.
    // Two players beside each other must see the same sky, which is the whole
    // reason this lives in the sim rather than the renderer.
    for (const s of [0, 601.5, DAY_SECONDS + 3]) {
      expect(dayCycleAt(s)).toEqual(dayCycleAt(s));
      expect(daylight(s)).toBe(daylight(s));
    }
  });
});
