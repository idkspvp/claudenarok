// The Ragnarok Classic job tree. Pinned as the SHAPE the conversion converges
// on, so a later edit cannot quietly add a transcendent class, drop a branch, or
// leave a first job with only one advancement.

import { describe, expect, it } from 'vitest';
import {
  advancementsFrom,
  firstJobOf,
  firstJobs,
  JOBS,
  type JobDef,
  jobById,
} from '../src/sim/content/jobs';

describe('the tree matches Ragnarok Classic', () => {
  it('has the six first jobs and no more', () => {
    expect(firstJobs().map((j) => j.id)).toEqual([
      'swordman',
      'mage',
      'archer',
      'acolyte',
      'merchant',
      'thief',
    ]);
  });

  it('gives every first job exactly two advancements, a 2-1 and a 2-2', () => {
    // The pair is a DIRECTION, not a quality tier: 2-1 leans to the profession's
    // obvious strength and 2-2 to its unobvious one. A first job with one branch
    // would mean a missing class.
    for (const first of firstJobs()) {
      const next = advancementsFrom(first.id);
      expect(next, first.id).toHaveLength(2);
      expect(
        next.map((j) => j.tier),
        first.id,
      ).toEqual(['second_1', 'second_2']);
    }
  });

  it('carries twenty jobs: Novice, six first, twelve second, and Super Novice', () => {
    expect(JOBS).toHaveLength(20);
    const byTier = (tier: JobDef['tier']) => JOBS.filter((j) => j.tier === tier).length;
    expect(byTier('novice')).toBe(1);
    expect(byTier('first')).toBe(6);
    // Seven 2-1 rather than six: Super Novice is the Novice's, which the source
    // comments on directly.
    expect(byTier('second_1')).toBe(7);
    expect(byTier('second_2')).toBe(6);
  });

  it('hangs Super Novice off the Novice, not off a first job', () => {
    expect(jobById('super_novice')?.from).toBe('novice');
    expect(advancementsFrom('novice').map((j) => j.id)).toEqual(['super_novice']);
  });

  it('excludes every transcendent, third, and expanded class', () => {
    // rAthena's e_mapid carries all of them. Classic has none, so a name from a
    // later era appearing here means the filter slipped.
    const names = JOBS.map((j) => j.name);
    for (const later of [
      'Lord Knight',
      'High Wizard',
      'Sniper',
      'High Priest',
      'Whitesmith',
      'Assassin Cross',
      'Paladin',
      'Professor',
      'Champion',
      'Creator',
      'Stalker',
      'Clown',
      'Taekwon',
      'Gunslinger',
      'Ninja',
      'Summoner',
      'Star Gladiator',
      'Soul Linker',
    ]) {
      expect(names, later).not.toContain(later);
    }
  });
});

describe('the tree is internally consistent', () => {
  it('gives every job a unique id and a resolvable parent', () => {
    const ids = new Set(JOBS.map((j) => j.id));
    expect(ids.size).toBe(JOBS.length);
    for (const job of JOBS) {
      if (job.from === null) {
        expect(job.tier, job.id).toBe('novice');
        continue;
      }
      expect(jobById(job.from), `${job.id} parent ${job.from}`).toBeDefined();
    }
  });

  it('walks every second job back to its first job', () => {
    expect(firstJobOf('knight')?.id).toBe('swordman');
    expect(firstJobOf('rogue')?.id).toBe('thief');
    expect(firstJobOf('alchemist')?.id).toBe('merchant');
    expect(firstJobOf('bard')?.id).toBe('archer');
  });

  it('returns a first job unchanged and refuses the Novice', () => {
    expect(firstJobOf('thief')?.id).toBe('thief');
    // The Novice descends from nothing, so it has no first job; Super Novice
    // inherits that, which is exactly the oddity the source calls out.
    expect(firstJobOf('novice')).toBeUndefined();
    expect(firstJobOf('super_novice')).toBeUndefined();
  });

  it('has no unknown job id', () => {
    expect(jobById('paladin')).toBeUndefined();
    expect(jobById('')).toBeUndefined();
  });
});
