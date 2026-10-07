// RoguSo error harness: boots the real game in headless Chromium, drives every flow with real
// pointer/keyboard events, and collects every console error / page error / failed request.
// Usage: node tools/harness.mjs [--shot dir] [--legs name,name] 
// Exits 1 when any page error fired. Each leg runs on a fresh page (an old leg's render loop
// starves the next navigation under software GL).
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
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
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shot', null);
if (SHOTS && !existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
const problems = [];
const seen = new Set();
const note = (kind, msg) => {
  const key = kind + '|' + msg.slice(0, 220);
  if (seen.has(key)) return; seen.add(key);
  problems.push({ kind, msg });
  console.log(`  [${kind}] ${msg.split('\n')[0].slice(0, 300)}`);
};

let page = null, legShot = 0;
const freshPage = async () => {
  if (page) await page.close().catch(() => {});
  for (let i = 0; i < 2; i++) {
    try { page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); return; }
    catch { await browser.close().catch(() => {}); }
    // SwiftShader sometimes eats itself after many heavy pages: relaunch
    const nb = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
    Object.assign(browser, nb); // not reassignable (const): swap methods
    browser.newPage = nb.newPage.bind(nb); browser.close = nb.close.bind(nb);
  }
};
const newLeg = async (url = '/') => {
  await freshPage();
  page.on('console', (m) => { if (m.type() === 'error') note('console.error', m.text()); });
  page.on('pageerror', (e) => note('pageerror', e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
  page.on('requestfailed', (r) => note('requestfailed', `${r.url().split('/').slice(-2).join('/')} ${r.failure()?.errorText}`));
  await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1500);
};
const shot = async (name) => { if (SHOTS) { try { await page.screenshot({ path: join(SHOTS, `${++legShot}-${name}.png`), timeout: 6000 }); } catch { /* software GL: frames never settle */ } } };
const waitState = async (name, ms = 45000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => window.__flow?.() ?? 'unknown').catch(() => 'gone');
    if (s === name) return true;
    if (s === 'gone') throw new Error('page gone');
    await page.waitForTimeout(150);
  }
  return false;
};
const key = async (k, times = 1, gap = 120) => { for (let i = 0; i < times; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const click = async (sel) => { await page.locator(sel).first().click({ force: true, timeout: 6000 }).catch((e) => note('harness', `click ${sel}: ${e.message.split('\n')[0]}`)); await page.waitForTimeout(260); };
// software GL: the boot wipe uncovers at ~1-2 fps — wait it out before any click, and after clicks that run under it
const settle = async (ms = 90000) => {
  try { await page.waitForFunction(() => !document.body.classList.contains('inkhold'), { timeout: ms }); } catch { note('harness', 'ink never uncovered'); }
  try { await page.waitForFunction(() => !document.getElementById('ink').hidden, { timeout: 3000 }).catch(() => {}); } catch { }
  await page.waitForTimeout(600);
};
const vis = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? !!el.getClientRects().length : 'missing'; }, sel);

const pageErrs = () => problems.filter((p) => p.kind === 'pageerror').length;
const tour = [];

tour.push({ name: 'menus-to-battle', run: async () => {
  await newLeg('/');
  await waitState('title', 20000) || note('harness', 'never reached title');
  await settle();
  await page.mouse.click(200, 600); await page.waitForTimeout(400);   // wake (press any key)
  await click('.t-main button[data-i="0"]');            // Battle -> the battlemenu screen
  await waitState('battlemenu', 20000) || note('harness', 'battle menu never opened');
  await settle();
  await click('.rg-loc[data-loc="hulao"]');             // pick a field
  await click('.rg-go');                                 // March -> select
  await waitState('select', 20000) || note('harness', 'march never reached select');
  await settle();
  await key('ArrowDown', 7, 320);                       // cycle the roster (per-char data bugs surface here)
  await key('ArrowUp', 7, 320);
  await shot('select');
  await key('Enter');                                   // GO
  await waitState('loading', 30000) || note('harness', 'no loading card');
  await waitState('battle', 240000) || note('harness', 'never reached battle (the infinite-load class)');
  await page.waitForTimeout(2500); await shot('battle');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  await key('KeyJ', 6, 150); await key('KeyK', 2, 280);
  await key('Space'); await page.waitForTimeout(350);
  await key('KeyI'); await page.waitForTimeout(1100);
  await key('KeyL'); await page.waitForTimeout(350);
  await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.up();
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await page.mouse.down({ button: 'middle' }); await page.mouse.up({ button: 'middle' });
  await page.mouse.wheel(0, 120); await page.mouse.wheel(0, -120);
  await shot('fight');
}});

