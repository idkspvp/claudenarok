// Hand-written types for transform_math.mjs, so a type-checked Vitest can import
// it directly (see scripts/CLAUDE.md, "How to add one").

/** Column-major 4x4 as a flat 16-array, m[column * 4 + row]. */
export type Mat4 = number[];
/** Row-major 3x3 as a flat 9-array. */
export type Mat3 = number[];
export type Vec3 = [number, number, number] | number[];
/** Quaternion, xyzw. */
export type Quat = [number, number, number, number] | number[];

export function trs(pos: Vec3, rot: Quat, scl: Vec3): Mat4;
export function matMul(a: Mat4, b: Mat4): Mat4;
export function applyMat(m: Mat4, x: number, y: number, z: number): [number, number, number];
export function normalMatrix(m: Mat4): Mat3;
export function applyDir(nm: Mat3, x: number, y: number, z: number): [number, number, number];
export function decompose(m: Mat4): {
  pos: [number, number, number];
  rot: number[];
  scale: number[];
  /** Degrees by which the basis columns are off perpendicular. */
  skew: number;
};
