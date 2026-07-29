// The SpiritVale job tree. Pinned as the SHAPE the conversion converges on, so a
// later edit cannot quietly drop a class, give a base job an advancement it does
// not have, or reintroduce the Ragnarok tree this replaced.

import { describe, expect, it } from 'vitest';
import {
  advancementsFrom,
  baseJobOf,
  baseJobs,
  JOBS,
  type JobDef,
  jobById,
} from '../src/sim/content/jobs';
import { SPIRITVALE_TREES } from '../src/sim/content/skills';

describe('the tree matches the published class export', () => {
  it('has the seven base classes and no more', () => {
    expect(baseJobs().map((j) => j.id)).toEqual([
      'swordman',
      'knight',
      'thief',
      'acolyte',
      'archer',
      'summoner',
      'mage',
    ]);
  });

  it('carries fifteen jobs: seven base and eight advanced', () => {
    expect(JOBS).toHaveLength(15);
    const byTier = (tier: JobDef['tier']) => JOBS.filter((j) => j.tier === tier).length;
    expect(byTier('base')).toBe(7);
    expect(byTier('advanced')).toBe(8);
  });

  it('advances each base class exactly one way, plus the Weaver', () => {
    // Ragnarok offered a branching PAIR from every first job. SpiritVale does
    // not, and a base class showing two named advancements would mean the old
    // tree had crept back in. The Weaver is offered to every base class because
    // it descends from none of them, so the count is two: one own, one Weaver.
    for (const base of baseJobs()) {
      const next = advancementsFrom(base.id);
      expect(next, base.id).toHaveLength(2);
      const own = next.filter((j) => j.from === base.id);
      expect(own, `${base.id} own advancement`).toHaveLength(1);
      expect(next.filter((j) => j.from === null).map((j) => j.id)).toEqual(['weaver']);
    }
  });

  it('names each base class own advancement, exactly as published', () => {
    const own = Object.fromEntries(
      baseJobs().map((b) => [b.id, advancementsFrom(b.id).find((j) => j.from === b.id)?.id]),
    );
    expect(own).toEqual({
      swordman: 'berserker',
      knight: 'paladin',
      thief: 'shinobi',
      acolyte: 'priest',
      archer: 'gunslinger',
      summoner: 'necromancer',
      mage: 'wizard',
    });
  });

  it('has no job from the Ragnarok tree this replaced', () => {
    // Each of these was a SECOND job under the old tree and is not a SpiritVale
    // class at all. `knight`, `priest` and `wizard` survive as ids but at a
    // different place in the tree, which the cases above pin.
    for (const gone of ['crusader', 'sage', 'hunter', 'bard', 'monk', 'assassin', 'rogue']) {
      expect(jobById(gone), gone).toBeUndefined();
    }
  });
});

describe('the tree agrees with the rest of the game', () => {
  it('gives every base job a skill tree, and every skill tree a base job', () => {
    // The two tables must name the same seven classes. They are generated and
    // hand-written respectively, so nothing but this makes them agree.
    expect(
      baseJobs()
        .map((j) => j.id)
        .sort(),
    ).toEqual(Object.keys(SPIRITVALE_TREES).sort());
  });

  it('uses the reference display name that the skill trees record as the archetype', () => {
    for (const base of baseJobs()) {
      expect(SPIRITVALE_TREES[base.id]?.archetype, base.id).toBe(base.name);
    }
  });

  it('keeps the three renamed ids frozen while the names change', () => {
    // An id that has reached a saved character can never move. These three were
    // authored under the game own earlier names and keep them as ids forever.
    expect(jobById('swordman')?.name).toBe('Warrior');
    expect(jobById('thief')?.name).toBe('Rogue');
    expect(jobById('archer')?.name).toBe('Scout');
  });
});

describe('the tree is internally consistent', () => {
  it('gives every job a unique id and a resolvable parent', () => {
    const ids = new Set(JOBS.map((j) => j.id));
    expect(ids.size).toBe(JOBS.length);
    for (const job of JOBS) {
      if (job.from === null) continue;
      expect(jobById(job.from), `${job.id} parent ${job.from}`).toBeDefined();
      expect(jobById(job.from)?.tier, `${job.id} parent tier`).toBe('base');
    }
  });

  it('lets only a base job or the Weaver have no parent', () => {
    for (const job of JOBS) {
      if (job.from !== null) continue;
      expect(
        job.tier === 'base' || job.id === 'weaver',
        `${job.id} is a parentless ${job.tier}`,
      ).toBe(true);
    }
  });

  it('walks every advanced job back to its base job', () => {
    expect(baseJobOf('berserker')?.id).toBe('swordman');
    expect(baseJobOf('paladin')?.id).toBe('knight');
    expect(baseJobOf('shinobi')?.id).toBe('thief');
    expect(baseJobOf('wizard')?.id).toBe('mage');
  });

  it('returns undefined for the Weaver, rather than guessing an origin', () => {
    // It descends from no single base class. Returning one would be an invention,
    // and a caller that needs a character actual origin must read the character.
    expect(baseJobOf('weaver')).toBeUndefined();
  });

  it('returns a base job unchanged', () => {
    expect(baseJobOf('thief')?.id).toBe('thief');
    expect(baseJobOf('swordman')?.id).toBe('swordman');
    expect(baseJobOf('summoner')?.id).toBe('summoner');
  });

  it('has no unknown job id', () => {
    expect(jobById('novice')).toBeUndefined();
    expect(jobById('')).toBeUndefined();
  });

  it('never offers an advanced job as startable', () => {
    // The one direction that is a safety property. The reverse does not hold:
    // knight and summoner are base classes that ship unstartable until their
    // kits land, which is what the flag is for.
    for (const job of JOBS) {
      if (job.tier !== 'advanced') continue;
      expect(job.startable, `${job.id}`).toBeUndefined();
    }
    expect(JOBS.filter((j) => j.startable === true).map((j) => j.id)).toEqual([
      'swordman',
      'thief',
      'acolyte',
      'archer',
      'mage',
    ]);
  });
});
