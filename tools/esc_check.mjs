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
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const state = () => page.evaluate(() => window.__flow?.() ?? 'unknown');
const settle = async (ms = 120000) => { try { await page.waitForFunction(() => !document.body.classList.contains('inkhold'), { timeout: ms }); } catch {} await page.waitForTimeout(1200); };
const waitFlow = async (name, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await state()) === name) return true; await page.waitForTimeout(300); } return false; };
const click = async (sel) => { await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel); await page.waitForTimeout(400); };

await settle();
for (const [item, screen] of [['5', 'settings'], ['0', 'battlemenu'], ['1', 'fighters'], ['2', 'train']]) {
  try {
    await click(`.t-main button[data-i="${item}"]`);
    const ok1 = await waitFlow(screen, 90000);
    await settle();
    await page.keyboard.press('Escape');
    const ok2 = await waitFlow('title', 90000);
    console.log(`${screen}: opened=${ok1} esc-back=${ok2}`);
    await settle();
  } catch (e) { console.log(`${screen}: crashed (${String(e).split('\n')[0].slice(0, 60)})`); break; }
}
console.log('pageerrors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
