// Hand-written types for build_map_instances.mjs, so a type-checked Vitest can
// import it directly (see scripts/CLAUDE.md, "How to add one").

import type { Placement } from './map_placements.d.mts';

/** Instance floats: 3 position, 4 quaternion, 3 scale. */
export const INSTANCE_STRIDE: number;

export interface InstanceBatch {
  mesh: string;
  /** One atlas name per submesh, in submesh order. */
  atlases: string[];
  cell: string;
  /** Flat, INSTANCE_STRIDE numbers per copy. */
  instances: number[];
}

export function batchPlacements(
  placements: Placement[],
  opts: {
    chunkSize: number;
    atlasFor: (p: Placement, submeshIndex: number) => string;
    submeshCount: (meshName: string) => number;
    /** The mesh's own longest side in metres, or null when it has no geometry. */
    spanOf: (meshName: string) => number | null;
    maxSpan: number;
  },
): { batches: InstanceBatch[]; dropped: [string, number][] };
