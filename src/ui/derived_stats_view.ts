// The right-hand half of Ragnarok's status window: what the six attributes buy.
//
// The left half (place a point, see what the next one costs) has shipped since
// the status-point pass. This is the half that tells a player WHY they placed
// it: the attack, accuracy, evasion, defence and cadence the attributes and the
// worn gear add up to. Without it, spending a point is an act of faith.
//
// Every number here is READ, never recomputed. The sim already derives all of
// them in recalcPlayerStats and the combat leaves, and a second copy of a
// formula in the UI is a copy that eventually disagrees with the one that
// decides the fight. The one exception is attack speed, which the sim carries as
// a swing INTERVAL in seconds and Ragnarok displays as a rate; that conversion
// is here because it is presentation, not derivation.
//
// A pure core over IWorld: the offline Sim and the online ClientWorld both drive
// it unchanged, and a Vitest drives it from a plain stub with no DOM.

import type { IWorld } from '../world_api';

/** One readout: a label key suffix, the value, and an optional second value for
 *  the pairs Ragnarok shows as `a + b` (hard and soft defence) or `a ~ b`
 *  (the magic attack range). */
export interface DerivedStatRow {
  /** Stable id; the painter maps it to a translation key and an order. */
  id: DerivedStatId;
  value: number;
  /** The second half of a pair, or null for a single number. */
  second: number | null;
  /** How the painter should join the pair. */
  pair: 'none' | 'plus' | 'range';
}

export const DERIVED_STAT_IDS = [
  'atk',
  'matk',
  'hit',
  'crit',
  'flee',
  'def',
  'mdef',
  'aspd',
] as const;
export type DerivedStatId = (typeof DERIVED_STAT_IDS)[number];

export interface DerivedStatsModel {
  rows: readonly DerivedStatRow[];
}

/** Ragnarok shows attack speed as a RATE out of 200, not as an interval.
 *
 *  Read from the reference rather than remembered: it converts a configured
 *  attack-speed rating into a swing delay with
 *  `(AMOTION_ZERO_ASPD - aspd * AMOTION_INTERVAL) * AMOTION_DIVIDER_PC`, whose
 *  constants are 2000, 10 and 2 (`status.hpp:61-67`, applied at
 *  `battle.cpp:8965`). Inverted, a delay in milliseconds reads as
 *  `200 - delay / 20`, which puts the reference's own 190 ceiling at the 200ms
 *  swing it caps players to.
 *
 *  Presentation only: nothing reads this back, and the sim keeps the interval. */
export function aspdDisplay(swingIntervalSeconds: number): number {
  if (!(swingIntervalSeconds > 0)) return 0;
  return Math.max(0, Math.min(200, Math.round(200 - (swingIntervalSeconds * 1000) / 20)));
}

const row = (
  id: DerivedStatId,
  value: number,
  second: number | null = null,
  pair: DerivedStatRow['pair'] = 'none',
): DerivedStatRow => ({ id, value: Math.round(value), second, pair });

export function buildDerivedStats(world: IWorld): DerivedStatsModel | null {
  const p = world.player;
  // A mirrored player can exist before its first snapshot has filled in the
  // derived fields, so neither the attributes nor the weapon are assumed: the
  // whole panel withholds rather than painting a row of zeroes that reads like
  // a character with no gear.
  if (!p?.stats || !p.weapon) return null;
  const s = p.stats;
  const weapon = p.weapon;
  return {
    rows: [
      // Weapon attack and the attack power the attributes add, kept apart the way
      // the reference does: the left number is the weapon, the right is you.
      row(
        'atk',
        ((weapon.min ?? 0) + (weapon.max ?? 0)) / 2,
        Math.round(p.attackPower ?? 0),
        'plus',
      ),
      // Magic attack is a RANGE in the reference; this engine carries the
      // midpoint, so both ends read the same until the range is restored.
      row('matk', p.spellPower ?? 0, p.spellPower ?? 0, 'range'),
      row('hit', p.hit ?? 0),
      // Critical is a fraction on the entity and a percentage on the sheet.
      row('crit', (p.critChance ?? 0) * 100),
      // Evasion and the perfect dodge Luck buys, which are separate lines in the
      // reference because they are separate rolls.
      row('flee', p.flee ?? 0, Math.round((1 + (s.luk ?? 0) * 0.1) * 10) / 10, 'plus'),
      // Hard defence from equipment, soft defence from Vitality.
      row('def', s.armor ?? 0, s.vit ?? 0, 'plus'),
      row('mdef', s.mdef ?? 0, (s.int ?? 0) + Math.floor((s.vit ?? 0) / 2), 'plus'),
      row('aspd', aspdDisplay(weapon.speed ?? 0)),
    ],
  };
}
