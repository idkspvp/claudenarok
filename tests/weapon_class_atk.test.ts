// The weapon class attack bands.
//
// This module replaced a single item-level dps curve that every weapon in the
// game sat on, so what is worth pinning is the property the curve could not
// express: that the class, not the tier, decides how hard a weapon hits, and
// that the ordering between classes is the one Ragnarok's players expect.

import { describe, expect, it } from 'vitest';
import {
  ATK_BAND_HIGH,
  ATK_BAND_LOW,
  CLASS_ATK_MEDIAN,
  isInAtkBand,
  weaponAtkBand,
  weaponLevelFor,
} from '../src/sim/combat/weapon_class_atk';
import type { WeaponType } from '../src/sim/types';

const ALL = Object.keys(CLASS_ATK_MEDIAN) as WeaponType[];

describe('the band table', () => {
  it('covers every weapon type with a positive median', () => {
    expect(ALL.length).toBeGreaterThan(10);
    for (const t of ALL) expect(CLASS_ATK_MEDIAN[t], t).toBeGreaterThan(0);
  });

  it('brackets each median from below and above', () => {
    for (const t of ALL) {
      const band = weaponAtkBand(t);
      expect(band.min, t).toBeLessThan(CLASS_ATK_MEDIAN[t]);
      expect(band.max, t).toBeGreaterThan(CLASS_ATK_MEDIAN[t]);
      expect(band.min, t).toBeGreaterThan(0);
    }
  });

  it('derives the band from the two published spread constants', () => {
    // Pinned to literals so a silent widening of the spread, which would let any
    // weapon pass the content check, has to be a deliberate edit here.
    expect(ATK_BAND_LOW).toBe(0.45);
    expect(ATK_BAND_HIGH).toBe(1.4);
    expect(weaponAtkBand('sword')).toEqual({ min: 54, max: 168 });
    expect(weaponAtkBand('rod')).toEqual({ min: 27, max: 84 });
  });
});

describe('the ordering between classes', () => {
  it('puts every two-handed weapon above its one-handed twin', () => {
    const PAIRS: [WeaponType, WeaponType][] = [
      ['twohand_sword', 'sword'],
      ['twohand_axe', 'axe'],
      ['twohand_mace', 'mace'],
      ['twohand_rod', 'rod'],
      ['twohand_spear', 'spear'],
    ];
    for (const [two, one] of PAIRS) {
      expect(CLASS_ATK_MEDIAN[two], `${two} vs ${one}`).toBeGreaterThan(CLASS_ATK_MEDIAN[one]);
    }
  });

  it('makes the caster rod the weakest weapon in the game', () => {
    // The load-bearing one. A rod is not an underpowered sword, it is the
    // deliberate floor: a caster's damage is MATK, so its weapon gives up the
    // attack a melee weapon exists to provide.
    const weakest = ALL.reduce((a, b) => (CLASS_ATK_MEDIAN[a] <= CLASS_ATK_MEDIAN[b] ? a : b));
    expect(weakest).toBe('rod');
    expect(CLASS_ATK_MEDIAN.rod).toBeLessThan(CLASS_ATK_MEDIAN.dagger);
  });

  it('lets adjacent bands overlap, so class alone does not settle a matchup', () => {
    // A top-rung dagger really does out-attack a starting sword. If the bands
    // ever stopped overlapping, weapon choice would collapse into a strict
    // ranking and the class would stop being a tradeoff.
    expect(weaponAtkBand('dagger').max).toBeGreaterThan(weaponAtkBand('sword').min);
    expect(weaponAtkBand('rod').max).toBeGreaterThan(weaponAtkBand('twohand_sword').min);
  });
});

describe('membership and the refine rung', () => {
  it('accepts the endpoints and rejects a step outside either', () => {
    const band = weaponAtkBand('sword');
    expect(isInAtkBand('sword', band.min)).toBe(true);
    expect(isInAtkBand('sword', band.max)).toBe(true);
    expect(isInAtkBand('sword', band.min - 1)).toBe(false);
    expect(isInAtkBand('sword', band.max + 1)).toBe(false);
  });

  it('catches a weapon typed as the wrong class', () => {
    // The mistake the content check exists to find: a staff authored with sword
    // attack passes as a sword and fails as a rod.
    expect(isInAtkBand('sword', 150)).toBe(true);
    expect(isInAtkBand('rod', 150)).toBe(false);
  });

  it('walks the rung from the bottom of a band to the top', () => {
    const band = weaponAtkBand('sword');
    expect(weaponLevelFor('sword', band.min)).toBe(1);
    expect(weaponLevelFor('sword', band.max)).toBe(4);
    const rungs = [0, 0.3, 0.6, 0.9].map((t) =>
      weaponLevelFor('sword', Math.round(band.min + t * (band.max - band.min))),
    );
    expect(rungs).toEqual([1, 2, 3, 4]);
  });

  it('never returns a rung outside 1 to 4, even off the ends of the band', () => {
    for (const t of ALL) {
      const band = weaponAtkBand(t);
      for (const atk of [0, band.min - 50, band.min, band.max, band.max + 500]) {
        const rung = weaponLevelFor(t, atk);
        expect(rung, `${t} @ ${atk}`).toBeGreaterThanOrEqual(1);
        expect(rung, `${t} @ ${atk}`).toBeLessThanOrEqual(4);
      }
    }
  });
});
