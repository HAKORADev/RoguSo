// v0.7.5 probe: the settings-open bug (controls pane / capture dialog on open?) + Esc-back on every menu screen
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  } catch { res.writeHead(500); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(pathToFileURL('/home/z/.npm-global/lib/node_modules/playwright/index.mjs'));
mkdirSync(join(ROOT, 'tools/shots075'), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300)));
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForTimeout(1500);

const state = () => page.evaluate(() => window.__flow?.() ?? 'unknown').catch(() => 'gone');
const settle = async (ms = 90000) => {
  try { await page.waitForFunction(() => !document.body.classList.contains('inkhold'), { timeout: ms }); } catch { console.log('  ink never uncovered'); }
  await page.waitForTimeout(600);
};
const dump = async (tag) => {
  const s = await state();
  const d = await page.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const cap = q('.st-capture'), modal = q('.st-modal'), pane = q('.st-pane');
    return {
      state: window.__flow?.(),
      pane: pane ? pane.dataset.pane : null,
      captureHidden: cap ? cap.hidden : null,
      modalHidden: modal ? modal.hidden : null,
      modifyArmed: !!q('.st-modify.on'),
      settingsVisible: (() => { const el = q('#settings'); return el ? !el.hidden : null; })(),
    };
  }).catch((e) => ({ err: String(e).slice(0, 120) }));
  console.log(`  [${tag}] flow=${d.state} pane=${d.pane} captureHidden=${d.captureHidden} modalHidden=${d.modalHidden} modifyArmed=${d.modifyArmed} settingsVisible=${d.settingsVisible}`);
  return d;
};
const click = async (sel) => { await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel); await page.waitForTimeout(260); };
const shot = (n) => page.screenshot({ path: join(ROOT, 'tools/shots075', n + '.png'), timeout: 6000 }).catch(() => {});

await settle();
await page.mouse.click(200, 600); await page.waitForTimeout(400);
await click('.t-main button[data-i="5"]');
const reached = await (async () => { for (let i = 0; i < 200; i++) { if ((await state()) === 'settings') return true; await page.waitForTimeout(150); } return false; })();
console.log('settings reached:', reached);
await settle();
await dump('settings-open');
await shot('settings-open');
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
await dump('after-esc');
await shot('settings-after-esc');

await click('.t-main button[data-i="0"]');
for (let i = 0; i < 200; i++) { if ((await state()) === 'battlemenu') break; await page.waitForTimeout(150); }
await settle();
await dump('battlemenu-open');
await shot('battlemenu-open');
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
await dump('battlemenu-after-esc');

await click('.t-main button[data-i="1"]');
for (let i = 0; i < 200; i++) { if ((await state()) === 'fighters') break; await page.waitForTimeout(150); }
await settle();
await shot('fighters-open');
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
await dump('fighters-after-esc');

console.log('---- page errors ----');
for (const e of errs) console.log(' ', e);
await browser.close(); server.close();
