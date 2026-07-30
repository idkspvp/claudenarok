// Read a BINARY Unity SerializedFile, driven by the type tree inside it.
//
// Most of this project's assets were ripped to YAML, which is why the mesh and
// prefab readers here are regex over text. TerrainData was not: it is still
// Unity's binary SerializedFile, and the terrain (the GROUND, on 38 of 53 maps)
// is locked inside it.
//
// GUESSING AT OFFSETS DOES NOT WORK, and it fails in a way that looks like it
// worked. Scanning the file for a smooth uint16 block "found" a heightmap at two
// different offsets and resolutions on the first two attempts; both were noise
// or padding, and only rendering the relief as ASCII showed it. The files also
// vary from 2.2 to 3.9 MiB and hold splat, detail and tree data besides heights,
// so no size arithmetic pins the layout either.
//
// What makes this tractable is that these files set enableTypeTree, so each one
// carries a full description of its own layout. This walks that description. It
// deliberately does NOT depend on Unity's built-in common string table, which is
// a version-specific constant that would have to be transcribed exactly:
//   - arrays are identified by the isArray bit in typeFlags, not by the name
//     "Array"
//   - primitives are read by their declared byteSize, not by the name "int"
//   - only FIELD names are resolved, and those needed here live in the file's
//     own string buffer
// So the reader stays correct without carrying a table it cannot verify.

const ALIGN_FLAG = 0x4000; // kAlignBytesFlag on a node's metaFlag
const IS_ARRAY_FLAG = 0x01; // typeFlags bit 0

// Unity's built-in common string table. A node's string offset with the high bit
// set indexes into this instead of the file's own buffer, and the primitive TYPE
// names (float, int, SInt16) all live here, which is what a reader needs to tell
// a float from an int32 of the same width: without it m_Scale reads back as
// 1058406400 rather than 0.6.
//
// It is a fixed constant, so it is used ONLY to refine how a primitive is
// interpreted. Structure still comes from the isArray flag and the declared
// byteSize, so if this table were ever wrong for some Unity version the result is
// a mislabelled scalar, never a desynchronised walk. The byte-accounting check in
// readObject would catch the latter; this cannot cause it.
const COMMON_STRINGS = [
  'AABB',
  'AnimationClip',
  'AnimationCurve',
  'AnimationState',
  'Array',
  'Base',
  'BitField',
  'bitset',
  'bool',
  'char',
  'ColorRGBA',
  'Component',
  'data',
  'deque',
  'double',
  'dynamic_array',
  'FastPropertyName',
  'first',
  'float',
  'Font',
  'GameObject',
  'Generic Mono',
  'GradientNEW',
  'GUID',
  'GUIStyle',
  'int',
  'list',
  'long long',
  'map',
  'Matrix4x4f',
  'MdFour',
  'MonoBehaviour',
  'MonoScript',
  'm_ByteSize',
  'm_Curve',
  'm_EditorClassIdentifier',
  'm_EditorHideFlags',
  'm_Enabled',
  'm_ExtensionPtr',
  'm_GameObject',
  'm_Index',
  'm_IsArray',
  'm_IsStatic',
  'm_MetaFlag',
  'm_Name',
  'm_ObjectHideFlags',
  'm_PrefabInternal',
  'm_PrefabParentObject',
  'm_Script',
  'm_StaticEditorFlags',
  'm_Type',
  'm_Version',
  'Object',
  'pair',
  'PPtr<Component>',
  'PPtr<GameObject>',
  'PPtr<Material>',
  'PPtr<MonoBehaviour>',
  'PPtr<MonoScript>',
  'PPtr<Object>',
  'PPtr<Prefab>',
  'PPtr<Sprite>',
  'PPtr<TextAsset>',
  'PPtr<Texture>',
  'PPtr<Texture2D>',
  'PPtr<Transform>',
  'Prefab',
  'Quaternionf',
  'Rectf',
  'RectInt',
  'RectOffset',
  'second',
  'set',
  'short',
  'size',
  'SInt16',
  'SInt32',
  'SInt64',
  'SInt8',
  'staticvector',
  'string',
  'TextAsset',
  'TextMesh',
  'Texture',
  'Texture2D',
  'Transform',
  'TypelessData',
  'UInt16',
  'UInt32',
  'UInt64',
  'UInt8',
  'unsigned int',
  'unsigned long long',
  'unsigned short',
  'vector',
  'Vector2f',
  'Vector3f',
  'Vector4f',
  'm_ScriptingClassIdentifier',
  'Gradient',
  'Type*',
  'int2_storage',
  'int3_storage',
  'BoundsInt',
  'm_CorrespondingSourceObject',
  'm_PrefabInstance',
  'm_PrefabAsset',
  'FileSize',
  'Hash128',
];

