// Reproduce the result-screen ESC hang: trial boot -> force a win -> result -> ESC -> probe the title's responsiveness.
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
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n').slice(0, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });

await page.goto(base + '/?go=trial&enemies=20', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
while (Date.now() - t0 < 180000) {
  const s = await page.evaluate(() => window.__flow?.()).catch(() => 'gone');
  if (s === 'battle') break;
  await page.waitForTimeout(400);
}
console.log('battle reached');
await page.waitForTimeout(2500);

// force the story end (win) — the exact event the result screen listens for
const emitted = await page.evaluate(async () => {
  try {
    const { emit } = await import('/src/core/events.js');
    emit('story:end', { win: true, stats: { kos: 42, time: 133, hpMax: 480, maxChain: 311, dmg: 230 }, reason: null });
    return 'emitted';
  } catch (e) { return 'import fail: ' + e.message; }
});
console.log('story:end ->', emitted);
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1000);
  console.log(i + 's', await page.evaluate(() => JSON.stringify({ flow: window.__flow?.(), ink: window.__ink?.() })));
  if (await page.evaluate(() => window.__flow?.()) === 'result') break;
}

// press ESC like the owner did
await page.keyboard.press('Escape');
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(1000);
  const fl = await page.evaluate(() => window.__flow?.());
  if (fl === 'title') { console.log(`title reached after ${i + 1}s`); break; }
  if (i === 23) console.log('flow after ESC:', fl);
}
const idx = () => page.evaluate(() => [...document.querySelectorAll('.t-main button')].findIndex((b) => b.classList.contains('on')));
const before = await idx().catch(() => 'no-title');
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(600);
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(600);
const after = await idx().catch(() => 'no-title');
console.log('title focus moved?', before, '->', after);
await page.waitForTimeout(1500);
console.log('flow final:', await page.evaluate(() => window.__flow?.()));

await browser.close(); server.close(); process.exit(0);
