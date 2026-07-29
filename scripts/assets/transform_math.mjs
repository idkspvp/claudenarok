// The 4x4 transform maths the Unity asset pipeline runs on, in one place.
//
// This lives apart from its two callers (unity_map_layout.mjs composes prefab
// parent chains, build_map_chunks.mjs welds props into chunks) for one reason:
// every defect this module now guards against was a silent one. Wrong maths here
// does not throw, it produces a world that is subtly and permanently wrong, and
// the only way to catch that is a test that pins the arithmetic directly.
//
// Convention throughout: COLUMN-MAJOR 4x4 as a flat 16-array, m[column * 4 + row],
// which is what glTF and Three both use. Quaternions are xyzw.

/** Translation + rotation + scale to a column-major 4x4. */
export function trs(pos, rot, scl) {
  const [x, y, z, w] = rot;
  const [sx, sy, sz] = scl;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    pos[0],
    pos[1],
    pos[2],
    1,
  ];
}

/** Column-major 4x4 product. `a` is applied after `b`, so matMul(parent, child)
 *  is the child expressed in the parent's space. */
export function matMul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
  }
  return o;
}

/** A point through a 4x4, translation included. */
export function applyMat(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** The matrix that carries NORMALS: the inverse transpose of the upper 3x3,
 *  returned ROW-major as 9 numbers.
 *
 *  The plain upper 3x3 agrees with this under rotation and uniform scale, and
 *  the pipeline assumed that covered every case. It does not: 10.03% of real
 *  placements carry a non-uniform scale, and there the plain matrix tilts a
 *  normal by up to 71 degrees. Renormalising cannot repair it, because the error
 *  is in direction and renormalising only fixes length.
 *
 *  The cofactor matrix is the inverse transpose up to a 1/det factor. det is
 *  divided out rather than dropped so a mirrored placement (negative
 *  determinant) still flips its normals the right way. */
export function normalMatrix(m) {
  const a = m[0];
  const b = m[4];
  const c = m[8];
  const d = m[1];
  const e = m[5];
  const f = m[9];
  const g = m[2];
  const h = m[6];
  const i = m[10];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) {
    // A collapsed axis has no well-defined normal transform. The plain matrix is
    // the least-wrong answer, and the geometry is degenerate regardless.
    return [a, b, c, d, e, f, g, h, i];
  }
  const k = 1 / det;
  return [
    (e * i - f * h) * k,
    -(d * i - f * g) * k,
    (d * h - e * g) * k,
    -(b * i - c * h) * k,
    (a * i - c * g) * k,
    -(a * h - b * g) * k,
    (b * f - c * e) * k,
    -(a * f - c * d) * k,
    (a * e - b * d) * k,
  ];
}

/** A direction through a ROW-major 3x3 normal matrix, renormalized. */
export function applyDir(nm, x, y, z) {
  const v = [
    nm[0] * x + nm[1] * y + nm[2] * z,
    nm[3] * x + nm[4] * y + nm[5] * z,
    nm[6] * x + nm[7] * y + nm[8] * z,
  ];
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Split a world matrix back into position, rotation and scale, reporting the
 *  SHEAR the split had to discard as `skew`, in degrees.
 *
 *  A rotated child under a non-uniformly scaled parent composes to a matrix
 *  whose basis columns are no longer perpendicular, and no position/rotation/
 *  scale triple can represent that. A caller uses `skew` to decide whether the
 *  triple is the whole truth or whether the matrix has to travel beside it. */
export function decompose(m) {
  const col = (i) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
  const c = [col(0), col(1), col(2)];
  const len = c.map((v) => Math.hypot(v[0], v[1], v[2]));
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const angleOff = (i, j) =>
    len[i] < 1e-9 || len[j] < 1e-9
      ? 0
      : Math.abs(
          90 -
            (Math.acos(Math.max(-1, Math.min(1, dot(c[i], c[j]) / (len[i] * len[j])))) * 180) /
              Math.PI,
        );
  const skew = Math.max(angleOff(0, 1), angleOff(0, 2), angleOff(1, 2));

  // A negative determinant means a mirrored basis, which a positive scale triple
  // cannot express; fold the flip into x, as three.js does.
  const det =
    c[0][0] * (c[1][1] * c[2][2] - c[2][1] * c[1][2]) -
    c[1][0] * (c[0][1] * c[2][2] - c[2][1] * c[0][2]) +
    c[2][0] * (c[0][1] * c[1][2] - c[1][1] * c[0][2]);
  const scale = [det < 0 ? -len[0] : len[0], len[1], len[2]];

  const inv = scale.map((s) => (Math.abs(s) < 1e-9 ? 0 : 1 / s));
  const m11 = m[0] * inv[0];
  const m21 = m[1] * inv[0];
  const m31 = m[2] * inv[0];
  const m12 = m[4] * inv[1];
  const m22 = m[5] * inv[1];
  const m32 = m[6] * inv[1];
  const m13 = m[8] * inv[2];
  const m23 = m[9] * inv[2];
  const m33 = m[10] * inv[2];
  const trace = m11 + m22 + m33;
  let rot;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    rot = [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s];
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    rot = [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s];
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    rot = [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    rot = [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
  }
  return { pos: [m[12], m[13], m[14]], rot, scale, skew };
}
