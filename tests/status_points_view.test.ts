// The character sheet's status-point row.
//
// The core decides every affordance the painter renders, so these cases are the
// contract for what a player is allowed to click. It reads through IWorld only,
// which is what lets the offline Sim and the online ClientWorld drive the same
// row; the stub below is deliberately shaped like both.

import { describe, expect, it } from 'vitest';
import { emptyStatAllocation, type StatAllocation, type StatusStat } from '../src/sim/types';
import { buildStatusPoints, STATUS_POINT_ORDER } from '../src/ui/status_points_view';
import type { IWorld } from '../src/world_api';

interface StubOpts {
  unspent?: number;
  alloc?: Partial<StatAllocation>;
  /** Per-attribute cost; undefined means "priced at 2", null means unbuyable. */
  costs?: Partial<Record<StatusStat, number | null>>;
  stats?: Partial<Record<StatusStat, number>>;
}

function stubWorld(opts: StubOpts = {}): IWorld {
  const alloc: StatAllocation = { ...emptyStatAllocation(), ...opts.alloc };
  const stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1, ...opts.stats };
  return {
    statAllocation: alloc,
    statusPoints: () => opts.unspent ?? 0,
    statRaiseCost: (stat: StatusStat) =>
      opts.costs && stat in opts.costs ? (opts.costs[stat] ?? null) : 2,
    raiseStat: () => {},
    resetStats: () => {},
    player: { stats },
  } as unknown as IWorld;
}

describe('the status-point row', () => {
  it('covers all six attributes, in Ragnarok order', () => {
    expect([...STATUS_POINT_ORDER]).toEqual(['str', 'agi', 'vit', 'int', 'dex', 'luk']);
    const model = buildStatusPoints(stubWorld({ unspent: 10 }));
    expect(model.rows.map((r) => r.stat)).toEqual([...STATUS_POINT_ORDER]);
  });

  it('reads the value off the live entity, so gear and buffs show', () => {
    // The tile shows what the character HAS, not what they bought: a Blessing is
    // part of the number a player is reading when they decide where to spend.
    const model = buildStatusPoints(
      stubWorld({ unspent: 4, alloc: { str: 5 }, stats: { str: 16 } }),
    );
    expect(model.rows.find((r) => r.stat === 'str')?.value).toBe(16);
  });

  it('marks a raise affordable only when the pool actually covers it', () => {
    const model = buildStatusPoints(stubWorld({ unspent: 3, costs: { str: 2, agi: 4 } }));
    const row = (s: StatusStat) => model.rows.find((r) => r.stat === s);
    expect(row('str')?.affordable).toBe(true);
    expect(row('agi')?.affordable).toBe(false);
    // The unaffordable row still carries its price: that is the information a
    // player needs to decide what to save for, so the painter keeps showing it.
    expect(row('agi')?.cost).toBe(4);
    expect(model.canSpend).toBe(true);
  });

  it('treats a cost exactly equal to the pool as affordable', () => {
    const model = buildStatusPoints(stubWorld({ unspent: 4, costs: { str: 4 } }));
    expect(model.rows.find((r) => r.stat === 'str')?.affordable).toBe(true);
  });

  it('reports nothing spendable when the pool is empty', () => {
    const model = buildStatusPoints(stubWorld({ unspent: 0 }));
    expect(model.canSpend).toBe(false);
    expect(model.rows.every((r) => !r.affordable)).toBe(true);
  });

  it('distinguishes a capped attribute from an unaffordable one', () => {
    // Both refuse the click; only one of them will ever accept it again, and the
    // player is owed the difference between "too expensive" and "finished".
    const model = buildStatusPoints(stubWorld({ unspent: 50, costs: { str: null } }));
    const str = model.rows.find((r) => r.stat === 'str');
    expect(str?.maxed).toBe(true);
    expect(str?.cost).toBeNull();
    expect(str?.affordable).toBe(false);
    expect(model.rows.find((r) => r.stat === 'agi')?.maxed).toBe(false);
  });

  it('does not call an unpriced attribute maxed when the pool is empty', () => {
    // With no points, the world declines to price ANY raise. Reading that as the
    // 99 cap would tell a level-1 character they had finished their build.
    const model = buildStatusPoints(stubWorld({ unspent: 0, costs: { str: null } }));
    expect(model.rows.find((r) => r.stat === 'str')?.maxed).toBe(false);
  });

  it('offers a reset only once something has been placed', () => {
    expect(buildStatusPoints(stubWorld({ unspent: 48 })).canReset).toBe(false);
    expect(buildStatusPoints(stubWorld({ alloc: { vit: 1 } })).canReset).toBe(true);
  });

  it('never reports a negative pool', () => {
    const model = buildStatusPoints(stubWorld({ unspent: -5 }));
    expect(model.unspent).toBe(0);
    expect(model.canSpend).toBe(false);
  });

  it('survives a world with no player entity yet', () => {
    // The pre-spawn frame: the sheet can be built before the entity exists, and
    // falling back to the raw allocation beats throwing at paint time.
    const world = { ...stubWorld({ unspent: 6, alloc: { dex: 3 } }), player: undefined };
    const model = buildStatusPoints(world as unknown as IWorld);
    expect(model.unspent).toBe(6);
    expect(model.rows.find((r) => r.stat === 'dex')?.value).toBe(3);
  });
});
