// Extract a Unity map prefab into a flat placement list the game can rebuild from.
//
// SpiritVale's maps are HAND-AUTHORED, not generated: each is one Unity prefab
// carrying a real GameObject + Transform for every tree, rock, building and prop.
// So reproducing a map means copying coordinates, not reverse-engineering a
// generator. Only two things are procedural there and stay procedural here:
// monster spawning (a box volume plus a count) and small ground foliage.
//
// This reads the prefab YAML and writes one JSON per map:
//
//   { map, props: [{ name, pos:[x,y,z], rot:[x,y,z,w], scale:[x,y,z], group }],
//     npcs: [...], spawners: [...], counts: {...} }
//
// WHAT IT DOES NOT DO: it never copies a mesh. `name` is the SOURCE prop name
// (SM_Env_Tree_Birch_01), which the renderer resolves against whatever GLB the
// asset pipeline produced for it. Placement is coordinates; art is a separate
// licence question answered by whoever owns the pack.
//
// USAGE
//   node scripts/assets/unity_map_layout.mjs <bundlesDir> <outDir> [--limit n]
//
// The prefab format is plain YAML documents separated by `--- !u!<class> &<id>`.
// The classes that matter:
//   1   GameObject  -> m_Name, m_Component list, m_IsActive
//   4   Transform   -> m_LocalPosition/Rotation/Scale, m_Father, m_GameObject
//   33  MeshFilter  -> m_Mesh, the AUTHORITATIVE mesh reference
//   23  MeshRenderer -> marks a node as drawn
//   205 LODGroup    -> m_LODs, which of a node's renderers are DETAIL LEVELS
// A Transform points at its GameObject and its parent, so the tree is rebuilt by
// following m_Father and the group name is the nearest named ancestor.
//
// THE EMITTED TRANSFORM IS WORLD, COMPOSED UP THE PARENT CHAIN. Unity stores
// m_LocalPosition/Rotation/Scale, and emitting those verbatim is wrong for any
// node that is not a direct child of the root: 39,168 of 46,104 props (85%) sit
// under a displaced ancestor, with position errors up to 1023 units, and the
// failure is worst exactly where it is least visible. N children of a repeated
// parent all carry the SAME local offset, so they collapse onto one point: three
// minecart wheels belonging to carts 250 units apart emitted at one coordinate,
// 62 window panes stacked at the origin. `group` is only a name, so nothing
// downstream can undo it; the composition has to happen here or not at all.
//
// TRS SURVIVES THE COMPOSITION, ALMOST ALWAYS. A rotated child under a
// non-uniformly scaled parent composes to a sheared matrix that no
// position/rotation/scale triple can hold. Measured over the real corpus that is
// 6 props of 46,104 (0.01%), so the emitted shape stays TRS and those 6 also
// carry `mat`, the full column-major world matrix, which a consumer must prefer
// when it is present.
//
// LOD LEVELS ARE NOT SEPARATE PROPS. A LODGroup node parents one child per
// detail level, and all of them own a MeshRenderer, so a naive walk emits every
// level as its own always-drawn prop: 4,579 redundant draws, 10.8% of the total
// and 60% of the worst map. Only the LOD0 renderers survive here.
//
// THE MESH IS RESOLVED BY GUID, NEVER BY THE GAMEOBJECT'S NAME. A scene node's
// name is an arbitrary label a level designer typed; the MeshFilter's guid is
// what actually gets drawn, and the two disagree often. One real case:
// a node named SM_Env_Railing_15 draws SM_Env_Railing_04, and no asset called
// SM_Env_Railing_15 exists anywhere in the project. Matching on the name both
// loses those props AND silently mis-binds the ones whose names happen to
// collide with a real mesh.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { decompose, matMul, trs } from './transform_math.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--limit']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));

