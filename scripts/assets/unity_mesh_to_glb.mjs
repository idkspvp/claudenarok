// Convert Unity serialized meshes (AssetRipper `.asset` YAML) straight to web GLB.
//
// No Unity install and no headless browser: an AssetRipper-exported Mesh is
// PLAIN YAML that publishes its own vertex layout, so the geometry can be
// decoded directly. That is the whole reason this exists next to
// synty_to_glb.mjs, which needs a real engine only because FBX parsing does.
//
// THE LAYOUT IS SELF-DESCRIBING, which is what makes this safe rather than a
// guess. Every mesh carries:
//
//   m_VertexData.m_VertexCount   how many vertices
//   m_VertexData.m_Channels[]    one row per attribute: {stream, offset,
//                                format, dimension}, in Unity's fixed
//                                VertexAttribute order (0 Position, 1 Normal,
//                                2 Tangent, 3 Color, 4..11 TexCoord0..7,
//                                12 BlendWeight, 13 BlendIndices)
//   m_VertexData._typelessdata   the interleaved buffer, hex
//   m_IndexBuffer                indices, hex; m_IndexFormat 0 = uint16
//   m_SubMeshes[]                firstByte / indexCount / baseVertex / topology
//   m_DataSize                   total byte length
//
// A row with dimension 0 is an unused slot, not a zero-wide attribute. Channels
// are grouped into STREAMS, each stream tightly packed at its own stride and
// laid out one after another; the decode is checked against m_DataSize, so a
// wrong stride is a hard error rather than silent garbage.
//
// USAGE
//   node scripts/assets/unity_mesh_to_glb.mjs <meshDir> <outDir> [options]
//
// OPTIONS
//   --include <re>   only meshes whose name matches
//   --exclude <re>   skip meshes whose name matches
//   --limit <n>      convert at most n
//   --scale <n>      uniform scale applied to positions (default 1)
//   --force          rebuild even when the output is newer than the source
//   --no-meshopt     skip compression
//   --keep-tangents  keep TANGENT (only useful with a normal map)
//   --keep-skinning  keep JOINTS_0/WEIGHTS_0 (dead payload until a skin is exported)
//   -h, --help

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const has = (n) => argv.includes(n);
const VALUED = new Set(['--include', '--exclude', '--limit', '--scale']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const [meshDir, outDir] = positional;
const include = flag('--include');
const exclude = flag('--exclude');
const limit = Number(flag('--limit', '0'));
const scale = Number(flag('--scale', '1'));
const force = has('--force');
const compress = !has('--no-meshopt');
const keepTangents = has('--keep-tangents');
const keepSkinning = has('--keep-skinning');

// Unity VertexAttributeFormat -> [bytes per component, reader name].
const FORMAT = {
  0: [4, 'f32'],
  1: [2, 'f16'],
  2: [1, 'unorm8'],
  3: [1, 'snorm8'],
  4: [2, 'unorm16'],
  5: [2, 'snorm16'],
  6: [1, 'u8'],
  7: [1, 'i8'],
  8: [2, 'u16'],
  9: [2, 'i16'],
  10: [4, 'u32'],
  11: [4, 'i32'],
};

// Unity VertexAttribute index -> what we call it. Only the ones a web renderer
// consumes; the rest are decoded and dropped.
//
// TANGENT and TEXCOORD_1 are deliberately absent. Tangents exist to orient a
// NORMAL MAP, and the prop atlases carry none, so they were 18.7% of the vertex
// payload doing nothing. TEXCOORD_1 is Unity's lightmap channel, which a web
// renderer that lights in real time never reads. COLOR_0 is KEPT: it was checked
// and genuinely varies on every mesh that has it (Synty shades with it), so
// dropping it would flatten the art.
//
// WEIGHTS_0 and JOINTS_0 are absent for a harder reason: this exporter writes no
// skins array and no joint nodes at all, so a skinning attribute is payload
// nothing downstream can consume, and 1,726 of the 3,994 source meshes that
// carry one carry BlendIndices ALONE, which glTF rejects outright.
// --keep-skinning brings them back, spec-shaped, for when the character
// pipeline lands and actually exports a skin.
const ATTR = {
  0: 'POSITION',
  1: 'NORMAL',
  3: 'COLOR_0',
  4: 'TEXCOORD_0',
};
/** Only read when --keep-tangents asks for it. */
const OPTIONAL_ATTR = { 2: 'TANGENT' };
/** Only read when --keep-skinning asks for it. */
const SKIN_ATTR = { 12: 'WEIGHTS_0', 13: 'JOINTS_0' };

// glTF 2.0 fixes the component count PER SEMANTIC; Unity's channel width does
// not, so the raw dimension must never be mapped straight to an accessor type.
// That mismatch was live: Unity pads float16 normals to 4 components, so NORMAL
// went out as VEC4 on 3,120 meshes, and BlendIndices came through as SCALAR or
// VEC2 where glTF demands VEC4. It is not a paperwork problem. Readers trust the
// spec instead of the header: build_map_chunks.mjs walks NORMAL at a hard stride
// of 3 and, handed a VEC4 array, reads misaligned from the second vertex on,
// which measured 73 to 94 degrees of mean angular error on real props.
//
// So the width is re-strided, not relabelled: relabelling a 4-wide array as VEC3
// would shear every vertex after the first. Truncation is provably free on the
// only case that hits it, the padded normals: their 4th component is exactly 0
// on every one of the 3,120 meshes, global max |w| = 0 over the whole corpus.
// Unity even says so in the field this parser already reads: the high nibble of
// `dimension`, masked off above, holds the SEMANTIC count 3 on exactly those
// rows and 0 on every other row in the corpus.
//
// `pad` is what a MISSING component means, never a blind zero: TANGENT w is the
// handedness sign and COLOR_0 alpha is opaque.
const ACCESSOR_TYPE = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' };
const SEMANTIC_SHAPE = {
  POSITION: { want: 3 },
  NORMAL: { want: 3 },
  TANGENT: { want: 4, pad: (d) => (d === 3 ? 1 : 0) },
  COLOR_0: { want: 4, allow: [3, 4], pad: (d) => (d === 3 ? 1 : 0) },
  TEXCOORD_0: { want: 2 },
  JOINTS_0: { want: 4 },
  WEIGHTS_0: { want: 4 },
};

/** Re-stride one decoded attribute to the width its semantic is allowed to have. */
export function conformAttribute(semantic, data, dimension) {
  const shape = SEMANTIC_SHAPE[semantic];
  // Fail CLOSED. Passing an unlisted semantic through at Unity's raw width is
  // exactly the bug this function exists to close, so adding a row to ATTR
  // without one here must break loudly rather than quietly reintroduce it. The
  // corpus already carries dimension-4 TEXCOORD_2 and TEXCOORD_3 rows waiting to
  // do so.
  if (!shape) throw new Error(`conformAttribute: no glTF shape declared for ${semantic}`);
  if ((shape.allow ?? [shape.want]).includes(dimension)) return { data, dimension };
  const want = shape.want;
  const count = data.length / dimension;
  const out = new data.constructor(count * want);
  for (let v = 0; v < count; v++) {
    for (let d = 0; d < want; d++) {
      out[v * want + d] = d < dimension ? data[v * dimension + d] : (shape.pad?.(d) ?? 0);
    }
  }
  return { data: out, dimension: want };
}

/** glTF forbids either half of the JOINTS_0/WEIGHTS_0 pair on its own, and the
 *  corpus is full of exactly that: BlendIndices at dimension 1 with no
 *  BlendWeight channel anywhere, which is Unity rigid single-bone bind data, not
 *  a weighted skin. The implied weight is 1 on the bound bone, so fill the
 *  missing half rather than dropping the pair; --keep-skinning output then keeps
 *  its meaning AND validates. */
function pairSkinning(attributes, vertexCount) {
  if (attributes.JOINTS_0 && !attributes.WEIGHTS_0) {
    const weights = new Float32Array(vertexCount * 4);
    for (let v = 0; v < vertexCount; v++) weights[v * 4] = 1;
    attributes.WEIGHTS_0 = { data: weights, dimension: 4 };
  }
  if (attributes.WEIGHTS_0 && !attributes.JOINTS_0) {
    attributes.JOINTS_0 = { data: new Uint16Array(vertexCount * 4), dimension: 4 };
  }
}

/** IEEE half-precision to float. Unity stores UVs this way. */
function f16(u) {
  const s = (u & 0x8000) >> 15;
  const e = (u & 0x7c00) >> 10;
  const f = u & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * 2 ** -14 * (f / 1024);
  if (e === 0x1f) return f ? Number.NaN : (s ? -1 : 1) * Number.POSITIVE_INFINITY;
  return (s ? -1 : 1) * 2 ** (e - 15) * (1 + f / 1024);
}

/** Pull one scalar field out of the YAML by name, without a YAML parser: the
 *  files carry a megabyte-scale hex scalar that a real parser walks needlessly. */
const num = (text, key, fallback = null) => {
  const m = text.match(new RegExp(`^\\s*${key}: (-?[0-9.eE+]+)\\s*$`, 'm'));
  return m ? Number(m[1]) : fallback;
};
const hex = (text, key) => text.match(new RegExp(`${key}: ([0-9a-fA-F]+)`))?.[1] ?? '';

function parseChannels(text) {
  const block = text.slice(text.indexOf('m_Channels:'), text.indexOf('m_DataSize:'));
  const rows = [];
  const re = /- stream: (\d+)\s+offset: (\d+)\s+format: (\d+)\s+dimension: (\d+)/g;
  let m = re.exec(block);
  while (m) {
    rows.push({
      stream: Number(m[1]),
      offset: Number(m[2]),
      format: Number(m[3]),
      // Unity packs FLAGS into the high nibble of `dimension`, so a raw read
      // yields impossible widths like 52 (0x34) where the real dimension is 4.
      // Only the low nibble is the component count. Left unmasked this makes
      // the stride roughly 3.6x too wide, which is how it was found: the
      // m_DataSize check refused 203 meshes rather than decoding garbage.
      dimension: Number(m[4]) & 0x0f,
    });
    m = re.exec(block);
  }
  return rows;
}

/** Decode one Unity mesh into plain typed arrays. Throws rather than guessing. */
/** How far outside [0,1] a texcoord may sit and still count as noise rather than
 *  intent. Well past a float32 rounding error, well short of a second tile. */
export const UV_DUST_EPSILON = 1e-3;

/** Snap texcoords that miss [0,1] by rounding error, and LEAVE REAL TILING ALONE.
 *
 *  The quantizer refuses a texcoord set that strays outside [0,1] and silently
 *  keeps the whole attribute as float32, which is how TEXCOORD_0 came to be 24%
 *  of the vertex payload. An earlier version of this bought that back by clamping
 *  every UV unconditionally, on a stated measurement that the corpus maximum was
 *  1.0 and the strays were floating-point dust.
 *
 *  That measurement was wrong, and wrong in the way that is hardest to notice: it
 *  was taken by decoding through the clamp itself, so it could only ever report
 *  [0,1]. Measured on the raw channel the corpus runs -69.34 to 164.36, and 543
 *  meshes tile by a real margin: river surfaces at 164 repeats, fountain water,
 *  gold piles, bridges, stairs, tower walls. Clamping those collapses every
 *  repeat onto the atlas edge, which is not a size trade, it is destroyed texture
 *  mapping that no later stage can recover.
 *
 *  So the decision is per mesh. A mesh that only overshoots by dust is snapped
 *  and quantises; a mesh that genuinely tiles keeps its float32 texcoords and
 *  costs the bytes. */
export function snapTexcoordDust(attr, epsilon = UV_DUST_EPSILON) {
  if (!attr) return false;
  const uv = attr.data;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < uv.length; i++) {
    if (uv[i] < min) min = uv[i];
    if (uv[i] > max) max = uv[i];
  }
  if (min < -epsilon || max > 1 + epsilon) return false;
  for (let i = 0; i < uv.length; i++) {
    if (uv[i] < 0) uv[i] = 0;
    else if (uv[i] > 1) uv[i] = 1;
  }
  return true;
}

