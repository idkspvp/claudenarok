// Pure, host-agnostic view model for the character sheet's status-point row.
//
// The pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Modularity). It answers, for one character: how many points are unspent, what
// the next point in each attribute costs, whether they can afford it, and whether
// a reset would return anything. The painter (char_window.ts) turns that into
// tiles, buttons, and aria text; nothing here touches the DOM or i18n.
//
// It reads through IWorld only, so the offline Sim and the online ClientWorld
// both drive it unchanged, and a Vitest can drive it from a plain stub. Costs and
// affordability are asked of the world rather than recomputed here: the server is
// the authority on both, and a second copy of the cost curve in the UI is a copy
// that eventually disagrees with it.

import type { StatusStat } from '../sim/types';
import type { IWorld } from '../world_api';

/** One attribute's row: what it is now, and what the next point would take. */
export interface StatusPointRow {
  stat: StatusStat;
  value: number;
  /** Points the next raise costs, or null if it cannot be raised at all. */
  cost: number | null;
  /** Cost is known AND the unspent pool covers it. */
  affordable: boolean;
  /** At the 99 cap, so no cost exists no matter how many points are held. */
  maxed: boolean;
}

export interface StatusPointsModel {
  /** Unspent points. Zero means the whole row renders read-only. */
  unspent: number;
  /** Any raise at all is affordable: drives whether the row is worth showing. */
  canSpend: boolean;
  /** A reset would return something, so the button is worth offering. */
  canReset: boolean;
  rows: readonly StatusPointRow[];
}

/** The six, in the order Ragnarok lists them. */
export const STATUS_POINT_ORDER: readonly StatusStat[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

export function buildStatusPoints(world: IWorld): StatusPointsModel {
  const unspent = Math.max(0, Math.floor(world.statusPoints()));
  const alloc = world.statAllocation;
  const stats = world.player?.stats;
  const rows = STATUS_POINT_ORDER.map((stat): StatusPointRow => {
    const cost = world.statRaiseCost(stat);
    return {
      stat,
      // The entity's live value, which includes gear and buffs, is what the
      // player sees on the tile. Fall back to the raw allocation only if there
      // is no entity to read, which is the pre-spawn frame.
      value: stats ? stats[stat] : (alloc?.[stat] ?? 0),
      cost,
      affordable: cost !== null && cost <= unspent,
      // A null cost with points in hand can only mean the cap: the world refuses
      // to price a raise it would not allow.
      maxed: cost === null && unspent > 0,
    };
  });
  let spent = 0;
  if (alloc) for (const stat of STATUS_POINT_ORDER) spent += alloc[stat] ?? 0;
  return {
    unspent,
    canSpend: rows.some((r) => r.affordable),
    canReset: spent > 0,
    rows,
  };
}
