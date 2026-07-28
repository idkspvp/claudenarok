// What the six attributes buy: the right-hand half of the status window.
//
// The load-bearing property is that this core READS and never re-derives. Every
// number it reports has an owner in the sim, and a second copy of any of those
// formulas here is a copy that eventually disagrees with the one that decides
// the fight. So the assertions drive it from a stub whose values are
// deliberately unlike each other, and check that each lands in the right row
// rather than that any formula is correct.

import { describe, expect, it } from 'vitest';
import {
  aspdDisplay,
  buildDerivedStats,
  DERIVED_STAT_IDS,
  type DerivedStatId,
} from '../src/ui/derived_stats_view';
import type { IWorld } from '../src/world_api';

const stubWorld = (over: Record<string, unknown> = {}): IWorld =>
  ({
    player: {
      stats: { str: 10, agi: 20, vit: 30, int: 40, dex: 50, luk: 60, armor: 25, mdef: 7 },
      weapon: { min: 100, max: 140, speed: 1.5 },
      attackPower: 11,
      spellPower: 88,
      hit: 77,
      flee: 66,
      critChance: 0.125,
      ...over,
    },
  }) as unknown as IWorld;

const rowById = (world: IWorld, id: DerivedStatId) =>
  buildDerivedStats(world)?.rows.find((r) => r.id === id);

describe('the shape of the readout', () => {
  it('reports every row once, in a stable order', () => {
    const model = buildDerivedStats(stubWorld());
    expect(model).not.toBeNull();
    expect(model?.rows.map((r) => r.id)).toEqual([...DERIVED_STAT_IDS]);
    expect(new Set(model?.rows.map((r) => r.id)).size).toBe(DERIVED_STAT_IDS.length);
  });

  it('withholds the whole panel until there is something real to read', () => {
    // Three states a painter can meet: no character, a mirrored one whose first
    // snapshot has not filled the derived fields, and one with no weapon. A row
    // of zeroes reads like a character with no gear, so none of them paint.
    expect(buildDerivedStats({ player: null } as unknown as IWorld)).toBeNull();
    expect(buildDerivedStats({ player: {} } as unknown as IWorld)).toBeNull();
    expect(buildDerivedStats({ player: { stats: { str: 1 } } } as unknown as IWorld)).toBeNull();
  });

  it('rounds every value to a whole number', () => {
    for (const r of buildDerivedStats(stubWorld())?.rows ?? []) {
      expect(Number.isInteger(r.value), r.id).toBe(true);
    }
  });
});

describe('what each row reads', () => {
  it('splits attack into the weapon and the wielder', () => {
    // The reference keeps these apart because they answer different questions:
    // the left number is what you are holding, the right is what you are.
    const atk = rowById(stubWorld(), 'atk');
    expect(atk?.value).toBe(120); // midpoint of 100..140
    expect(atk?.second).toBe(11);
    expect(atk?.pair).toBe('plus');
  });

  it('shows the critical chance as a percentage, not a fraction', () => {
    expect(rowById(stubWorld(), 'crit')?.value).toBe(13); // 0.125 -> 12.5 -> 13
  });

  it('pairs evasion with the perfect dodge Luck buys', () => {
    // Two separate rolls in the reference, so two numbers here.
    const flee = rowById(stubWorld(), 'flee');
    expect(flee?.value).toBe(66);
    expect(flee?.second).toBe(7); // 1 + 60 * 0.1
  });

  it('pairs each defence with its soft half', () => {
    expect(rowById(stubWorld(), 'def')).toMatchObject({ value: 25, second: 30, pair: 'plus' });
    // Soft magic defence is INT + half of VIT: 40 + 15.
    expect(rowById(stubWorld(), 'mdef')).toMatchObject({ value: 7, second: 55, pair: 'plus' });
  });

  it('takes accuracy and magic attack straight off the character', () => {
    expect(rowById(stubWorld(), 'hit')?.value).toBe(77);
    const matk = rowById(stubWorld(), 'matk');
    expect(matk?.value).toBe(88);
    expect(matk?.pair).toBe('range');
  });
});

describe('attack speed, the one conversion', () => {
  it('turns a swing interval into the rate the reference displays', () => {
    // The reference caps at 190, which is a 200ms swing: (2000 - 190*10)*2.
    expect(aspdDisplay(0.2)).toBe(190);
    expect(aspdDisplay(1)).toBe(150);
    expect(aspdDisplay(1.5)).toBe(125);
    expect(aspdDisplay(2)).toBe(100);
  });

  it('is monotonic: a faster swing always reads higher', () => {
    let prev = -1;
    for (const interval of [2, 1.5, 1.2, 1, 0.7, 0.5, 0.3, 0.2]) {
      const now = aspdDisplay(interval);
      expect(now, `${interval}s`).toBeGreaterThan(prev);
      prev = now;
    }
  });

  it('never runs off either end of the scale', () => {
    // A garbage interval must not produce a negative rate or one past the cap.
    expect(aspdDisplay(0)).toBe(0);
    expect(aspdDisplay(-1)).toBe(0);
    expect(aspdDisplay(Number.NaN)).toBe(0);
    expect(aspdDisplay(999)).toBe(0);
    expect(aspdDisplay(0.0001)).toBe(200);
  });

  it('reaches the row through the model', () => {
    expect(rowById(stubWorld(), 'aspd')?.value).toBe(125);
  });
});
