// The HP and SP a job carries at a level, before attributes multiply it.
//
// Ragnarok's curve, and it is NOT a straight line. HP grows QUADRATICALLY and SP
// grows linearly, which is why a level-1 character of any job is equally fragile
// and a level-99 one is not. A linear model gets the endpoints right and the
// whole middle wrong.
//
// Verified against `JobDatabase::calc_basehp` / `calc_basesp` in rAthena's
// `src/map/pc.cpp`:
//
//   base_hp = 35
//   base_hp += floor(level * hpIncrease / 100)              the linear term
//   for i = 2..level: base_hp += floor(hpFactor/100 * i + 0.5)   the quadratic one
//
//   base_sp = 10, same shape with spIncrease / spFactor
//
// The 35 and the 10 are universal: every job in the game starts from them, which
// is why every character has 40 HP at level 1 whatever they picked.
//
// The attribute multiplier is applied by the caller, not here:
//   maxHp = baseHp(level) * (1 + VIT/100)
//   maxSp = baseSp(level) * (1 + INT/100)
//
// A pure leaf: no SimContext, no rng, no clock.

/** The two universal floors. Every job starts from these. */
export const BASE_HP_FLOOR = 35;
export const BASE_SP_FLOOR = 10;

export interface JobVitals {
  /** Linear HP per level, in hundredths. */
  hpIncrease: number;
  /** Quadratic HP term, in hundredths. The only thing that separates the jobs. */
  hpFactor: number;
  /** Linear SP per level, in hundredths. */
  spIncrease: number;
  /** Quadratic SP term, in hundredths. Zero for every first job. */
  spFactor: number;
}

/** Ragnarok's pre-renewal coefficients for the first jobs.
 *
 *  Three things are worth reading off this table rather than assuming:
 *  `hpIncrease` is 500 for EVERY job, so it separates nothing; `spFactor` is 0
 *  for every first job, so SP is purely linear; and Thief and Archer are
 *  identical, which is a real property of the era and not a copy-paste slip. */
export const JOB_VITALS: Readonly<Record<string, JobVitals>> = {
  novice: { hpIncrease: 500, hpFactor: 0, spIncrease: 100, spFactor: 0 },
  swordman: { hpIncrease: 500, hpFactor: 70, spIncrease: 200, spFactor: 0 },
  thief: { hpIncrease: 500, hpFactor: 50, spIncrease: 200, spFactor: 0 },
  archer: { hpIncrease: 500, hpFactor: 50, spIncrease: 200, spFactor: 0 },
  acolyte: { hpIncrease: 500, hpFactor: 40, spIncrease: 500, spFactor: 0 },
  mage: { hpIncrease: 500, hpFactor: 30, spIncrease: 600, spFactor: 0 },
};

/** The shared curve. `floor` placement matters: the source floors each term
 *  separately and rounds the quadratic one with a `+ 0.5` inside the floor, so
 *  computing it as one expression drifts by a point or two per level. */
function curve(floor: number, level: number, increase: number, factor: number): number {
  const lv = Math.max(1, Math.floor(level));
  let value = floor + Math.floor((lv * increase) / 100);
  for (let i = 2; i <= lv; i++) value += Math.floor((factor / 100) * i + 0.5);
  return value;
}

/** Base HP for a job at a level, before Vitality multiplies it. */
export function baseHpAt(vitals: JobVitals, level: number): number {
  return curve(BASE_HP_FLOOR, level, vitals.hpIncrease, vitals.hpFactor);
}

/** Base SP for a job at a level, before Intelligence multiplies it. */
export function baseSpAt(vitals: JobVitals, level: number): number {
  return curve(BASE_SP_FLOOR, level, vitals.spIncrease, vitals.spFactor);
}
