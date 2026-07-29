// Job level: the second progression track, and the only source of skill points.
//
// Two experience bars run at once. BASE level buys attribute points and the
// health and spell-point pools; JOB level buys SKILL points, one per level, and
// nothing else. A character who grinds a low-level map has a high job level and
// a modest base level, and that is a real build decision rather than an accident.
//
// The reference runs the job track in TWO SEGMENTS with SEPARATE point pools
// (docs/design/spiritvale-engine-formulas.md, "Skill points, from job level"):
//
//   base class          job 1 to 50    50 points, buy base-tree skills
//   after advancement   job 1 to 70    70 points, buy advanced-tree skills
//   career total                      120
//
// One point per job level INCLUDING the point granted at job level 1, so a brand
// new character already holds one. Advancement RESTARTS the bar at job 1 and
// opens the second pool; the first pool survives, unspent points and all, which
// is the whole reason the two are modelled separately rather than as one budget.
//
// 120 points does not max a career: a base tree costs 65 to 75 points and an
// advanced tree 85 to 126, so every build ends 30 to 78 short. That shortfall is
// deliberate on the reference's part and is what makes a skill tree a choice.
//
// WHAT THIS MODULE DOES NOT DO, and why. The reference does not publish a job
// experience curve: no job table appears in any of its data files, its page
// source, or the two community wikis. The formulas doc carries a well-evidenced
// hypothesis (job level reuses the base curve, one kill feeding both bars) and
// states its own unresolved gap: the RATIO between the two awards is unknown.
// So the curve and the per-kill award below are the ones already in the tree,
// left in place deliberately. Implementing the hypothesis would be inventing the
// one number it cannot supply.
//
// A pure leaf: numbers in, numbers out, no Sim and no rng.

/** Which segment of the career a character's job bar is running. */
export type JobTrack = 'base' | 'advanced';

/** A base class caps here, then advances. */
export const MAX_BASE_JOB_LEVEL = 50;
/** An advanced class caps here, and there is no third segment. */
export const MAX_ADVANCED_JOB_LEVEL = 70;

/** One skill point per job level, granted on reaching it. */
export const SKILL_POINTS_PER_JOB_LEVEL = 1;

/** Where a job bar caps on `track`. */
export function maxJobLevel(track: JobTrack): number {
  return track === 'advanced' ? MAX_ADVANCED_JOB_LEVEL : MAX_BASE_JOB_LEVEL;
}

/** Job experience to go from job level L to L+1, indexed by L-1. */
export const JOB_XP_TABLE: readonly number[] = [
  30, 43, 58, 76, 116, 180, 220, 272, 336, 520, 604, 699, 802, 948, 1125, 1668, 1937, 2226, 3040,
  3988, 5564, 6272, 7021, 9114, 11473, 15290, 16891, 18570, 23229, 28359, 36478, 39716, 43088,
  52417, 62495, 78160, 84175, 90404, 107611, 125915, 153941, 191781, 204351, 248352, 286212, 386371,
  409795, 482092, 509596,
];

/** What the next job level costs, or null at the track's cap.
 *
 *  The advanced track runs twenty levels past the end of the table; those steps
 *  reuse the last published requirement rather than extrapolating a curve nobody
 *  wrote down. Flat and obviously a stand-in, which is the point: a fabricated
 *  growth rate would read as authoritative. */
export function jobXpToNext(jobLevel: number, track: JobTrack = 'base'): number | null {
  const lvl = Math.max(1, Math.floor(jobLevel));
  if (lvl >= maxJobLevel(track)) return null;
  return JOB_XP_TABLE[lvl - 1] ?? JOB_XP_TABLE[JOB_XP_TABLE.length - 1] ?? null;
}

/** Total job experience banked between job level 1 and `jobLevel` on `track`.
 *  Used by the bar, and by a load path that has a level but no progress. */
