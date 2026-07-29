// Extract SpiritVale's skill effects into a table of numbers a web renderer can
// re-author from.
//
// The effects are classic Unity Shuriken ParticleSystems in plain YAML, not VFX
// Graph, so their parameters are readable. What CANNOT cross is the shading: one
// Piloto uber Shader Graph backs most FX materials, and Unity shaders do not run
// on the web. The colours, timings, counts and shapes DO cross, and that is what
// this emits. Nothing here copies a texture or a mesh.
//
// THE BINDING IS A TABLE, NOT A NAME MATCH, and that distinction is load-bearing:
// `Whirlwind.asset` is a trading card while the SKILL is `Whirlwind_2.asset`, so
// matching on filename silently binds the wrong effect. Every SkillConfig carries
// an explicit `Id` field plus five effect slots, and the script guid identifies
// which MonoBehaviour assets are SkillConfigs at all.
//
//   EffectCast      played when the cast starts
//   EffectInstance  the persistent one, for channels and fields
//   EffectComplete  played when the cast finishes
//   EffectHit       played on each target hit
//   EffectBolt      the travelling projectile
//
// USAGE
//   node scripts/assets/unity_skill_fx.mjs <assetsDir> <guidMap.json> <out.json>
//     [--skills <a,b,c>]   only these skill ids
//     [--pretty]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--skills']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));

/** The MonoBehaviour script guid that marks an asset as a SkillConfig. Taken
 *  from a known-good SkillConfig rather than assumed. */
const SKILL_CONFIG_SCRIPT = 'eaf36c6c278fdd22161139bea71de573';

const EFFECT_SLOTS = ['EffectCast', 'EffectInstance', 'EffectComplete', 'EffectHit', 'EffectBolt'];

const scalar = (text, key) =>
  text.match(new RegExp(`^\\s*${key}: (.*)$`, 'm'))?.[1]?.trim() ?? null;
const guidOf = (text, key) =>
  text.match(new RegExp(`^\\s*${key}: \\{fileID: \\d+, guid: ([0-9a-f]{32})`, 'm'))?.[1] ?? null;

/** A Unity MinMaxCurve: `scalar` is the constant, and the curve arms carry the
 *  min/max when the value is randomised between two constants. */
function minMax(block, key) {
  const b = block.match(new RegExp(`${key}:\\n([\\s\\S]{0,700}?)(?=\\n    [a-zA-Z]|$)`))?.[1];
  if (!b) return null;
  const s = b.match(/scalar: (-?[\d.eE+-]+)/)?.[1];
  const minS = b.match(/minScalar: (-?[\d.eE+-]+)/)?.[1];
  const out = {};
  if (s !== undefined) out.value = Number(s);
  if (minS !== undefined && Number(minS) !== Number(s)) out.min = Number(minS);
  return Object.keys(out).length ? out : null;
}

/** Unity stores a colour as linear floats. Emitted as-is; conversion to the
 *  renderer's space is the renderer's business, not this script's. */
function colour(block, key) {
  const m = block.match(
    new RegExp(
      `${key}:[\\s\\S]{0,400}?maxColor: \\{r: (-?[\\d.eE+-]+), g: (-?[\\d.eE+-]+), b: (-?[\\d.eE+-]+), a: (-?[\\d.eE+-]+)\\}`,
    ),
  );
  return m
    ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])].map((n) => Math.round(n * 1e4) / 1e4)
    : null;
}

/** One module block out of a ParticleSystem body: from its key to the next
 *  top-level key at the same indent.
 *
 *  Module ORDER IS NOT FIXED. Slicing between two named modules assumes one
 *  comes before the other, and in these files ShapeModule precedes
 *  EmissionModule, so that slice runs backwards and silently yields nothing. */
function moduleBlock(body, name) {
  const start = body.indexOf(`  ${name}:`);
  if (start < 0) return '';
  const rest = body.slice(start + name.length + 3);
  const next = rest.search(/\n {2}[A-Za-z_]\w*:/);
  return rest.slice(0, next < 0 ? undefined : next);
}

/** Split a Unity YAML file into documents. */
function splitDocuments(text) {
  const heads = [];
  const re = /^--- !u!(\d+) &(\d+)/gm;
  let m = re.exec(text);
  while (m) {
    heads.push({ classId: Number(m[1]), at: m.index });
    m = re.exec(text);
  }
  return heads.map((h, i) => ({
    classId: h.classId,
    body: text.slice(h.at, heads[i + 1]?.at ?? text.length),
  }));
}

/** Every ParticleSystem (class 198) in an FX prefab, reduced to the parameters a
 *  web particle system can consume. */
