// Extract the LIVE WORLD out of Game.unity: where monsters spawn, where the
// warps go, and where the NPCs stand.
//
// None of this is in the map prefabs. The prefabs carry scenery, and the scene
// carries everything that makes a map playable, which is why the prefab walker
// honestly reported 0 spawners for all 53 maps: it was reading the wrong file.
// Counted by script guid rather than by name, Game.unity holds 54 Map, 396
// MonsterSpawner, 164 MapExit, 28 NpcMaster and 94 Character components.
//
// IDENTIFY BY SCRIPT GUID, NEVER BY GAMEOBJECT NAME. A MonoBehaviour's type is
// its m_Script guid; the GameObject's name is a label someone typed. 43 of the
// 396 spawners are named after the monster they spawn ("Wisp Blue", "Dog Pup")
// rather than anything matching /spawner/i, so a name test silently drops 11% of
// the world's monsters.
//
// USAGE
//   node scripts/assets/unity_scene_world.mjs <sceneFile> <outFile>
//     --scripts <assetsDir>   to resolve script guids to class names

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { decompose, matMul, trs } from './transform_math.mjs';

const NUM = '(-?[\\d.eE+-]+)';
const vec = (b, k) => {
  const m = b.match(new RegExp(`${k}: \\{x: ${NUM}, y: ${NUM}, z: ${NUM}(?:, w: ${NUM})?\\}`));
  if (!m) return null;
  const o = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] !== undefined) o.push(Number(m[4]));
  return o;
};
const ref = (b, k) => b.match(new RegExp(`${k}: \\{fileID: (-?\\d+)`))?.[1] ?? null;

