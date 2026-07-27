// The Ragnarok Classic job tree: the shape every class-facing system converts to.
//
// Read off `e_mapid` in rAthena's `src/map/map.hpp`, filtered to the pre-renewal
// Classic era: the six first jobs plus Novice, and each first job's two second
// jobs. Transcendent, third, and expanded classes are all in that enum and all
// deliberately excluded here, because Classic does not have them.
//
// This is the AUTHORITY for the conversion, not the game's live class list. The
// live list is still the nine it inherited (`PlayerClass` in ../types.ts), and
// migrating it is staged work: every class touches abilities, talents, stat
// blocks, starting gear, the guide, and saved characters. This table is what
// that migration converges ON, and it is what the systems blocked on job
// identity need in the meantime, chiefly attack speed, which is per JOB and per
// weapon class rather than a single global number.
//
// Nothing here is Gravity's authored data. These are the job NAMES and the tree
// they hang in, which is structure; no stat block, skill list, or balance number
// from Ragnarok is reproduced. `Swordman` keeps its non-standard spelling
// because that is the name Ragnarok uses and the tree is being matched, not
// paraphrased.

/** The tier a job sits at. `first` are the six starting professions, `second_1`
 *  and `second_2` the branching pair each of them offers. Ragnarok's own naming
 *  for the pair is 2-1 and 2-2; the split is not a quality tier, it is a
 *  direction (2-1 leans to the profession's obvious strength, 2-2 to its
 *  unobvious one). */
export type JobTier = 'novice' | 'first' | 'second_1' | 'second_2';

export interface JobDef {
  /** Stable id. Lower snake case, never displayed. */
  id: string;
  /** The English name. Localized at the client like every other entity name. */
  name: string;
  tier: JobTier;
  /** The job this one advances from, or null for the Novice. */
  from: string | null;
}

/** The Novice, the six first jobs, and their twelve second jobs: nineteen
 *  records, in tree order. Super Novice is the odd one out and is included
 *  because Ragnarok includes it: the source comments on it directly, noting that
 *  Super Novices are the 2-1 of the Novice and that Novices count as a first
 *  class too. */
export const JOBS: readonly JobDef[] = [
  { id: 'novice', name: 'Novice', tier: 'novice', from: null },

  { id: 'swordman', name: 'Swordman', tier: 'first', from: 'novice' },
  { id: 'mage', name: 'Mage', tier: 'first', from: 'novice' },
  { id: 'archer', name: 'Archer', tier: 'first', from: 'novice' },
  { id: 'acolyte', name: 'Acolyte', tier: 'first', from: 'novice' },
  { id: 'merchant', name: 'Merchant', tier: 'first', from: 'novice' },
  { id: 'thief', name: 'Thief', tier: 'first', from: 'novice' },

  { id: 'super_novice', name: 'Super Novice', tier: 'second_1', from: 'novice' },

  { id: 'knight', name: 'Knight', tier: 'second_1', from: 'swordman' },
  { id: 'crusader', name: 'Crusader', tier: 'second_2', from: 'swordman' },

  { id: 'wizard', name: 'Wizard', tier: 'second_1', from: 'mage' },
  { id: 'sage', name: 'Sage', tier: 'second_2', from: 'mage' },

  { id: 'hunter', name: 'Hunter', tier: 'second_1', from: 'archer' },
  { id: 'bard', name: 'Bard', tier: 'second_2', from: 'archer' },

  { id: 'priest', name: 'Priest', tier: 'second_1', from: 'acolyte' },
  { id: 'monk', name: 'Monk', tier: 'second_2', from: 'acolyte' },

  { id: 'blacksmith', name: 'Blacksmith', tier: 'second_1', from: 'merchant' },
  { id: 'alchemist', name: 'Alchemist', tier: 'second_2', from: 'merchant' },

  { id: 'assassin', name: 'Assassin', tier: 'second_1', from: 'thief' },
  { id: 'rogue', name: 'Rogue', tier: 'second_2', from: 'thief' },
];

const BY_ID = new Map(JOBS.map((j) => [j.id, j]));

export function jobById(id: string): JobDef | undefined {
  return BY_ID.get(id);
}

/** The six starting professions, in the source's own order. */
export function firstJobs(): readonly JobDef[] {
  return JOBS.filter((j) => j.tier === 'first');
}

/** Both advancements a first job offers, 2-1 first. Super Novice is reachable
 *  from the Novice and so appears for it. */
export function advancementsFrom(jobId: string): readonly JobDef[] {
  return JOBS.filter((j) => j.from === jobId && j.tier !== 'first');
}

/** Walk back to the first job this one descends from, or the job itself when it
 *  already is one. Returns null for the Novice, which descends from nothing. */
export function firstJobOf(jobId: string): JobDef | undefined {
  let cur = BY_ID.get(jobId);
  while (cur && cur.tier !== 'first') {
    if (cur.from === null) return undefined;
    cur = BY_ID.get(cur.from);
  }
  return cur;
}
