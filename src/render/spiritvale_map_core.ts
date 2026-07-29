// Turn a SpiritVale map layout into a draw plan.
//
// A pure core: layout in, plan out. No Three, no DOM, no fetch. The builder that
// consumes this (spiritvale_map.ts) does nothing but create the objects the plan
// names, which is what makes the interesting decisions unit-testable.
//
// THE WHOLE POINT IS INSTANCING. These maps are built out of a small kit repeated
// enormously: one map places the same floor tile 1,716 times, and across the
// game 45,856 placements draw from under 3,000 distinct meshes. Emitting one
// mesh per placement would spend the entire per-frame draw-call budget on a
// single room. So the plan groups placements by mesh and hands the builder one
// instanced batch per mesh, with a per-instance transform.
//
// Layouts come from scripts/assets/unity_map_layout.mjs and name their prop by
// the MESH IT DRAWS, resolved through the source project's guid table, never by
// the scene node's label. See that script's header for why that distinction is
// load-bearing.

/** One placed prop, as the layout JSON carries it. */
export interface MapPlacement {
  /** The mesh name, already guid-resolved. */
  name: string;
  pos: readonly [number, number, number];
  /** Quaternion, xyzw. */
  rot: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  group?: string;
  /** The scene node's own label, present only when it differs from the mesh. */
  node?: string;
  inactive?: boolean;
}

export interface MapLayout {
  map: string;
  props: readonly MapPlacement[];
  npcs?: readonly MapPlacement[];
}

/** One instanced draw: a mesh, and every transform it appears at. */
export interface InstancedBatch {
  mesh: string;
  instances: readonly MapPlacement[];
}

export interface MapPlan {
  map: string;
  batches: readonly InstancedBatch[];
  /** Meshes the layout wants that the caller said it does not have. */
  missing: readonly string[];
  counts: {
    placements: number;
    drawn: number;
    batches: number;
    /** Placements skipped because their mesh is unavailable. */
    skipped: number;
    /** Placements skipped because the source authored them disabled. */
    inactive: number;
  };
}

export interface PlanOptions {
  /** Whether a mesh can be drawn at all. Usually a manifest lookup. */
  has: (mesh: string) => boolean;
  /** Drop props authored inactive in the source. Default true: a disabled node
   *  is a level designer's deliberate "not this one", not a loading hint. */
  skipInactive?: boolean;
  /**
   * Groups to leave out. The source authors lighting rigs, fog volumes and
   * backdrop cards as ordinary children, and a web renderer supplies its own.
   * Matched case-insensitively against a placement's `group`.
   */
  excludeGroups?: readonly string[];
}

/** Groups a web renderer authors itself rather than importing. */
export const DEFAULT_EXCLUDED_GROUPS: readonly string[] = ['lighting', 'fog', 'backdropmountains'];

/**
 * Group a layout's placements into one instanced batch per mesh.
 *
 * Batches come out sorted by instance count, heaviest first, so a caller that
 * has to cut for budget drops the cheapest tail rather than an arbitrary slice.
 * Within a batch the source order is preserved, which keeps a re-plan of the
 * same layout byte-identical.
 */
export function planMap(layout: MapLayout, opts: PlanOptions): MapPlan {
  const skipInactive = opts.skipInactive !== false;
  const excluded = new Set(
    (opts.excludeGroups ?? DEFAULT_EXCLUDED_GROUPS).map((g) => g.toLowerCase()),
  );

  const byMesh = new Map<string, MapPlacement[]>();
  const missing = new Set<string>();
  let skipped = 0;
  let inactive = 0;

  for (const p of layout.props) {
    if (skipInactive && p.inactive) {
      inactive++;
      continue;
    }
    if (p.group && excluded.has(p.group.toLowerCase())) {
      skipped++;
      continue;
    }
    if (!opts.has(p.name)) {
      missing.add(p.name);
      skipped++;
      continue;
    }
    const list = byMesh.get(p.name);
    if (list) list.push(p);
    else byMesh.set(p.name, [p]);
  }

  const batches = [...byMesh.entries()]
    .map(([mesh, instances]) => ({ mesh, instances }))
    // Heaviest first, then by name so the order is total and stable.
    .sort((a, b) => b.instances.length - a.instances.length || a.mesh.localeCompare(b.mesh));

  const drawn = batches.reduce((n, b) => n + b.instances.length, 0);

  return {
    map: layout.map,
    batches,
    missing: [...missing].sort(),
    counts: {
      placements: layout.props.length,
      drawn,
      batches: batches.length,
      skipped,
      inactive,
    },
  };
}

/**
 * The meshes a layout needs, so a loader can fetch exactly those.
 *
 * Deliberately independent of `planMap`: a caller must be able to ask what to
 * download BEFORE it has anything downloaded, and `planMap` needs a `has` that
 * only makes sense afterwards.
 */
export function requiredMeshes(layout: MapLayout): readonly string[] {
  const out = new Set<string>();
  for (const p of layout.props) if (!p.inactive) out.add(p.name);
  return [...out].sort();
}

/**
 * How many draw calls a plan costs, which is the number a frame budget cares
 * about. One per batch, NOT one per placement: that ratio is the whole reason
 * this module exists, and a caller can report it to prove instancing is working.
 */
export function drawCallCost(plan: MapPlan): { calls: number; placements: number; ratio: number } {
  const calls = plan.batches.length;
  const placements = plan.counts.drawn;
  return { calls, placements, ratio: calls === 0 ? 0 : placements / calls };
}