/** Split a Unity YAML scene into documents. */
export function splitDocuments(text) {
  const re = /^--- !u!(\d+) &(-?\d+)/gm;
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

/** Everything the scene says about the playable world, in world coordinates. */
export function extractSceneWorld(text, scriptNames = {}) {
  const docs = splitDocuments(text);
  const gameObjects = new Map();
  const transforms = new Map();
  const componentOwner = new Map();
  const behaviours = [];

  for (const d of docs) {
    if (d.classId === 1) {
      const name = d.body.match(/^\s*m_Name: (.*)$/m)?.[1]?.trim() ?? '';
      const active = d.body.match(/^\s*m_IsActive: (\d)$/m)?.[1] !== '0';
      const comps = [...d.body.matchAll(/- component: \{fileID: (-?\d+)\}/g)].map((c) => c[1]);
      gameObjects.set(d.anchor, { name, active, comps });
      for (const c of comps) componentOwner.set(c, d.anchor);
    } else if (d.classId === 4) {
      transforms.set(d.anchor, {
        go: ref(d.body, 'm_GameObject'),
        parent: ref(d.body, 'm_Father'),
        pos: vec(d.body, 'm_LocalPosition'),
        rot: vec(d.body, 'm_LocalRotation'),
        scale: vec(d.body, 'm_LocalScale'),
      });
    } else if (d.classId === 114) {
      const guid = d.body.match(/m_Script: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
      if (guid) behaviours.push({ ...d, guid, go: ref(d.body, 'm_GameObject') });
    }
  }

  const transformOfGo = new Map();
  for (const [a, t] of transforms) if (t.go) transformOfGo.set(t.go, a);

  const worldCache = new Map();
  const worldOf = (anchor, guard = 0) => {
    const hit = worldCache.get(anchor);
    if (hit) return hit;
    const t = transforms.get(anchor);
    if (!t || guard > 64) return null;
    let m = trs(t.pos ?? [0, 0, 0], t.rot ?? [0, 0, 0, 1], t.scale ?? [1, 1, 1]);
    if (t.parent && t.parent !== '0') {
      const p = worldOf(t.parent, guard + 1);
      if (p) m = matMul(p, m);
    }
    worldCache.set(anchor, m);
    return m;
  };
  const placeOf = (goAnchor) => {
    const tA = transformOfGo.get(goAnchor);
    if (!tA) return null;
    const w = worldOf(tA);
    if (!w) return null;
    const d = decompose(w);
    const r4 = (a) => a.map((n) => Math.round(n * 1e4) / 1e4);
    return { pos: r4(d.pos), rot: r4(d.rot), scale: r4(d.scale) };
  };
  /** Nearest ancestor GameObject carrying a Map component, which is the map a
   *  spawner or warp belongs to. Parenting is how the scene groups them. */
  const mapOwners = new Map();
  const mapOf = (goAnchor, guard = 0) => {
    if (mapOwners.has(goAnchor)) return mapOwners.get(goAnchor);
    let name = null;
    if (guard <= 64) {
      const tA = transformOfGo.get(goAnchor);
      const t = tA ? transforms.get(tA) : null;
      if (t?.parent && t.parent !== '0') {
        const pt = transforms.get(t.parent);
        if (pt?.go) name = mapNameByGo.get(pt.go) ?? mapOf(pt.go, guard + 1);
      }
    }
    mapOwners.set(goAnchor, name);
    return name;
  };

  const nameOf = (guid) => scriptNames[guid] ?? guid;
  const mapNameByGo = new Map();
  for (const b of behaviours) {
    if (nameOf(b.guid) !== 'Map' || !b.go) continue;
    const go = gameObjects.get(b.go);
    if (go?.name) mapNameByGo.set(b.go, go.name);
  }

  const maps = [];
  const spawners = [];
  const exits = [];
  const npcs = [];

  for (const b of behaviours) {
    if (!b.go) continue;
    const cls = nameOf(b.guid);
    const go = gameObjects.get(b.go);
    if (!go) continue;
    const place = placeOf(b.go);
    if (cls === 'Map') {
      maps.push({ name: go.name, active: go.active, ...(place ?? {}) });
    } else if (cls === 'MonsterSpawner') {
      const area = vec(b.body, 'Area');
      spawners.push({
        name: go.name,
        map: mapOf(b.go),
        active: go.active,
        area,
        count: Number(b.body.match(/^\s*SpawnCount: (\d+)/m)?.[1] ?? 0),
        ...(place ?? {}),
      });
    } else if (cls === 'MapExit') {
      exits.push({
        name: go.name,
        map: mapOf(b.go),
        active: go.active,
        // The paired exit is a scene-local fileID, so it resolves to the
        // GameObject that carries it and from there to the map it sits in.
        linked: ref(b.body, 'LinkedExit'),
        anchor: b.anchor,
        ...(place ?? {}),
      });
    } else if (cls === 'NpcMaster' || cls === 'Npc') {
      npcs.push({
        name: go.name,
        map: mapOf(b.go),
        active: go.active,
        kind: cls,
        ...(place ?? {}),
      });
    }
  }

  // Resolve each exit's link to the map it lands in, which is what makes the
  // warp graph usable rather than a list of doors.
  const exitByComponent = new Map();
  for (const b of behaviours) {
    if (nameOf(b.guid) === 'MapExit' && b.go) exitByComponent.set(b.anchor, b.go);
  }
  for (const e of exits) {
    const targetGo = e.linked ? exitByComponent.get(e.linked) : null;
    e.toMap = targetGo ? mapOf(targetGo) : null;
    e.toName = targetGo ? (gameObjects.get(targetGo)?.name ?? null) : null;
    delete e.anchor;
    delete e.linked;
  }

  return { maps, spawners, exits, npcs };
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const VALUED = new Set(['--scripts']);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const [sceneFile, outFile] = positional;
  if (!sceneFile) {
    console.log(
      'usage: node scripts/assets/unity_scene_world.mjs <scene> [out.json] [--scripts assetsDir]',
    );
    process.exit(1);
  }

  // guid -> class name, from the .cs.meta files. A MonoBehaviour's type is its
  // script guid and nothing else.
  const scriptNames = {};
  const scriptsDir = flag('--scripts');
  if (scriptsDir) {
    const walk = (dir, depth = 0) => {
      if (depth > 8) return;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, depth + 1);
        else if (e.name.endsWith('.cs.meta')) {
          try {
            const g = readFileSync(p, 'utf8').match(/guid: ([0-9a-f]{32})/)?.[1];
            if (g) scriptNames[g] = e.name.replace(/\.cs\.meta$/, '');
          } catch {
            /* unreadable meta */
          }
        }
      }
    };
    walk(scriptsDir);
  }

  const world = extractSceneWorld(readFileSync(sceneFile, 'utf8'), scriptNames);
  const byMap = new Map();
  for (const kind of ['spawners', 'exits', 'npcs']) {
    for (const e of world[kind]) {
      const k = e.map ?? '(unassigned)';
      const row = byMap.get(k) ?? { spawners: 0, exits: 0, npcs: 0 };
      row[kind]++;
      byMap.set(k, row);
    }
  }

  console.log(
    `unity_scene_world: ${world.maps.length} maps, ${world.spawners.length} spawners, ` +
      `${world.exits.length} exits, ${world.npcs.length} npcs`,
  );
  const linked = world.exits.filter((e) => e.toMap).length;
  console.log(`  exits whose destination map resolves: ${linked} of ${world.exits.length}`);
  const placedSpawners = world.spawners.filter((s) => s.map).length;
  console.log(`  spawners assigned to a map: ${placedSpawners} of ${world.spawners.length}`);
  console.log('\n  busiest maps:');
  for (const [m, r] of [...byMap].sort((a, b) => b[1].spawners - a[1].spawners).slice(0, 10)) {
    console.log(
      `    ${m.padEnd(30)} ${String(r.spawners).padStart(4)} spawners  ${String(r.exits).padStart(3)} exits  ${String(r.npcs).padStart(3)} npcs`,
    );
  }
  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify(world, null, 2)}\n`);
    console.log(`\n  wrote ${outFile}`);
  }
}
