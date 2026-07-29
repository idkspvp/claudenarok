// The character-creation picker derives from the job table, and the two server
// validation lists derive from the same rows. The point of the gate is that a
// class cannot be added or removed in one place and forgotten in the others.

import { describe, expect, it } from 'vitest';
import { isStartableJob, JOBS, startableJobs } from '../src/sim/content/jobs';
import { CLASSES } from '../src/sim/data';
import { ALL_CLASSES, type PlayerClass } from '../src/sim/types';
import { classChipSpecs } from '../src/ui/class_picker_view';

describe('startable jobs', () => {
  it('is the base classes with an authored kit, in tree order', () => {
    // NOT every base class. `knight` and `summoner` exist in PlayerClass and
    // carry their archetype numbers, but their kit is the SpiritVale skill tree
    // and the sim does not cast from it yet, so they ship unstartable. That is
    // exactly what the `startable` flag is for: it says whether a NEW character
    // may pick a job, which is a different question from what a job IS.
    expect(startableJobs().map((j) => j.id)).toEqual([
      'swordman',
      'thief',
      'acolyte',
      'archer',
      'mage',
    ]);
  });

  it('offers no class the sim cannot build a character as', () => {
    // The direction that matters for safety: everything offered must exist.
    for (const job of startableJobs()) {
      expect(ALL_CLASSES, job.id).toContain(job.id as PlayerClass);
      expect(CLASSES[job.id as PlayerClass]?.abilities.length, job.id).toBeGreaterThan(0);
    }
  });

  it('never marks an advanced job startable', () => {
    for (const job of JOBS) {
      if (job.tier === 'base') continue;
      expect(job.startable, job.id).toBeUndefined();
    }
  });

  it('is a SUBSET of PlayerClass, never a class the sim lacks', () => {
    const startable = startableJobs().map((j) => j.id);
    for (const id of startable) expect(CLASSES[id as PlayerClass]?.id, id).toBe(id);
    // The two unstartable base classes are the whole difference, named so this
    // relaxes back to equality the moment their kits land rather than silently
    // tolerating any future gap.
    const missing = ALL_CLASSES.filter((c) => !startable.includes(c));
    expect([...missing].sort()).toEqual(['knight', 'summoner']);
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

  it('names each job by its SpiritVale name, not the id it is stored under', () => {
    // The ids are frozen because saved characters carry them; the names are the
    // reference's. Three of the five diverge, which is the whole point of the pin.
    const byId = new Map(classChipSpecs().map((s) => [s.id, s.englishName]));
    expect(byId.get('swordman')).toBe('Warrior');
    expect(byId.get('thief')).toBe('Rogue');
    expect(byId.get('archer')).toBe('Scout');
    expect(byId.get('acolyte')).toBe('Acolyte');
    expect(byId.get('mage')).toBe('Mage');
  });
});
