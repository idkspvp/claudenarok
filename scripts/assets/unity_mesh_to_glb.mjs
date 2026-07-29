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
if (has('-h') || has('--help') || argv.length < 2) {
  console.log(
    'usage: node scripts/assets/unity_mesh_to_glb.mjs <meshDir> <outDir> [--limit n] [--scale n]',
  );
  process.exit(argv.length < 2 ? 1 : 0);
}
const VALUED = new Set(['--include', '--exclude', '--limit', '--scale']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const [meshDir, outDir] = positional;
const include = flag('--include');
const exclude = flag('--exclude');
const limit = Number(flag('--limit', '0'));
const scale = Number(flag('--scale', '1'));
const force = has('--force');
const compress = !has('--no-meshopt');

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
const ATTR = {
  0: 'POSITION',
  1: 'NORMAL',
  2: 'TANGENT',
  3: 'COLOR_0',
  4: 'TEXCOORD_0',
  5: 'TEXCOORD_1',
  12: 'WEIGHTS_0',
  13: 'JOINTS_0',
};

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
    const semantic = ATTR[i];
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
    attributes[semantic] = { data: out, dimension: c.dimension };
  }

  if (!attributes.POSITION) throw new Error(`${name}: no POSITION channel`);
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
      const type = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' }[dimension];
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
        await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
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
