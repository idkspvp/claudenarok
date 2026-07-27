// The world clock: whether it is night, and how bright the world is.
//
// Two things that look like one and are deliberately kept apart:
//
//   `isNight`   a BOOLEAN. Anything that ever branches on the time of day wants
//               a crisp yes or no, so there is no dawn or dusk STATE: nothing
//               would be written against one.
//   `daylight`  a CONTINUOUS 0..1 the renderer lerps its sun, hemisphere, fog
//               and sky against. Free to compute and the reason the sky does not
//               snap: the boolean flips in one tick, the light takes a minute.
//
// The two disagree during the ramp, on purpose. Night BEGINS halfway through
// the darkening, which is what "sunset" means.
//
// **Why this is sim code even though nothing gameplay-side reads it yet.** It is
// not for the sake of night-only spawns, which may never be authored. It is that
// two players standing beside each other have to see the same sky, and the sim
// is the only clock all three hosts share. A cycle driven from the renderer
// would put every client on its own sunset. The sky is a property of the world,
// and the world is the sim.
//
// The cost of keeping it here is nothing: a pure function of sim seconds, no
// tick phase, no rng draw, no state. It takes the time as an argument rather
// than reading one, because `src/sim/` may not touch a wall clock at all (root
// CLAUDE.md, Invariants).

/** How long the world stays fully lit, in sim seconds. */
export const DAY_SECONDS = 1_200; // 20 minutes

/** How long it stays dark. Shorter than the day: night is a change of pace, not
 *  a third of the session spent squinting. */
export const NIGHT_SECONDS = 600; // 10 minutes

export const CYCLE_SECONDS = DAY_SECONDS + NIGHT_SECONDS;

/** How long the light takes to cross between the two levels, centred on each
 *  boundary. Purely visual: `isNight` does not ramp. */
export const TWILIGHT_SECONDS = 60;

/** How dark night is allowed to get, and it is a FAIRNESS floor rather than an
 *  art choice.
 *
 *  The repo's graphics rule is that nothing may hide information a player acts
 *  on. A night dark enough to lose a mob in is exactly that, and it would land
 *  hardest on whoever has the worst monitor. So the floor is high enough to keep
 *  the world readable, and the darkening is atmosphere on top of a world you can
 *  still fight in.
 *
 *  The other half of the rule cannot live here: the renderer must apply this
 *  identically at every graphics preset, and must not dim the HUD at all, since
 *  nameplates and health bars are interface rather than lit geometry. A preset
 *  that bought a brighter night would be buying an advantage. */
export const MIN_NIGHT_LIGHT = 0.45;

/** Per-area override, modelled on Ragnarok's `MF_NIGHTENABLED`: a town stays
 *  lit, an interior stays dark, and only the open world turns. */
export type DaylightMode = 'cycle' | 'always_day' | 'always_night';

/** Where in the cycle a moment sits, as a 0..1 fraction. */
export function cyclePosition(seconds: number): number {
  const t = seconds % CYCLE_SECONDS;
  return (t < 0 ? t + CYCLE_SECONDS : t) / CYCLE_SECONDS;
}

/** Whether it is night. The whole gameplay surface of this module.
 *
 *  Flips in a single tick at the boundary, while `daylight` is halfway through
 *  its ramp. A caller that wants the smooth value wants `daylight`. */
export function isNight(seconds: number): boolean {
  const t = seconds % CYCLE_SECONDS;
  return (t < 0 ? t + CYCLE_SECONDS : t) >= DAY_SECONDS;
}

/** Smoothstep, so the ramp eases in and out instead of sliding linearly. A
 *  linear ramp reads as a dimmer switch being turned by hand. */
function ease(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** How lit the world is, from `MIN_NIGHT_LIGHT` at midnight to 1 in full day.
 *
 *  Ramps across `TWILIGHT_SECONDS` centred on each boundary, so at the exact
 *  moment `isNight` flips this sits halfway between the two levels. */
export function daylight(seconds: number, mode: DaylightMode = 'cycle'): number {
  if (mode === 'always_day') return 1;
  if (mode === 'always_night') return MIN_NIGHT_LIGHT;

  const t = seconds % CYCLE_SECONDS;
  const now = t < 0 ? t + CYCLE_SECONDS : t;
  const half = TWILIGHT_SECONDS / 2;

  // Distance into, or out of, each boundary. Dusk sits at DAY_SECONDS and dawn
  // at the wrap back to 0, which is why the second one measures from both ends
  // of the cycle.
  const intoDusk = now - (DAY_SECONDS - half);
  const intoDawn = now - (CYCLE_SECONDS - half);

  let darkness: number;
  if (intoDawn >= 0) darkness = 1 - ease(intoDawn / TWILIGHT_SECONDS);
  else if (now < half) darkness = 1 - ease((now + half) / TWILIGHT_SECONDS);
  else if (intoDusk >= 0) darkness = ease(Math.min(1, intoDusk / TWILIGHT_SECONDS));
  else darkness = 0;

  // Clamped rather than left to the arithmetic. `1 - 1 * (1 - 0.45)` lands on
  // 0.44999999999999996 in binary floating point, a hair under the floor. The
  // difference is invisible, but the floor is a fairness guarantee and a
  // guarantee that holds approximately is not one, so it is enforced here.
  return Math.max(MIN_NIGHT_LIGHT, Math.min(1, 1 - darkness * (1 - MIN_NIGHT_LIGHT)));
}

/** Both readings at once, which is what a per-frame consumer wants so it does
 *  not compute the cycle position twice. */
export function dayCycleAt(
  seconds: number,
  mode: DaylightMode = 'cycle',
): { night: boolean; light: number } {
  return {
    night: mode === 'cycle' ? isNight(seconds) : mode === 'always_night',
    light: daylight(seconds, mode),
  };
}