export function decodeUnityMesh(text) {
  const name = text.match(/^\s*m_Name: (.*)$/m)?.[1]?.trim() ?? 'mesh';
  const vertexCount = num(text, 'm_VertexCount');
  const dataSize = num(text, 'm_DataSize');
  const indexFormat = num(text, 'm_IndexFormat', 0);
  if (!vertexCount || !dataSize) throw new Error(`${name}: no vertex data`);

  const channels = parseChannels(text).filter((c) => c.dimension > 0);
  if (!channels.length) throw new Error(`${name}: no channels`);

  // Stride per stream is the widest (offset + size) in it, which is how Unity
  // packs them.
  const strides = new Map();
  for (const [i, c] of channels.entries()) {
    const [bytes] = FORMAT[c.format] ?? [];
    if (!bytes) throw new Error(`${name}: unknown vertex format ${c.format} on channel ${i}`);
    const end = c.offset + bytes * c.dimension;
    strides.set(c.stream, Math.max(strides.get(c.stream) ?? 0, end));
  }

  // Streams sit one after another in the blob, each starting on a 16-byte
  // boundary. Verified against m_DataSize below.
  const streamIds = [...strides.keys()].sort((a, b) => a - b);
  const base = new Map();
  let cursor = 0;
  for (const s of streamIds) {
    base.set(s, cursor);
    cursor += strides.get(s) * vertexCount;
    cursor = Math.ceil(cursor / 16) * 16;
  }
  const packedEnd = streamIds.reduce((n, s) => n + strides.get(s) * vertexCount, 0);
  if (packedEnd > dataSize) {
    throw new Error(`${name}: computed ${packedEnd} bytes of vertex data, blob holds ${dataSize}`);
  }

  const blob = Buffer.from(hex(text, '_typelessdata'), 'hex');
  if (blob.length !== dataSize) {
    throw new Error(`${name}: blob is ${blob.length} bytes, m_DataSize says ${dataSize}`);
  }

  const read = (fmt, buf, at) => {
    switch (FORMAT[fmt][1]) {
      case 'f32':
        return buf.readFloatLE(at);
      case 'f16':
        return f16(buf.readUInt16LE(at));
      case 'unorm8':
        return buf.readUInt8(at) / 255;
      case 'snorm8':
        return Math.max(-1, buf.readInt8(at) / 127);
      case 'unorm16':
        return buf.readUInt16LE(at) / 65535;
      case 'snorm16':
        return Math.max(-1, buf.readInt16LE(at) / 32767);
      case 'u8':
        return buf.readUInt8(at);
      case 'i8':
        return buf.readInt8(at);
      case 'u16':
        return buf.readUInt16LE(at);
      case 'i16':
        return buf.readInt16LE(at);
      case 'u32':
        return buf.readUInt32LE(at);
      default:
        return buf.readInt32LE(at);
    }
  };

  const attributes = {};
  for (const [i, c] of parseChannels(text).entries()) {
    if (!c.dimension) continue;
    const semantic =
      ATTR[i] ??
      (keepTangents ? OPTIONAL_ATTR[i] : undefined) ??
      (keepSkinning ? SKIN_ATTR[i] : undefined);
    if (!semantic) continue;
    const [bytes] = FORMAT[c.format];
    const stride = strides.get(c.stream);
    const start = base.get(c.stream);
    const out =
      semantic === 'JOINTS_0'
        ? new Uint16Array(vertexCount * c.dimension)
        : new Float32Array(vertexCount * c.dimension);
    for (let v = 0; v < vertexCount; v++) {
      const at = start + v * stride + c.offset;
      for (let d = 0; d < c.dimension; d++)
        out[v * c.dimension + d] = read(c.format, blob, at + d * bytes);
    }
    attributes[semantic] = conformAttribute(semantic, out, c.dimension);
  }

  if (!attributes.POSITION) throw new Error(`${name}: no POSITION channel`);
  if (keepSkinning) pairSkinning(attributes, vertexCount);

  snapTexcoordDust(attributes.TEXCOORD_0);
  if (scale !== 1)
    for (let i = 0; i < attributes.POSITION.data.length; i++) attributes.POSITION.data[i] *= scale;

  const idxHex = hex(text, 'm_IndexBuffer');
  const idxBuf = Buffer.from(idxHex, 'hex');
  const wide = indexFormat === 1;
  const count = wide ? idxBuf.length / 4 : idxBuf.length / 2;
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    indices[i] = wide ? idxBuf.readUInt32LE(i * 4) : idxBuf.readUInt16LE(i * 2);
  }

  return { name, vertexCount, attributes, indices, triangles: indices.length / 3 };
}

