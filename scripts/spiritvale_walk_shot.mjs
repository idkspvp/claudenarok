// Smoke the SpiritVale walkthrough in a real browser, and screenshot it.
//
// The offline pipeline can prove a great deal about a baked map and still not
// answer whether it loads and stands up in a browser. This drives the real dev
// page, asserts what actually got built, walks the camera to a few points to
// confirm the ground is under it, and writes a PNG.
//
// Needs `npm run dev` on :5173 and a map staged into public/spiritvale by
// scripts/assets/stage_spiritvale_map.mjs.
//
// USAGE
//   node scripts/spiritvale_walk_shot.mjs [--map <name>] [--out <png>]
//     [--size <w>x<h>] [--url <base>]

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BROWSER_PATH } from './browser_path.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const map = flag('--map', 'Sunny_Meadows_1');
const outPath = flag('--out', `tmp/preview/${map}_walk.png`);
const [w, h] = (flag('--size', '1280x720') ?? '1280x720').split('x').map(Number);
const base = flag('--url', 'http://localhost:5173');

let fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`);
  if (!ok) fail++;
};

const puppeteer = await import('puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--no-sandbox', '--enable-webgl'],
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`${base}/spiritvale_walk.html?map=${encodeURIComponent(map)}`, {
  waitUntil: 'domcontentloaded',
});
// The page exposes __spiritvale once the whole map is built, which is the only
// honest "ready" signal: the canvas exists long before the assets land.
await page.waitForFunction('globalThis.__spiritvale !== undefined', { timeout: 120_000 });

const built = await page.evaluate(() => {
  const s = globalThis.__spiritvale;
  return {
    map: s.map,
    batches: s.built.drawCalls,
    instances: s.built.instances,
    triangles: s.built.triangles,
    missing: s.built.missing,
    hasTerrain: Boolean(s.built.terrain),
  };
});

console.log(`spiritvale_walk_shot: ${built.map}`);
check('map built', built.batches > 0, `${built.batches} batches, ${built.instances} instances`);
check('nothing failed to load', built.missing.length === 0, built.missing.slice(0, 4).join(', '));
check('terrain present', built.hasTerrain);
check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

// Walk a few points and confirm the camera sits exactly one eye height above the
// ground at each: that is what "you can stand on it" means, and it is the check
// a flat or missing terrain fails.
const walk = await page.evaluate(() => {
  const s = globalThis.__spiritvale;
  const pts = [];
  for (const [x, z] of [
    [60, 60],
    [120, 120],
    [200, 100],
    [100, 220],
    [250, 250],
  ]) {
    const p = s.teleport(x, z);
    const g = s.groundAt(x, z);
    const r = s.render();
    pts.push({ x, z, eye: p[1], ground: g, calls: r.calls, tris: r.triangles });
  }
  return pts;
});
const offsets = walk.filter((p) => p.ground !== null).map((p) => p.eye - p.ground);
const spread = offsets.length ? Math.max(...offsets) - Math.min(...offsets) : Number.NaN;
check(
  'camera stands on the ground everywhere',
  offsets.length > 0 && spread < 1e-3,
  `eye - ground spread ${spread.toExponential(1)}`,
);
const relief = walk.filter((p) => p.ground !== null).map((p) => p.ground);
check(
  'terrain actually has relief',
  relief.length > 1 && Math.max(...relief) - Math.min(...relief) > 1,
  `${Math.min(...relief).toFixed(1)} to ${Math.max(...relief).toFixed(1)} m`,
);
const worstCalls = Math.max(...walk.map((p) => p.calls));
check('draw calls stay under 150 while walking', worstCalls < 150, `worst ${worstCalls}`);

// Two captures: an overview that shows whether the world holds together, and
// an eye-level one, which is the view the whole exercise is for.
const eyeUrl = await page.evaluate(() => {
  const s = globalThis.__spiritvale;
  s.teleport(150, 210);
  const cam = s.camera;
  cam.fov = 70;
  cam.rotation.set(-0.02, 3.6, 0, 'YXZ');
  cam.updateProjectionMatrix();
  s.render();
  return s.renderer.domElement.toDataURL('image/png');
});

const dataUrl = await page.evaluate(() => {
  const s = globalThis.__spiritvale;
  // An overview that frames the whole map, which is what shows whether the
  // world holds together; a ground-level shot mostly shows the nearest hill.
  // The walk fog ends at 420 m and an overview camera sits further out than
  // that, so without this the whole frame is sky.
  s.scene.fog = null;
  const cam = s.camera;
  cam.fov = 38;
  const pitch = (24 * Math.PI) / 180;
  const yaw = (40 * Math.PI) / 180;
  const dist = (190 / Math.tan((cam.fov * 0.5 * Math.PI) / 180)) * 1.15;
  cam.position.set(
    150 + Math.sin(yaw) * Math.cos(pitch) * dist,
    25 + Math.sin(pitch) * dist,
    150 + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  cam.lookAt(150, 25, 150);
  cam.updateProjectionMatrix();
  s.render();
  return s.renderer.domElement.toDataURL('image/png');
});
await browser.close();

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
const eyePath = outPath.replace(/.png$/, '_eye.png');
writeFileSync(eyePath, Buffer.from(eyeUrl.split(',')[1], 'base64'));
console.log(`  wrote ${outPath} and ${eyePath}`);
console.log(
  `  ${built.triangles.toLocaleString('en-US')} tris in the map, worst walked frame ${Math.max(...walk.map((p) => p.tris)).toLocaleString('en-US')}`,
);
process.exit(fail > 0 ? 1 : 0);
