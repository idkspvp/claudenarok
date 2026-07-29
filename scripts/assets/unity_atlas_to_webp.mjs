// Resolve every kept prop to its colour atlas, and ship those atlases as WebP.
//
// A Unity mesh asset carries no material, so the props converted without one and
// the maps baked untextured. The binding lives on the prefab's MeshRenderer:
//   MeshRenderer.m_Materials[] -> .mat -> m_Texture guid -> a PNG
// and this walks that chain, then writes the mesh-to-atlas mapping the renderer
// needs to bind anything.
//
// THREE THINGS MAKE THIS AFFORDABLE, and each was measured rather than assumed.
// The naive answer is 1,483 MiB of PNG, against a 95 MiB budget for the whole
// game.
//
//   1. SCOPE. Counting every material in every prefab counts props that variety
//      reduction already dropped. Only materials reachable from a mesh the
//      reduced layouts still place are relevant: 1,187 MiB falls to 607.
//   2. DEDUPLICATION BY CONTENT. Unity mints a fresh guid for the same art in
//      every bundle it appears in, so the same atlas is referenced over and over.
//      70.3% of the referenced colour textures are byte-identical duplicates:
//      593 files collapse to 176, and 607 MiB to 216.
//   3. RESOLUTION AND FORMAT. The sources run to 4096 with a median of 1024,
//      which is far past what flat-shaded low-poly art needs.
//
// ONLY COLOUR IS SHIPPED. The kept props do bind 282 normal maps, plus metallic,
// emission, occlusion and parallax sets. That is a deliberate omission, not an
// absence: this art is flat-shaded low-poly whose form reads from geometry and
// vertex colour, and the exporter drops TANGENT to match. If normal maps are ever
// wanted, both decisions have to be revisited together, since a normal map with
// no tangents does nothing.
//
// USAGE
//   node scripts/assets/unity_atlas_to_webp.mjs <bundlesDir> <layoutDir> <outDir>
//     --guid-map <guid_map.json>
//     [--cap <px>]        longest side, default 1024
//     [--quality <n>]     WebP quality, default 90
//
// Emits <outDir>/<atlas>.webp plus <outDir>/index.json carrying the atlas list
// and the mesh-name-to-atlas mapping.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

/** Texture slots that carry base colour. Everything else is a lighting input
 *  this renderer does not consume. */
export const COLOUR_SLOT =
  /^_(MainTex|BaseMap|Albedo|Albedo_Map|Leaf_Texture|Trunk_Texture|Main_Texture|Overlay_Texture|Triplanar_Texture_(Top|Side|Bottom))$/i;

const ref = (body, key) => body.match(new RegExp(`${key}: \\{fileID: (\\d+)`))?.[1] ?? null;

/** Split a Unity YAML file into `{ classId, anchor, body }` documents. */
function splitDocuments(text) {
  const re = /^--- !u!(\d+) &(\d+)/gm;
  const heads = [];
  let m = re.exec(text);
  while (m) {
    heads.push({ classId: Number(m[1]), anchor: m[2], at: m.index });
    m = re.exec(text);
  }
  return heads.map((h, i) => ({
    ...h,
    body: text.slice(h.at, heads[i + 1]?.at ?? text.length),
  }));
}

/** Mesh name -> the material guids the prefab binds when drawing it.
 *  Keyed on the RESOLVED mesh name, because a scene node's own name is an
 *  arbitrary label and often disagrees with what it draws. */