tour.push({ name: 'pause-resume-quit', run: async () => {
  await key('Escape'); await page.waitForTimeout(450); await shot('pause');
  await key('Enter'); await page.waitForTimeout(350);   // resume
  await key('Escape'); await page.waitForTimeout(450);
  await key('ArrowDown'); await key('Enter');           // quit -> arm
  await key('Enter'); await page.waitForTimeout(2500);  // confirm
  await waitState('title', 20000) || note('harness', 'pause-quit never reached title');
  await shot('title-again');
}});

tour.push({ name: 'settings-tour', run: async () => {
  await settle();
  await page.mouse.click(200, 600); await page.waitForTimeout(400);   // wake
  await click('.t-main button[data-i="5"]');            // Settings
  await waitState('settings', 30000) || note('harness', 'settings never opened');
  await settle(); await shot('settings');
  for (let t = 0; t < 5; t++) {                         // sweep every tab, wiggle every control class
    await key('ArrowRight', 1, 260);
    await key('Tab', 3, 150); await key('ArrowDown', 2, 130); await key('ArrowUp', 2, 130);
    await key('Enter', 1, 200); await key('ArrowLeft', 1, 110); await key('ArrowRight', 1, 110);
    await key('Escape', 1, 150);                        // back out of any sub-dialog this opened
    await shot(`settings-tab${t}`);
  }
  await key('Escape'); await page.waitForTimeout(700);
  await waitState('title', 8000) || note('harness', 'settings Esc never returned to title');
}});

tour.push({ name: 'rogue-boot', run: async () => {
  await newLeg('/?go=rogue&loc=hulao&enemies=40');
  await waitState('battle', 240000) || note('harness', 'rogue never reached battle');
  await page.waitForTimeout(2500);
  await key('KeyJ', 10, 140);
  await key('KeyZ', 1, 200); await key('KeyX', 1, 200);   // the bio row (defaults: nothing grown — must be a no-op)
  await page.waitForTimeout(1200);
  await shot('rogue-fight');
}});

tour.push({ name: 'train-boot', run: async () => {
  await newLeg('/?go=trainchar&loc=dingjun&enemies=0');
  await waitState('battle', 240000) || note('harness', 'train never reached battle');
  await page.waitForTimeout(1500);
  await key('KeyJ', 6, 140);
  await shot('train-fight');
}});

tour.push({ name: 'roster-free-boots', run: async () => {
  for (const c of ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'huangzhong', 'lubu']) {
    await newLeg(`/?go=free&char=${c}`);
    await waitState('battle', 60000) || note('harness', `free/${c} never reached battle`);
    await page.waitForTimeout(1000);
    await key('KeyJ', 5, 130);
    await shot(`free-${c}`);
    console.log(`  booted ${c}`);
  }
}});

tour.push({ name: 'story-prologue-path', run: async () => {
  // story with prologue: the one flow with its own screen (deploy -> prologue -> battle)
  await newLeg('/?go=story&char=zhaoyun');
  await waitState('battle', 90000) || note('harness', 'story boot never reached battle');
  await page.waitForTimeout(2000); await shot('story-battle');
}});

const ONLY = arg('legs', null);
for (const t of tour) {
  if (ONLY && !ONLY.split(',').includes(t.name)) continue;
  const before = pageErrs();
  console.log(`leg: ${t.name}`);
  try { await t.run(); } catch (e) { note('harness', `${t.name}: ${e.message.split('\n')[0]}`); }
  const fresh = pageErrs() - before;
  console.log(`  -> ${fresh === 0 ? 'clean' : fresh + ' NEW pageerror(s)'}`);
}

if (page) await page.close().catch(() => {});
await browser.close();
server.close();

console.log('\n==== HARNESS REPORT ====');
const pageErrors = problems.filter((p) => p.kind === 'pageerror');
for (const p of problems.filter((p) => p.kind !== 'pageerror')) console.log(`[${p.kind}] ${p.msg.split('\n')[0].slice(0, 260)}`);
for (const p of pageErrors) console.log(`[PAGEERROR] ${p.msg.split('\n').slice(0, 4).join(' | ').slice(0, 420)}`);
console.log(`pageerrors: ${pageErrors.length}, other notes: ${problems.length - pageErrors.length}`);
writeFileSync(join(ROOT, 'tools/harness-report.json'), JSON.stringify(problems, null, 2));
process.exit(pageErrors.length ? 1 : 0);
