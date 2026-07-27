// Per-player proc bookkeeping: the counters and internal cooldowns a
// modifier-driven proc parks on the entity, plus the two lifecycle calls that
// keep them honest (tick them down, drop them on death).
//
// This used to live inside the talent proc engine. The engine went with the
// talent trees; the bookkeeping stayed because the surviving modifier
// vocabulary (`PlayerModifiers.global.cheatDeathIcd`, and any future Fiesta
// augment that arms an icd) still parks state here, and an icd that is never
// ticked down is an icd that never expires.
//
// A pure leaf: no SimContext, no rng, no clock. Plain tick math.

import type { Entity } from '../types';

/** Advance every running internal cooldown by `dt` seconds, dropping expired ones. */
export function tickProcState(player: Entity, dt: number): void {
  const procState = player.procState;
  if (!procState) return;
  for (const key of Object.keys(procState.icds)) {
    procState.icds[key] -= dt;
    if (procState.icds[key] <= 0) delete procState.icds[key];
  }
}

/** Drop the whole bag (death resets counters and icds alike). */
export function resetProcState(player: Entity): void {
  player.procState = undefined;
}
