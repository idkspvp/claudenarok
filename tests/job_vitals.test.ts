// Ragnarok's HP and SP curves. Pinned as the SHAPE plus the handful of endpoints
// that would tell immediately if the curve were reimplemented as a straight line,
// which is what it replaced and what it is most likely to drift back into.

import { describe, expect, it } from 'vitest';
import {
  BASE_HP_FLOOR,
  BASE_SP_FLOOR,
  baseHpAt,
  baseSpAt,
  JOB_VITALS,
} from '../src/sim/job_vitals';

describe('every job starts from the same floor', () => {
  it('gives a level-1 character 40 HP whatever they picked', () => {
    // 35 + floor(1 * 500/100) = 40, and hpIncrease is 500 for every job, so the
    // whole roster lands on the same number. This is the most recognizable
    // single fact about a fresh Ragnarok character.
    for (const id of Object.keys(JOB_VITALS)) {
      expect(baseHpAt(JOB_VITALS[id], 1), id).toBe(40);
    }
  });

  it('separates SP at level 1, because spIncrease does differ', () => {
    expect(baseSpAt(JOB_VITALS.mage, 1)).toBeGreaterThan(baseSpAt(JOB_VITALS.swordman, 1));
    expect(baseSpAt(JOB_VITALS.swordman, 1)).toBe(BASE_SP_FLOOR + 2);
  });

  it('floors at level 1 rather than extrapolating below it', () => {
    expect(baseHpAt(JOB_VITALS.mage, 0)).toBe(baseHpAt(JOB_VITALS.mage, 1));
    expect(baseHpAt(JOB_VITALS.mage, -5)).toBe(baseHpAt(JOB_VITALS.mage, 1));
  });
});

describe('HP is quadratic and SP is linear', () => {
  it('accelerates HP: each ten levels adds more than the ten before', () => {
    // The whole point of the quadratic term. A straight line would make these
    // two differences equal, which is the regression this catches.
    const v = JOB_VITALS.swordman;
    const early = baseHpAt(v, 20) - baseHpAt(v, 10);
    const late = baseHpAt(v, 90) - baseHpAt(v, 80);
    expect(late).toBeGreaterThan(early * 2);
  });

  it('keeps SP a straight line, because spFactor is zero for every first job', () => {
    // Not an oversight in the table: pre-renewal first jobs genuinely carry no
    // quadratic SP term, so SP per level is flat.
    for (const id of Object.keys(JOB_VITALS)) {
      expect(JOB_VITALS[id].spFactor, id).toBe(0);
      const v = JOB_VITALS[id];
      const a = baseSpAt(v, 30) - baseSpAt(v, 20);
      const b = baseSpAt(v, 90) - baseSpAt(v, 80);
      expect(b, id).toBe(a);
    }
  });
});

describe('the roster is spread the way Ragnarok spreads it', () => {
  it('orders HP swordman > thief = archer > acolyte > mage', () => {
    const at99 = (id: string) => baseHpAt(JOB_VITALS[id], 99);
    expect(at99('swordman')).toBeGreaterThan(at99('thief'));
    expect(at99('thief')).toBe(at99('archer'));
    expect(at99('archer')).toBeGreaterThan(at99('acolyte'));
    expect(at99('acolyte')).toBeGreaterThan(at99('mage'));
  });

  it('orders SP the other way, mage highest', () => {
    const at99 = (id: string) => baseSpAt(JOB_VITALS[id], 99);
    expect(at99('mage')).toBeGreaterThan(at99('acolyte'));
    expect(at99('acolyte')).toBeGreaterThan(at99('archer'));
    expect(at99('archer')).toBe(at99('swordman'));
  });

  it('makes Thief and Archer identical, which is real and not a slip', () => {
    // Both carry 50 / 200. Anyone tidying this table is likely to assume one of
    // them is a copy-paste error and "fix" it, so it is pinned.
    expect(JOB_VITALS.thief).toEqual(JOB_VITALS.archer);
  });

  it('carries no Novice row, because there is no Novice to carry one for', () => {
    // Characters pick a first job at creation, so a Novice curve is a row that
    // nothing would ever evaluate.
    expect(JOB_VITALS.novice).toBeUndefined();
    expect(Object.keys(JOB_VITALS).sort()).toEqual([
      'acolyte',
      'archer',
      'mage',
      'swordman',
      'thief',
    ]);
  });
});

describe('the endpoints', () => {
  // Computed from the source formula, stated as literals in exactly one place so
  // a change to the curve has to come here and be looked at.
  const HP_AT_99: Record<string, number> = {
    swordman: 3997,
    thief: 3029,
    archer: 3029,
    acolyte: 2510,
    mage: 2020,
  };
  const SP_AT_99: Record<string, number> = {
    swordman: 208,
    thief: 208,
    archer: 208,
    acolyte: 505,
    mage: 604,
  };

  it('lands where the formula says at the cap', () => {
    for (const [id, hp] of Object.entries(HP_AT_99)) {
      expect(baseHpAt(JOB_VITALS[id], 99), `${id} hp`).toBe(hp);
    }
    for (const [id, sp] of Object.entries(SP_AT_99)) {
      expect(baseSpAt(JOB_VITALS[id], 99), `${id} sp`).toBe(sp);
    }
  });

  it('reaches a believable pool once attributes multiply it', () => {
    // The caller applies (1 + VIT/100) and (1 + INT/100). At a capped attribute
    // that is just under a doubling, which is what puts a level-99 Swordman near
    // eight thousand health and a Mage near twelve hundred mana.
    expect(Math.floor(baseHpAt(JOB_VITALS.swordman, 99) * 1.99)).toBeGreaterThan(7000);
    expect(Math.floor(baseSpAt(JOB_VITALS.mage, 99) * 1.99)).toBeGreaterThan(1000);
  });

  it('states the floors it is built on', () => {
    expect(BASE_HP_FLOOR).toBe(35);
    expect(BASE_SP_FLOOR).toBe(10);
  });
});
