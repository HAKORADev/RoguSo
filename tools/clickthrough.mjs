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
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
try { await page.waitForFunction(() => !document.body.classList.contains('inkhold'), { timeout: 90000 }); } catch {}
await page.waitForTimeout(800);
await page.mouse.click(200, 600); await page.waitForTimeout(500);
const box = await page.evaluate(() => { const b = document.querySelector('.t-main button[data-i="5"]'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
console.log('settings button center:', box);
await page.mouse.click(box.x, box.y);
for (let i = 0; i < 200; i++) { const s = await page.evaluate(() => window.__flow?.()); if (s === 'settings') break; await page.waitForTimeout(150); }
try { await page.waitForFunction(() => !document.body.classList.contains('inkhold'), { timeout: 90000 }); } catch {}
await page.waitForTimeout(900);
const hit = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  const path = [];
  let n = el;
  while (n && path.length < 5) { path.push(n.tagName + (n.className ? '.' + String(n.className).split(' ').join('.') : '')); n = n.parentElement; }
  return path;
}, [box.x, box.y]);
console.log('element at same point on settings:', hit);
await page.mouse.click(box.x, box.y); await page.waitForTimeout(400);
const after = await page.evaluate(() => ({
  pane: document.querySelector('.st-pane')?.dataset.pane,
  captureHidden: document.querySelector('.st-capture')?.hidden,
  armed: !!document.querySelector('.st-modify.on'),
  note: document.querySelector('.st-note')?.textContent,
}));
console.log('after real click at same point:', after);
await page.screenshot({ path: join(ROOT, 'tools/shots075/clickthrough.png'), timeout: 6000 }).catch(() => {});
await browser.close(); server.close();
