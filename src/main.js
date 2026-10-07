// Boot, flow and the fixed 60 Hz loop. Sim modules (hero, combat, crowd, actors, pickups, musou, story, camera control yaw) advance only
// in step(); render-side modules read sim state in render() and never write it.
// Flow: title → select → loading → (story: prologue →) battle → (story / trial: result →) title. Each non-battle state is a DOM screen (index.html
// #title #select #loading #prologue #result, modules below: createX(el, flow) → { enter(ctx), exit(), view? }; view(scene, camera,
// focus, dt) = optional render-only camera/stage hook run after the gameplay rig while that screen is up); the sim only steps in
// 'battle' and not paused (Esc: pause menu #menu). startBattle() resets the sim for a character / mode / chapter.
// ctx through the flow: title → select { mode, ch, map } (mode 'story': ch = the chapter, story/chapters.js; 'trial':
// ch = the trial, story/trials.js; 'free': ch = the battlefield's chapter, map = its field) → loading / prologue / battle
// { mode, ch, map, char, art?, retry? } → result (+ win, stats, reason?, diff, rec?) → title (+ mode, ch after a win:
// the chapter / trial panel opens there). rec = core/progress.js record()'s result for the win.
// flow.go() returns a promise that settles once the new state's materials are compiled and two frames have presented
// (menu.js inkWipe holds the ink until then; the page boots under it, inkBoot). Every screen change but prologue →
// battle (its own fade onto the live field) goes through the ink wipe; the HUD slides in on each battle entry (#hud.in).
// 'loading' (after Deploy, or Retry on the result) runs deploy(): once the card is fully uncovered, startBattle for the chosen
// officer (flow.go('battle') then keeps it: no second reset under a visible field), compile, warm frames
// (the bar tracks those real stages), a minimum dwell, then ink on into the prologue / battle — the officer on the field
// is the chosen one before anything of the field is seen again, and his kit's first draws never stall on screen.
// Select → loading also snaps the select stage's key-art frame of the officer (snapArt) for the loading card and result.
// Maps: startBattle loads the battle's map (world.load: in-page, under the loading card / ink); the title and select
// always stand on HOME (flow.go('title') swaps back under the ink and clears the last battle's soldiers).
// Dev shortcut: ?go=free|story|trial[&char=id][&ch=chapter / trial id][&map=map id] skips the screens straight into a
// battle (story without &ch: the first chapter that lists the officer).
import * as THREE from 'three';
import { vrng, rng } from './core/rng.js';
import { emit, on, collect } from './core/events.js';
import { createInput } from './core/input.js';
import { createPost } from './post/post.js';
import { createWorld } from './world/world.js';
import { createHero, createHeroView } from './hero/hero.js';
import { createCrowd } from './crowd/crowd.js';
import { createCrowdView } from './crowd/view.js';
import { armyPair, FREE_ARMY } from './crowd/armies.js';
import { createCombat } from './combat/combat.js';
import { createActors } from './actors/actors.js';
import { createActorsView } from './actors/view.js';
import { createPickups, createPickupsView } from './actors/pickups.js';
import { createCamSim, createCameraRig } from './camera/camera.js';
import { createVfx } from './vfx/vfx.js';
import { createHud } from './ui/hud.js';
import { createAudio } from './audio/audio.js';
import { CHARS } from './chars/index.js';
import { spawnPoint, MAP } from './world/map.js';
import { HOME } from './world/maps/index.js';
import { createStory } from './story/index.js';
import { CHAPTERS, chapter } from './story/chapters.js';
import { createRogue } from './rogue/director.js';
import { location as locById, ROGUE_MODES } from './rogue/locations.js';
import * as economy from './core/economy.js';
import { reloadEconomy } from './core/economy.js';
import { createTitle } from './ui/title.js';
import { createSelect } from './ui/select.js';
import { createLoading } from './ui/loading.js';
import { inkWipe, inkBoot, wiping, afterWipe, createNav, sfx, replay } from './ui/menu.js';
import { createPrologue } from './story/prologue.js';
import { createResult } from './story/result.js';
import { difficulty } from './core/difficulty.js';
import { record } from './core/progress.js';
import * as storage from './core/storage.js';
import { applyBindings, bindingsTemplate, bindings, labelSlot, ACTIONS } from './core/input.js';
import { read, write } from './core/storage.js';
import { createSettings } from './ui/settings.js';
import { createBattle, createFighters, createTrain } from './ui/rogue.js';
import { createScheduler } from './core/scheduler.js';
import { updateDayNight } from './world/daynight.js';
import { reload as reloadSettings } from './core/settings.js';
import { reloadDifficulty } from './core/difficulty.js';
import './ui/cursor3d.js';
import { fitSoon } from './ui/fittext.js';

