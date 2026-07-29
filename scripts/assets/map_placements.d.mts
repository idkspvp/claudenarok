// Hand-written types for map_placements.mjs, so a type-checked Vitest can import
// it directly (see scripts/CLAUDE.md, "How to add one").

export interface Placement {
  name: string;
  pos: number[];
  rot?: number[];
  scale: number[];
  group?: string;
  inactive?: boolean;
  /** Material guids from the prefab's MeshRenderer, in submesh order. */
  mats?: string[];
  /** Full column-major world matrix, present only where TRS would shear. */
  mat?: number[];
}

export interface AtlasIndex {
  atlases?: { atlas: string; hash: string; source: string; bytes: number }[];
  meshAtlas?: Record<string, string[]>;
  materialAtlas?: Record<string, string>;
}

export const EXCLUDED_GROUPS: ReadonlySet<string>;
export const SKYDOME_NAME: RegExp;
export const DEFAULT_MAX_SPAN_M: number;

export function skipPlacement(p: Placement): boolean;
export function cellKey(p: Placement, chunkSize: number): string;
export function makeAtlasResolver(
  atlasIndex: AtlasIndex | null | undefined,
): (placement: Placement, submeshIndex?: number) => string;
export function propFileName(name: string): string;
