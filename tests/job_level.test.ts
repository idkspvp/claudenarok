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
  applyJobXp,
  JOB_XP_TABLE,
  type JobProgress,
  jobXpToNext,
  jobXpToReachLevel,
  MAX_JOB_LEVEL,
  SKILL_POINTS_PER_JOB_LEVEL,
} from '../src/sim/progression/job_level';

const fresh = (): JobProgress => ({ jobLevel: 1, jobXp: 0, skillPoints: 0 });

describe('the table', () => {
  it('carries one step short of the cap', () => {
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
    expect(applyJobXp(fresh(), 30)).toEqual({ jobLevel: 2, jobXp: 0, skillPoints: 1 });
    expect(SKILL_POINTS_PER_JOB_LEVEL).toBe(1);
  });

  it('holds short of the threshold without touching the level', () => {
    expect(applyJobXp(fresh(), 29)).toEqual({ jobLevel: 1, jobXp: 29, skillPoints: 0 });
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
    const carried = { jobLevel: 4, jobXp: 0, skillPoints: 3 };
    expect(applyJobXp(carried, 0).skillPoints).toBe(3);
    expect(applyJobXp(carried, 76).skillPoints).toBe(4);
  });

  it('stops dead at the cap and leaves the bar empty', () => {
    const capped = { jobLevel: MAX_JOB_LEVEL, jobXp: 0, skillPoints: 49 };
    const after = applyJobXp(capped, 10_000_000);
    expect(after).toEqual({ jobLevel: MAX_JOB_LEVEL, jobXp: 0, skillPoints: 49 });
  });

  it('ignores a negative or fractional grant instead of taking a level back', () => {
    expect(applyJobXp(fresh(), -500)).toEqual(fresh());
    expect(applyJobXp(fresh(), 29.9)).toEqual({ jobLevel: 1, jobXp: 29, skillPoints: 0 });
  });

  it('repairs a corrupt saved level rather than reading off the table', () => {
    const broken = { jobLevel: 0, jobXp: -5, skillPoints: 0 };
    const after = applyJobXp(broken, 30);
    expect(after.jobLevel).toBe(2);
    expect(after.jobXp).toBe(0);
  });

  it('never mutates what it was given', () => {
    const before = fresh();
    applyJobXp(before, 5_000);
    expect(before).toEqual({ jobLevel: 1, jobXp: 0, skillPoints: 0 });
  });
});
