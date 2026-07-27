// The per-job, per-weapon attack-speed table.
//
// A data table gets tested for the CLAIMS it makes, not for its cells: that a
// missing row is a real penalty, that the same weapon differs between jobs, that
// every job can attack unarmed, and that the resulting cadences land where
// Ragnarok's players would expect. A test that restated each number would pass
// on a table transcribed into the wrong columns.

import { describe, expect, it } from 'vitest';
import { attackIntervalSeconds, MAX_AMOTION_MS } from '../src/sim/combat/aspd';
import {
  ASPD_JOBS,
  type AspdJob,
  baseAmotionFor,
  DEFAULT_BASE_AMOTION,
  JOB_BASE_AMOTION,
  UNARMED_BASE_AMOTION,
} from '../src/sim/job_aspd';
import type { WeaponType } from '../src/sim/types';

describe('the shape of the table', () => {
  it('covers all five startable jobs, unarmed and armed', () => {
    expect(ASPD_JOBS).toHaveLength(5);
    for (const job of ASPD_JOBS) {
      expect(UNARMED_BASE_AMOTION[job]).toBeGreaterThan(0);
      expect(Object.keys(JOB_BASE_AMOTION[job]).length).toBeGreaterThan(0);
    }
  });

  it('leaves every authored row well inside the legal band', () => {
    for (const job of ASPD_JOBS) {
      for (const [weapon, value] of Object.entries(JOB_BASE_AMOTION[job])) {
        expect(value, `${job}/${weapon}`).toBeGreaterThan(0);
        expect(value, `${job}/${weapon}`).toBeLessThan(MAX_AMOTION_MS);
      }
    }
  });
});

describe('a missing row is the mechanic', () => {
  it('punishes a job for holding a weapon it has no row for', () => {
    // 2000 is `AMOTION_ZERO_ASPD`, twice the slowest authored entry in the whole
    // table. A Mage with an axe is not slightly worse than a Swordman with one,
    // they are barely able to attack. That gap is what makes a weapon class a
    // commitment instead of a stat stick.
    expect(baseAmotionFor('mage', 'twohand_axe')).toBe(DEFAULT_BASE_AMOTION);
    expect(baseAmotionFor('acolyte', 'bow')).toBe(DEFAULT_BASE_AMOTION);
    const worstAuthored = Math.max(...ASPD_JOBS.flatMap((j) => Object.values(JOB_BASE_AMOTION[j])));
    expect(DEFAULT_BASE_AMOTION).toBeGreaterThan(worstAuthored);
  });

  it('reserves the second-job weapons for second jobs', () => {
    // Katar, book, knuckle, instrument, and whip belong to Assassin, Sage,
    // Monk, Bard, and Dancer. No first job may have picked one up by accident.
    const secondJobOnly: WeaponType[] = ['katar', 'book', 'knuckle', 'instrument', 'whip'];
    for (const job of ASPD_JOBS) {
      for (const weapon of secondJobOnly) {
        expect(baseAmotionFor(job, weapon), `${job}/${weapon}`).toBe(DEFAULT_BASE_AMOTION);
      }
    }
  });
});

describe('the same weapon in different hands', () => {
  it('gives a Swordman a faster sword than a Thief', () => {
    // The property a per-weapon `speed` field cannot express, and the reason
    // `WeaponInfo.speed` has to go when this is wired in. If these two are ever
    // equal, the table has collapsed back into a per-weapon one.
    expect(baseAmotionFor('swordman', 'sword')).toBeLessThan(baseAmotionFor('thief', 'sword'));
  });

  it('gives a Thief the fastest dagger and a Mage the slowest', () => {
    const daggerUsers: AspdJob[] = ['thief', 'swordman', 'archer', 'mage'];
    const values = daggerUsers.map((j) => baseAmotionFor(j, 'dagger'));
    expect(Math.min(...values)).toBe(baseAmotionFor('thief', 'dagger'));
    expect(Math.max(...values)).toBe(baseAmotionFor('mage', 'dagger'));
  });

  it('gives an Acolyte a faster mace than a Swordman', () => {
    // Each job is fastest with the weapon its kit is built around, even when
    // another job is the better fighter overall.
    expect(baseAmotionFor('acolyte', 'mace')).toBeLessThan(baseAmotionFor('swordman', 'mace'));
  });
});

describe('unarmed', () => {
  it('is available to every job and never the penalty value', () => {
    for (const job of ASPD_JOBS) {
      expect(baseAmotionFor(job, null)).toBe(UNARMED_BASE_AMOTION[job]);
      expect(baseAmotionFor(job, null)).toBeLessThan(DEFAULT_BASE_AMOTION);
    }
  });

  it('is the FASTEST option for every job except the Swordman', () => {
    // A level-1 character with no weapon is weak in Ragnarok, not helpless: bare
    // hands out-swing everything they can hold. The Swordman is the exception,
    // and the exception is the whole identity of the job.
    for (const job of ASPD_JOBS) {
      const fastestWeapon = Math.min(...Object.values(JOB_BASE_AMOTION[job]));
      const unarmed = UNARMED_BASE_AMOTION[job];
      if (job === 'swordman') expect(unarmed).toBeLessThan(fastestWeapon);
      else expect(unarmed).toBeLessThanOrEqual(fastestWeapon);
    }
  });
});

describe('the cadences this produces', () => {
  const interval = (job: AspdJob, weapon: WeaponType | null, agi = 1, dex = 1) =>
    attackIntervalSeconds({ baseAmotion: baseAmotionFor(job, weapon), agi, dex });

  it('starts a fresh character around one swing a second', () => {
    // A level-1 character has 1 in every attribute, so the base is nearly the
    // whole story. Anything far off a second here means the table and the
    // formula disagree about units.
    for (const job of ASPD_JOBS) {
      const seconds = interval(job, null);
      expect(seconds, job).toBeGreaterThan(0.7);
      expect(seconds, job).toBeLessThan(1.1);
    }
  });

  it('roughly halves that at capped Agility, and never reaches instant', () => {
    const fresh = interval('thief', 'dagger');
    const capped = interval('thief', 'dagger', 99, 99);
    expect(capped).toBeLessThan(fresh);
    expect(capped).toBeGreaterThan(fresh / 2);
    expect(capped).toBeGreaterThan(0.2);
  });

  it('makes the wrong weapon cost seconds, not percentages', () => {
    // The penalty row expressed as the thing a player actually feels, with the
    // attributes zeroed so this reads the table rather than the stat reduction.
    // Nearly three seconds of difference, on a base a Mage cannot improve: no
    // amount of Agility makes an axe a Mage weapon.
    expect(interval('mage', 'twohand_axe', 0, 0)).toBeCloseTo(4, 5);
    expect(interval('mage', 'rod', 0, 0)).toBeCloseTo(1.4, 5);
    expect(interval('mage', 'twohand_axe', 99, 99)).toBeGreaterThan(interval('mage', 'rod', 0, 0));
  });
});
