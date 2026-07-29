// Which pool pays for which tree.
//
// The acceptance criterion for this phase is one sentence: base points cannot
// buy an advanced skill. It is worth a file of its own because the failure mode
// is silent. A shared budget produces a game that plays fine and is simply the
// wrong game, and no crash, no type error and no other test would notice.

import { describe, expect, it } from 'vitest';
import {
  advanceJob,
  CAREER_SKILL_POINTS,
  freshJobProgress,
  type JobProgress,
  MAX_ADVANCED_JOB_LEVEL,
  MAX_BASE_JOB_LEVEL,
} from '../src/sim/progression/job_level';
import {
  canSpendSkillPoints,
  refuseReason,
  skillPointBalance,
  spendSkillPoints,
} from '../src/sim/progression/skill_points';

/** A character that finished its base tree and advanced, holding both pools. */
const bothPools = (base: number, advanced: number): JobProgress => ({
  track: 'advanced',
  jobLevel: 20,
  jobXp: 0,
  skillPoints: base,
  advancedSkillPoints: advanced,
});

describe('reading a balance', () => {
  it('reads each tier from its own pool', () => {
    const p = bothPools(7, 12);
    expect(skillPointBalance(p, 'base')).toBe(7);
    expect(skillPointBalance(p, 'advanced')).toBe(12);
  });

  it('never reports a negative or fractional balance from a corrupt record', () => {
    const broken = { ...bothPools(-4, 2.7) };
    expect(skillPointBalance(broken, 'base')).toBe(0);
    expect(skillPointBalance(broken, 'advanced')).toBe(2);
  });
});

describe('the acceptance case: base points cannot buy an advanced skill', () => {
  it('refuses an advanced skill to a character holding only base points', () => {
    // The whole point. Fifty base points banked, zero advanced, and the
    // advanced tree is still shut.
    const p = bothPools(50, 0);
    expect(canSpendSkillPoints(p, 'advanced', 1)).toBe(false);
    expect(spendSkillPoints(p, 'advanced', 1)).toBeNull();
    expect(refuseReason(p, 'advanced', 1)).toBe('noAdvancedPoints');
    // …while the base tree is wide open on the same record.
    expect(canSpendSkillPoints(p, 'base', 1)).toBe(true);
  });

  it('refuses a base skill to a character holding only advanced points', () => {
    // The mirror, and the one a one-directional guard would let through. A
    // capped advanced character cannot backfill the base tree it skipped.
    const p = bothPools(0, MAX_ADVANCED_JOB_LEVEL);
    expect(canSpendSkillPoints(p, 'base', 1)).toBe(false);
    expect(spendSkillPoints(p, 'base', 1)).toBeNull();
    expect(refuseReason(p, 'base', 1)).toBe('noBasePoints');
    expect(canSpendSkillPoints(p, 'advanced', 1)).toBe(true);
  });

  it('draws down only the pool that paid', () => {
    const p = bothPools(10, 10);
    const afterBase = spendSkillPoints(p, 'base', 3) as JobProgress;
    expect(afterBase.skillPoints).toBe(7);
    expect(afterBase.advancedSkillPoints).toBe(10);

    const afterAdvanced = spendSkillPoints(afterBase, 'advanced', 4) as JobProgress;
    expect(afterAdvanced.skillPoints).toBe(7);
    expect(afterAdvanced.advancedSkillPoints).toBe(6);
  });

  it('cannot cover a base cost by adding the two pools together', () => {
    // 3 base and 3 advanced is not 6 of anything. The shared-budget bug in its
    // most plausible form.
    const p = bothPools(3, 3);
    expect(canSpendSkillPoints(p, 'base', 6)).toBe(false);
    expect(canSpendSkillPoints(p, 'advanced', 6)).toBe(false);
    expect(spendSkillPoints(p, 'base', 6)).toBeNull();
  });
});

describe('refusing badly formed spends', () => {
  it('refuses a zero, negative, fractional or non-finite cost', () => {
    const p = bothPools(50, 50);
    for (const cost of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(refuseReason(p, 'base', cost), `cost ${cost}`).toBe('invalidCost');
      expect(spendSkillPoints(p, 'base', cost), `cost ${cost}`).toBeNull();
    }
  });

  it('allows a spend that empties a pool exactly, and nothing after it', () => {
    const p = bothPools(4, 0);
    const empty = spendSkillPoints(p, 'base', 4) as JobProgress;
    expect(empty.skillPoints).toBe(0);
    expect(spendSkillPoints(empty, 'base', 1)).toBeNull();
  });

  it('never mutates what it was given', () => {
    const p = bothPools(9, 9);
    spendSkillPoints(p, 'base', 5);
    spendSkillPoints(p, 'advanced', 5);
    expect(p.skillPoints).toBe(9);
    expect(p.advancedSkillPoints).toBe(9);
  });
});

describe('across a whole career', () => {
  it('spends at most 120 points, split 50 and 70', () => {
    // Walk the real path: a base character banks its 50, advances, banks its 70,
    // and the two budgets stay in their own trees the whole way.
    const start = freshJobProgress();
    const capped = { ...start, jobLevel: MAX_BASE_JOB_LEVEL, skillPoints: MAX_BASE_JOB_LEVEL };
    const advanced = advanceJob(capped) as JobProgress;
    const full = { ...advanced, advancedSkillPoints: MAX_ADVANCED_JOB_LEVEL };

    expect(full.skillPoints + full.advancedSkillPoints).toBe(CAREER_SKILL_POINTS);
    // Every base point spent, and the advanced pool is still whole.
    const drained = spendSkillPoints(full, 'base', MAX_BASE_JOB_LEVEL) as JobProgress;
    expect(drained.skillPoints).toBe(0);
    expect(drained.advancedSkillPoints).toBe(MAX_ADVANCED_JOB_LEVEL);
    // And with the base tree paid for, one more base point is still refused
    // despite seventy sitting in the other pool.
    expect(spendSkillPoints(drained, 'base', 1)).toBeNull();
  });
});
