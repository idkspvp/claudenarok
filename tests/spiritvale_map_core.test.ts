// The map draw plan.
//
// The load-bearing property is instancing: these maps repeat a small kit
// enormously, so a plan that emitted one draw per placement would spend a whole
// frame budget on one room. Most of what follows checks that grouping, and that
// the plan degrades honestly when a mesh is missing rather than silently
// dropping props.

import { describe, expect, it } from 'vitest';
import {
  batchesNear,
  DEFAULT_EXCLUDED_GROUPS,
  drawCallCost,
  type MapLayout,
  type MapPlacement,
  planMap,
  requiredMeshes,
} from '../src/render/spiritvale_map_core';

const at = (name: string, x: number, extra: Partial<MapPlacement> = {}): MapPlacement => ({
  name,
  pos: [x, 0, 0],
  rot: [0, 0, 0, 1],
  scale: [1, 1, 1],
  ...extra,
});

const layout = (props: MapPlacement[], map = 'Test_Map'): MapLayout => ({ map, props });

const hasAll = { has: () => true };

describe('instancing', () => {
  it('emits one batch per mesh, not one per placement', () => {
    const plan = planMap(
      layout([at('Tile', 0), at('Tile', 1), at('Tile', 2), at('Rock', 3)]),
      hasAll,
    );
    expect(plan.counts.placements).toBe(4);
    expect(plan.counts.drawn).toBe(4);
    expect(plan.batches).toHaveLength(2);
    expect(plan.batches.map((b) => b.mesh)).toEqual(['Tile', 'Rock']);
    expect(plan.batches[0].instances).toHaveLength(3);
  });

  it('reports the draw-call saving, which is the point of the module', () => {
    const props = Array.from({ length: 1716 }, (_, i) => at('Bld_Floor_Tile_04', i));
    const plan = planMap(layout(props), hasAll);
    const cost = drawCallCost(plan);
    expect(cost.placements).toBe(1716);
    expect(cost.calls).toBe(1);
    expect(cost.ratio).toBe(1716);
  });

  it('orders batches heaviest first, so a budget cut drops the cheap tail', () => {
    const plan = planMap(
      layout([at('A', 0), at('B', 1), at('B', 2), at('C', 3), at('C', 4), at('C', 5)]),
      hasAll,
    );
    expect(plan.batches.map((b) => b.mesh)).toEqual(['C', 'B', 'A']);
  });

  it('is stable: the same layout plans identically twice', () => {
    const props = [at('B', 0), at('A', 1), at('B', 2), at('A', 3)];
    expect(planMap(layout(props), hasAll)).toEqual(planMap(layout(props), hasAll));
  });

  it('preserves source order inside a batch', () => {
    const plan = planMap(layout([at('T', 5), at('T', 1), at('T', 9)]), hasAll);
    expect(plan.batches[0].instances.map((i) => i.pos[0])).toEqual([5, 1, 9]);
  });
});

describe('a mesh the caller does not have', () => {
  it('is reported by name rather than silently dropped', () => {
    const plan = planMap(layout([at('Have', 0), at('Gone', 1), at('Gone', 2)]), {
      has: (m) => m === 'Have',
    });
    expect(plan.missing).toEqual(['Gone']);
    expect(plan.counts.skipped).toBe(2);
    expect(plan.counts.drawn).toBe(1);
    // Reported ONCE per mesh, not once per placement: the caller wants to know
    // what to fetch, not how many times it failed.
    expect(plan.missing).toHaveLength(1);
  });

  it('leaves the placement count intact, so the loss is visible', () => {
    const plan = planMap(layout([at('A', 0), at('B', 1)]), { has: () => false });
    expect(plan.counts.placements).toBe(2);
    expect(plan.counts.drawn).toBe(0);
    expect(plan.batches).toEqual([]);
  });
});

describe('what a web renderer supplies itself', () => {
  it('drops the authored lighting, fog and backdrop groups by default', () => {
    const plan = planMap(
      layout([
        at('Lamp', 0, { group: 'Lighting' }),
        at('FogCard', 1, { group: 'Fog' }),
        at('Mtn', 2, { group: 'BackdropMountains' }),
        at('Tree', 3, { group: 'Tree' }),
      ]),
      hasAll,
    );
    expect(plan.batches.map((b) => b.mesh)).toEqual(['Tree']);
    expect(plan.counts.skipped).toBe(3);
    expect(DEFAULT_EXCLUDED_GROUPS).toContain('lighting');
  });

  it('matches a group name case-insensitively', () => {
    const plan = planMap(layout([at('L', 0, { group: 'LIGHTING' })]), hasAll);
    expect(plan.batches).toEqual([]);
  });

  it('takes an explicit group list over the default', () => {
    const plan = planMap(
      layout([at('L', 0, { group: 'Lighting' }), at('T', 1, { group: 'Tree' })]),
      {
        ...hasAll,
        excludeGroups: ['tree'],
      },
    );
    expect(plan.batches.map((b) => b.mesh)).toEqual(['L']);
  });
});

