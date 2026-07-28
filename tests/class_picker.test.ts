// The character-creation picker derives from the job table, and the two server
// validation lists derive from the same rows. The point of the gate is that a
// class cannot be added or removed in one place and forgotten in the others.

import { describe, expect, it } from 'vitest';
import { isStartableJob, JOBS, startableJobs } from '../src/sim/content/jobs';
import { CLASSES } from '../src/sim/data';
import { ALL_CLASSES, type PlayerClass } from '../src/sim/types';
import { classChipSpecs } from '../src/ui/class_picker_view';

describe('startable jobs', () => {
  it('is exactly the five first jobs, in tree order', () => {
    expect(startableJobs().map((j) => j.id)).toEqual([
      'swordman',
      'mage',
      'archer',
      'acolyte',
      'thief',
    ]);
  });

  it('never marks a second job startable', () => {
    for (const job of JOBS) {
      if (job.tier === 'first') continue;
      expect(job.startable, job.id).toBeUndefined();
    }
  });

  it('agrees with PlayerClass, so the picker cannot offer a class the sim lacks', () => {
    const startable = startableJobs().map((j) => j.id);
    expect([...startable].sort()).toEqual([...ALL_CLASSES].sort());
    for (const id of startable) expect(CLASSES[id as PlayerClass]?.id, id).toBe(id);
  });

  it('isStartableJob rejects a second job and an unknown id', () => {
    expect(isStartableJob('swordman')).toBe(true);
    // Rogue, Hunter, and Priest are SECOND jobs that share a name with a class id
    // this branch renamed away. Creating a character as one must stay refused.
    expect(isStartableJob('rogue')).toBe(false);
    expect(isStartableJob('hunter')).toBe(false);
    expect(isStartableJob('priest')).toBe(false);
    expect(isStartableJob('warlock')).toBe(false);
    expect(isStartableJob('')).toBe(false);
  });
});

describe('class chip specs', () => {
  it('carries one chip per startable job, with both i18n keys', () => {
    const specs = classChipSpecs();
    expect(specs.map((s) => s.id)).toEqual(startableJobs().map((j) => j.id));
    for (const spec of specs) {
      expect(spec.nameKey).toBe(`classes.${spec.id}`);
      expect(spec.ariaKey).toBe(`classes.${spec.id}Aria`);
      expect(spec.englishName.length).toBeGreaterThan(0);
    }
  });

  it('names the renamed jobs by their Ragnarok names, not the old class names', () => {
    const byId = new Map(classChipSpecs().map((s) => [s.id, s.englishName]));
    expect(byId.get('swordman')).toBe('Swordman');
    expect(byId.get('archer')).toBe('Archer');
    expect(byId.get('acolyte')).toBe('Acolyte');
    expect(byId.get('thief')).toBe('Thief');
  });
});
