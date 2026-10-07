// Stress the FREE battle (the owner's frozen-scene report): few enemies so the hero really kills, all buttons,
// musou at ready, dodge/jump spam — detect a frozen canvas by pixel-diff and surface any thrown error with its stack.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(pathToFileURL('/home/z/.npm-global/lib/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });   // small: SwiftShader fps up
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + (e.stack || '').split('\n').slice(1, 5).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });

await page.goto(base + '/?go=free&enemies=26', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const s = await page.evaluate(() => window.__flow?.()).catch(() => 'gone');
  if (s === 'battle') break;
  await page.waitForTimeout(400);
}
console.log('battle reached; fighting...');
await page.waitForTimeout(1500);

const frameAlive = async () => page.evaluate(() => new Promise((res) => {
  const c = document.getElementById('c');
  try {
    const g = c.getContext('2d') || null;   // WebGL canvas: readback needs preserveDrawingBuffer; use toDataURL length churn as a proxy
    const a = c.toDataURL('image/webp', 0.3).length;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const b = c.toDataURL('image/webp', 0.3).length;
      res({ changed: Math.abs(a - b) > 0, a, b });
    }));
  } catch (e) { res({ err: e.message }); }
}));

let frozenTicks = 0;
const acts = ['KeyJ', 'KeyJ', 'KeyK', 'Space', 'KeyL', 'KeyI', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyR'];
for (let i = 0; i < 220; i++) {
  const k = acts[i % acts.length];
  await page.keyboard.down(k); await page.waitForTimeout(90); await page.keyboard.up(k); await page.waitForTimeout(60);
  if (i % 20 === 19) {
    const f = await frameAlive();
    const kos = await page.evaluate(() => window.__flow?.() + '|kos:' + (document.querySelector('.h-ko b')?.textContent ?? '?'));
    if (f.changed === false) frozenTicks++;
    console.log(`i=${i + 1} ${kos} frame ${f.changed === false ? 'STATIC' : 'moving'}`);
  }
}
console.log('static frame checks:', frozenTicks, '/ 11');
console.log('--- errors (' + errors.length + ') ---');
[...new Set(errors)].forEach((e) => console.log(e.slice(0, 500)));
await browser.close(); server.close(); process.exit(0);