/** offset -> string, built once. Entries are null-separated in the real buffer,
 *  so an entry's offset is the running total of the lengths before it plus one
 *  terminator each. */
const COMMON_BY_OFFSET = (() => {
  const map = new Map();
  let off = 0;
  for (const s of COMMON_STRINGS) {
    map.set(off, s);
    off += s.length + 1;
  }
  return map;
})();

/** A cursor over a buffer that tracks alignment, which the format needs. */
class Cursor {
  constructor(buf, base = 0) {
    this.buf = buf;
    this.base = base;
    this.pos = 0;
  }
  get abs() {
    return this.base + this.pos;
  }
  u8() {
    return this.buf[this.base + this.pos++];
  }
  i16() {
    const v = this.buf.readInt16LE(this.abs);
    this.pos += 2;
    return v;
  }
  u16() {
    const v = this.buf.readUInt16LE(this.abs);
    this.pos += 2;
    return v;
  }
  i32() {
    const v = this.buf.readInt32LE(this.abs);
    this.pos += 4;
    return v;
  }
  u32() {
    const v = this.buf.readUInt32LE(this.abs);
    this.pos += 4;
    return v;
  }
  f32() {
    const v = this.buf.readFloatLE(this.abs);
    this.pos += 4;
    return v;
  }
  bytes(n) {
    const v = this.buf.subarray(this.abs, this.abs + n);
    this.pos += n;
    return v;
  }
  align(n = 4) {
    this.pos = Math.ceil(this.pos / n) * n;
  }
}

/** Parse the file header and metadata. Big-endian header, then metadata in the
 *  file's own endianness (little, for every asset in this project). */
export function readSerializedFile(buf) {
  let o = 0;
  const u32be = () => {
    const v = buf.readUInt32BE(o);
    o += 4;
    return v;
  };
  const i64be = () => {
    const v = Number(buf.readBigInt64BE(o));
    o += 8;
    return v;
  };

  u32be(); // legacy metadataSize
  u32be(); // legacy fileSize
  const version = u32be();
  u32be(); // legacy dataOffset
  const endianness = buf[o];
  o += 4;
  if (version < 22) throw new Error(`unsupported SerializedFile version ${version}`);
  if (endianness !== 0) throw new Error('big-endian SerializedFile not supported');
  u32be(); // metadataSize
  const fileSize = i64be();
  const dataOffset = i64be();
  i64be(); // unknown
  if (fileSize !== buf.length) {
    throw new Error(`fileSize ${fileSize} does not match the actual ${buf.length}`);
  }

  const c = new Cursor(buf, o);
  const cstr = () => {
    const start = c.abs;
    while (c.buf[c.base + c.pos] !== 0) c.pos++;
    const s = c.buf.toString('utf8', start, c.abs);
    c.pos++;
    return s;
  };

  const unityVersion = cstr();
  c.u32(); // targetPlatform
  const enableTypeTree = c.u8() !== 0;
  if (!enableTypeTree) throw new Error('no type tree: layout cannot be recovered from this file');

  const typeCount = c.u32();
  const types = [];
  for (let i = 0; i < typeCount; i++) types.push(readType(c));

  const objectCount = c.u32();
  const objects = [];
  for (let i = 0; i < objectCount; i++) {
    c.align(4);
    const pathId = c.buf.readBigInt64LE(c.abs);
    c.pos += 8;
    const byteStart = Number(c.buf.readBigInt64LE(c.abs));
    c.pos += 8;
    const byteSize = c.u32();
    const typeIndex = c.i32();
    objects.push({ pathId, byteStart, byteSize, typeIndex });
  }

  // Script types, then the EXTERNALS table. A PPtr's m_FileID is an index into
  // that table (1-based; 0 means this file), so without it a reference to
  // another asset is just a number. The terrain's four ground layers are exactly
  // that kind of reference.
  const externals = [];
  try {
    const scriptCount = c.u32();
    c.pos += scriptCount * (4 + 8); // localSerializedFileIndex + localIdentifierInFile
    const externalCount = c.u32();
    for (let i = 0; i < externalCount && i < 4096; i++) {
      cstr(); // tempEmpty
      const guidBytes = c.bytes(16);
      const type = c.i32();
      const pathName = cstr();
      // Unity writes the guid as 16 raw bytes, nibble-swapped per byte relative
      // to how the text form reads.
      let guid = '';
      for (const b of guidBytes)
        guid += (((b & 0x0f) << 4) | (b >> 4)).toString(16).padStart(2, '0');
      externals.push({ guid, type, pathName });
    }
  } catch {
    // A file without a usable externals table still yields its own objects.
    externals.length = 0;
  }

  return { version, unityVersion, dataOffset, types, objects, externals, buf };
}

