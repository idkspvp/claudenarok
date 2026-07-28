// Firing what a piece of gear does beyond its numbers, on a landed hit.
//
// `gear_effects.ts` is the pure half: it says WHAT a set of equipment carries and
// which of it fires for a given set of rolls. This is the half that touches the
// world: it draws the rolls, applies the status auras, and dispatches the
// auto-cast. Splitting them that way is what lets a Vitest drive every rule with
// no Sim at all.
//
// Determinism and parity: a wearer with no such gear draws NO rng here. Every
// guard short-circuits before the first draw, exactly as the legendary weapon
// procs do, so the shared draw order (and every golden that equips ordinary
// gear) is unchanged.
//
// An auto-cast is free, instant, and ignores cooldown, which is what it is in the
// reference: the gear casts, not the wearer.
//
// src/sim-pure: reaches Sim only through SimContext.

import type { SimContext } from '../sim_context';
import type { Entity } from '../types';
import { resolveAutoCastAbility } from './auto_cast_ability';
import {
  type AutoCast,
  autoCastsThisHit,
  type GearStatus,
  inflictsThisHit,
  STATUS_AURA,
  STATUS_DURATION,
} from './gear_effects';

/** The damage a bleed or a poison deals per tick, as a fraction of the victim's
 *  maximum health. The reference's own bleeding is a percentage of maximum
 *  health for the same reason: it has to stay relevant across a hundred levels
 *  without a flat number that is lethal early and ignorable late. */
const STATUS_DOT_FRACTION = 0.01;
const STATUS_DOT_INTERVAL = 1;

/** English names for the status auras. The sim is language-agnostic (see
 *  src/sim/CLAUDE.md); the client re-renders these through `localizeSimText`. */
const STATUS_NAME: Record<GearStatus, string> = {
  stun: 'Stunned',
  curse: 'Cursed',
  bleeding: 'Bleeding',
  blind: 'Blinded',
  poison: 'Poisoned',
  freeze: 'Frozen',
  silence: 'Silenced',
  sleep: 'Asleep',
};

/** How much a curse slows, as the remaining fraction of move speed. */
const CURSE_SPEED = 0.5;

/** Roll every on-hit extra the attacker's gear carries against `target`. Called
 *  from the melee and ranged swing shells once a hit has actually landed. */
export function runGearOnHit(ctx: SimContext, attacker: Entity, target: Entity): void {
  if (target.dead) return;
  const effects = attacker.gearEffects;
  if (!effects) return;
  const { inflict, autoCast } = effects;
  // Both guards are BEFORE any draw: ordinary gear never touches the stream.
  if (inflict.length > 0) {
    const rolls = inflict.map(() => ctx.rng.next());
    const resist = target.gearEffects?.resist;
    for (const status of inflictsThisHit(inflict, rolls, resist)) {
      applyStatus(ctx, attacker, target, status);
    }
  }
  if (autoCast.length > 0 && !target.dead) {
    const rolls = autoCast.map(() => ctx.rng.next());
    for (const entry of autoCastsThisHit(autoCast, rolls)) {
      fireAutoCast(ctx, attacker, target, entry);
    }
  }
}

function applyStatus(ctx: SimContext, attacker: Entity, target: Entity, status: GearStatus): void {
  const duration = STATUS_DURATION[status];
  const base = {
    id: `gear_${status}`,
    name: STATUS_NAME[status],
    kind: STATUS_AURA[status],
    remaining: duration,
    duration,
    sourceId: attacker.id,
  } as const;
  if (status === 'bleeding' || status === 'poison') {
    ctx.applyAura(target, {
      ...base,
      value: Math.max(1, Math.round(target.maxHp * STATUS_DOT_FRACTION)),
      tickInterval: STATUS_DOT_INTERVAL,
      tickTimer: STATUS_DOT_INTERVAL,
      school: status === 'poison' ? 'nature' : 'physical',
    });
    return;
  }
  if (status === 'curse') {
    // `slow` reads `value` as the remaining fraction of move speed.
    ctx.applyAura(target, { ...base, value: CURSE_SPEED, school: 'shadow' });
    return;
  }
  ctx.applyAura(target, {
    ...base,
    value: 0,
    school: status === 'freeze' ? 'frost' : 'physical',
  });
}

function fireAutoCast(ctx: SimContext, attacker: Entity, target: Entity, entry: AutoCast): void {
  // Only a player carries the meta an effect dispatch needs; a mob that somehow
  // carried an auto-cast no-ops rather than throwing.
  if (attacker.kind !== 'player') return;
  // A player's entity id IS its pid (Sim.resolve keys both off the same map).
  const owner = ctx.resolve(attacker.id);
  if (!owner) return;
  // Resolved from the ability table, NOT the wearer's known list: a card that
  // casts a bolt has to work on a character who never learns that bolt.
  const res = resolveAutoCastAbility(entry.abilityId);
  if (!res) return;
  ctx.runEffects(attacker, owner.meta, target, res);
}