/** Split a Unity YAML file into `{ classId, anchor, body }` documents. */
function splitDocuments(text) {
  const docs = [];
  const re = /^--- !u!(\d+) &(\d+)/gm;
  const heads = [];
  let m = re.exec(text);
  while (m) {
    heads.push({ classId: Number(m[1]), anchor: m[2], at: m.index });
    m = re.exec(text);
  }
  for (const [i, h] of heads.entries()) {
    docs.push({ ...h, body: text.slice(h.at, heads[i + 1]?.at ?? text.length) });
  }
  return docs;
}

const vec = (body, key) => {
  const m = body.match(
    new RegExp(
      `${key}: \\{x: (-?[\\d.eE+-]+), y: (-?[\\d.eE+-]+), z: (-?[\\d.eE+-]+)(?:, w: (-?[\\d.eE+-]+))?\\}`,
    ),
  );
  if (!m) return null;
  const out = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] !== undefined) out.push(Number(m[4]));
  return out;
};
const ref = (body, key) => body.match(new RegExp(`${key}: \\{fileID: (\\d+)`))?.[1] ?? null;

/** Round to 4 decimals so the JSON is stable and small; a map is metres, not microns. */
const r4 = (a) => a.map((n) => Math.round(n * 1e4) / 1e4);

/** Renderer anchors belonging to a LODGroup's levels BELOW LOD0. Unity's
 *  m_LODs is an ordered list, most detailed first, so everything after the first
 *  `- screenRelativeHeight:` entry is a reduced level that must not be drawn on
 *  top of the real one. */
function lodFallbackRenderers(body) {
  const start = body.indexOf('m_LODs:');
  if (start < 0) return [];
  const block = body.slice(start);
  const levels = block.split(/^\s*- screenRelativeHeight:/m).slice(1);
  const out = [];
  // Skip levels[0]: that is LOD0, the one that survives.
  for (const level of levels.slice(1)) {
    for (const m of level.matchAll(/- renderer: \{fileID: (\d+)\}/g)) out.push(m[1]);
  }
  return out;
}

