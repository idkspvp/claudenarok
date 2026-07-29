// The second experience track, and the only source of skill points.
//
// Two things here are worth a test rather than a reading. The table is a
// LITERAL taken from the reference, so the assertions pin its endpoints and its
// deliberate discontinuities: a generated curve would sail through those and
// look fine. And the overflow rule is a rule, not an accident: a single huge
// kill buys ONE job level and the remainder is thrown away, which is what stops
// a party carry from vaulting a fresh character through a whole skill tree.

import { describe, expect, it } from 'vitest';
import {
  advanceJob,
  applyJobXp,
  CAREER_SKILL_POINTS,
  canAdvanceJob,
  freshJobProgress,
  JOB_XP_TABLE,
  type JobProgress,
  jobXpToNext,
  jobXpToReachLevel,
  MAX_ADVANCED_JOB_LEVEL,
  MAX_BASE_JOB_LEVEL as MAX_JOB_LEVEL,
  maxJobLevel,
  SKILL_POINTS_PER_JOB_LEVEL,
} from '../src/sim/progression/job_level';

// A character at job 1 with nothing banked. NOT the level-1 skill point: these
// cases pin the banking arithmetic, so they start the counter at zero and let
// each assertion say what it added. freshJobProgress() carries the grant, and
// its own case below pins that.
const fresh = (): JobProgress => ({
  track: 'base',
  jobLevel: 1,
  jobXp: 0,
  skillPoints: 0,
  advancedSkillPoints: 0,
});