function readType(c) {
  const classId = c.i32();
  c.u8(); // isStrippedType
  const scriptTypeIndex = c.i16();
  if (classId === 114) c.pos += 16; // script id hash
  c.pos += 16; // old type hash

  const nodeCount = c.u32();
  const stringBufferSize = c.u32();
  const raw = [];
  for (let i = 0; i < nodeCount; i++) {
    const nodeVersion = c.u16();
    const level = c.u8();
    const typeFlags = c.u8();
    const typeStrOffset = c.u32();
    const nameStrOffset = c.u32();
    const byteSize = c.i32();
    const index = c.i32();
    const metaFlag = c.u32();
    c.pos += 8; // refTypeHash, version >= 19
    raw.push({
      nodeVersion,
      level,
      typeFlags,
      typeStrOffset,
      nameStrOffset,
      byteSize,
      index,
      metaFlag,
    });
  }
  const strings = c.bytes(stringBufferSize);

  // A string offset with the high bit set indexes Unity's built-in common table;
  // otherwise it is an offset into this file's own buffer.
  const str = (off) => {
    if (off & 0x80000000) return COMMON_BY_OFFSET.get(off & 0x7fffffff) ?? null;
    let end = off;
    while (end < strings.length && strings[end] !== 0) end++;
    return strings.toString('utf8', off, end);
  };

  const nodes = raw.map((n) => ({
    ...n,
    type: str(n.typeStrOffset),
    name: str(n.nameStrOffset),
    isArray: (n.typeFlags & IS_ARRAY_FLAG) !== 0,
    align: (n.metaFlag & ALIGN_FLAG) !== 0,
  }));

  // Type dependencies, present from version 21.
  const depCount = c.u32();
  c.pos += depCount * 4;

  return { classId, scriptTypeIndex, nodes };
}

/** Children of `i` are the run of nodes one level deeper, up to the next node at
 *  or above the parent's level. */
function childrenOf(nodes, i) {
  const out = [];
  const level = nodes[i].level;
  for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[j].level <= level) break;
    if (nodes[j].level === level + 1) out.push(j);
  }
  return out;
}

/** Read one node's value.
 *
 *  `want` is an optional predicate on the dotted field path. A node whose path
 *  fails it is still WALKED (the format has no skip offsets, so the bytes have
 *  to be consumed) but large arrays under it are not materialized. That keeps a
 *  4 MiB terrain from turning into a million-element JS array per field. */
