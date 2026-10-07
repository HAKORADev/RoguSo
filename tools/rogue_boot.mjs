import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { chromium } = await import(pathToFileURL('/home/z/.npm-global/lib/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 180)); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 250)));
await page.goto(`http://127.0.0.1:${server.address().port}/?go=rogue&loc=hulao&enemies=40`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForTimeout(2000);
const state = () => page.evaluate(() => window.__flow?.() ?? 'unknown').catch(() => 'gone');
const t0 = Date.now();
while (Date.now() - t0 < 200000 && (await state()) !== 'battle') await page.waitForTimeout(500);
console.log('battle reached:', (await state()) === 'battle');
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(200); }
await page.keyboard.press('KeyO'); await page.waitForTimeout(400);
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
console.log('state after Esc+Esc:', await state());
console.log('---- errors ----');
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'none');
await browser.close(); server.close();
