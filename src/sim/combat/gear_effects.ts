// What a piece of equipment does BEYOND its numbers.
//
// Attack, defence and attributes make one sword better than another. These make
// a sword change how a class plays: a chance to stun on hit, a resistance that
// turns one fight from impossible to routine, a spell that casts itself. Each is
// rare in the reference and none is decorative. Measured over its 2017
// pre-renewal equipment rows and its 538 cards:
//
//                   equipment     cards
//   inflict            3.2%        2.6%
//   resist             2.7%        4.3%
//   flat health        3.5%        2.6%
//   flat spell points  3.5%        1.7%
//   attack speed       3.7%        0.7%
//   auto-cast on hit   4.5%        4.6%
//
// The statuses are the ones the reference actually inflicts, in its own order of
// frequency: stun, bleeding, curse, blind, freeze, poison, silence, sleep. Each
// maps onto an aura this game already has rather than inventing a parallel set.
//
// A pure leaf: it takes resolved records and a roll, and answers what fires.
// Every roll is passed IN so the caller owns the rng and the sim stays
// deterministic.

import type { AuraKind } from '../types';

/** The statuses a piece of gear can inflict or resist, and the aura each one
 *  becomes. Ordered by how often the reference data uses them. */
export const GEAR_STATUSES = [
  'stun',
  'bleeding',
  'curse',
  'blind',
  'freeze',
  'poison',
  'silence',
  'sleep',
] as const;
export type GearStatus = (typeof GEAR_STATUSES)[number];

/** Which existing aura each reference status becomes. Curse slows and freeze
 *  holds you in place, which is what those two do there as well. */
export const STATUS_AURA: Record<GearStatus, AuraKind> = {
  stun: 'stun',
  bleeding: 'dot',
  curse: 'slow',
  blind: 'blind',
  poison: 'dot',
  freeze: 'stasis',
  silence: 'silence',
  sleep: 'incapacitate',
};

/** How long each status lasts, in seconds. Short for the hard disables, longer
 *  for the ones a player can keep fighting through. */
export const STATUS_DURATION: Record<GearStatus, number> = {
  stun: 2,
  bleeding: 6,
  curse: 8,
  blind: 5,
  poison: 8,
  freeze: 3,
  silence: 4,
  sleep: 4,
};

export interface InflictOnHit {
  status: GearStatus;
  /** Chance per landed hit, as a fraction. The reference's most common
   *  value by a wide margin is 5%, then 1% and 3%. */
  chance: number;
}

export interface ResistStatus {
  status: GearStatus;
  /** Fraction taken off the chance of that status landing on the wearer. */
  fraction: number;
}

export interface AutoCast {
  /** The ability this gear casts by itself. */
  abilityId: string;
  /** Chance per landed hit, as a fraction. */
  chance: number;
}

/** The extras a piece of equipment or a card may carry. */
export interface GearEffects {
  inflictOnHit?: InflictOnHit;
  resistStatus?: ResistStatus;
  autoCast?: AutoCast;
  /** Flat maximum health and spell points. */
  maxHp?: number;
  maxSp?: number;
  /** Attack speed, as a fraction taken OFF the swing interval. Small: the
   *  reference's own attack-speed gear moves it by a few percent, and this
   *  stacks with everything Agility already buys. */
  attackSpeed?: number;
}

export interface AggregatedGearEffects {
  inflict: InflictOnHit[];
  resist: Partial<Record<GearStatus, number>>;
  autoCast: AutoCast[];
  maxHp: number;
  maxSp: number;
  attackSpeed: number;
}

export function emptyGearEffects(): AggregatedGearEffects {
  return { inflict: [], resist: {}, autoCast: [], maxHp: 0, maxSp: 0, attackSpeed: 0 };
}

/** Add up every worn piece. Inflict and auto-cast entries STACK as separate
 *  rolls rather than summing into one, which is how two stunning items give two
 *  chances instead of one bigger chance. Resistance sums, and is capped at total
 *  immunity by `resistedChance` below. */
export function aggregateGearEffects(
  sources: readonly (GearEffects | undefined)[],
): AggregatedGearEffects {
  const out = emptyGearEffects();
  for (const src of sources) {
    if (!src) continue;
    if (src.inflictOnHit) out.inflict.push(src.inflictOnHit);
    if (src.autoCast) out.autoCast.push(src.autoCast);
    if (src.resistStatus) {
      const { status, fraction } = src.resistStatus;
      out.resist[status] = (out.resist[status] ?? 0) + fraction;
    }
    out.maxHp += src.maxHp ?? 0;
    out.maxSp += src.maxSp ?? 0;
    out.attackSpeed += src.attackSpeed ?? 0;
  }
  return out;
}

/** What a status's chance becomes against a defender wearing resistance.
 *  Floored at zero: a stack may reach immunity, and never turns into a bonus. */
export function resistedChance(
  chance: number,
  resist: Partial<Record<GearStatus, number>> | undefined,
  status: GearStatus,
): number {
  return Math.max(0, chance * (1 - (resist?.[status] ?? 0)));
}

/** Which inflict entries fire for one landed hit, given one roll per entry.
 *  Rolls are supplied by the caller so the sim owns its randomness. */
export function inflictsThisHit(
  inflict: readonly InflictOnHit[],
  rolls: readonly number[],
  defenderResist?: Partial<Record<GearStatus, number>>,
): GearStatus[] {
  const out: GearStatus[] = [];
  for (const [i, entry] of inflict.entries()) {
    const chance = resistedChance(entry.chance, defenderResist, entry.status);
    if (chance > 0 && (rolls[i] ?? 1) < chance) out.push(entry.status);
  }
  return out;
}

/** Which auto-casts fire for one landed hit, one roll per entry. */
export function autoCastsThisHit(
  autoCast: readonly AutoCast[],
  rolls: readonly number[],
): AutoCast[] {
  return autoCast.filter((entry, i) => (rolls[i] ?? 1) < entry.chance);
}