function readValue(nodes, i, c, path, want) {
  const node = nodes[i];
  const kids = childrenOf(nodes, i);

  // Unity's vector<T> is a struct wrapping a single unnamed array node. Collapse
  // it, so `m_Heights` reads as the array rather than as a box holding one.
  // (That wrapper's child is named through the built-in common string table, so
  // its name resolves to null here and cannot be matched on.)
  if (kids.length === 1 && nodes[kids[0]].isArray) {
    const inner = readValue(nodes, kids[0], c, path, want);
    if (node.align) c.align(4);
    return inner;
  }

  let value;
  if (
    node.isArray ||
    (kids.length === 2 && nodes[kids[0]].name === 'size' && nodes[kids[1]].name === 'data')
  ) {
    // Array: a size, then that many elements of the second child's type.
    const sizeIdx = kids[0];
    const dataIdx = kids[1];
    const n = c.i32();
    const elem = nodes[dataIdx];
    const elemKids = childrenOf(nodes, dataIdx);
    const keep = !want || want(path);
    if (elemKids.length === 0 && elem.byteSize > 0) {
      // Flat primitive array: take it as one contiguous block, which is what
      // makes a 1 M sample heightmap cheap rather than a million reads.
      const raw = c.bytes(n * elem.byteSize);
      value = keep
        ? { typedArray: decodePrimitiveArray(raw, elem, n), count: n, elemSize: elem.byteSize }
        : { count: n, elemSize: elem.byteSize };
    } else {
      const out = keep ? [] : null;
      for (let k = 0; k < n; k++) {
        const v = readValue(nodes, dataIdx, c, `${path}[]`, want);
        if (out) out.push(v);
      }
      value = out ?? { count: n };
    }
    void sizeIdx;
  } else if (kids.length === 0) {
    value = readPrimitive(c, node);
  } else {
    value = {};
    for (const k of kids) {
      const child = nodes[k];
      value[child.name ?? `#${child.index}`] = readValue(
        nodes,
        k,
        c,
        path ? `${path}.${child.name ?? ''}` : (child.name ?? ''),
        want,
      );
    }
  }

  if (node.align) c.align(4);
  return value;
}

function readPrimitive(c, node) {
  // Read by declared SIZE, not by type name, so this needs no common string
  // table. Signedness and float-ness come from the type name when the file
  // provides it locally, and default to the common case otherwise.
  const t = node.type;
  switch (node.byteSize) {
    case 1: {
      const v = c.u8();
      return t === 'bool' ? v !== 0 : v;
    }
    case 2:
      return t === 'UInt16' || t === 'unsigned short' ? c.u16() : c.i16();
    case 4:
      if (t === 'float') return c.f32();
      if (t === 'UInt32' || t === 'unsigned int') return c.u32();
      return c.i32();
    case 8: {
      const v = c.buf.readBigInt64LE(c.abs);
      c.pos += 8;
      return Number(v);
    }
    default: {
      const raw = c.bytes(Math.max(0, node.byteSize));
      return raw;
    }
  }
}

function decodePrimitiveArray(raw, elem, n) {
  const t = elem.type;
  const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  switch (elem.byteSize) {
    case 1:
      return t === 'SInt8' || t === 'char' ? new Int8Array(ab, 0, n) : new Uint8Array(ab, 0, n);
    case 2:
      return t === 'UInt16' || t === 'unsigned short'
        ? new Uint16Array(ab, 0, n)
        : new Int16Array(ab, 0, n);
    case 4:
      if (t === 'float') return new Float32Array(ab, 0, n);
      return t === 'UInt32' || t === 'unsigned int'
        ? new Uint32Array(ab, 0, n)
        : new Int32Array(ab, 0, n);
    default:
      return raw;
  }
}

/** Read one object's fields as a plain tree.
 *  `want(path)` decides which large arrays are materialized. */
export function readObject(file, object, want = null) {
  const type = file.types[object.typeIndex];
  if (!type?.nodes.length) throw new Error('object has no type tree');
  const c = new Cursor(file.buf, file.dataOffset + object.byteStart);
  const value = readValue(type.nodes, 0, c, '', want);
  return { classId: type.classId, value, consumed: c.pos, expected: object.byteSize };
}