export function jobXpToReachLevel(jobLevel: number, track: JobTrack = 'base'): number {
  const lvl = Math.max(1, Math.min(maxJobLevel(track), Math.floor(jobLevel)));
  let total = 0;
  for (let l = 1; l < lvl; l++) total += jobXpToNext(l, track) ?? 0;
  return total;
}

export interface JobProgress {
  /** Which segment the bar is running. Absent on a save from before the split. */
  track: JobTrack;
  jobLevel: number;
  jobXp: number;
  /** Points earned on the BASE track. They buy base-tree skills only. */
  skillPoints: number;
  /** Points earned AFTER advancement. They buy advanced-tree skills only. */
  advancedSkillPoints: number;
}

/** A character at the very start of its career: job 1, and the one point job
 *  level 1 grants. */
export function freshJobProgress(): JobProgress {
  return {
    track: 'base',
    jobLevel: 1,
    jobXp: 0,
    skillPoints: SKILL_POINTS_PER_JOB_LEVEL,
    advancedSkillPoints: 0,
  };
}

/** Bank job experience and take every job level it pays for.
 *
 *  The points land in the pool belonging to the CURRENT track, which is the one
 *  thing that makes the two budgets separate in practice.
 *
 *  Overflow is CAPPED at one short of the next requirement, which is what the
 *  reference does when multi-level-up is off: a single enormous kill can carry a
 *  character up one job level and no further, and the remainder does not bank
 *  toward the level after it. Deliberate: it stops a party carry from vaulting a
 *  low character through the whole tree in one fight. */
export function applyJobXp(progress: JobProgress, amount: number): JobProgress {
  const gain = Math.max(0, Math.floor(amount));
  const track = progress.track === 'advanced' ? 'advanced' : 'base';
  const cap = maxJobLevel(track);
  let { jobLevel, jobXp, skillPoints, advancedSkillPoints } = progress;
  jobLevel = Math.max(1, Math.min(cap, Math.floor(jobLevel)));
  jobXp = Math.max(0, Math.floor(jobXp)) + gain;
  skillPoints = Math.max(0, Math.floor(skillPoints));
  advancedSkillPoints = Math.max(0, Math.floor(advancedSkillPoints));
  for (;;) {
    const next = jobXpToNext(jobLevel, track);
    if (next === null) {
      // At the cap the bar sits full rather than accumulating a number nothing
      // will ever spend.
      jobXp = 0;
      break;
    }
    if (jobXp < next) break;
    jobXp -= next;
    jobLevel += 1;
    if (track === 'advanced') advancedSkillPoints += SKILL_POINTS_PER_JOB_LEVEL;
    else skillPoints += SKILL_POINTS_PER_JOB_LEVEL;
    if (jobXp > next - 1) jobXp = next - 1;
  }
  return { track, jobLevel, jobXp, skillPoints, advancedSkillPoints };
}

/** Whether the character has finished its base segment and may advance. */
export function canAdvanceJob(progress: JobProgress): boolean {
  return progress.track === 'base' && progress.jobLevel >= MAX_BASE_JOB_LEVEL;
}

/** Advance to the second segment: the bar restarts at job 1 and the advanced
 *  pool opens with its level-1 point.
 *
 *  UNSPENT BASE POINTS SURVIVE. They are still base points and still buy only
 *  base-tree skills, so advancing never launders a hoarded budget into the
 *  advanced tree. Returns null when the character has not earned it. */
export function advanceJob(progress: JobProgress): JobProgress | null {
  if (!canAdvanceJob(progress)) return null;
  return {
    track: 'advanced',
    jobLevel: 1,
    jobXp: 0,
    skillPoints: progress.skillPoints,
    advancedSkillPoints: SKILL_POINTS_PER_JOB_LEVEL,
  };
}

/** Every skill point a career grants, base and advanced together. 120. */
export const CAREER_SKILL_POINTS =
  MAX_BASE_JOB_LEVEL * SKILL_POINTS_PER_JOB_LEVEL +
  MAX_ADVANCED_JOB_LEVEL * SKILL_POINTS_PER_JOB_LEVEL;
