// Hand-written types for unity_mesh_to_glb.mjs, so a type-checked Vitest can
// import it directly (see scripts/CLAUDE.md, "How to add one").

/** One decoded vertex channel: the flat component array plus its width. */
export interface DecodedAttribute {
  data: Float32Array | Uint16Array | Uint8Array | Int16Array | Int8Array | Uint32Array;
  dimension: number;
}

/** Re-stride a decoded attribute to the component count its glTF semantic
 *  allows. Throws for a semantic with no declared shape. */
export function conformAttribute(
  semantic: string,
  data: DecodedAttribute['data'],
  dimension: number,
): DecodedAttribute;

/** How far outside [0,1] a texcoord may sit and still count as noise. */
export const UV_DUST_EPSILON: number;

/** Snap texcoords that miss [0,1] by rounding error, leaving real tiling alone.
 *  Returns whether the set was snapped. */
export function snapTexcoordDust(
  attr: { data: Float32Array } | null | undefined,
  epsilon?: number,
): boolean;

/** Decode one AssetRipper `.asset` mesh YAML into attributes plus indices. */
export function decodeUnityMesh(text: string): {
  attributes: Record<string, DecodedAttribute>;
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
};