// ---------------------------------------------------------------------------

// Windows makes the naive form wrong: import.meta.url is file:///E:/... with
// three slashes while a hand-built file://${argv[1]} has two, so the guard never
// matches and the whole CLI silently does nothing at all.
const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  // Argument checking belongs INSIDE this guard. At module top level it ran on
  // import too, so `import { decodeUnityMesh }` from a test or a sibling script
  // printed the usage line and called process.exit before the importer's first
  // statement. That is why this file had no test.
  if (has('-h') || has('--help') || argv.length < 2) {
    console.log(
      'usage: node scripts/assets/unity_mesh_to_glb.mjs <meshDir> <outDir> [--limit n] [--scale n]',
    );
    process.exit(argv.length < 2 ? 1 : 0);
  }
  let files = readdirSync(meshDir)
    .filter((f) => f.endsWith('.asset'))
    .sort();
  if (include) files = files.filter((f) => new RegExp(include, 'i').test(f));
  if (exclude) files = files.filter((f) => !new RegExp(exclude, 'i').test(f));
  if (limit > 0) files = files.slice(0, limit);

  mkdirSync(outDir, { recursive: true });
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  const manifest = [];
  let built = 0;
  let reused = 0;
  let failed = 0;

  for (const file of files) {
    const src = path.join(meshDir, file);
    const name = path.basename(file, '.asset').replace(/[^A-Za-z0-9_-]/g, '_');
    const out = path.join(outDir, `${name}.glb`);
    if (!force && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
      manifest.push({ name, bytes: statSync(out).size, reused: true });
      reused++;
      continue;
    }
    let mesh;
    try {
      mesh = decodeUnityMesh(readFileSync(src, 'utf8'));
    } catch (err) {
      console.error(`  FAIL ${name}: ${String(err.message).slice(0, 140)}`);
      failed++;
      continue;
    }

    const doc = new Document();
    const buffer = doc.createBuffer();
    const prim = doc.createPrimitive().setMode(4);
    for (const [semantic, { data, dimension }] of Object.entries(mesh.attributes)) {
      const type = ACCESSOR_TYPE[dimension];
      if (!type) continue;
      prim.setAttribute(
        semantic,
        doc.createAccessor(semantic).setType(type).setArray(data).setBuffer(buffer),
      );
    }
    prim.setIndices(
      doc.createAccessor('idx').setType('SCALAR').setArray(mesh.indices).setBuffer(buffer),
    );
    prim.setMaterial(doc.createMaterial(mesh.name).setRoughnessFactor(0.85).setMetallicFactor(0));
    const gltfMesh = doc.createMesh(mesh.name).addPrimitive(prim);
    doc.createScene().addChild(doc.createNode(mesh.name).setMesh(gltfMesh));

    if (compress) {
      try {
        await doc.transform(
          prune({ keepAttributes: true }),
          dedup(),
          meshopt({ encoder: MeshoptEncoder, level: 'high' }),
        );
      } catch (err) {
        console.error(`  optimize failed for ${name}: ${String(err).slice(0, 100)}`);
      }
    }
    await io.write(out, doc);
    manifest.push({
      name,
      bytes: statSync(out).size,
      verts: mesh.vertexCount,
      tris: Math.round(mesh.triangles),
    });
    built++;
    if ((built + reused) % 250 === 0) console.log(`  ${built + reused}/${files.length}`);
  }

  manifest.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const bytes = manifest.reduce((n, m) => n + m.bytes, 0);
  const tris = manifest.reduce((n, m) => n + (m.tris ?? 0), 0);
  console.log(
    `\nunity_mesh_to_glb: ${manifest.length} meshes (${built} built, ${reused} reused, ${failed} failed) -> ` +
      `${(bytes / 1024 / 1024).toFixed(2)} MiB, ${tris.toLocaleString('en-US')} tris`,
  );
}
