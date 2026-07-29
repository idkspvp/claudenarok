// Pins the two attribute policies in the Unity mesh converter.
//
// Both existed as silent bugs. The accessor width was copied from Unity's channel
// header, which emitted NORMAL as VEC4 on 3,120 meshes and JOINTS_0 as SCALAR on
// 1,726, so a downstream reader walking at the spec stride read a different lane
// on every vertex after the first. The texcoord handling then clamped every UV
// into [0,1] on a measurement that had been taken THROUGH the clamp, destroying
// real tiling on 543 meshes.
//
// This file could not have existed before: the converter ran its argument check
// at module top level, so importing it called process.exit.

import { describe, expect, it } from 'vitest';
import {
  conformAttribute,
  snapTexcoordDust,
  UV_DUST_EPSILON,
} from '../scripts/assets/unity_mesh_to_glb.mjs';

describe('conformAttribute', () => {
  it('truncates a 4-wide NORMAL to VEC3 by RE-STRIDING, not relabelling', () => {
    // Unity pads float16 normals to four components. Relabelling a 4-wide array
    // as VEC3 without moving the data shears every vertex after the first, which
    // is precisely the defect this exists to prevent, so assert the values and
    // not merely the declared type. Three distinct axis normals, so a stride slip
    // is unmissable.
    const out = conformAttribute(
      'NORMAL',
      new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]),
      4,
    );
    expect(out.dimension).toBe(3);
    expect(Array.from(out.data)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('leaves an already-correct NORMAL untouched', () => {
    const out = conformAttribute('NORMAL', new Float32Array([0, 1, 0, 1, 0, 0]), 3);
    expect(out.dimension).toBe(3);
    expect(Array.from(out.data)).toEqual([0, 1, 0, 1, 0, 0]);
  });

  it('pads JOINTS_0 out to the VEC4 glTF requires', () => {
    // Unity rigid single-bone bind data arrives as a bare index per vertex.
    const out = conformAttribute('JOINTS_0', new Uint16Array([7, 3]), 1);
    expect(out.dimension).toBe(4);
    expect(Array.from(out.data)).toEqual([7, 0, 0, 0, 3, 0, 0, 0]);
  });

  it('preserves the element type when it re-strides', () => {
    // A joint index widened into a Float32Array would be silently wrong.
    const out = conformAttribute('JOINTS_0', new Uint16Array([1]), 1);
    expect(out.data).toBeInstanceOf(Uint16Array);
  });

  it('pads a missing TANGENT w with the handedness sign, not zero', () => {
    // w is the bitangent direction. Zero there is not "unset", it is a
    // degenerate frame.
    const out = conformAttribute('TANGENT', new Float32Array([0, 0, 1]), 3);
    expect(out.dimension).toBe(4);
    expect(Array.from(out.data)).toEqual([0, 0, 1, 1]);
  });

  it('accepts COLOR_0 at VEC3, which glTF allows, rather than forcing VEC4', () => {
    // Both widths are legal for this semantic, so widening would add a byte per
    // vertex across the corpus for nothing.
    const out = conformAttribute('COLOR_0', new Float32Array([0.25, 0.5, 0.75]), 3);
    expect(out.dimension).toBe(3);
    expect(Array.from(out.data)).toEqual([0.25, 0.5, 0.75]);
  });
});

describe('snapTexcoordDust', () => {
  it('snaps a UV set that misses [0,1] only by rounding error', () => {
    const attr = { data: new Float32Array([-1e-7, 0.5, 1 + 1e-7, 0.25]) };
    expect(snapTexcoordDust(attr)).toBe(true);
    expect(attr.data[0]).toBe(0);
    expect(attr.data[2]).toBe(1);
  });

  it('LEAVES REAL TILING ALONE, which is the whole point', () => {
    // A river surface in the corpus runs to 164 repeats. Clamping it collapses
    // every repeat onto one atlas edge and nothing downstream can recover it.
    const attr = { data: new Float32Array([0, 0, 164.36, 12.5, -69.34, 3]) };
    expect(snapTexcoordDust(attr)).toBe(false);
    // Compared against the float32 round-trip, since that is what the array holds.
    expect(Array.from(attr.data)).toEqual(
      Array.from(new Float32Array([0, 0, 164.36, 12.5, -69.34, 3])),
    );
  });

  it('treats a modest but deliberate overshoot as tiling, not dust', () => {
    // SM_Bld_Bridge_Base_01 runs to exactly 3.0. Three repeats is intent.
    const attr = { data: new Float32Array([0, 0, 3, 1]) };
    expect(snapTexcoordDust(attr)).toBe(false);
    expect(attr.data[2]).toBe(3);
  });

  it('draws the line at the stated epsilon, both directions', () => {
    const justInside = { data: new Float32Array([0, 1 + UV_DUST_EPSILON / 2]) };
    expect(snapTexcoordDust(justInside)).toBe(true);
    const justOutside = { data: new Float32Array([0, 1 + UV_DUST_EPSILON * 2]) };
    expect(snapTexcoordDust(justOutside)).toBe(false);
    const belowZero = { data: new Float32Array([-UV_DUST_EPSILON * 2, 0.5]) };
    expect(snapTexcoordDust(belowZero)).toBe(false);
  });

  it('handles a mesh with no texcoords at all', () => {
    expect(snapTexcoordDust(undefined)).toBe(false);
    expect(snapTexcoordDust(null)).toBe(false);
  });
});

describe('conformAttribute fails closed', () => {
  it('throws on a semantic with no declared glTF shape', () => {
    // Passing an unknown semantic through at Unity's raw width is the original
    // bug. Adding a row to ATTR without one to SEMANTIC_SHAPE must break loudly.
    expect(() => conformAttribute('TEXCOORD_2', new Float32Array([0, 0, 0, 0]), 4)).toThrow(
      /no glTF shape declared/,
    );
  });
});
