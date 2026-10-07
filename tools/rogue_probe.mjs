// Rogue-mode validation: boot ?go=rogue (dev shortcut), reach battle, fight, verify the director runs
// (waves, banners, coins), no page errors, canvas alive.
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
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.split('\n').slice(0, 4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });

const url = process.argv[2] || '/?go=rogue&loc=hulao&enemies=40';
await page.goto(base + url, { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
let ok = false;
while (Date.now() - t0 < 240000) {
  const s = await page.evaluate(() => window.__flow?.()).catch(() => 'gone');
  if (s === 'battle') { ok = true; break; }
  await page.waitForTimeout(600);
}
console.log('battle reached:', ok, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
if (ok) {
  await page.waitForTimeout(2000);
  const acts = ['KeyJ', 'KeyJ', 'KeyK', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyI', 'KeyZ', 'KeyX', 'KeyC'];
  for (let i = 0; i < 100; i++) {
    const k = acts[i % acts.length];
    await page.keyboard.down(k); await page.waitForTimeout(80); await page.keyboard.up(k); await page.waitForTimeout(50);
    if (i % 25 === 24) {
      const st = await page.evaluate(() => ({
        kos: document.querySelector('.h-ko b')?.textContent,
        obj: document.querySelector('.h-obj b')?.textContent,
        banner: document.querySelector('.h-band p')?.textContent?.slice(0, 40),
      })).catch(() => ({}));
      console.log(`i=${i + 1}`, JSON.stringify(st));
    }
  }
}
console.log('--- errors (' + errors.length + ') ---');
[...new Set(errors)].forEach((e) => console.log(e.slice(0, 400)));
await browser.close(); server.close(); process.exit(0);
