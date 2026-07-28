// Job level: the second progression track, and the only source of skill points.
//
// Ragnarok runs two experience bars at once. BASE level buys status points and
// the health and spell-point pools; JOB level buys SKILL points, one per level,
// and nothing else. A character who grinds a low-level map has a high job level
// and a modest base level, and that is a real build decision, not an accident.
//
// The table is the reference's own first-job curve, verbatim from its
// db/pre-re/job_exp.yml (the block shared by Swordman, Mage, Archer, Acolyte,
// Merchant and Thief). Forty-nine steps, because a first job caps at job level
// 50 and the fiftieth row there is the cannot-advance sentinel rather than a
// real requirement.
//
// The shape is worth seeing before it is used: the first level costs 30 and the
// last costs 509,596, a factor of seventeen thousand, and it is NOT smooth. The
// jumps at job 10, 16 and 21 are where the reference deliberately slows a
// character down. A generated curve cannot reproduce that, which is why this is
// a literal.
//
// A pure leaf: numbers in, numbers out, no Sim and no rng.

/** A first job caps here. */
export const MAX_JOB_LEVEL = 50;

/** One skill point per job level, which is the whole of what job level buys
 *  (`pc_checkjoblevelup` increments `skill_point` by exactly one). */
export const SKILL_POINTS_PER_JOB_LEVEL = 1;

/** Job experience to go from job level L to L+1, indexed by L-1. */
export const JOB_XP_TABLE: readonly number[] = [
  30, 43, 58, 76, 116, 180, 220, 272, 336, 520, 604, 699, 802, 948, 1125, 1668, 1937, 2226, 3040,
  3988, 5564, 6272, 7021, 9114, 11473, 15290, 16891, 18570, 23229, 28359, 36478, 39716, 43088,
  52417, 62495, 78160, 84175, 90404, 107611, 125915, 153941, 191781, 204351, 248352, 286212, 386371,
  409795, 482092, 509596,
];

/** What the next job level costs, or null at the cap. */
export function jobXpToNext(jobLevel: number): number | null {
  const lvl = Math.max(1, Math.floor(jobLevel));
  if (lvl >= MAX_JOB_LEVEL) return null;
  return JOB_XP_TABLE[lvl - 1] ?? null;
}

/** Total job experience banked between job level 1 and `jobLevel`. Used by the
 *  bar, and by a load path that has a level but no progress. */
export function jobXpToReachLevel(jobLevel: number): number {
  const lvl = Math.max(1, Math.min(MAX_JOB_LEVEL, Math.floor(jobLevel)));
  let total = 0;
  for (let l = 1; l < lvl; l++) total += JOB_XP_TABLE[l - 1] ?? 0;
  return total;
}

export interface JobProgress {
  jobLevel: number;
  jobXp: number;
  skillPoints: number;
}

/** Bank job experience and take every job level it pays for.
 *
 *  Overflow is CAPPED at one short of the next requirement, which is what the
 *  reference does when multi-level-up is off: a single enormous kill can carry a
 *  character up one job level and no further, and the remainder does not bank
 *  toward the level after it. Deliberate: it stops a party carry from vaulting a
 *  low character through the whole tree in one fight. */
export function applyJobXp(progress: JobProgress, amount: number): JobProgress {
  const gain = Math.max(0, Math.floor(amount));
  let { jobLevel, jobXp, skillPoints } = progress;
  jobLevel = Math.max(1, Math.min(MAX_JOB_LEVEL, Math.floor(jobLevel)));
  jobXp = Math.max(0, Math.floor(jobXp)) + gain;
  for (;;) {
    const next = jobXpToNext(jobLevel);
    if (next === null) {
      // At the cap the bar sits full rather than accumulating a number nothing
      // will ever spend.
      jobXp = 0;
      break;
    }
    if (jobXp < next) break;
    jobXp -= next;
    jobLevel += 1;
    skillPoints += SKILL_POINTS_PER_JOB_LEVEL;
    if (jobXp > next - 1) jobXp = next - 1;
  }
  return { jobLevel, jobXp, skillPoints };
}