describe('the table', () => {
  it('carries one step short of the BASE cap', () => {
    // Forty-nine steps for fifty levels. The reference's fiftieth row is a
    // cannot-advance sentinel, not a requirement, and copying it would put a
    // billion-point step on the ladder.
    expect(JOB_XP_TABLE).toHaveLength(MAX_JOB_LEVEL - 1);
    expect(JOB_XP_TABLE.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
  });

  it('matches the reference at both ends', () => {
    expect(JOB_XP_TABLE[0]).toBe(30);
    expect(JOB_XP_TABLE[JOB_XP_TABLE.length - 1]).toBe(509_596);
  });

  it('rises without exception, and jumps where the reference slows you down', () => {
    for (let i = 1; i < JOB_XP_TABLE.length; i++) {
      expect(JOB_XP_TABLE[i], `step ${i + 1}`).toBeGreaterThan(JOB_XP_TABLE[i - 1]);
    }
    // The three deliberate walls. A smooth generated curve cannot produce these,
    // which is the whole argument for keeping the table a literal.
    const jump = (level: number) => JOB_XP_TABLE[level - 1] / JOB_XP_TABLE[level - 2];
    expect(jump(10)).toBeGreaterThan(1.5); // 336 -> 520
    expect(jump(16)).toBeGreaterThan(1.4); // 1125 -> 1668
    expect(jump(21)).toBeGreaterThan(1.3); // 3988 -> 5564
  });
});

describe('what the next level costs', () => {
  it('prices every level below the cap and refuses at it', () => {
    expect(jobXpToNext(1)).toBe(30);
    expect(jobXpToNext(MAX_JOB_LEVEL - 1)).toBe(509_596);
    // Null, not zero or Infinity: a caller that treats it as a number would
    // divide a progress bar by nothing.
    expect(jobXpToNext(MAX_JOB_LEVEL)).toBeNull();
    expect(jobXpToNext(MAX_JOB_LEVEL + 40)).toBeNull();
  });

  it('treats a level below one as one rather than reading off the table', () => {
    expect(jobXpToNext(0)).toBe(jobXpToNext(1));
    expect(jobXpToNext(-5)).toBe(jobXpToNext(1));
  });
});

describe('the total banked to a level', () => {
  it('is zero at the first level and the whole table at the cap', () => {
    expect(jobXpToReachLevel(1)).toBe(0);
    const all = JOB_XP_TABLE.reduce((a, b) => a + b, 0);
    expect(jobXpToReachLevel(MAX_JOB_LEVEL)).toBe(all);
    // And clamps rather than running off the end.
    expect(jobXpToReachLevel(999)).toBe(all);
  });

  it('agrees with walking the table one level at a time', () => {
    expect(jobXpToReachLevel(5)).toBe(
      JOB_XP_TABLE[0] + JOB_XP_TABLE[1] + JOB_XP_TABLE[2] + JOB_XP_TABLE[3],
    );
  });
});

describe('banking experience', () => {
  it('takes exactly one level and one skill point at the threshold', () => {
    expect(applyJobXp(fresh(), 30)).toEqual({ ...fresh(), jobLevel: 2, skillPoints: 1 });
    expect(SKILL_POINTS_PER_JOB_LEVEL).toBe(1);
  });

  it('holds short of the threshold without touching the level', () => {
    expect(applyJobXp(fresh(), 29)).toEqual({ ...fresh(), jobXp: 29 });
  });

  it('buys ONE level from an enormous kill and discards the rest', () => {
    // The load-bearing rule. Without the overflow cap this would run the whole
    // table in a single call and hand over forty-nine skill points.
    const after = applyJobXp(fresh(), 1_000_000);
    expect(after.jobLevel).toBe(2);
    expect(after.skillPoints).toBe(1);
    // Capped at one short of the step just taken, which leaves it below the
    // next one, so the loop stops after a single level.
    expect(after.jobXp).toBe(JOB_XP_TABLE[0] - 1);
    // A second enormous kill takes exactly one more, never a run of them.
    expect(applyJobXp(after, 1_000_000).jobLevel).toBe(3);
  });

  it('keeps the points already earned', () => {
    const carried = { ...fresh(), jobLevel: 4, skillPoints: 3 };
    expect(applyJobXp(carried, 0).skillPoints).toBe(3);
    expect(applyJobXp(carried, 76).skillPoints).toBe(4);
  });

  it('stops dead at the cap and leaves the bar empty', () => {
    const capped = { ...fresh(), jobLevel: MAX_JOB_LEVEL, skillPoints: 49 };
    const after = applyJobXp(capped, 10_000_000);
    expect(after).toEqual(capped);
  });

  it('ignores a negative or fractional grant instead of taking a level back', () => {
    expect(applyJobXp(fresh(), -500)).toEqual(fresh());
    expect(applyJobXp(fresh(), 29.9)).toEqual({ ...fresh(), jobXp: 29 });
  });

  it('repairs a corrupt saved level rather than reading off the table', () => {
    const broken = { ...fresh(), jobLevel: 0, jobXp: -5 };
    const after = applyJobXp(broken, 30);
    expect(after.jobLevel).toBe(2);
    expect(after.jobXp).toBe(0);
  });

  it('never mutates what it was given', () => {
    const before = fresh();
    applyJobXp(before, 5_000);
    expect(before).toEqual(fresh());
  });
});

describe('the two segments', () => {
  it('caps a base class at 50 and an advanced one at 70', () => {
    expect(maxJobLevel('base')).toBe(50);
    expect(maxJobLevel('advanced')).toBe(70);
    expect(MAX_ADVANCED_JOB_LEVEL).toBe(70);
    // 50 + 70. The reference's career total, and the number every skill budget
    // is measured against.
    expect(CAREER_SKILL_POINTS).toBe(120);
  });

  it('grants the level-1 point to a brand new character', () => {
    // The reference counts the point granted at job level 1 inside its 50, so a
    // character that has killed nothing already holds one.
    const start = freshJobProgress();
    expect(start.jobLevel).toBe(1);
    expect(start.skillPoints).toBe(SKILL_POINTS_PER_JOB_LEVEL);
    expect(start.advancedSkillPoints).toBe(0);
    expect(start.track).toBe('base');
  });

  it('prices the advanced levels the base table does not reach', () => {
    // The published table stops at the base cap. The advanced segment runs
    // twenty levels further and reuses the last requirement rather than
    // extrapolating a curve nobody wrote down: flat, and obviously a stand-in.
    const last = JOB_XP_TABLE[JOB_XP_TABLE.length - 1];
    expect(jobXpToNext(MAX_JOB_LEVEL, 'advanced')).toBe(last);
    expect(jobXpToNext(MAX_ADVANCED_JOB_LEVEL - 1, 'advanced')).toBe(last);
    expect(jobXpToNext(MAX_ADVANCED_JOB_LEVEL, 'advanced')).toBeNull();
    // The base track still stops where it always did.
    expect(jobXpToNext(MAX_JOB_LEVEL, 'base')).toBeNull();
  });

  it('banks advanced levels into the advanced pool, never the base one', () => {
    const adv: JobProgress = {
      track: 'advanced',
      jobLevel: 1,
      jobXp: 0,
      skillPoints: 12,
      advancedSkillPoints: 1,
    };
    const after = applyJobXp(adv, 30);
    expect(after.jobLevel).toBe(2);
    expect(after.advancedSkillPoints).toBe(2);
    // The base pool is untouched. This is the separation, in one assertion.
    expect(after.skillPoints).toBe(12);
  });

  it('lets an advanced character run past the base cap', () => {
    let p: JobProgress = {
      track: 'advanced',
      jobLevel: MAX_JOB_LEVEL,
      jobXp: 0,
      skillPoints: 0,
      advancedSkillPoints: 0,
    };
    for (let i = 0; i < 40; i++) p = applyJobXp(p, 10_000_000);
    expect(p.jobLevel).toBe(MAX_ADVANCED_JOB_LEVEL);
    expect(p.advancedSkillPoints).toBe(MAX_ADVANCED_JOB_LEVEL - MAX_JOB_LEVEL);
  });
});

describe('advancing', () => {
  it('refuses until the base segment is finished', () => {
    expect(canAdvanceJob(fresh())).toBe(false);
    expect(advanceJob(fresh())).toBeNull();
    const nearly = { ...fresh(), jobLevel: MAX_JOB_LEVEL - 1 };
    expect(canAdvanceJob(nearly)).toBe(false);
    expect(advanceJob(nearly)).toBeNull();
  });

  it('restarts the bar at job 1 and opens the advanced pool', () => {
    const done = { ...fresh(), jobLevel: MAX_JOB_LEVEL, jobXp: 500, skillPoints: 50 };
    expect(canAdvanceJob(done)).toBe(true);
    const after = advanceJob(done) as JobProgress;
    expect(after.track).toBe('advanced');
    expect(after.jobLevel).toBe(1);
    expect(after.jobXp).toBe(0);
    expect(after.advancedSkillPoints).toBe(SKILL_POINTS_PER_JOB_LEVEL);
  });

  it('carries UNSPENT base points across, still as base points', () => {
    // The case a shared budget would get wrong. A character that hoarded its
    // base points keeps them, and they are still base points: advancement is
    // not a laundering route into the advanced tree.
    const hoarded = { ...fresh(), jobLevel: MAX_JOB_LEVEL, skillPoints: 50 };
    const after = advanceJob(hoarded) as JobProgress;
    expect(after.skillPoints).toBe(50);
    expect(after.advancedSkillPoints).toBe(SKILL_POINTS_PER_JOB_LEVEL);
  });

  it('refuses a second advancement', () => {
    const done = { ...fresh(), jobLevel: MAX_JOB_LEVEL, skillPoints: 50 };
    const once = advanceJob(done) as JobProgress;
    const capped = { ...once, jobLevel: MAX_ADVANCED_JOB_LEVEL };
    expect(canAdvanceJob(capped)).toBe(false);
    expect(advanceJob(capped)).toBeNull();
  });

  it('never mutates what it was given', () => {
    const done = { ...fresh(), jobLevel: MAX_JOB_LEVEL, skillPoints: 50 };
    advanceJob(done);
    expect(done.track).toBe('base');
    expect(done.jobLevel).toBe(MAX_JOB_LEVEL);
  });
});