// data before anything reads it: records, settings (difficulty + the option tabs), key bindings, the roguelike wallet —
// Documents/RoguSo through the shell bridge, localStorage in a plain browser. Settings and the difficulty pick re-read
// after the bridge answers (their modules pre-load from the localStorage mirror alone).
await storage.init();
reloadSettings();
reloadDifficulty();
reloadEconomy();
if (!read('controls.json') || read('controls.json').v !== 2) write('controls.json', bindingsTemplate());
applyBindings(read('controls.json'));

// the cursor: the voxel golden-fire arrowhead (ui/cursor3d.js) steers with the hand and grays out on hold; the system
// cursor is banned everywhere while it is on, and Display → Custom cursor turns the whole thing off

const params = new URLSearchParams(location.search);
const ENEMIES = Math.max(0, Math.min(2000, params.get('enemies') ? Number(params.get('enemies')) | 0 : 300));

const canvas = document.getElementById('c');
let vw = innerWidth, vh = innerHeight;

const post = createPost({ canvas, width: vw, height: vh });
const scene = new THREE.Scene();
const world = createWorld(scene, post);          // loads HOME

// ---- sim
// mode: 'free' | 'story' | 'trial' (set by startBattle); the hero's character / kit: game.hero.char / game.hero.kit; army: the
// battle's { foe, ally } (crowd/armies.js, set by startBattle before any view rebuild)
const game = { frame: 0, hitstop: 0, freeze: 0, mode: 'free', diff: difficulty(), army: armyPair(FREE_ARMY) };   // diff: core/difficulty.js, fixed per battle
game.cam = createCamSim();
game.hero = createHero(game);
game.crowd = createCrowd(game, ENEMIES);
game.combat = createCombat(game);
game.actors = createActors(game);                 // hero-model NPCs: the boss, allied officers (src/actors, CONTRACTS C5)
game.pickups = createPickups(game);               // the roguelike's coins (the only drop: no healing anywhere)
game.musou = game.hero.kit.createMusou(game);     // the character's Musou (rebuilt with the kit in startBattle)
game.story = createStory(game);
game.rogue = createRogue(game);                   // the roguelike run director (rogue modes only; story owns the rest)
const input = createInput();

// ---- render side
let crowdView = createCrowdView(scene, game);          // rebuilt when the battle's army pair changes (startBattle)
const camRig = createCameraRig(game, vw, vh);
const vfx = createVfx(scene, game, world);
// actor models are built on spawn and shown once compiled (post.compile: parallel, no stall mid-battle)
const actorsView = createActorsView(scene, game, () => post.compile(scene, camRig.camera));
const pickupsView = createPickupsView(scene, game);
// kit views (hero model + chains + ghosts, Musou grade/dragon/cut-in): rebuilt when the character's kit changes
let heroView, musouView, dropViews = null;
function buildViews() {
  if (dropViews) { dropViews(); heroView.dispose(); musouView.dispose(); }
  [[heroView, musouView], dropViews] = collect(() => [createHeroView(scene, game.hero), game.hero.kit.createMusouView(scene, game, camRig.camera)]);
}
buildViews();
// hud part: camera passed so officer name/HP tags can be projected over their heads (read-only)
const hud = createHud(document.getElementById('hud'), game, camRig.camera);
createAudio(game);

// sim frame: a throw inside one module must never kill the loop (a dead step() freezes the whole field while DOM
// menus keep working — the worst class of bug to debug through a shell with no devtools). The offending module is
// skipped for that frame and the error surfaces on screen (errorToast) and in the console.
function step() {
  const inp = input.sample();
  const parts = [
    ['cam', () => game.cam.step(game, inp)], ['hero', () => game.hero.step(inp)], ['combat', () => game.combat.step()],
    ['crowd', () => game.crowd.step()], ['actors', () => { game.actors.step(); game.pickups.step(); }],
    ['musou', () => game.musou.step()],
    ['director', () => (ROGUE_MODES.has(game.mode) ? game.rogue.step() : game.story.step())],
  ];
  for (const [name, run] of parts) {
    try { run(); } catch (err) { simFault(name, err); }
  }
  game.frame++;
  try { vfx.afterStep(); } catch (err) { simFault('vfx', err); }
}