export function extractMapLayout(text, mapName, guidMap = null) {
  const docs = splitDocuments(text);

  const gameObjects = new Map(); // anchor -> { name, active, components[] }
  const transforms = new Map(); // anchor -> { go, parent, pos, rot, scale }
  const geometryOwners = new Set(); // GameObject anchors that own a MeshFilter/Renderer
  const meshGuidOf = new Map(); // GameObject anchor -> the guid its MeshFilter draws
  const componentOwner = new Map(); // component anchor -> GameObject anchor
  const lodFallbackComponents = new Set(); // renderer anchors for LOD1 and below
  const materialsOf = new Map(); // GameObject anchor -> material guids, submesh order

  for (const d of docs) {
    if (d.classId === 1) {
      const name = d.body.match(/^\s*m_Name: (.*)$/m)?.[1]?.trim() ?? '';
      const active = d.body.match(/^\s*m_IsActive: (\d)$/m)?.[1] !== '0';
      const components = [...d.body.matchAll(/- component: \{fileID: (\d+)\}/g)].map((c) => c[1]);
      gameObjects.set(d.anchor, { name, active, components });
      for (const c of components) componentOwner.set(c, d.anchor);
    }
  }

  for (const d of docs) {
    if (d.classId === 4) {
      transforms.set(d.anchor, {
        go: ref(d.body, 'm_GameObject'),
        parent: ref(d.body, 'm_Father'),
        pos: vec(d.body, 'm_LocalPosition'),
        rot: vec(d.body, 'm_LocalRotation'),
        scale: vec(d.body, 'm_LocalScale'),
      });
    } else if (d.classId === 33) {
      // MeshFilter: this GameObject draws something, and m_Mesh says WHAT.
      const owner = ref(d.body, 'm_GameObject');
      if (!owner) continue;
      geometryOwners.add(owner);
      const guid = d.body.match(/m_Mesh: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
      if (guid) meshGuidOf.set(owner, guid);
    } else if (d.classId === 23) {
      const owner = ref(d.body, 'm_GameObject');
      if (owner) geometryOwners.add(owner);
      // The MATERIAL list, in submesh order, is a property of this PLACEMENT and
      // not of the mesh. The same tree draws with a different atlas in a forest
      // map than in a meadow one: 353 of the meshes the maps place resolve to
      // more than one atlas for exactly that reason, so binding a texture per
      // mesh name would put the wrong art on one of the two.
      if (owner) {
        const block = d.body.match(
          /m_Materials:\s*\n((?:\s*- \{fileID: \d+, guid: [0-9a-f]{32}, type: \d+\}\s*\n)+)/,
        );
        if (block) {
          materialsOf.set(
            owner,
            [...block[1].matchAll(/guid: ([0-9a-f]{32})/g)].map((m) => m[1]),
          );
        }
      }
    } else if (d.classId === 205) {
      for (const r of lodFallbackRenderers(d.body)) lodFallbackComponents.add(r);
    }
  }

  // A reduced LOD level is identified by its RENDERER component, so resolve each
  // back to the GameObject that carries it. Those nodes are real geometry with a
  // real transform; they simply must not be drawn alongside LOD0.
  const lodCulled = new Set();
  for (const comp of lodFallbackComponents) {
    const owner = componentOwner.get(comp);
    if (owner) lodCulled.add(owner);
  }

  // Transform anchor by GameObject, so a parent chain can be walked.
  const transformOfGo = new Map();
  for (const [anchor, t] of transforms) if (t.go) transformOfGo.set(t.go, anchor);

  /** The composed world matrix of a transform, memoized: a deep chain is walked
   *  once per node, not once per descendant. */
  const worldCache = new Map();
  const worldOf = (anchor, guard = 0) => {
    const hit = worldCache.get(anchor);
    if (hit) return hit;
    const t = transforms.get(anchor);
    if (!t || guard > 64) return null;
    let m = trs(t.pos ?? [0, 0, 0], t.rot ?? [0, 0, 0, 1], t.scale ?? [1, 1, 1]);
    if (t.parent && t.parent !== '0') {
      const parent = worldOf(t.parent, guard + 1);
      if (parent) m = matMul(parent, m);
    }
    worldCache.set(anchor, m);
    return m;
  };

  /** The nearest NAMED ancestor, which is how the prefab groups its content
   *  ("Tree", "Rocks", "Props"). Used as a coarse category. */
  const groupOf = (transformAnchor) => {
    let cur = transforms.get(transformAnchor);
    const chain = [];
    let guard = 0;
    while (cur?.parent && cur.parent !== '0' && guard++ < 64) {
      const parentT = transforms.get(cur.parent);
      if (!parentT) break;
      const go = gameObjects.get(parentT.go ?? '');
      if (go?.name) chain.push(go.name);
      cur = parentT;
    }
    // chain runs child -> root; the group is the one just under the root.
    return chain.length >= 2 ? chain[chain.length - 2] : (chain[0] ?? '');
  };

  const props = [];
  const npcs = [];
  const spawners = [];

  let culledLod = 0;
  let shearedProps = 0;

  for (const [anchor, t] of transforms) {
    if (!t.go || !t.pos) continue;
    const go = gameObjects.get(t.go);
    if (!go?.name) continue;
    if (lodCulled.has(t.go)) {
      culledLod++;
      continue;
    }
    // The mesh a guid resolves to, which is the thing actually drawn. Falls back
    // to the node name only when there is no guid map, so a caller running
    // without one still gets a usable (if approximate) answer.
    const guid = meshGuidOf.get(t.go);
    const resolved = guid && guidMap ? guidMap[guid]?.name : null;
    // WORLD, not local: see the header. The local triple is only correct for a
    // direct child of the root, and 85% of these nodes are not one.
    const world = worldOf(anchor);
    const d = world
      ? decompose(world)
      : { pos: t.pos, rot: t.rot ?? [0, 0, 0, 1], scale: t.scale ?? [1, 1, 1], skew: 0 };
    const entry = {
      name: resolved ?? go.name,
      ...(resolved && resolved !== go.name ? { node: go.name } : {}),
      pos: r4(d.pos),
      rot: r4(d.rot),
      scale: r4(d.scale),
      group: groupOf(anchor),
    };
    const mats = materialsOf.get(t.go);
    if (mats?.length) entry.mats = mats;
    // A sheared basis does not fit in a scale triple. Rare enough (6 props in the
    // whole corpus) to carry the matrix only where it is actually needed.
    if (d.skew > 0.5 && world) {
      entry.mat = r4(world);
      shearedProps++;
    }
    if (!go.active) entry.inactive = true;

    if (/^NPC[_\s]/i.test(go.name)) npcs.push(entry);
    else if (/spawner/i.test(go.name)) spawners.push(entry);
    else if (geometryOwners.has(t.go)) props.push(entry);
  }

  const byName = new Map();
  for (const p of props) byName.set(p.name, (byName.get(p.name) ?? 0) + 1);

  return {
    map: mapName,
    counts: {
      props: props.length,
      npcs: npcs.length,
      spawners: spawners.length,
      distinctProps: byName.size,
      transforms: transforms.size,
      culledLod: culledLod,
      sheared: shearedProps,
    },
    props: props.sort((a, b) => a.name.localeCompare(b.name) || a.pos[0] - b.pos[0]),
    npcs: npcs.sort((a, b) => a.name.localeCompare(b.name)),
    spawners,
  };
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [bundlesDir, outDir] = positional;
  if (!bundlesDir || !outDir) {
    console.log(
      'usage: node scripts/assets/unity_map_layout.mjs <bundlesDir> <outDir> [--limit n]',
    );
    process.exit(1);
  }
  const limit = Number(flag('--limit', '0'));
  // Optional but strongly recommended: without it, props are named by their scene
  // node rather than by the mesh they draw.
  const guidMapPath = flag('--guid-map');
  const guidMap = guidMapPath ? JSON.parse(readFileSync(guidMapPath, 'utf8')) : null;
  if (!guidMap) {
    console.error('warning: no --guid-map, falling back to node names (see the header)');
  }

  /** Every `_Maps/**\/*.prefab` under the ripped bundle tree. */
  const found = [];
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
      else if (e.name.endsWith('.prefab') && p.includes('_Maps')) found.push(p);
    }
  };
  walk(bundlesDir);
  found.sort();
  const files = limit > 0 ? found.slice(0, limit) : found;

  mkdirSync(outDir, { recursive: true });
  const index = [];
  for (const file of files) {
    const mapName = path.basename(file, '.prefab');
    let layout;
    try {
      layout = extractMapLayout(readFileSync(file, 'utf8'), mapName, guidMap);
    } catch (err) {
      console.error(`  FAIL ${mapName}: ${String(err.message).slice(0, 140)}`);
      continue;
    }
    const out = path.join(outDir, `${mapName}.json`);
    writeFileSync(out, `${JSON.stringify(layout)}\n`);
    index.push({ map: mapName, ...layout.counts, bytes: statSync(out).size });
  }

  index.sort((a, b) => a.map.localeCompare(b.map));
  writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  const total = index.reduce(
    (acc, m) => ({
      props: acc.props + m.props,
      npcs: acc.npcs + m.npcs,
      spawners: acc.spawners + m.spawners,
      culledLod: acc.culledLod + (m.culledLod ?? 0),
      sheared: acc.sheared + (m.sheared ?? 0),
      bytes: acc.bytes + m.bytes,
    }),
    { props: 0, npcs: 0, spawners: 0, culledLod: 0, sheared: 0, bytes: 0 },
  );
  console.log(
    `\nunity_map_layout: ${index.length} maps -> ${total.props.toLocaleString('en-US')} props, ` +
      `${total.npcs} npcs, ${total.spawners} spawners, ` +
      `${(total.bytes / 1024 / 1024).toFixed(2)} MiB of JSON`,
  );
  console.log(
    `  ${total.culledLod.toLocaleString('en-US')} reduced LOD levels dropped, ` +
      `${total.sheared} props needed a full matrix`,
  );
}