export function meshMaterials(text, guidMap, keep = null) {
  const docs = splitDocuments(text);
  const meshOf = new Map();
  for (const d of docs) {
    if (d.classId !== 33) continue;
    const owner = ref(d.body, 'm_GameObject');
    const guid = d.body.match(/m_Mesh: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
    const name = guid ? guidMap[guid]?.name : null;
    if (owner && name) meshOf.set(owner, name);
  }
  const out = new Map();
  for (const d of docs) {
    if (d.classId !== 23) continue;
    const owner = ref(d.body, 'm_GameObject');
    const meshName = owner ? meshOf.get(owner) : null;
    if (!meshName) continue;
    if (keep && !keep.has(meshName)) continue;
    const block = d.body.match(
      /m_Materials:\s*\n((?:\s*- \{fileID: \d+, guid: [0-9a-f]{32}, type: \d+\}\s*\n)+)/,
    );
    if (!block) continue;
    const set = out.get(meshName) ?? new Set();
    for (const g of block[1].matchAll(/guid: ([0-9a-f]{32})/g)) set.add(g[1]);
    out.set(meshName, set);
  }
  return out;
}

/** The colour texture guids a `.mat` binds. */
export function materialColourTextures(matText) {
  const out = [];
  for (const m of matText.matchAll(
    /- (\w+):\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]{32})/g,
  )) {
    if (COLOUR_SLOT.test(m[1])) out.push(m[2]);
  }
  return out;
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const VALUED = new Set(['--guid-map', '--cap', '--quality']);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const [bundlesDir, layoutDir, outDir] = positional;
  const guidMapPath = flag('--guid-map');
  if (!bundlesDir || !layoutDir || !outDir || !guidMapPath) {
    console.log(
      'usage: node scripts/assets/unity_atlas_to_webp.mjs <bundlesDir> <layoutDir> <outDir> --guid-map <f> [--cap px] [--quality n]',
    );
    process.exit(1);
  }
  const cap = Number(flag('--cap', '1024'));
  const quality = Number(flag('--quality', '90'));
  const guidMap = JSON.parse(readFileSync(guidMapPath, 'utf8'));
  const assetsRoot = path.resolve(bundlesDir, '..');

  // Only the meshes the reduced layouts still place.
  const keep = new Set();
  for (const f of readdirSync(layoutDir)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const layout = JSON.parse(readFileSync(path.join(layoutDir, f), 'utf8'));
    for (const p of layout.props ?? []) keep.add(p.name);
  }

  const prefabs = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith('.prefab') && p.includes('_Maps')) prefabs.push(p);
    }
  };
  walk(bundlesDir);
  prefabs.sort();

  const meshToMaterials = new Map();
  for (const file of prefabs) {
    for (const [mesh, mats] of meshMaterials(readFileSync(file, 'utf8'), guidMap, keep)) {
      const set = meshToMaterials.get(mesh) ?? new Set();
      for (const g of mats) set.add(g);
      meshToMaterials.set(mesh, set);
    }
  }
  console.log(`${meshToMaterials.size} of ${keep.size} kept meshes resolve to a material`);

  // Material guid -> colour texture guids, read once.
  const matTextures = new Map();
  for (const set of meshToMaterials.values()) {
    for (const g of set) {
      if (matTextures.has(g)) continue;
      const entry = guidMap[g];
      if (!entry) {
        matTextures.set(g, []);
        continue;
      }
      try {
        matTextures.set(
          g,
          materialColourTextures(readFileSync(path.join(assetsRoot, entry.path), 'utf8')),
        );
      } catch {
        matTextures.set(g, []);
      }
    }
  }

  // Deduplicate by CONTENT: the same art carries a different guid per bundle.
  mkdirSync(outDir, { recursive: true });
  const hashOfGuid = new Map();
  const atlasByHash = new Map();
  let sourceBytes = 0;
  let referenced = 0;

  for (const [texGuid, _] of [...matTextures].flatMap(([, list]) => list.map((t) => [t, null]))) {
    if (hashOfGuid.has(texGuid)) continue;
    const entry = guidMap[texGuid];
    if (!entry) {
      hashOfGuid.set(texGuid, null);
      continue;
    }
    const src = path.join(assetsRoot, entry.path);
    let buf;
    try {
      buf = readFileSync(src);
    } catch {
      hashOfGuid.set(texGuid, null);
      continue;
    }
    referenced++;
    sourceBytes += buf.length;
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
    hashOfGuid.set(texGuid, hash);
    if (!atlasByHash.has(hash))
      atlasByHash.set(hash, { hash, name: entry.name, src, srcBytes: buf.length });
  }
  console.log(
    `${referenced} colour textures referenced, ${atlasByHash.size} unique by content ` +
      `(${((1 - atlasByHash.size / Math.max(1, referenced)) * 100).toFixed(1)}% duplicates), ` +
      `${(sourceBytes / 1048576).toFixed(2)} MiB of PNG`,
  );

  const atlases = [];
  for (const a of atlasByHash.values()) {
    const safe = `${a.name.replace(/[^A-Za-z0-9_-]/g, '_')}_${a.hash}`;
    const out = path.join(outDir, `${safe}.webp`);
    const info = await sharp(a.src)
      .resize({ width: cap, height: cap, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toFile(out);
    atlases.push({
      atlas: safe,
      hash: a.hash,
      source: a.name,
      width: info.width,
      height: info.height,
      bytes: statSync(out).size,
      srcBytes: a.srcBytes,
    });
  }

  // Mesh -> the atlases it draws with. A mesh with more than one is a mesh whose
  // props cannot be merged into a single draw call with a different-atlas
  // neighbour, so the count is reported rather than buried.
  const meshAtlas = {};
  let unmapped = 0;
  for (const [mesh, mats] of meshToMaterials) {
    const set = new Set();
    for (const g of mats) {
      for (const t of matTextures.get(g) ?? []) {
        const h = hashOfGuid.get(t);
        if (h) set.add(h);
      }
    }
    if (!set.size) {
      unmapped++;
      continue;
    }
    meshAtlas[mesh] = [...set];
  }

  const byHash = new Map(atlases.map((a) => [a.hash, a.atlas]));
  const mapping = {};
  for (const [mesh, hashes] of Object.entries(meshAtlas)) {
    mapping[mesh] = hashes.map((h) => byHash.get(h)).filter(Boolean);
  }

  // MATERIAL guid -> atlas, which is the mapping a baker actually needs. The
  // mesh-keyed one above cannot answer the two cases that matter: the same mesh
  // drawn with a different material in a different map (353 meshes), and a
  // multi-submesh mesh whose materials differ from each other (149). Both are
  // resolved per placement and per submesh through this.
  const materialAtlas = {};
  for (const [g, textures] of matTextures) {
    const names = [];
    for (const t of textures) {
      const atlas = byHash.get(hashOfGuid.get(t));
      if (atlas && !names.includes(atlas)) names.push(atlas);
    }
    if (names.length) materialAtlas[g] = names[0];
  }

  const multi = Object.values(mapping).filter((v) => v.length > 1).length;
  const totalBytes = atlases.reduce((a, x) => a + x.bytes, 0);
  atlases.sort((a, b) => b.bytes - a.bytes);
  writeFileSync(
    path.join(outDir, 'index.json'),
    `${JSON.stringify({ cap, quality, atlases, meshAtlas: mapping, materialAtlas }, null, 2)}\n`,
  );
  console.log(`  ${Object.keys(materialAtlas).length} materials resolve to an atlas`);

  console.log(
    `\nunity_atlas_to_webp: ${atlases.length} atlases -> ${(totalBytes / 1048576).toFixed(2)} MiB ` +
      `(from ${(sourceBytes / 1048576).toFixed(2)} MiB, ${((totalBytes / sourceBytes) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  ${Object.keys(mapping).length} meshes mapped, ${unmapped} with a material but no colour texture, ` +
      `${multi} drawing more than one atlas`,
  );
  console.log('  largest:');
  for (const a of atlases.slice(0, 8)) {
    console.log(
      `    ${(a.bytes / 1024).toFixed(0).padStart(6)} KiB  ${a.width}x${a.height}  ${a.source}`,
    );
  }
}