// the roguelike run modes: ROGUE_MODES (rogue/locations.js) — startBattle / the director / the result branch on them

const simFaults = {};
function simFault(name, err) {
  const n = (simFaults[name] = (simFaults[name] || 0) + 1);
  console.error(`sim[${name}] fault #${n}:`, err);
  // the shell has no devtools: a repeating sim fault must say so on screen (index.html's #errtoast)
  if (n <= 3 || n % 300 === 0) {
    let t = document.getElementById('errtoast');
    if (!t) { t = document.createElement('div'); t.id = 'errtoast'; document.body.append(t); }
    t.innerHTML = `<b>Battle fault: ${name}</b><small>${String(err?.message || err).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).slice(0, 200)} ×${n}</small>`;
    t.classList.add('on');
  }
}

let lastRenderFrame = 0;
/** real: wall-clock dt while a screen is up (the field idles behind it: fires, flags, cloth keep moving); battle: sim time.
 *  Guarded like step(): a view that throws one frame must not take the whole canvas down (frozen field, alive menus). */
function render(real) {
  try {
    const dt = real ?? Math.min(10, Math.max(0, (game.frame - lastRenderFrame) / 60));
    lastRenderFrame = game.frame;
    heroView.root.visible = state !== 'title' && state !== 'select' && state !== 'settings';   // no officer chosen yet: the field stands empty
    actorsView.root.visible = pickupsView.root.visible = heroView.root.visible;
    heroView.update(Math.min(dt, 0.1));
    crowdView.update(dt, camRig.camera);
    actorsView.update(dt); pickupsView.update();
    vfx.update(dt);
    camRig.update(dt);
    updateDayNight(dt, scene, camRig.camera);                         // the 24-minute cycle drives sky, fog, lights
    screens[state]?.view?.(scene, camRig.camera, camRig.focus, dt);   // ui lane: a screen may frame the idle field itself
    world.update(dt, camRig.focus, game);
    musouView.update(dt);
    post.render(scene, camRig.camera, game.frame / 60, camRig.focus, vfx.flash);   // post-fx: DoF focus + screen flash
    post.present(post.mbWeight());                                     // the frame lands on screen (motion blur blends here)
    hud.update();
  } catch (err) { simFault('render', err); }
}

/** New battle: { char: CHARS id, mode: 'free' | 'story' | 'trial' | rogue modes, ch, map, loc (rogue/locations id) }.
 *  Sets the armies, loads the map (no-op if it is up), resets every sim module (deterministic from here: both RNGs
 *  reseeded, frame 0), rebuilds the kit views on a character change, lets the story / rogue director spawn the field. */
function startBattle({ char = 'zhaoyun', mode = 'free', ch, map, loc: locId } = {}) {
  const rogue = ROGUE_MODES.has(mode);
  const L = rogue ? locById(locId) : null;
  const C = (mode === 'free' || rogue) ? null : chapter(ch);                                         // C2: the chapter / trial
  const who = CHARS[char] || CHARS.zhaoyun, newKit = who.kit !== game.hero.kit;
  char = who.id; ch = C?.CH.id; map = C ? C.CH.map : rogue ? L.map : map || HOME;                          // C2: resolved ids
  const prev = game.army; game.army = armyPair(rogue ? L.army : C ? C.CH.army : CHAPTERS.find((m) => m.CH.map === map)?.CH.army ?? FREE_ARMY);              // C3
  if (game.army.foe !== prev.foe || game.army.ally !== prev.ally) { crowdView.dispose(); crowdView = createCrowdView(scene, game); }
  world.load(map, { army: game.army });                                                                    // C1
  map = MAP.id;
  const p = { ...spawnPoint(mode), ...C?.CH.start };                                                      // C2 (also opens every gate; a trial: the free arena)
  Object.assign(game, { mode, frame: 0, hitstop: 0, freeze: 0, diff: difficulty() });
  lastRenderFrame = 0;
  vrng.seed(7936); rng.seed(1);
  game.hero.reset({ ...p, char: who });
  if (newKit) game.musou = who.kit.createMusou(game);
  game.cam.reset(p.yaw); game.cam.tilt = p.tilt || 0;           // first: crowd.reset takes the allies' front from the camera yaw
  game.crowd.reset(); game.combat.reset(); game.musou.reset();
  if (newKit) buildViews();
  heroView.reset();
  game.actors.reset(); game.pickups.reset();                                              // C5
  if (rogue) game.rogue.reset({ mode, char, loc: L });
  else game.story.reset({ mode, char, ch });                                                // C2
  menu.querySelector('.t').innerHTML = `${who.name}<i>${who.seal}</i>`;
  menu.querySelector('.sub').innerHTML = `Battle paused · ${game.diff}<small>Battle paused</small>`;
  document.title = 'RoguSo';
  emit('scenario', { mode, char, ch, map });
}

