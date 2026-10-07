// New-screens sweep: Battle menu, Fighters (buy + upgrade rows render), Train, Arena (bio-lab rows render).
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
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.split('\n').slice(0, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 250)); });

await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const s = await page.evaluate(() => window.__flow?.()).catch(() => 'gone');
  if (s === 'title') break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(2000);
await page.mouse.click(200, 600); await page.waitForTimeout(400);   // wake

const openScreen = async (idx, name) => {
  await page.click(`.t-main button[data-i="${idx}"]`, { force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({ flow: window.__flow?.(), rows: document.querySelectorAll('.rg-urow, .rg-loc, .rg-char').length }));
  console.log(`${name}: flow=${st.flow} rows=${st.rows}`);
  return st;
};
const back = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(900); };

await openScreen(0, 'Battle menu');
await back();
await openScreen(1, 'Fighters');
await page.click('.rg-char[data-id="liubei"]', { force: true }).catch(() => {});
await page.waitForTimeout(500);
const upg = await page.evaluate(() => document.querySelectorAll('.rg-urow').length);
console.log('Fighters upgrade rows after focus:', upg);
await back();
await openScreen(2, 'Train');
await back();
await openScreen(4, 'Arena');
const strips = await page.evaluate(() => document.querySelectorAll('.rg-strip').length);
console.log('Arena strip buttons:', strips);
await back();

console.log('--- errors (' + errors.length + ') ---');
[...new Set(errors)].forEach((e) => console.log(e.slice(0, 300)));
await browser.close(); server.close(); process.exit(errors.length ? 1 : 0);
