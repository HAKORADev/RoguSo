// Minimal boot probe: does the game reach title/battle under headless SwiftShader, and what errors fire?
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.split('\n').slice(0, 3).join(' | ').slice(0, 400)));
page.on('requestfailed', (r) => errs.push('reqfail: ' + r.url().split('/').slice(-1)[0]));

const url = process.argv[2] || '/';
await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 20000 });
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => ({ flow: window.__flow?.(), title: document.title, h1: document.querySelector('.scr:not([hidden])')?.id || document.querySelector('#menu:not([hidden])') ? 'menu' : '-' })).catch((e) => ({ flow: 'evalfail: ' + e.message.slice(0, 80) }));
  console.log(`t=${(i + 1) * 5}s  ${JSON.stringify(s)}`);
  if (s.flow === 'battle' && i >= 2) break;
}
console.log('--- errors ---');
errs.forEach((e) => console.log(e));
console.log(`total: ${errs.length}`);
await browser.close(); server.close();