describe('props the source authored disabled', () => {
  it('are dropped by default, and counted separately from a missing mesh', () => {
    const plan = planMap(layout([at('On', 0), at('Off', 1, { inactive: true })]), hasAll);
    expect(plan.counts.inactive).toBe(1);
    expect(plan.counts.skipped).toBe(0);
    expect(plan.batches.map((b) => b.mesh)).toEqual(['On']);
  });

  it('can be kept when a caller wants the authored set verbatim', () => {
    const plan = planMap(layout([at('Off', 0, { inactive: true })]), {
      ...hasAll,
      skipInactive: false,
    });
    expect(plan.batches.map((b) => b.mesh)).toEqual(['Off']);
    expect(plan.counts.inactive).toBe(0);
  });
});

describe('requiredMeshes', () => {
  it('lists what to fetch, deduped and sorted, before anything is loaded', () => {
    // Deliberately independent of planMap: a loader must be able to ask this
    // BEFORE it has a `has` to answer with.
    expect(requiredMeshes(layout([at('B', 0), at('A', 1), at('B', 2)]))).toEqual(['A', 'B']);
  });

  it('leaves out props the source disabled', () => {
    expect(requiredMeshes(layout([at('A', 0), at('B', 1, { inactive: true })]))).toEqual(['A']);
  });
});

describe('an empty map', () => {
  it('plans to nothing without dividing by zero', () => {
    const plan = planMap(layout([]), hasAll);
    expect(plan.batches).toEqual([]);
    expect(drawCallCost(plan)).toEqual({ calls: 0, placements: 0, ratio: 0 });
  });
});

describe('spatial chunking', () => {
  it('splits one mesh across cells, raising batch count to lower submitted count', () => {
    // Chunking makes the TOTAL worse on purpose. What it buys is that a frame
    // submits only the cells in view, and that trade is the whole point.
    const props = [at('Tile', 0), at('Tile', 10), at('Tile', 200), at('Tile', 210)];
    const flat = planMap(layout(props), hasAll);
    const chunked = planMap(layout(props), { ...hasAll, chunkSize: 32 });
    expect(flat.batches).toHaveLength(1);
    expect(chunked.batches).toHaveLength(2);
    expect(chunked.batches.every((b) => b.mesh === 'Tile')).toBe(true);
    expect(new Set(chunked.batches.map((b) => b.chunk)).size).toBe(2);
  });

  it('gives every chunked batch bounds that contain its instances', () => {
    const plan = planMap(layout([at('T', 5), at('T', 12), at('T', 20)]), {
      ...hasAll,
      chunkSize: 64,
    });
    const b = plan.batches[0];
    expect(b.bounds).toBeDefined();
    const [minX, , , maxX] = b.bounds as readonly number[];
    for (const i of b.instances) {
      expect(i.pos[0]).toBeGreaterThanOrEqual(minX);
      expect(i.pos[0]).toBeLessThanOrEqual(maxX);
    }
  });

  it('leaves an unchunked plan without chunk or bounds', () => {
    const plan = planMap(layout([at('T', 0)]), hasAll);
    expect(plan.batches[0].chunk).toBeUndefined();
    expect(plan.batches[0].bounds).toBeUndefined();
  });

  it('never loses or duplicates a placement when chunking', () => {
    const props = Array.from({ length: 300 }, (_, i) => at(i % 3 === 0 ? 'A' : 'B', i * 7));
    const flat = planMap(layout(props), hasAll);
    const chunked = planMap(layout(props), { ...hasAll, chunkSize: 32 });
    expect(chunked.counts.drawn).toBe(flat.counts.drawn);
    expect(chunked.counts.drawn).toBe(300);
  });

  it('treats a zero or negative chunk size as no chunking', () => {
    for (const size of [0, -1]) {
      const plan = planMap(layout([at('T', 0), at('T', 999)]), { ...hasAll, chunkSize: size });
      expect(plan.batches, `chunkSize ${size}`).toHaveLength(1);
    }
  });
});

describe('batchesNear', () => {
  it('submits only the cells within the radius', () => {
    const plan = planMap(layout([at('T', 0), at('T', 5), at('T', 500), at('T', 505)]), {
      ...hasAll,
      chunkSize: 32,
    });
    expect(plan.batches).toHaveLength(2);
    const near = batchesNear(plan, 0, 0, 50);
    expect(near).toHaveLength(1);
    expect(near[0].instances.map((i) => i.pos[0])).toEqual([0, 5]);
  });

  it('measures to the batch box, not its centre, so a wide batch still counts', () => {
    const plan = planMap(layout([at('T', 0), at('T', 300)]), { ...hasAll, chunkSize: 4096 });
    // One batch spanning 0..300. Standing at 290 is inside it even though the
    // midpoint is 150 away.
    expect(plan.batches).toHaveLength(1);
    expect(batchesNear(plan, 290, 0, 5)).toHaveLength(1);
  });

  it('returns everything for an UNCHUNKED plan rather than pretending to cull', () => {
    // Quietly returning less would hide that the plan was never chunked.
    const plan = planMap(layout([at('T', 0), at('T', 9999)]), hasAll);
    expect(batchesNear(plan, 0, 0, 1)).toHaveLength(plan.batches.length);
  });
});
