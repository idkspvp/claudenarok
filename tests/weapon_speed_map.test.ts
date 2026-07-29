// The join between this game's weapon vocabulary and the reference's speed
// table.
//
// This is OUR mapping, not a transcription, so it is the file where a judgement
// call about a weapon's speed can hide. Two of the seventeen rows are genuine
// calls (knuckle and whip have no counterpart in the reference table) and both
// are pinned by name here so a later reader sees them as decisions rather than
// as data.

import { describe, expect, it } from 'vitest';
import {
  baseDelayFor,
  speedClassFor,
  WEAPON_SPEED_CLASS,
} from '../src/sim/combat/weapon_speed_map';
import { WEAPON_BASE_ATTACK_DELAY } from '../src/sim/stats/attack_speed';
import type { WeaponType } from '../src/sim/types';

const ALL_WEAPON_TYPES: WeaponType[] = [
  'dagger',
  'sword',
  'twohand_sword',
  'spear',
  'twohand_spear',
  'axe',
  'twohand_axe',
  'mace',
  'twohand_mace',
  'rod',
  'twohand_rod',
  'bow',
  'katar',
  'book',
  'knuckle',
  'instrument',
  'whip',
];

describe('the mapping is total', () => {
  it('covers every weapon type this game has', () => {
    for (const w of ALL_WEAPON_TYPES) {
      expect(WEAPON_SPEED_CLASS[w], w).toBeDefined();
    }
    expect(Object.keys(WEAPON_SPEED_CLASS)).toHaveLength(ALL_WEAPON_TYPES.length);
  });

  it('lands every row on a real entry in the reference table', () => {
    for (const w of ALL_WEAPON_TYPES) {
      expect(WEAPON_BASE_ATTACK_DELAY[WEAPON_SPEED_CLASS[w]], w).toBeGreaterThan(0);
    }
  });

  it('treats an empty hand as Unarmed, which is a real row and the fastest one', () => {
    expect(speedClassFor(null)).toBe('Unarmed');
    expect(speedClassFor(undefined)).toBe('Unarmed');
    expect(baseDelayFor(null)).toBe(0.9);
    const slowest = Math.max(...Object.values(WEAPON_BASE_ATTACK_DELAY));
    expect(baseDelayFor(null)).toBeLessThan(slowest);
    for (const w of ALL_WEAPON_TYPES) {
      expect(baseDelayFor(w), `${w} must not beat an empty hand`).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe('the two rows that are judgement calls', () => {
  it('sends knuckle to Unarmed, because a knuckle IS the fist slot', () => {
    expect(WEAPON_SPEED_CLASS.knuckle).toBe('Unarmed');
  });

  it('sends whip to Instrument, its paired weapon in the source game', () => {
    expect(WEAPON_SPEED_CLASS.whip).toBe('Instrument');
    expect(WEAPON_SPEED_CLASS.instrument).toBe('Instrument');
  });
});

describe('the rows that are not calls', () => {
  it('keeps one-handed and two-handed on the same delay, as the table does', () => {
    for (const [one, two] of [
      ['sword', 'twohand_sword'],
      ['spear', 'twohand_spear'],
      ['axe', 'twohand_axe'],
      ['mace', 'twohand_mace'],
      ['rod', 'twohand_rod'],
    ] as [WeaponType, WeaponType][]) {
      expect(baseDelayFor(one), `${one} vs ${two}`).toBe(baseDelayFor(two));
    }
  });

  it('pins the delays a player actually feels', () => {
    // Literals rather than a lookup: this is what a dagger user and an axe user
    // are trading, and a silent change to either should read as a failure here.
    expect(baseDelayFor('dagger')).toBe(1.0);
    expect(baseDelayFor('sword')).toBe(1.1);
    expect(baseDelayFor('mace')).toBe(1.15);
    expect(baseDelayFor('spear')).toBe(1.2);
    expect(baseDelayFor('rod')).toBe(1.2);
    expect(baseDelayFor('axe')).toBe(1.3);
    expect(baseDelayFor('bow')).toBe(1.4);
  });

  it('makes a dagger strictly faster than an axe, which is the whole ladder', () => {
    expect(baseDelayFor('dagger')).toBeLessThan(baseDelayFor('sword'));
    expect(baseDelayFor('sword')).toBeLessThan(baseDelayFor('axe'));
    expect(baseDelayFor('axe')).toBeLessThan(baseDelayFor('bow'));
  });
});