export function readParticleSystems(prefabText) {
  const emitters = [];
  for (const doc of splitDocuments(prefabText)) {
    if (doc.classId !== 198) continue;
    const b = doc.body;
    const e = {
      duration: Number(scalar(b, 'lengthInSec') ?? 0),
      looping: scalar(b, 'looping') === '1',
      prewarm: scalar(b, 'prewarm') === '1',
      // 0 = local, 1 = world. Decides whether the effect trails behind a moving caster.
      simulationSpace: Number(scalar(b, 'moveWithTransform') ?? 0),
      gravity: minMax(b, 'gravityModifier'),
      startLifetime: minMax(b, 'startLifetime'),
      startSpeed: minMax(b, 'startSpeed'),
      startSize: minMax(b, 'startSize'),
      startRotation: minMax(b, 'startRotation'),
      startColor: colour(b, 'startColor'),
      maxParticles: Number(scalar(b, 'maxNumParticles') ?? 0),
    };
    // Emission: a steady rate plus optional bursts. The window has to reach the
    // whole module: rateOverTime alone is over 900 characters of curve boilerplate,
    // so a short window silently reports every effect as having no bursts, which
    // for a one-shot impact means an effect that emits nothing at all.
    const emission = moduleBlock(b, 'EmissionModule');
    e.rateOverTime = minMax(emission, 'rateOverTime')?.value ?? 0;
    const burstBlock = emission.slice(emission.indexOf('m_Bursts:'));
    const bursts = [];
    for (const chunk of burstBlock.split(/\n\s+- serializedVersion:/).slice(1)) {
      const time = chunk.match(/^\s*time: (-?[\d.eE+-]+)/m)?.[1];
      const count = chunk.match(/countCurve:[\s\S]{0,200}?scalar: (-?[\d.eE+-]+)/)?.[1];
      const countMin = chunk.match(/countCurve:[\s\S]{0,260}?minScalar: (-?[\d.eE+-]+)/)?.[1];
      const cycles = chunk.match(/cycleCount: (-?\d+)/)?.[1];
      if (count === undefined) continue;
      const burst = { time: Number(time ?? 0), count: Number(count) };
      if (countMin !== undefined && Number(countMin) !== Number(count))
        burst.countMax = Number(countMin);
      if (cycles && Number(cycles) !== 1) burst.cycles = Number(cycles);
      bursts.push(burst);
    }
    if (bursts.length) e.bursts = bursts;
    // Shape: which volume particles are born in.
    const shape = moduleBlock(b, 'ShapeModule');
    const shapeType = scalar(shape, 'type');
    if (shapeType !== null) {
      e.shape = { type: Number(shapeType) };
      const radius = shape.match(/radius:\n\s+value: (-?[\d.eE+-]+)/)?.[1];
      if (radius) e.shape.radius = Number(radius);
      const angle = scalar(shape, 'angle');
      if (angle) e.shape.angle = Number(angle);
    }
    for (const k of Object.keys(e)) if (e[k] === null) delete e[k];
    emitters.push(e);
  }
  return emitters;
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [assetsDir, guidMapPath, outPath] = positional;
  if (!assetsDir || !guidMapPath || !outPath) {
    console.log(
      'usage: node scripts/assets/unity_skill_fx.mjs <assetsDir> <guidMap.json> <out.json>',
    );
    process.exit(1);
  }
  const guidMap = JSON.parse(readFileSync(guidMapPath, 'utf8'));
  const only = flag('--skills')
    ?.split(',')
    .map((s) => s.trim());

  const monoDir = path.join(assetsDir, 'MonoBehaviour');
  const files = readdirSync(monoDir).filter((f) => f.endsWith('.asset'));

  const skills = [];
  let scanned = 0;
  for (const f of files) {
    const text = readFileSync(path.join(monoDir, f), 'utf8');
    // Filter by SCRIPT, never by filename: a trading card and a skill can share
    // a name, and the card would silently win.
    if (!text.includes(SKILL_CONFIG_SCRIPT)) continue;
    scanned++;
    const id = scalar(text, 'Id');
    if (!id) continue;
    if (only && !only.includes(id)) continue;

    const effects = {};
    for (const slot of EFFECT_SLOTS) {
      const guid = guidOf(text, slot);
      if (!guid) continue;
      const target = guidMap[guid];
      if (!target) {
        effects[slot] = { unresolved: guid };
        continue;
      }
      const prefabPath = path.join(assetsDir, target.path);
      const entry = { prefab: target.name };
      if (existsSync(prefabPath)) {
        try {
          entry.emitters = readParticleSystems(readFileSync(prefabPath, 'utf8'));
        } catch (err) {
          entry.error = String(err.message).slice(0, 120);
        }
      }
      effects[slot] = entry;
    }

    skills.push({
      id,
      displayName: scalar(text, 'DisplayName'),
      spriteId: scalar(text, 'SpriteId'),
      centerOnSelf: scalar(text, 'EffectCenterOnSelf') === '1',
      attached: scalar(text, 'EffectAttached') === '1',
      removeDelay: Number(scalar(text, 'EffectRemoveDelay') ?? 0),
      effects,
    });
  }

  skills.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(outPath, `${JSON.stringify(skills, null, argv.includes('--pretty') ? 2 : 0)}\n`);

  const withFx = skills.filter((s) => Object.keys(s.effects).length > 0).length;
  const emitters = skills.reduce(
    (n, s) => n + Object.values(s.effects).reduce((m, e) => m + (e.emitters?.length ?? 0), 0),
    0,
  );
  console.log(
    `unity_skill_fx: ${scanned} SkillConfigs scanned, ${skills.length} emitted, ` +
      `${withFx} with at least one effect, ${emitters} emitters total`,
  );
}
