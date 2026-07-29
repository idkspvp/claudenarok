<!-- scripts/assets/: OFFLINE GLB/texture build pipeline. Run by hand, not by
     `npm run build`. Separate from the renderer's runtime procedural geometry
     (src/render/) AND from the media manifest (scripts/build_media_manifest.mjs).
     See ../CLAUDE.md for the rest of scripts/. -->

# scripts/assets/

Offline asset pipeline: optimize raw downloaded model packs into shipping files
under `public/`. Run manually (not part of `npm run build`):
`node scripts/assets/build_assets.mjs scripts/assets/specs/<spec>.json`.
For reference-image reconstruction and procedural GLB authoring, read the living
`docs/image-to-glb-asset-workflow.md` runbook before adding a model-specific exporter.

- **`specs/*.json`** declare *what* to build: `{ items: [{ src, out, type, ... }] }`.
  `src` is usually under `tmp/asset_src` (raw packs, gitignored); `out` is relative
  to `public/`. Specs: `characters`, `characters_v2`, `skeletons_v2`, `dungeon`,
  `props`, `textures`, `lookdev`, `asset_bits`, `foliage`, `biome_packs`
  (`ls specs/` for the live set). A new asset pack is a new spec JSON, never
  hardcoded paths in the script.
- **`build_assets.mjs`** processes each item with `@gltf-transform` + `meshoptimizer`
  + `sharp`: `resample`, `prune`, `dedup`, `(textureCompress)`, `meshopt`. Types:
  `character`/`static` are geometry-safe (never join/flatten/**simplify**, would
  corrupt rigs/hard edges); `copy` is a byte-for-byte copy (HDRIs, plain textures).
  Clip names (`Armature|Idle`) are stripped to the last `|` segment + deduped.
  Per-item options (`keepClips`/`maxTex`/`attachMeshes`, bulk `srcDir`/`outDir`
  instead of `src`/`out`, a top-level `defaults` block, `--shard i/n`) live in
  `build_assets.mjs`.
- **`build_foliage.mjs`** is a superset for `foliage.json`: adds `weld + simplify`
  (target `ratio`), strips constant-white `COLOR_0`, and hue-rotates leaf textures
  via `recolor` rules. Use this only for foliage.
- **Per-asset procedural exporters** (`banker_chest/`, `eastbrook_town/`,
  `eastbrook_grand_armoury/`, `eastbrook_mailbox/`, `eastbrook_noticeboard/`) author GLBs
  from reference images: deterministic `model.js` factory, browser `export_entry.js`,
  driver `export_<asset>.mjs`, and a spec with `keepExtras: true`. The condensed procedure
  is the `image-to-glb` skill (`.claude/skills/image-to-glb/SKILL.md`); a new asset copies
  the mailbox/noticeboard archetype (or the town contract-table archetype for a wave),
  never a bespoke pipeline.
- **Source fingerprints are load-bearing.** Eastbrook-era exporters stamp a sha256 over a
  pinned input list (factory/entry/exporter/spec, `build_assets.mjs`, reference
  turnarounds, the shared atlas, and `package-lock.json`) into the GLB extras, and tests
  recompute it live. Any change to a fingerprinted input, including a lockfile-only bump,
  means re-exporting the affected families (`--no-preview`), regenerating the media
  manifest, and re-pinning the sha256/fingerprint literals in tests, docs, and capture
  evidence JSONs in the same change.

## The Unity map import (`unity_*`, `build_map_*`, `verify_map_bake`)
A second, self-contained pipeline that turns SpiritVale's Unity maps into
drawable world data. It does NOT go through `specs/*.json` or `build_assets.mjs`.
Run in order; each step reads the previous step's output:

| Step | Script | In / out |
|---|---|---|
| 1 | `unity_mesh_to_glb.mjs` | `.asset` mesh YAML -> prop GLBs + `manifest.json` |
| 2 | `unity_map_layout.mjs` | map prefabs -> one placement JSON per map (`--guid-map`) |
| 3 | `reduce_map_variety.mjs` | layouts -> layouts with fewer distinct meshes |
| 4 | `unity_atlas_to_webp.mjs` | prefabs + layouts -> WebP atlases + `index.json` |
| 5a | `build_map_instances.mjs` | layouts -> per-map instance batches (**prefer this**) |
| 5b | `build_map_chunks.mjs` | layouts -> merged per-cell chunk GLBs |
| 6 | `verify_map_bake.mjs` | a chunk dir -> pass/fail, non-zero on failure |
| - | `unity_terrain_to_glb.mjs` | binary `TerrainData` -> ground meshes (38 of 53 maps) |
| - | `preview_map.mjs` | a baked map -> a PNG a human can look at |

**5a versus 5b is a real choice, not a preference.** Merging a cell into one
buffer costs fewer draw calls but duplicates a mesh's geometry per placement, and
every copy stays resident: Nevaris is 201 MiB of GPU memory merged against 17.58
instanced. Instancing wins everywhere GPU memory is the binding constraint, which
includes both Capacitor shells. Both must draw the SAME world, so the rules they
share (which placements to skip, which atlas a submesh samples, which cell a prop
is in) live in `map_placements.mjs` and are pinned by
`tests/asset_map_placements.test.ts`; they currently agree on 30,820,661
triangles across all 52 maps, and that equality is the check to re-run after
touching either.

**Every defect this pipeline has produced was SILENT**, and several rendered
convincingly: local coordinates emitted as world, a stride-3 walk over 4-wide
normals, a missing dequantize that made a map measure 255 km, a UV clamp
justified by a measurement taken through the clamp itself. So:
- Run `verify_map_bake.mjs` after any bake. It checks the properties a
  plausible-looking wrong answer still fails (degenerate triangles, NaN,
  out-of-range indices, extents, draw calls over a 3x3 neighbourhood).
- Measure claims against the WRITTEN FILE, never the in-memory document.
  `meshopt()` reorders vertices per primitive on write, which is not what the
  code that produced them looks like.

## Relationship to the rest
- **Output to `public/`** (the GLB/texture/HDRI tree the game loads at runtime).
- **Runtime procedural generation** in `src/render/` is a *separate* path, most
  geometry/textures are generated in-browser; this pipeline only bakes the imported assets.
- The **runtime media manifest** (`src/render/assets/manifest.generated.ts`) is
  generated separately by `../build_media_manifest.mjs`, which content-hashes
  whatever ends up in `public/`. Asset licenses: `CREDITS.md`.

## Never
- Don't add `simplify` to a `character`/`static` item in `build_assets.mjs`, that's
  exactly why `build_foliage.mjs` exists separately.
