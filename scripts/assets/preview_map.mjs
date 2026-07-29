// Render a baked map to a PNG, so a human can look at it.
//
// Everything upstream of this is numbers: placement counts, triangle budgets,
// substitution rates. None of that answers "does it look right", and the two
// questions it cannot answer at all are whether the import came in MIRRORED and
// whether a variety reduction left the place looking thin. This renders the real
// baked chunks with a labelled axis gizmo (blue +Z, red +X) so both are visible.
//
// USAGE
//   node scripts/assets/preview_map.mjs <chunkDir> <map> <out.png>
//     [--pitch <deg>] [--yaw <deg>] [--size <w>x<h>] [--wireframe]
//     [--max-chunks <n>]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { BROWSER_PATH } from '../browser_path.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const VALUED = new Set(['--pitch', '--yaw', '--size', '--max-chunks', '--terrain']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const [chunkDir, mapName, outPath] = positional;
if (!chunkDir || !mapName || !outPath) {
  console.log(
    'usage: node scripts/assets/preview_map.mjs <chunkDir> <map> <out.png> [--pitch d] [--yaw d]',
  );
  process.exit(1);
}

const [w, h] = (flag('--size', '1280x800') ?? '1280x800').split('x').map(Number);
const maxChunks = Number(flag('--max-chunks', '0'));

const mapDir = path.join(chunkDir, mapName);
const index = JSON.parse(readFileSync(path.join(mapDir, 'chunks.json'), 'utf8'));
let chunks = index.chunks;
if (maxChunks > 0) {
  // Biggest first, so a capped preview shows the dense part rather than an
  // arbitrary corner.
  chunks = [...chunks].sort((a, b) => b.tris - a.tris).slice(0, maxChunks);
}

const payload = chunks.map((c) => ({
  origin: c.origin,
  glb: readFileSync(path.join(mapDir, `${c.chunk}.glb`)).toString('base64'),
}));

// The ground is baked separately (it is a Unity heightfield, not a mesh), so it
// has to be composed in here or every prop appears to float.
const terrainFile = flag('--terrain');
const terrain = terrainFile ? readFileSync(terrainFile).toString('base64') : null;

const bundle = await esbuild.build({
  entryPoints: [new URL('preview_map_entry.js', import.meta.url).pathname.replace(/^\//, '')],
  bundle: true,
  format: 'iife',
  write: false,
  logLevel: 'silent',
});

const puppeteer = await import('puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--no-sandbox', '--enable-webgl'],
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h });
await page.setContent('<!doctype html><meta charset=utf-8><body style="margin:0"></body>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });
await page.waitForFunction('globalThis.__ready === true', { timeout: 60_000 });

const result = await page.evaluate((args) => globalThis.__renderMap(args), {
  chunks: payload,
  terrain,
  width: w,
  height: h,
  pitch: Number(flag('--pitch', '38')),
  yaw: Number(flag('--yaw', '35')),
  wireframe: argv.includes('--wireframe'),
});

await browser.close();

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(result.png.split(',')[1], 'base64'));
console.log(
  `preview_map: ${mapName} -> ${outPath}  (${chunks.length} chunks, ` +
    `${result.tris.toLocaleString('en-US')} tris, ${result.draws} meshes, ` +
    `${result.size.join(' x ')} m)`,
);
