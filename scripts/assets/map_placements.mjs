// The placement rules both bakers must agree on.
//
// There are two ways to turn a layout into drawable output: weld a cell into one
// merged buffer, or draw one mesh many times with GPU instancing. They differ in
// how they emit, and in NOTHING ELSE. Which placements are skipped, which atlas a
// submesh samples, and which cell a prop belongs to have to be identical, or the
// two produce different worlds from the same input and the difference is invisible
// until someone compares them.
//
// So those rules live here once, and each baker consumes them.

/** Groups that are lighting and atmosphere rather than world geometry. */
export const EXCLUDED_GROUPS = new Set(['lighting', 'fog', 'backdropmountains']);

/** Names that are skydome-scale by convention. Kept ALONGSIDE the size rule
 *  below, not replaced by it: a small prop legitimately called "skybox" should
 *  still be excluded, and a huge one called "Plane" should still be caught. */
export const SKYDOME_NAME = /backdrop|skyline|skydome|skybox|colormap|horizon/;

/** Longest side, in metres, past which a placement is horizon rather than world.
 *  Measured over 38,309 real placements: median 10 m, p99 164 m, p99.9 893 m,
 *  and every placement past a kilometre is a skydome, cloud ring, fog ring,
 *  backdrop mountain, water plane or lava cube. */
export const DEFAULT_MAX_SPAN_M = 1200;

/** Should this placement be drawn at all, ignoring size (which needs the mesh)? */
export function skipPlacement(p) {
  if (p.inactive) return true;
  const group = (p.group ?? '').toLowerCase();
  const name = (p.name ?? '').toLowerCase();
  if (EXCLUDED_GROUPS.has(group)) return true;
  if (SKYDOME_NAME.test(name) || /backdrop|skyline/.test(group)) return true;
  return false;
}

/** The grid cell a placement belongs to, as a stable string key. */
export function cellKey(p, chunkSize) {
  return `${Math.floor(p.pos[0] / chunkSize)}_${Math.floor(p.pos[2] / chunkSize)}`;
}

/** Build the atlas resolver from an atlas index.
 *
 *  Resolution is per PLACEMENT and per SUBMESH because neither alone is enough:
 *  the same tree draws from a different atlas in a forest map than in a meadow
 *  one (353 meshes), and a multi-submesh model binds a different material per
 *  part (149). The mesh-keyed fallback covers the 246 props that variety
 *  reduction swapped to a different model, whose recorded material list still
 *  describes the mesh they used to be. */
export function makeAtlasResolver(atlasIndex) {
  const materialAtlas = atlasIndex?.materialAtlas ?? {};
  const meshAtlas = atlasIndex?.meshAtlas ?? {};
  return (placement, submeshIndex = 0) => {
    const mats = placement.mats;
    if (mats?.length) {
      const hit = materialAtlas[mats[submeshIndex]] ?? materialAtlas[mats[0]];
      if (hit) return hit;
    }
    return meshAtlas[placement.name]?.[0] ?? '';
  };
}

/** The on-disk basename a prop's GLB uses. */
export function propFileName(name) {
  return name.replace(/[^A-Za-z0-9_-]/g, '_');
}
