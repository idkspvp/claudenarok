// Batch-convert a folder of static Synty prop/building FBX into web GLB.
//
// This is the STATIC sibling of scripts/combine_fbx_to_glb.mjs, which does
// rigged characters. Same proven core (three.js FBXLoader inside headless
// Chrome, so FBX parsing is done by a real engine rather than by a standalone
// Node converter), different job: no skeleton, no clips, hundreds of files at a
// time, and a hard per-prop triangle budget.
//
// USAGE
//   node scripts/assets/synty_to_glb.mjs <inputDir> <outDir> [options]
//
// OPTIONS
//   --include <re>    only convert FBX whose path matches this regex
//   --exclude <re>    skip FBX whose path matches this regex
//   --max-tris <n>    warn (and with --strict, fail) above n triangles per prop
//   --limit <n>       convert at most n files (a dry run on a big pack)
//   --strict          exit non-zero on any budget breach
//   --no-meshopt      skip meshopt compression (debugging only)
//   -h, --help
//
// It writes <outDir>/<name>.glb plus a manifest.json recording every prop's
// triangle count and byte size, which is what the budget report reads.
//
// LICENSING: this converts assets you must already hold a licence for. Synty
// Unity Asset Store licences are granted to the purchasing account and are not
// transferable, so run this against YOUR OWN pack download, not against a copy
// extracted from someone else's game build. CREDITS.md records what this
// project ships and under which licence.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions';
import * as esbuild from 'esbuild';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { BROWSER_PATH } from '../browser_path.mjs';

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help') || argv.length < 2) {
  console.log(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n// USAGE')[1]
      ?.slice(0, 900),
  );
  process.exit(argv.length < 2 ? 1 : 0);
}

const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);

const [inputDir, outDir] = argv.filter(
  (a) =>
    !a.startsWith('--') &&
    argv[argv.indexOf(a) - 1] !== '--include' &&
    argv[argv.indexOf(a) - 1] !== '--exclude' &&
    argv[argv.indexOf(a) - 1] !== '--max-tris' &&
    argv[argv.indexOf(a) - 1] !== '--limit',
);
const include = flag('--include');
const exclude = flag('--exclude');
const maxTris = Number(flag('--max-tris', '20000'));
const limit = Number(flag('--limit', '0'));
const strict = has('--strict');
const force = has('--force');
const compress = !has('--no-meshopt');

/** Every .fbx under `dir`, sorted so a run is reproducible. */
function findFbx(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith('.fbx')) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

let files = findFbx(inputDir);
// Editor-only source files. Pruning their NODES leaves a valid but empty GLB,
// so they are dropped before conversion rather than after.
const EDITOR_ONLY = /_collision|_lod[1-9]|collider/i;
files = files.filter((f) => !EDITOR_ONLY.test(path.basename(f)));
if (include) files = files.filter((f) => new RegExp(include, 'i').test(f));
if (exclude) files = files.filter((f) => !new RegExp(exclude, 'i').test(f));
if (limit > 0) files = files.slice(0, limit);

if (!files.length) {
  console.error(`no .fbx matched under ${inputDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// Bundle the browser half exactly the way combine_fbx_to_glb.mjs does.
const bundle = await esbuild.build({
  entryPoints: [new URL('synty_props_entry.js', import.meta.url).pathname.replace(/^\//, '')],
  bundle: true,
  format: 'iife',
  write: false,
  logLevel: 'silent',
});
const entryJs = bundle.outputFiles[0].text;

const puppeteer = await import('puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--no-sandbox'],
});

const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset=utf-8><body></body>');
await page.addScriptTag({ content: entryJs });
await page.waitForFunction('globalThis.__ready === true', { timeout: 60_000 });

// One IO for the whole batch. Geometry only: these props carry no embedded
// texture (they share a pack atlas the renderer binds), so there is nothing for
// a texture-compress pass to do.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const manifest = [];
let breaches = 0;
let converted = 0;
let skipped = 0;

for (const file of files) {
  const name = path
    .basename(file, path.extname(file))
    .replace(/^SM_/, '')
    .replace(/[^A-Za-z0-9_-]/g, '_');
  const outPath = path.join(outDir, `${name}.glb`);
  if (!force && existsSync(outPath) && statSync(outPath).mtimeMs >= statSync(file).mtimeMs) {
    manifest.push({
      name,
      tris: null,
      bytes: statSync(outPath).size,
      source: path.relative(inputDir, file),
      reused: true,
    });
    skipped++;
    continue;
  }
  const b64 = readFileSync(file).toString('base64');
  let result;
  try {
    result = await page.evaluate((data) => globalThis.__convertProp(data), b64);
  } catch (err) {
    console.error(`  FAIL ${name}: ${String(err).slice(0, 160)}`);
    continue;
  }

  const raw = Buffer.from(result.glb, 'base64');
  const outFile = outPath;
  writeFileSync(outFile, raw);

  if (compress) {
    try {
      const doc = await io.read(outFile);
      await doc.transform(
        resample(),
        prune(),
        dedup(),
        meshopt({ encoder: MeshoptEncoder, level: 'high' }),
      );
      await io.write(outFile, doc);
    } catch (err) {
      console.error(`  optimize failed for ${name}: ${String(err).slice(0, 120)}`);
    }
  }

  const bytes = statSync(outFile).size;
  const tris = Math.round(result.tris);
  if (tris > maxTris) {
    breaches++;
    console.error(`  OVER BUDGET ${name}: ${tris} tris (max ${maxTris})`);
  }
  manifest.push({ name, tris, bytes, source: path.relative(inputDir, file) });
  converted++;
  if ((converted + skipped) % 50 === 0) console.log(`  ${converted + skipped}/${files.length}`);
}

await browser.close();

manifest.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const totalBytes = manifest.reduce((n, m) => n + m.bytes, 0);
const totalTris = manifest.reduce((n, m) => n + m.tris, 0);
const mib = (b) => (b / 1024 / 1024).toFixed(2);
console.log(
  `\nsynty_to_glb: ${manifest.length} props (${converted} built, ${skipped} reused) -> ${mib(totalBytes)} MiB, ` +
    `${totalTris.toLocaleString('en-US')} tris total, ` +
    `median ${manifest.length ? manifest.map((m) => m.bytes).sort((a, b) => a - b)[Math.floor(manifest.length / 2)] : 0} bytes`,
);
if (breaches) console.error(`${breaches} prop(s) over the ${maxTris}-triangle budget`);
process.exit(strict && breaches ? 1 : 0);
