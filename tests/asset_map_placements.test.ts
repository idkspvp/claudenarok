// Pins the placement rules the two bakers must agree on, and the batching that
// GPU instancing depends on.
//
// There are two ways to turn a layout into drawable output: weld a cell into one
// merged buffer, or instance a mesh many times. They must differ ONLY in how
// they emit. If they disagree about which placements to skip, which atlas a
// submesh samples, or which cell a prop is in, they produce different worlds
// from the same input and nothing reports it. Over the real corpus they draw an
// identical 30,888,832 triangles on all 52 maps; these tests are what keeps that
// true.

import { describe, expect, it } from 'vitest';
import { batchPlacements, INSTANCE_STRIDE } from '../scripts/assets/build_map_instances.mjs';
import {
  cellKey,
  makeAtlasResolver,
  propFileName,
  skipPlacement,
} from '../scripts/assets/map_placements.mjs';

const place = (over = {}) => ({
  name: 'SM_Bld_Castle_Wall_01',
  pos: [10, 0, 10],
  rot: [0, 0, 0, 1],
  scale: [1, 1, 1],
  group: 'World',
  ...over,
});

/** Defaults that draw everything, so each test opts into one exclusion. */
const opts = (over = {}) => ({
  chunkSize: 64,
  atlasFor: () => 'atlas_a',
  submeshCount: () => 1,
  spanOf: () => 10,
  maxSpan: 1200,
  ...over,
});

describe('skipPlacement', () => {
  it('draws an ordinary prop', () => {
    expect(skipPlacement(place())).toBe(false);
  });

  it('skips an inactive placement', () => {
    expect(skipPlacement(place({ inactive: true }))).toBe(true);
  });

  it('skips lighting and fog groups, which are not world geometry', () => {
    expect(skipPlacement(place({ group: 'Lighting' }))).toBe(true);
    expect(skipPlacement(place({ group: 'Fog' }))).toBe(true);
  });

  it('skips skydome-scale scenery by name', () => {
    for (const n of ['SM_Env_Skydome_01', 'BackdropMountains', 'Skybox_Thing', 'ColorMap']) {
      expect(skipPlacement(place({ name: n }))).toBe(true);
    }
  });

  it('does NOT skip a prop whose name merely contains a common word', () => {
    // The name rule must stay narrow; size is what catches the rest.
    expect(skipPlacement(place({ name: 'SM_Prop_Lantern_01' }))).toBe(false);
    expect(skipPlacement(place({ name: 'SM_Bld_Skylight_01' }))).toBe(false);
  });
});

describe('cellKey', () => {
  it('buckets by floor division, including negative coordinates', () => {
    expect(cellKey(place({ pos: [10, 0, 10] }), 64)).toBe('0_0');
    expect(cellKey(place({ pos: [70, 0, 130] }), 64)).toBe('1_2');
    // -1 must land in cell -1, not 0, or the two sides of the origin collide.
    expect(cellKey(place({ pos: [-1, 0, -1] }), 64)).toBe('-1_-1');
  });
});

describe('makeAtlasResolver', () => {
  const index = {
    materialAtlas: { matA: 'atlas_a', matB: 'atlas_b' },
    meshAtlas: { SM_Bld_Castle_Wall_01: ['atlas_fallback'] },
  };

  it('prefers the placement material over the mesh name', () => {
    // The same mesh takes a different atlas per map, so the placement wins.
    const resolve = makeAtlasResolver(index);
    expect(resolve(place({ mats: ['matB'] }))).toBe('atlas_b');
  });

  it('resolves per submesh', () => {
    const resolve = makeAtlasResolver(index);
    const p = place({ mats: ['matA', 'matB'] });
    expect(resolve(p, 0)).toBe('atlas_a');
    expect(resolve(p, 1)).toBe('atlas_b');
  });

  it('falls back to the first material when a submesh index is past the list', () => {
    // Variety reduction swaps 246 props to a different model, whose recorded
    // material list describes the mesh they used to be and can be shorter.
    const resolve = makeAtlasResolver(index);
    expect(resolve(place({ mats: ['matA'] }), 3)).toBe('atlas_a');
  });

  it('falls back to the mesh mapping when no material resolves', () => {
    const resolve = makeAtlasResolver(index);
    expect(resolve(place({ mats: ['unknown'] }))).toBe('atlas_fallback');
    expect(resolve(place())).toBe('atlas_fallback');
  });

  it('returns empty rather than throwing with no index at all', () => {
    expect(makeAtlasResolver(null)(place())).toBe('');
  });
});

describe('propFileName', () => {
  it('matches the name the converter writes', () => {
    expect(propFileName('Bush Flat Flower 1')).toBe('Bush_Flat_Flower_1');
    expect(propFileName('SM_Env_Tree_01')).toBe('SM_Env_Tree_01');
  });
});

