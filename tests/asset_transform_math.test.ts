// Pins the transform maths the Unity asset pipeline runs on.
//
// Every case here is a defect that actually shipped. The pipeline emitted local
// coordinates as world (85% of 46,104 props misplaced, errors to 1023 units),
// lit non-uniformly scaled geometry with the plain matrix instead of the inverse
// transpose (10% of placements, up to 71 degrees off), and collapsed the
// children of repeated parents onto a single point. None of it threw. The
// assertions below are therefore written against INDEPENDENT ground truth, hand
// composed or analytically known, never against what the implementation happens
// to return.

import { describe, expect, it } from 'vitest';
import {
  applyDir,
  applyMat,
  decompose,
  matMul,
  normalMatrix,
  trs,
} from '../scripts/assets/transform_math.mjs';

/** Quaternion for a rotation of `deg` about `axis`. The axis is normalized here
 *  rather than trusted: a non-unit axis yields a non-unit quaternion, which
 *  quietly scales the rotation matrix and would show up as a bogus scale in the
 *  decomposition assertions below. */
function quat(axis: [number, number, number], deg: number) {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const h = (deg * Math.PI) / 180 / 2;
  const s = Math.sin(h) / l;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}

const IDENTITY = trs([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);

describe('trs', () => {
  it('places translation in the fourth column, column-major', () => {
    const m = trs([3, 4, 5], [0, 0, 0, 1], [1, 1, 1]);
    expect([m[12], m[13], m[14], m[15]]).toEqual([3, 4, 5, 1]);
  });

  it('rotates a point 90 degrees about Y, sending +X to -Z', () => {
    // Right-handed, +Y up: a 90 degree yaw takes (1,0,0) to (0,0,-1).
    const m = trs([0, 0, 0], quat([0, 1, 0], 90), [1, 1, 1]);
    const p = applyMat(m, 1, 0, 0);
    expect(p[0]).toBeCloseTo(0, 6);
    expect(p[1]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(-1, 6);
  });

  it('applies scale before rotation, as Unity and glTF both do', () => {
    const m = trs([0, 0, 0], quat([0, 1, 0], 90), [2, 1, 1]);
    // The x axis is scaled by 2 and then yawed onto -Z.
    const p = applyMat(m, 1, 0, 0);
    expect(p[2]).toBeCloseTo(-2, 6);
  });
});

describe('matMul', () => {
  it('leaves a matrix unchanged against identity, both sides', () => {
    const m = trs([1, 2, 3], quat([1, 1, 1], 33), [1.5, 2, 0.5]);
    matMul(m, IDENTITY).forEach((v, i) => {
      expect(v).toBeCloseTo(m[i], 9);
    });
    matMul(IDENTITY, m).forEach((v, i) => {
      expect(v).toBeCloseTo(m[i], 9);
    });
  });

  it('composes parent then child in that order', () => {
    // A child one unit along +X, under a parent yawed 90 degrees, lands at -Z.
    const parent = trs([0, 0, 0], quat([0, 1, 0], 90), [1, 1, 1]);
    const child = trs([1, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
    const world = matMul(parent, child);
    expect(world[12]).toBeCloseTo(0, 6);
    expect(world[14]).toBeCloseTo(-1, 6);
  });

  it('reproduces the hand-composed minecart wheel from the real prefab', () => {
    // Ground truth from Goblin_Cave_1.prefab, composed by hand from the raw YAML:
    // wheel local [-0, 0.21125859, -0.3337198] under SM_Prop_Minecart_01 at
    // {229.6, 46.605, 435.16} with scale 3. This is the case the pipeline used to
    // emit as the bare local offset, stacking three carts' wheels on one point.
    const parent = trs([229.6, 46.605, 435.16], [0, 0, 0, 1], [3, 3, 3]);
    const child = trs([-0, 0.21125859, -0.3337198], [0, 0, 0, 1], [1, 1, 1]);
    const world = matMul(parent, child);
    expect(world[12]).toBeCloseTo(229.6, 3);
    expect(world[13]).toBeCloseTo(47.2388, 3);
    expect(world[14]).toBeCloseTo(434.1589, 3);
    // The parent's scale must reach the child, or multi-part objects come out
    // the wrong size.
    expect(decompose(world).scale[0]).toBeCloseTo(3, 6);
  });
});

describe('normalMatrix', () => {
  it('equals the plain upper 3x3 under pure rotation', () => {
    const m = trs([9, 9, 9], quat([0, 1, 0], 37), [1, 1, 1]);
    const nm = normalMatrix(m);
    // Row-major 3x3 against the column-major upper 3x3.
    expect(nm[0]).toBeCloseTo(m[0], 6);
    expect(nm[1]).toBeCloseTo(m[4], 6);
    expect(nm[3]).toBeCloseTo(m[1], 6);
    expect(nm[8]).toBeCloseTo(m[10], 6);
  });

  it('keeps a normal perpendicular to a NON-uniformly scaled surface', () => {
    // The decisive property, and the one the plain matrix violates. Take a
    // surface spanned by two tangents; scale it unevenly; the transformed normal
    // must stay perpendicular to BOTH transformed tangents.
    const m = trs([0, 0, 0], quat([0, 1, 0], 90), [2, 0.5, 3]);
    const t1: [number, number, number] = [1, 1, 0];
    const t2: [number, number, number] = [0, 1, 1];
    // n = t1 x t2
    const n: [number, number, number] = [
      t1[1] * t2[2] - t1[2] * t2[1],
      t1[2] * t2[0] - t1[0] * t2[2],
      t1[0] * t2[1] - t1[1] * t2[0],
    ];
    const nt = applyDir(normalMatrix(m), n[0], n[1], n[2]);
    const at1 = applyMat(m, t1[0], t1[1], t1[2]);
    const at2 = applyMat(m, t2[0], t2[1], t2[2]);
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(Math.abs(dot(nt, at1))).toBeLessThan(1e-6);
    expect(Math.abs(dot(nt, at2))).toBeLessThan(1e-6);

    // And prove the old behaviour genuinely failed this, so the test is decisive
    // rather than vacuous: the plain upper 3x3 leaves the normal far off square.
    const plain = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
    const wrong = applyDir(plain, n[0], n[1], n[2]);
    const lenA = Math.hypot(at1[0], at1[1], at1[2]);
    const offBy = (Math.asin(Math.abs(dot(wrong, at1)) / lenA) * 180) / Math.PI;
    expect(offBy).toBeGreaterThan(15);
  });

  it('flips normals for a mirrored transform', () => {
    // Negative determinant. Dropping the 1/det factor would leave the normal
    // pointing into the surface.
    const m = trs([0, 0, 0], [0, 0, 0, 1], [-1, 1, 1]);
    const n = applyDir(normalMatrix(m), 1, 0, 0);
    expect(n[0]).toBeCloseTo(-1, 6);
  });

  it('falls back rather than dividing by zero on a collapsed axis', () => {
    const m = trs([0, 0, 0], [0, 0, 0, 1], [1, 0, 1]);
    const nm = normalMatrix(m);
    expect(nm.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('decompose', () => {
  it('round-trips a shear-free transform exactly', () => {
    const pos = [12.5, -3, 40.25];
    const rot = quat([0.267, 0.535, 0.802], 61);
    const scale = [2, 2, 2];
    const d = decompose(trs(pos, rot, scale));
    expect(d.pos[0]).toBeCloseTo(pos[0], 5);
    expect(d.pos[1]).toBeCloseTo(pos[1], 5);
    expect(d.pos[2]).toBeCloseTo(pos[2], 5);
    d.scale.forEach((s, i) => {
      expect(s).toBeCloseTo(scale[i], 5);
    });
    expect(d.skew).toBeLessThan(1e-6);
    // The quaternion may come back negated, which is the same rotation.
    const same = rot.every((v, i) => Math.abs(v - d.rot[i]) < 1e-5);
    const negated = rot.every((v, i) => Math.abs(v + d.rot[i]) < 1e-5);
    expect(same || negated).toBe(true);
  });

  it('round-trips non-uniform scale with no shear present', () => {
    const scale = [3, 0.5, 7];
    const d = decompose(trs([0, 0, 0], quat([0, 1, 0], 45), scale));
    d.scale.forEach((s, i) => {
      expect(s).toBeCloseTo(scale[i], 5);
    });
    expect(d.skew).toBeLessThan(1e-6);
  });

  it('reports skew when a rotated child sits under a non-uniform parent', () => {
    // This is the one composition TRS cannot hold, and the reason the extractor
    // emits a full matrix for the 6 props in the corpus that hit it. Silence here
    // would mean silently wrong geometry.
    const parent = trs([0, 0, 0], [0, 0, 0, 1], [4, 1, 1]);
    const child = trs([0, 0, 0], quat([0, 1, 0], 45), [1, 1, 1]);
    const d = decompose(matMul(parent, child));
    expect(d.skew).toBeGreaterThan(5);
  });

  it('reports no skew for a rotated child under a UNIFORM parent', () => {
    // The negative case: uniform scale composes cleanly at any rotation, so this
    // must not fire, or the extractor would emit matrices for the whole corpus.
    const parent = trs([5, 0, 5], quat([0, 1, 0], 20), [3, 3, 3]);
    const child = trs([1, 0, 0], quat([1, 0, 0], 45), [1, 1, 1]);
    expect(decompose(matMul(parent, child)).skew).toBeLessThan(1e-6);
  });

  it('recovers a mirrored basis as a negative scale', () => {
    const d = decompose(trs([0, 0, 0], [0, 0, 0, 1], [-2, 2, 2]));
    expect(d.scale[0]).toBeCloseTo(-2, 6);
    expect(d.scale[1]).toBeCloseTo(2, 6);
  });

  it('survives a deep chain the way a real prefab nests one', () => {
    // Composition must be associative down a chain, or props deeper in the tree
    // drift. Real trees in this corpus run deeper than two.
    const links = [
      trs([10, 0, 0], quat([0, 1, 0], 15), [2, 2, 2]),
      trs([0, 3, 0], quat([1, 0, 0], 10), [1, 1, 1]),
      trs([0, 0, 4], quat([0, 0, 1], 25), [0.5, 0.5, 0.5]),
      trs([1, 1, 1], [0, 0, 0, 1], [1, 1, 1]),
    ];
    const leftFold = links.reduce((acc, m) => matMul(acc, m));
    const rightFold = links.reduceRight((acc, m) => matMul(m, acc));
    leftFold.forEach((v, i) => {
      expect(v).toBeCloseTo(rightFold[i], 9);
    });
    // Net scale is the product down the chain.
    expect(decompose(leftFold).scale[1]).toBeCloseTo(1, 6);
  });
});