addEventListener('resize', () => {
  vw = innerWidth; vh = innerHeight;
  post.setSize(vw, vh);
  camRig.resize(vw, vh);
  fitSoon();
  render();
});

// ---- flow + pause menu (index.html #menu, battle only): the sim waits while it is open or while a screen is up
const $ = (id) => document.getElementById(id);
const menu = $('menu'), hudEl = $('hud');
// the bindings mid-battle too (critic: checking aim meant quitting the chapter) — rebuilt live from the user's binds
function pauseTable() {
  const B = bindings();
  const row = (label, slots, pad) => `<tr><td>${label}</td><td>${slots.filter(Boolean).map((s) => `<kbd>${labelSlot(s)}</kbd>`).join('')}</td><td class="pad">${pad}</td></tr>`;
  const act = (a, label, pad) => row(label, B.actions[a], pad);
  return [
    row('Move', [...B.move.up, ...B.move.down, ...B.move.left, ...B.move.right], 'left stick'),
    act('attack', 'Attack', 'X / □'),
    act('charge', 'Charge', 'Y / △'),
    act('jump', 'Jump', 'A / ✕'),
    act('dodge', 'Dodge', 'R1 / R2'),
    act('musou', 'Musou', 'B / ○'),
    row('Camera', ['MOUSE', ...B.camera.left, ...B.camera.right], 'right stick'),
    act('target', 'Recenter', 'L1 / L2'),
  ].join('');
}
menu.querySelector('.hint').insertAdjacentHTML('beforebegin', `<table>${pauseTable()}</table>`);
let paused = false, state = null, ctx = {}, hold = false;   // hold: loading, no renders until the new kit is compiled
// pause menu: title-screen vocabulary (diamond + swash on the focused item), Resume focused on open, up/down / pad move,
// Enter / A confirm, Esc / B resume. Quit asks once (Are you sure?), a second confirm ink-wipes to the title.
const mBtns = [$('go'), $('quit')], quitEl = $('quit');
let mCur = 0, quitArm = false;
const armQuit = (v) => {
  quitArm = v; quitEl.classList.toggle('arm', v);
  quitEl.innerHTML = v ? 'Abandon the battle?<small>Confirm · progress is lost</small>' : 'Quit to title<small>Quit to title</small>';
};
const mFocus = (i) => {
  mCur = (i + mBtns.length) % mBtns.length;
  mBtns.forEach((b, k) => b.classList.toggle('on', k === mCur));
  if (mCur !== 1 && quitArm) armQuit(false);
};
const mOk = () => {
  if (mCur === 0) return setPaused(false);
  if (!quitArm) { sfx('ok'); return armQuit(true); }
  sfx('back'); mNav.stop();
  afterWipe(() => inkWipe(() => flow.go('title')));
};
const mNav = createNav({ move: (d) => { mFocus(mCur + d); sfx('move'); }, ok: mOk, back: () => setPaused(false) });
const setPaused = (v) => {
  paused = v; menu.hidden = !v; hudEl.hidden = v; input.sample();   // sample(): drop keys pressed on the menu
  if (v) { mFocus(0); armQuit(false); mNav.start(); menu.querySelector('table').innerHTML = pauseTable(); } else mNav.stop();
};
mBtns.forEach((b, i) => {
  b.addEventListener('pointerenter', () => { if (mCur !== i) { mFocus(i); sfx('move'); } });
  b.addEventListener('click', () => { mFocus(i); mOk(); });
});
const flow = {
  /** Enter a flow state: 'title' | 'select' | 'loading' | 'prologue' | 'battle' | 'result' (ctx: see each screen module). */
  go(s, c = {}) {
    if (s === 'loading' && state === 'select') c.art = arts[c.char] = snapArt();
    if (screens[state]) { screens[state].exit(); $(state).hidden = true; }
    const set = state === 'loading' || state === 'prologue';   // deploy() already started this battle (its field is on screen)
    state = s; ctx = c;
    if (s === 'title') { world.load(HOME); game.crowd.reset(); }   // menus stand on HOME, the field empty (under the ink)
    if (s === 'battle') { if (!set) startBattle(c); setPaused(false); replay(hudEl, 'in'); }
    else {
      setPaused(false); hudEl.hidden = true; $(s).hidden = false;
      try { screens[s].enter(c); } catch (err) { console.error(err); }   // a screen crash must never kill the flow
    }
    emit('flow', { state: s, ctx: c });
    if (s === 'loading') { deploy(c); return nextFrame(); }
    // Results and the prologue only change DOM; a deployed battle is already compiled and presented.
    return warm(s === 'title' || s === 'select' || (s === 'battle' && !set));
  },
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Compile every material in the scene (hidden pools included) for this camera, in parallel where the GPU has
 *  KHR_parallel_shader_compile, then let two frames present: the screen's first draws don't stall. Both awaits fail
 *  open — a compile that never lands (driver stall) or a lost rAF cannot hold the flow hostage. */
async function warm(compile = true) {
  screens[state]?.view?.(scene, camRig.camera, camRig.focus, 0);   // a screen's stage (select: the focused officer's model) exists now
  if (compile) await Promise.race([post.compile(scene, camRig.camera), sleep(20000)]);
  await Promise.race([nextFrame(), sleep(400)]);
  await Promise.race([nextFrame(), sleep(400)]);
}
/** Key-art still of the officer focused on the select stage, taken under full ink: one render in the select screen's
 *  key-art framing, read back in the same task (no preserveDrawingBuffer needed). Cached per officer (retry reuses it). */
const arts = {};
function snapArt() {
  const S = screens.select;
  S.keyart(true); render(0); S.keyart(false);
  try { return canvas.toDataURL('image/jpeg', 0.9); } catch { return null; }
}
/** Under the loading card: the chosen officer's battle, compiled and rendered a few frames, then ink on into it.
 *  Runs only once the card is fully uncovered (the synchronous build would otherwise freeze the ink over it); each
 *  stage is labelled on the card and the bar gets two frames to start moving before the main thread blocks.
 *  Hang-proof by law: every await races a wall-clock fallback, every step is guarded, and a hard failure reports
 *  on screen (the shell has no devtools) then carries on — the loading card can never outlive the game again. */
async function deploy(c) {
  const L = screens.loading;
  hold = true;
  try {
    const t0 = performance.now();
    for (let i = 0; wiping() && i < 120; i++) await Promise.race([nextFrame(), sleep(120)]);   // the wipe uncovers (≤ ~6 s even throttled)
    if (state !== 'loading') return;
    const stage = async (p, label) => { L.progress(p, label); await Promise.race([nextFrame(), sleep(200)]); await Promise.race([nextFrame(), sleep(200)]); };
    await stage(0.18, 'Summoning the officer');
    startBattle(c);
    await stage(0.5, 'Deploying the ranks');
    await Promise.race([post.compile(scene, camRig.camera), sleep(20000)]);
    await stage(0.82, 'Preparing the field');
    hold = false;                                    // the loop renders the field behind the card: shadow / first-draw variants
    for (let i = 0; i < 4; i++) await Promise.race([nextFrame(), sleep(250)]);
    L.progress(1);
    await sleep(Math.max(500, 1300 - (performance.now() - t0)));   // the card stays readable >= 1.3 s once revealed
    if (state !== 'loading') return;
    L.ready(); sfx('ok');
    await sleep(450);
    if (state !== 'loading') return;
    inkWipe(() => flow.go(c.mode === 'story' && !c.retry ? 'prologue' : 'battle', c));
  } catch (err) {
    console.error(err);
    hold = false;
    if (state === 'loading') {
      L.progress(1); L.ready();
      setTimeout(() => { if (state === 'loading') inkWipe(() => flow.go(c.mode === 'story' && !c.retry ? 'prologue' : 'battle', c)); }, 600);
    }
  }
}
const screens = {
  title: createTitle($('title'), flow), select: createSelect($('select'), flow), loading: createLoading($('loading')),
  prologue: createPrologue($('prologue'), flow), result: createResult($('result'), flow),
  settings: createSettings($('settings'), flow),
  battlemenu: createBattle($('battlemenu'), flow), fighters: createFighters($('fighters'), flow),
  train: createTrain($('train'), flow),
};
// a story win/loss goes into the records (rec: what it beat and what it opened — the result screen shows both);
// reason: a fail beat's defeat line. A ROGUE run ends here too: the run's earnings bank (coins / XP / ally XP —
// the owner's law: nothing is lost on death), then the result screen shows what was earned. afterWipe: a battle that
// ends while ANOTHER wipe is still uncovering must not lose its own transition (inkWipe drops calls made mid-wipe).
on('story:end', (e) => {
  const rec = e.win ? record(ctx.ch, game.hero.char.id, game.diff.id, e.stats) : null;
  afterWipe(() => inkWipe(() => flow.go('result', { ...ctx, char: game.hero.char.id, win: e.win, stats: e.stats, reason: e.reason, diff: game.diff, rec })));
});
on('rogue:end', (e) => {
  const s = e.stats || {}, id = game.hero.char.id;
  economy.addCoins(s.coins | 0);
  if (s.xp) economy.addXp(id, s.xp);
  if (s.allyXp) economy.addAllyXp(id, s.allyXp);
  economy.addLifetime(id, { kills: s.kos | 0, coins: s.coins | 0, runs: 1, xp: s.xp | 0, bestKos: s.kos | 0 });
  afterWipe(() => inkWipe(() => flow.go('result', { ...ctx, char: id, win: e.win, stats: s, reason: e.reason, diff: game.diff, rec: null })));
});
addEventListener('keydown', (e) => {
  if (state !== 'battle' || paused || e.repeat || e.defaultPrevented) return;
  if (e.code === 'KeyO' && game.mode === 'trainally') { game.rogue.orderAllies(); return; }
});
addEventListener('keydown', (e) => {
  // opens; the menu's own nav (registered first) closes it and marks the key handled
  if (state === 'battle' && !paused && e.code === 'Escape' && !e.defaultPrevented) setPaused(true);
});
addEventListener('blur', () => { if (state === 'battle') setPaused(true); });

// ---- loop: the scheduler owns the cadence (Display settings: Hz simulation, FPS cap, V-Sync, frame pacer, FSR
// frame-gen synth presents); the sim keeps its fixed 60 Hz accumulator law inside real frames
let acc = 0;
const real = (dtWall) => {
  acc += dtWall * (game.timeScale ?? 1);                                   // story: victory slow-mo
  if (paused) { acc = 0; input.sample(); return; }
  if (state !== 'battle') { acc = 0; input.sample(); if (!hold) render(dtWall); return; }     // screens: the field idles behind them
  let n = 0;
  while (acc >= 1 / 60 && n < 4 && state === 'battle') { step(); acc -= 1 / 60; n++; }
  if (n === 4) acc = 0;
  if (!hold) render();
};
const synth = (alpha) => { if (!paused && !hold) post.present(alpha); };   // FSR frame generation: a blend of the last two real frames
const sched = createScheduler({ real, synth });

// F11: fullscreen / windowed toggle. In the shell the host window goes borderless natively (the page just asks it);
// in a plain browser the Fullscreen API does the job.
addEventListener('keydown', (e) => {
  if (e.code !== 'F11') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const bridge = window.chrome?.webview;
  if (bridge) bridge.postMessage('ROGUSO FULLSCREEN');
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
});

const dev = params.get('go');
// the page opens under full ink (index.html): the first screen is built and compiled under it, then the ink sweeps off
const devChar = params.get('char') || 'zhaoyun';
const devModes = ['story', 'trial', 'rogue', 'challenge', 'trainchar', 'trainally'];
const devCh = chapter(params.get('ch') || CHAPTERS.find((m) => m.CH.heroes.includes(devChar))?.CH.id).CH.id;
inkBoot(() => {
  if (dev) return flow.go('battle', {
    mode: devModes.includes(dev) ? dev : 'free', char: devChar, ch: devCh,
    loc: params.get('loc') || 'hulao', map: params.get('map') || undefined,
  });
  return flow.go('title');
});
sched.start();
// harness hook: tools/harness.mjs reads the live flow state (never used by the game itself)
window.__flow = () => state;
window.__ink = () => ({ hidden: document.getElementById("ink").hidden, hold: document.body.classList.contains("inkhold"), anims: document.getElementById("ink").getAnimations().length });
