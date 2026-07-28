// The Ragnarok Classic job tree: the shape every class-facing system converts to.
//
// Read off `e_mapid` in rAthena's `src/map/map.hpp`, filtered to the pre-renewal
// Classic era, minus what this game deliberately does not take: five first jobs
// and each one's two second jobs. Transcendent, third, and expanded classes are
// all in that enum and all excluded because Classic does not have them. Three
// more are Classic and excluded anyway, by product decision: Super Novice, the
// NOVICE state itself (characters pick a first job at creation), and MERCHANT
// with its Blacksmith and Alchemist branch.
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
export type JobTier = 'first' | 'second_1' | 'second_2';

export interface JobDef {
  /** Stable id. Lower snake case, never displayed. */
  id: string;
  /** The English name. Localized at the client like every other entity name. */
  name: string;
  tier: JobTier;
  /** The job this one advances from, or null for a first job, which is a root:
   *  characters pick one at creation and there is no Novice state before it. */
  from: string | null;
  /** Offered on the character-creation screen. Deliberately its own flag rather
   *  than `tier === 'first'`: the two say different things (what a job IS versus
   *  whether a new character may pick it), and keeping them apart is what lets a
   *  first job ship unstartable while its kit is authored. The picker and both
   *  server validation lists read THIS, so adding a startable job is one row. */
  startable?: boolean;
}

/** The five first jobs and their ten second jobs, in tree order.
 *
 *  Three Classic jobs are deliberately ABSENT, all by product decision rather
 *  than oversight, so a later reader does not go looking for what is missing:
 *  the NOVICE (a character picks a first job at creation, so there is no state
 *  before it and first jobs are roots), SUPER NOVICE (which Ragnarok hangs off
 *  the Novice as a 2-1), and MERCHANT with both of its branches, Blacksmith and
 *  Alchemist. */
export const JOBS: readonly JobDef[] = [
  { id: 'swordman', name: 'Swordman', tier: 'first', from: null, startable: true },
  { id: 'mage', name: 'Mage', tier: 'first', from: null, startable: true },
  { id: 'archer', name: 'Archer', tier: 'first', from: null, startable: true },
  { id: 'acolyte', name: 'Acolyte', tier: 'first', from: null, startable: true },
  { id: 'thief', name: 'Thief', tier: 'first', from: null, startable: true },

  { id: 'knight', name: 'Knight', tier: 'second_1', from: 'swordman' },
  { id: 'crusader', name: 'Crusader', tier: 'second_2', from: 'swordman' },

  { id: 'wizard', name: 'Wizard', tier: 'second_1', from: 'mage' },
  { id: 'sage', name: 'Sage', tier: 'second_2', from: 'mage' },

  { id: 'hunter', name: 'Hunter', tier: 'second_1', from: 'archer' },
  { id: 'bard', name: 'Bard', tier: 'second_2', from: 'archer' },

  { id: 'priest', name: 'Priest', tier: 'second_1', from: 'acolyte' },
  { id: 'monk', name: 'Monk', tier: 'second_2', from: 'acolyte' },

  { id: 'assassin', name: 'Assassin', tier: 'second_1', from: 'thief' },
  { id: 'rogue', name: 'Rogue', tier: 'second_2', from: 'thief' },
];

const BY_ID = new Map(JOBS.map((j) => [j.id, j]));

export function jobById(id: string): JobDef | undefined {
  return BY_ID.get(id);
}

/** The five starting professions, in the source's own order. */
export function firstJobs(): readonly JobDef[] {
  return JOBS.filter((j) => j.tier === 'first');
}

/** The jobs a new character may actually pick, in tree order. The ONE source the
 *  character-creation picker and both server validation lists derive from. */
export function startableJobs(): readonly JobDef[] {
  return JOBS.filter((j) => j.startable === true);
}

/** Whether `id` names a job a new character may be created as. */
export function isStartableJob(id: string): boolean {
  return BY_ID.get(id)?.startable === true;
}

/** Both advancements a first job offers, 2-1 first. */
export function advancementsFrom(jobId: string): readonly JobDef[] {
  return JOBS.filter((j) => j.from === jobId && j.tier !== 'first');
}

/** Walk back to the first job this one descends from, or the job itself when it
 *  already is one. */
export function firstJobOf(jobId: string): JobDef | undefined {
  let cur = BY_ID.get(jobId);
  while (cur && cur.tier !== 'first') {
    if (cur.from === null) return undefined;
    cur = BY_ID.get(cur.from);
  }
  return cur;
}
