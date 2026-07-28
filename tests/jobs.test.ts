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
  it('has the five first jobs and no more', () => {
    expect(firstJobs().map((j) => j.id)).toEqual([
      'swordman',
      'mage',
      'archer',
      'acolyte',
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

  it('carries fifteen jobs: five first and ten second', () => {
    expect(JOBS).toHaveLength(15);
    const byTier = (tier: JobDef['tier']) => JOBS.filter((j) => j.tier === tier).length;
    expect(byTier('first')).toBe(5);
    expect(byTier('second_1')).toBe(5);
    expect(byTier('second_2')).toBe(5);
  });

  it('has no Novice, no Super Novice, and no Merchant branch', () => {
    // All three are Classic and all three are out by product decision. A first
    // job is a ROOT here: a character picks one at creation, so nothing precedes
    // it, and every first job carries .
    for (const absent of ['novice', 'super_novice', 'merchant', 'blacksmith', 'alchemist']) {
      expect(jobById(absent), absent).toBeUndefined();
    }
    for (const first of firstJobs()) expect(first.from, first.id).toBeNull();
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
        expect(job.tier, job.id).toBe('first');
        continue;
      }
      expect(jobById(job.from), `${job.id} parent ${job.from}`).toBeDefined();
    }
  });

  it('walks every second job back to its first job', () => {
    expect(firstJobOf('knight')?.id).toBe('swordman');
    expect(firstJobOf('rogue')?.id).toBe('thief');
    expect(firstJobOf('bard')?.id).toBe('archer');
  });

  it('returns a first job unchanged', () => {
    expect(firstJobOf('thief')?.id).toBe('thief');
    expect(firstJobOf('swordman')?.id).toBe('swordman');
  });

  it('has no unknown job id', () => {
    expect(jobById('paladin')).toBeUndefined();
    expect(jobById('')).toBeUndefined();
  });
});
