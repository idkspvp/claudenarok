// Healing, siphon, leech and reflect, pinned against
// docs/design/spiritvale-engine-formulas.md.
//
// The leech tests carry the most weight. Leech reads like "steal this share of
// the hit" and is not: it converts a fifth of its face value into a RESERVE, and
// the reserve pays out at most a fifth of max health per second. Getting either
// wrong makes leech either useless or the best stat in the game, so both the
// conversion and the ceiling are pinned with the worked example from the source.

import { describe, expect, it } from 'vitest';
import {
  HEALING_COEFFICIENT,
  healingOutput,
  isLeechable,
  LEECH_MAX_CONTRIBUTING_TARGETS,
  leechHealthBanked,
  leechManaBanked,
  leechPayoutCapPerSecond,
  reflectDamage,
  SIPHON_PVP_LEVEL,
  STATUS_RESIST_PER_POINT,
  siphonHealth,
  siphonMana,
  statusResistPercent,
} from '../src/sim/stats/sustain';

describe('healing output', () => {
  it('matches a hand-computed case', () => {
    // (100 + 80 + 40) * 2.5 = 220 * 2.5 = 550
    expect(healingOutput({ level: 100, int: 80, vit: 40 })).toBeCloseTo(550, 10);
    expect(HEALING_COEFFICIENT).toBe(2.5);
  });

  it('counts VITALITY, so a healer bulk stat is also an output stat', () => {
    const lean = healingOutput({ level: 100, int: 80, vit: 0 });
    const tanky = healingOutput({ level: 100, int: 80, vit: 40 });
    expect(tanky).toBeGreaterThan(lean);
    // A point of Vitality is worth exactly as much as a point of Intelligence.
    expect(healingOutput({ level: 1, int: 10, vit: 0 })).toBe(
      healingOutput({ level: 1, int: 0, vit: 10 }),
    );
  });
});

describe('siphon', () => {
  it('matches hand-computed cases on both sides', () => {
    // HP: 20 * (100 + 50) / 50 = 20 * 3 = 60
    expect(siphonHealth({ siphonHp: 20, level: 100, vit: 50 })).toBeCloseTo(60, 10);
    // MP: same shape, Intelligence in place of Vitality
    expect(siphonMana({ siphonMp: 20, level: 100, int: 50 })).toBeCloseTo(60, 10);
  });

  it('pins the level term to 100 in PvP, so a level-150 cannot out-siphon a level-40', () => {
    expect(SIPHON_PVP_LEVEL).toBe(100);
    const high = siphonHealth({ siphonHp: 10, level: 150, vit: 0, pvp: true });
    const low = siphonHealth({ siphonHp: 10, level: 40, vit: 0, pvp: true });
    expect(high).toBe(low);
    // Outside PvP the level term is live again.
    expect(siphonHealth({ siphonHp: 10, level: 150, vit: 0 })).toBeGreaterThan(
      siphonHealth({ siphonHp: 10, level: 40, vit: 0 }),
    );
  });
});

describe('leech', () => {
  it('converts a FIFTH of the stat, matching the worked example in the source', () => {
    // "20 Leech on a 10,000 hit banks 10000 * 0.20 * 0.2 = 400 HP"
    expect(leechHealthBanked({ damage: 10_000, hpLeech: 20 })).toBe(400);
  });

  it('scales the banked amount by Healing Received', () => {
    expect(leechHealthBanked({ damage: 10_000, hpLeech: 20, healingReceivedPercent: 25 })).toBe(
      500,
    );
  });

  it('banks mana at a fiftieth, with no Healing Received arm', () => {
    // 10000 * 0.20 * 0.02 = 40
    expect(leechManaBanked({ damage: 10_000, manaLeech: 20 })).toBe(40);
  });

  it('caps the payout at a fifth of max health per second, which is the real bound', () => {
    // The per-hit number is not the limit. A character with 9,805 max health
    // pays out at most 1,961/sec, which is the figure the in-game tooltip shows.
    expect(leechPayoutCapPerSecond(9_805)).toBeCloseTo(1961, 10);
    // Five 400-HP banks in a second already exceed a 1,000-HP character's cap.
    const banked = 5 * leechHealthBanked({ damage: 10_000, hpLeech: 20 });
    expect(banked).toBeGreaterThan(leechPayoutCapPerSecond(1_000));
  });

  it('steals only on Melee, Magic and Ranged, never Status or True', () => {
    expect(isLeechable('Melee')).toBe(true);
    expect(isLeechable('Magic')).toBe(true);
    expect(isLeechable('Ranged')).toBe(true);
    expect(isLeechable('Status')).toBe(false);
    expect(isLeechable('True')).toBe(false);
  });

  it('counts at most three targets per attack', () => {
    expect(LEECH_MAX_CONTRIBUTING_TARGETS).toBe(3);
  });

  it('banks nothing from a zero or negative hit', () => {
    expect(leechHealthBanked({ damage: 0, hpLeech: 50 })).toBe(0);
    expect(leechHealthBanked({ damage: -100, hpLeech: 50 })).toBe(0);
  });
});

describe('reflect', () => {
  it('matches a hand-computed case', () => {
    // (100 + 200/2 + 40/2 + 300/2) * 4 * 0.1
    //   = (100 + 100 + 20 + 150) * 0.4 = 370 * 0.4 = 148
    expect(
      reflectDamage({ level: 100, def: 200, flatDef: 40, atk: 300, reflectPercent: 0.1 }),
    ).toBeCloseTo(148, 10);
  });

  it('reflects nothing without the stat, however tanky the character', () => {
    expect(reflectDamage({ level: 150, def: 999, flatDef: 999, atk: 999, reflectPercent: 0 })).toBe(
      0,
    );
  });
});

describe('status resistance', () => {
  it('is 0.66 percent per point of the mapped attribute', () => {
    expect(STATUS_RESIST_PER_POINT).toBe(0.66);
    // 50 Vitality against stun: 33%
    expect(statusResistPercent({ mappedAttribute: 50 })).toBeCloseTo(33, 10);
  });

  it('adds the gear stat, where an "immunity" line is really 50 points', () => {
    expect(statusResistPercent({ mappedAttribute: 50, statusResistStat: 50 })).toBeCloseTo(83, 10);
  });

  it('caps at 100 and never goes negative', () => {
    expect(statusResistPercent({ mappedAttribute: 200, statusResistStat: 100 })).toBe(100);
    expect(statusResistPercent({ mappedAttribute: -50 })).toBe(0);
  });
});
