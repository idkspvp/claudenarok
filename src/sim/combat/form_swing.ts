// Form-aware auto-attack resolution (a pure leaf, unit-tested directly): the
// base swing speed, plus which ranged auto profile (class wand) a shapeshifted
// player still has.
//
// A druid in Wolf Form (internally the `form_cat` shapeshift aura) fights with
// claws, not the staff/mace it carries, so its auto-attack cadence must NOT come
// from the equipped weapon. Classic feral forms use a fixed normalized speed; we
// match it to the thief's baseline so a feral druid attacks as fast as a thief.
//
// `src/sim`-pure: no DOM/Three, no Math.random/Date.now. Reads only the static
// content tables, so it stays deterministic and host-agnostic.

import { CLASSES, ITEMS } from '../data';
import type { Entity, RangedWeaponProfile, WeaponInfo } from '../types';

/** A resolved ranged auto-attack: the weapon's own damage and cadence plus its
 *  range descriptor, so a caller needs nothing else. */
export type RangedAutoProfile = RangedWeaponProfile & Pick<WeaponInfo, 'min' | 'max' | 'speed'>;

// The thief's baseline weapon speed (its starting dagger). Sourcing it from the
// content tables keeps Wolf Form genuinely "same as thief" even if the thief's
// base weapon is ever retuned, instead of a magic number that could drift.
export const ROGUE_BASE_SWING_SPEED: number = ITEMS[CLASSES.thief.startWeapon].weapon?.speed ?? 1.8;

// Effective base swing speed in seconds, BEFORE haste/slow auras
// (`swingIntervalMult`). Wolf Form ignores the equipped weapon and matches the
// thief baseline; every other entity swings at its own weapon speed.
export function baseSwingSpeed(e: Entity): number {
  return formSwingSpeed(e) ?? e.weapon.speed;
}

/** The fixed cadence a shapeshift imposes, or null when the entity swings at its
 *  own weapon's speed. Separate from `baseSwingSpeed` because a damage site may
 *  be resolving a weapon OTHER than the equipped one (a strike ability passes
 *  its own): it needs to know whether a form is overriding the cadence without
 *  being handed the equipped weapon's speed as the answer. */
export function formSwingSpeed(e: Entity): number | null {
  for (const a of e.auras) if (a.kind === 'form_cat') return ROGUE_BASE_SWING_SPEED;
  return null;
}

// The druid shapeshifts that fight with claws (or hooves): while one is active
// the class wand is unavailable, exactly like a weapon it cannot hold. Caster
// form and Moonwing Form (`form_moonkin`) keep the wand. Deliberately a
// blocklist of the druid melee/travel forms, so the acolyte's `form_shadow` and
// the warlock's `form_metamorph` keep their existing wand behavior.
const WANDLESS_FORMS = new Set(['form_bear', 'form_cat', 'form_travel']);

export function wandAllowedInForm(e: Entity): boolean {
  for (const a of e.auras) if (WANDLESS_FORMS.has(a.kind)) return false;
  return true;
}

// The ranged auto profile the player can fire RIGHT NOW, read off the EQUIPPED
// WEAPON rather than the class. A bow shoots because it is a bow; an Archer
// holding a dagger is a melee character, and a caster that puts its staff down
// stops firing bolts. A wand still resolves to nothing in a form that cannot
// hold it, so a shapeshifted druid never wands from bear or cat form.
//
// This is the one resolver every ranged-auto consumer (the swing loop, the
// /attack readout) goes through, so the weapon is the single source of truth for
// whether an auto-attack is ranged at all.
export function rangedAutoProfile(e: Entity): RangedAutoProfile | undefined {
  const w = e.weapon;
  const ranged = w?.ranged;
  if (!ranged) return undefined;
  if (ranged.wand && !wandAllowedInForm(e)) return undefined;
  return { ...ranged, min: w.min, max: w.max, speed: w.speed };
}
