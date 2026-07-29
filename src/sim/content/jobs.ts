// The SpiritVale job tree: the shape every class-facing system converts to.
//
// Read off the published class export (docs/design/data/spiritvale-raw/
// spiritvale-all-classes.json), whose 15 records carry a `type` of base or
// advanced and, on a base class, the `advancedClasses` it leads to.
//
// This REPLACED a Ragnarok Classic tree of five first jobs and ten second jobs.
// The two collided outright: Ragnarok hangs Knight off Swordman as a second job,
// while SpiritVale makes Knight a base class in its own right, and the same is
// true of Priest, Wizard and Paladin. The conversion target is SpiritVale, so
// this table is the one that yielded, and every id below is a SpiritVale class.
//
// This is the AUTHORITY for the conversion. It is what the systems blocked on
// job identity read, and what the live `PlayerClass` union in ../types.ts
// converges on.
//
// THE SHAPE IS NOT SYMMETRIC, and that is the source, not an omission. Seven
// base classes each advance to exactly ONE advanced class, where Ragnarok
// offered a branching pair. The eighth advanced class, the Weaver, has NO parent
// at all: the reference describes it as one skill tree drawn from every base
// class with no prerequisites, so it hangs off nothing and is reachable from any
// base. `from: null` on an advanced job means exactly that.

/** The tier a job sits at. `base` jobs are the seven a character is created as;
 *  `advanced` is the single advancement each of them leads to, plus the one
 *  parentless class any of them can become.
 *
 *  Ragnarok's branching `second_1`/`second_2` pair is gone with the tree that
 *  had it: SpiritVale advances one way, so a second tier value would encode a
 *  choice the game does not offer. */
export type JobTier = 'base' | 'advanced';

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

/** The seven base jobs and the eight advanced ones, in tree order.
 *
 *  THE IDS ARE THIS GAME OWN CLASS IDS, NOT THE REFERENCE NAMES. Three base
 *  classes were already here under a different name when the conversion started
 *  (`swordman` is the Warrior, `thief` the Rogue, `archer` the Scout), and an id
 *  that has reached a saved character is frozen: renaming one would strand every
 *  character carrying it. The `name` is the reference, the `id` is ours, and
 *  `SPIRITVALE_TREES[classId].archetype` holds the same pairing for the skill
 *  content, as do class_health_map.ts and progression/class_blocks.ts.
 *
 *  `knight` and `summoner` are new with the conversion and take the reference
 *  own id. Note `knight` was a SECOND job under the Ragnarok tree this replaces;
 *  nothing ever shipped as one, so the id is free. */
export const JOBS: readonly JobDef[] = [
  { id: 'swordman', name: 'Warrior', tier: 'base', from: null, startable: true },
  // Not startable YET: its kit is the SpiritVale skill tree, which is data but
  // is not what the sim casts from, so a character created as one would have no
  // abilities. The flag exists to let a base class ship while its kit is authored.
  { id: 'knight', name: 'Knight', tier: 'base', from: null },
  { id: 'thief', name: 'Rogue', tier: 'base', from: null, startable: true },
  { id: 'acolyte', name: 'Acolyte', tier: 'base', from: null, startable: true },
  { id: 'archer', name: 'Scout', tier: 'base', from: null, startable: true },
  { id: 'summoner', name: 'Summoner', tier: 'base', from: null },
  { id: 'mage', name: 'Mage', tier: 'base', from: null, startable: true },

  { id: 'berserker', name: 'Berserker', tier: 'advanced', from: 'swordman' },
  { id: 'paladin', name: 'Paladin', tier: 'advanced', from: 'knight' },
  { id: 'shinobi', name: 'Shinobi', tier: 'advanced', from: 'thief' },
  { id: 'priest', name: 'Priest', tier: 'advanced', from: 'acolyte' },
  { id: 'gunslinger', name: 'Gunslinger', tier: 'advanced', from: 'archer' },
  { id: 'necromancer', name: 'Necromancer', tier: 'advanced', from: 'summoner' },
  { id: 'wizard', name: 'Wizard', tier: 'advanced', from: 'mage' },

  // The parentless one. Not an oversight: the reference gives the Weaver a tree
  // drawn from every base class with no prerequisites, so it descends from none
  // of them and any base class may become it.
  { id: 'weaver', name: 'Weaver', tier: 'advanced', from: null },
];

const BY_ID = new Map(JOBS.map((j) => [j.id, j]));

export function jobById(id: string): JobDef | undefined {
  return BY_ID.get(id);
}

/** The seven base classes, in the tree order the source publishes. */
export function baseJobs(): readonly JobDef[] {
  return JOBS.filter((j) => j.tier === 'base');
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

/** The advancements a base job offers: its own, plus the parentless Weaver,
 *  which every base class may become. */
export function advancementsFrom(jobId: string): readonly JobDef[] {
  if (BY_ID.get(jobId)?.tier !== 'base') return [];
  return JOBS.filter((j) => j.tier === 'advanced' && (j.from === jobId || j.from === null));
}

/** Walk back to the base job this one descends from, or the job itself when it
 *  already is one.
 *
 *  Returns undefined for the Weaver, which is the honest answer rather than a
 *  gap: it descends from no single base class, so there is nothing to return.
 *  A caller that needs a character actual origin must read the character. */
export function baseJobOf(jobId: string): JobDef | undefined {
  let cur = BY_ID.get(jobId);
  while (cur && cur.tier !== 'base') {
    if (cur.from === null) return undefined;
    cur = BY_ID.get(cur.from);
  }
  return cur;
}