describe('batchPlacements', () => {
  it('emits exactly one instance per drawable placement', () => {
    const ps = [place(), place({ pos: [12, 0, 12] }), place({ pos: [14, 0, 14] })];
    const { batches } = batchPlacements(ps, opts());
    const total = batches.reduce((a, b) => a + b.instances.length / INSTANCE_STRIDE, 0);
    expect(total).toBe(3);
  });

  it('collapses same mesh, same atlas, same cell into ONE batch', () => {
    // This is the entire point: 709 copies of a castle wall become one draw.
    const ps = Array.from({ length: 709 }, (_, i) => place({ pos: [i % 60, 0, 10] }));
    const { batches } = batchPlacements(ps, opts());
    expect(batches).toHaveLength(1);
    expect(batches[0].instances.length / INSTANCE_STRIDE).toBe(709);
  });

  it('splits a batch when the atlas differs', () => {
    const ps = [place({ mats: ['a'] }), place({ mats: ['b'] })];
    const { batches } = batchPlacements(
      ps,
      opts({ atlasFor: (p: { mats: string[] }) => (p.mats[0] === 'a' ? 'atlas_a' : 'atlas_b') }),
    );
    expect(batches).toHaveLength(2);
  });

  it('splits on EVERY submesh atlas, not just the first', () => {
    // Two walls sharing a stone atlas on submesh 0 but differing on submesh 1
    // are not the same draw, and keying on the first alone would merge them.
    const ps = [place({ mats: ['a', 'x'] }), place({ mats: ['a', 'y'] })];
    const { batches } = batchPlacements(
      ps,
      opts({
        submeshCount: () => 2,
        atlasFor: (p: { mats: string[] }, si: number) => `atlas_${p.mats[si]}`,
      }),
    );
    expect(batches).toHaveLength(2);
  });

  it('splits a batch across cells, so a chunk can be culled', () => {
    const ps = [place({ pos: [10, 0, 10] }), place({ pos: [200, 0, 10] })];
    const { batches } = batchPlacements(ps, opts());
    expect(batches).toHaveLength(2);
    expect(new Set(batches.map((b) => b.cell)).size).toBe(2);
  });

  it('drops a placement whose world size makes it scenery, and says which', () => {
    const ps = [place(), place({ name: 'Plane', scale: [269.6, 269.6, 269.6] })];
    const { batches, dropped } = batchPlacements(
      ps,
      opts({ spanOf: (n: string) => (n === 'Plane' ? 41 : 10) }),
    );
    expect(batches.reduce((a, b) => a + b.instances.length / INSTANCE_STRIDE, 0)).toBe(1);
    expect(dropped).toHaveLength(1);
    expect(dropped[0][0]).toBe('Plane');
  });

  it('keeps a large but legitimate prop below the threshold', () => {
    // A 900 m ridge is real world geometry; p99.9 of the corpus is 893 m.
    const ps = [place({ name: 'SM_Env_RockPile_03', scale: [90, 90, 90] })];
    const { batches, dropped } = batchPlacements(ps, opts({ spanOf: () => 10 }));
    expect(dropped).toHaveLength(0);
    expect(batches).toHaveLength(1);
  });

  it('skips a placement whose mesh has no geometry at all', () => {
    // Unity primitive Cubes used as collision volumes have no GLB. Both bakers
    // must drop them, or the two disagree about what the world contains.
    const { batches } = batchPlacements([place({ name: 'Cube' })], opts({ spanOf: () => null }));
    expect(batches).toHaveLength(0);
  });

  it('writes position, rotation and scale in that order', () => {
    const { batches } = batchPlacements(
      [place({ pos: [1, 2, 3], rot: [0, 0.7071, 0, 0.7071], scale: [4, 5, 6] })],
      opts(),
    );
    const i = batches[0].instances;
    expect(i.slice(0, 3)).toEqual([1, 2, 3]);
    expect(i[4]).toBeCloseTo(0.7071, 4);
    expect(i.slice(7, 10)).toEqual([4, 5, 6]);
  });

  it('decomposes a sheared placement rather than dropping it', () => {
    // Six props in the corpus carry a full matrix because TRS cannot hold their
    // shear. An instance is 10 numbers, so they have to decompose.
    const mat = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 7, 8, 9, 1];
    const { batches } = batchPlacements([place({ mat })], opts());
    const i = batches[0].instances;
    expect(i.slice(0, 3)).toEqual([7, 8, 9]);
    expect(i[7]).toBeCloseTo(2, 5);
    expect(i[8]).toBeCloseTo(3, 5);
    expect(i[9]).toBeCloseTo(4, 5);
  });
});
