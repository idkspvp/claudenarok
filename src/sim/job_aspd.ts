// The base attack motion each first job has with each weapon, in milliseconds.
//
// This is the table `combat/aspd.ts` deliberately does not carry: the formula is
// pure arithmetic and knows nothing about jobs, and this knows nothing about the
// arithmetic. Same split as `job_vitals.ts` against the HP and SP curves.
//
// Values read from rAthena's `db/pre-re/job_aspd.yml`. That is Gravity's
// authored dataset, which `docs/design/ro-reference-source.md` otherwise puts
// off limits; the owner lifted the rule for this file explicitly, and the scope
// and the reason are recorded there. Do NOT treat it as a general licence: the
// rule still stands for monster records, item records, and card effects.
//
// Two properties of the table matter more than any single number in it:
//
//   1. **A missing row is the mechanic, not an omission.** A job with no entry
//      for a weapon falls back to 2000ms, which is `AMOTION_ZERO_ASPD` and works
//      out to a four-second swing. A Mage holding an axe is not slightly worse
//      than a Swordman holding one, they are barely able to attack at all. That
//      is what makes a weapon class a real commitment rather than a stat stick.
//   2. **The same weapon is a different speed in different hands.** A Swordman
//      swings a dagger at 500 and a Thief at 500, but a one-handed sword at 550
//      against the Thief's 650. This is exactly what a per-weapon `speed` field
//      cannot express, and it is why `WeaponInfo.speed` has to go when this is
//      wired in.
//
// Unarmed is a real row here and not an afterthought: every job has one, and for
// the four non-Swordman jobs it is the FASTEST option they have. A level-1
// character with no weapon is not helpless in Ragnarok, they are just weak.

import type { WeaponType } from './types';

/** The five startable jobs, as their own union rather than an import.
 *
 *  `PlayerClass` is still the inherited nine while the collapse onto the first
 *  jobs is in flight, and `content/jobs.ts` still lists all eighteen including
 *  the Novice and Merchant branches that were cut by decision. Neither is a
 *  stable key today. When `PlayerClass` becomes these five, this should become an
 *  alias of it and a test should pin the two as identical. */
export type AspdJob = 'swordman' | 'mage' | 'archer' | 'acolyte' | 'thief';

export const ASPD_JOBS: readonly AspdJob[] = ['swordman', 'mage', 'archer', 'acolyte', 'thief'];

/** The fallback for a job and weapon with no authored row, from rAthena's
 *  `AMOTION_ZERO_ASPD`. Twice the slowest real entry in the table, which is the
 *  point: it is a penalty, not a default. */
export const DEFAULT_BASE_AMOTION = 2000;

/** Base attack motion with no weapon equipped, per job. Ragnarok's `Fist`. */
export const UNARMED_BASE_AMOTION: Readonly<Record<AspdJob, number>> = {
  swordman: 400,
  mage: 500,
  archer: 400,
  acolyte: 400,
  thief: 400,
};

/** Base attack motion per job per weapon class.
 *
 *  Only weapons the job is actually built around appear. Everything absent
 *  resolves to `DEFAULT_BASE_AMOTION`, so the table stays a statement about what
 *  a job CAN use rather than a full matrix mostly filled with a penalty.
 *
 *  Ragnarok's two-handed mace and two-handed staff have no counterpart in this
 *  game's `WeaponType`, so their rows are dropped rather than folded into the
 *  one-handed entry. `Staff` maps onto `rod`. */
export const JOB_BASE_AMOTION: Readonly<
  Record<AspdJob, Readonly<Partial<Record<WeaponType, number>>>>
> = {
  // The only job with a full melee spread, and the only one whose unarmed row is
  // faster than every weapon it can hold: a Swordman always pays speed for reach
  // and damage.
  swordman: {
    dagger: 500,
    sword: 550,
    twohand_sword: 600,
    spear: 650,
    twohand_spear: 700,
    axe: 700,
    twohand_axe: 750,
    mace: 650,
  },
  // Three entries. A Mage that picks up anything else is not playing a Mage.
  mage: {
    dagger: 600,
    rod: 700,
  },
  archer: {
    dagger: 600,
    bow: 700,
  },
  acolyte: {
    mace: 600,
    rod: 600,
  },
  // Note the 800s: a Thief CAN hold an axe or a bow, and is punished for it
  // almost as hard as having no row at all. The dagger at 500 is the point.
  thief: {
    dagger: 500,
    sword: 650,
    axe: 800,
    bow: 800,
  },
};

/** The base attack motion for a job holding a weapon, or unarmed when `weapon`
 *  is null. Falls back to the penalty for any pairing with no authored row. */
export function baseAmotionFor(job: AspdJob, weapon: WeaponType | null): number {
  if (weapon === null) return UNARMED_BASE_AMOTION[job];
  return JOB_BASE_AMOTION[job][weapon] ?? DEFAULT_BASE_AMOTION;
}
