// The rogue run director (rogue/director.js): the sim-side brain of a run, same surface as the story director
// (story/index.js) so main.js can drive either — reset(cfg), step(), stats(), end(win), plus the HUD reads
// (target / timer / morale / defend / hq). Runs in step() after the musou, deterministic off rng streams.
//
// Run kinds (cfg.mode):
//   'rogue'      a Battle: endless field on a location — reinforcement squads every loc.wave s, the exclusive enemy
//                kind on kindShare of them (more each cycle), a boss every BOSS_EVERY kills (round-robin through the
//                location's pool, each return bigger: scale + HP + a meaner arm). Ends when the hero falls.
//   'challenge'  a rogue run + TARGETS (1-5, generated non-conflicting here or handed in via cfg.targets): reach them
//                all to win (a coin bonus on the result); death before that is a fail. Targets: kos (kill n), coins
//                (loot n), musou (launch n musous), survive (hold out n s), hug (stay within r m of a moving mark).
//   'trainchar'  Train → the character: a deadly elimination — 3 rival officers close in, no reinforcements, the last
//                one standing wins. XP banks per kill + per 100 damage; losing keeps the gains (the training's point).
//   'trainally'  Train → the allies: the ally block fights wave after wave beside the hero; their kills bank ally XP
//                (economy.allyXp per character). The 'O' button sends them forward / calls them back to guard.
//
// Coins: every COIN_EVERY-th grunt KO drops 1-2 coins at the fall (luck via economy.heroMods.luck; the owner's law:
// 1 coin per 10-30 kills, they must feel rare), a boss falls with a burst of COIN_BOSS. The pickups module owns the
// ground truth; the wallet is granted in main.js on 'pickup:coin' (the sim never touches the save file).
// Dynamic difficulty (economy.threatOf): foe hp/dmg scale with the deployer's total upgrade level — a maxed monster
// drags a meaner army in, so the field is always a challenge.
import { on, emit } from '../core/events.js';
import { rng } from '../core/rng.js';
import { CHARS } from '../chars/index.js';
import { NPCS } from '../chars/npc/index.js';
import { ground } from '../world/map.js';
import { heroMods, threatOf } from '../core/economy.js';
import { SPELLS } from './locations.js';
import { SPEAR } from '../actors/actors.js';
import { KIND } from '../crowd/crowd.js';

const BOSS_EVERY = 70;                 // grunts between bosses (they cycle bigger and bigger)
const COIN_EVERY = 20;                 // grunts per coin drop (luck raises the drop rate, not the cadence)
const COIN_BOSS = 6;                   // coins a boss bursts with
const SKY_WARN = 60;                   // sim frames between the shadow warning and the sky squad's drop

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createRogue(game) {
  const S = { mode: 'rogue', t: 0, done: false, maxChain: 0 };
  const st = { morale: 0.5, target: null, timer: null, defend: null, hq: null };
  let loc = null, cfg = null, cycle = 0, bossI = 0, sinceBoss = 0, sinceCoin = 0, waveT = 0, bossKey = null, bossDown = 0;
  let downT = -1, earned = { coins: 0, xp: 0, allyXp: 0, bodycoins: 0 }, targets = [], skyQ = [], rivals = [];
  let musouStarts = 0, coinsLooted = 0, allyForward = true, allyModeT = 0;

  st.stats = () => {
    const h = game.hero;
    return {
      kos: h.kos, time: Math.round(S.t / 60), hpMax: h.hpMax, maxChain: S.maxChain, dmg: S.dmg,
      coins: earned.coins, xp: earned.xp, allyXp: earned.allyXp, bodycoins: earned.bodycoins,
      cycle, targets: targets.map((q) => ({ ...q })),
      runKos: h.kos, runTime: Math.round(S.t / 60),
    };
  };
  S.end = (win) => { if (!S.done) { S.done = true; game.timeScale = 1; emit('rogue:end', { win, stats: st.stats() }); } };

  // ---- run bookkeeping (sim-side events)
  on('ko', (e) => {
    if (S.done || e.officer) return;
    sinceBoss++; sinceCoin++;
    if (sinceBoss >= BOSS_EVERY * (1 + cycle * 0.35)) spawnBoss();
    // the owner's economy law: 1 coin per 10-30 kills — rare, felt. Luck nudges the odds inside the window.
    if (sinceCoin >= COIN_EVERY) {
      sinceCoin = 0;
      const luck = S.mods?.luck ?? 1;
      if (rng.chance(Math.min(0.9, 0.22 * luck))) game.pickups.dropCoins(e.x, e.z, rng.chance(0.16) ? 2 : 1);
    }
  });
  on('pickup:coin', () => { coinsLooted++; earned.coins++; });
  on('musou:start', () => { musouStarts++; });
  on('hero:hurt', (e) => { S.dmg += e.dmg; });
  on('actor:down', (e) => {
    if (S.done) return;
    if (e.key === bossKey) {
      bossDown = S.t; bossKey = null; cycle++;
      game.pickups.dropCoins(e.x, e.z, COIN_BOSS);
      emit('story:banner', { html: `<em>${e.name || 'The officer'}</em> falls — the cycle deepens`, dur: 200, big: true });
      earned.coins += 2;                                    // the boss's purse, always
      for (const q of targets) if (q.kind === 'boss') q.progress = (q.progress | 0) + 1;
    } else if (cfg?.mode === 'trainchar') {
      const ri = rivals.findIndex((r) => r.key === e.key);
      if (ri >= 0) {
        const gain = 120 + ri * 30;
        earned.xp += gain;
        emit('story:banner', { html: `<em>${rivals[ri].name}</em> is down · +${gain} XP`, dur: 170 });
        rivals.splice(ri, 1);
        if (!rivals.length) { S.won = S.t; st.morale = 1; }
      }
    }
  });

  // ---- bosses: the location's pool round-robin, each cycle bigger and armed with the field's element
  function spawnBoss() {
    const h = game.hero;
    const id = loc.bosses[bossI % loc.bosses.length];
    const name = loc.bossNames[bossI % loc.bosses.length];
    bossI++;
    sinceBoss = 0;
    const kit = CHARS[id]?.kit || NPCS[id]?.kit;
    if (!kit) return;
    const scale = Math.min(2.6, 1.12 + cycle * 0.16);
    const hp = Math.round((520 + cycle * 260) * threatOf(cfg.char) * (0.9 + 0.2 * rng.next()));
    const a = game.actors.spawn('boss' + cycle + '_' + bossI, {
      kit: id, role: 'boss', name: `${name}${cycle > 0 ? ` · ${['Greater', 'Grand', 'Colossal', 'Abyssal'][Math.min(3, cycle - 1)] || 'Eternal'}` : ''}`,
      at: [h.x + Math.sin(rng.next() * 6.28) * 16, h.z + Math.cos(rng.next() * 6.28) * 16],
      hp, scale, invuln: false,
      attacks: [ ...(kit.bossAttacks || SPEAR), { ...SPELLS[loc.elem], dmg: SPELLS[loc.elem].dmg * (1 + cycle * 0.25) } ],
    });
    if (a) {
      bossKey = a.key;
      emit('story:banner', { html: `<em>${a.name}</em> takes the field!`, dur: 200, big: true });
    }
  }

  // ---- waves: reinforcement squads, the exclusive kind woven in (thicker every cycle)
  function waves() {
    const c = game.crowd, h = game.hero;
    if (--waveT > 0) return;
    waveT = Math.max(6, loc.wave - cycle) * 60;
    const n = Math.min(26, 14 + cycle * 3);
    const special = loc.kind && rng.next() < Math.min(0.85, loc.kindShare + cycle * 0.08);
    const d = 20 + rng.next() * 10, a = rng.next() * Math.PI * 2;
    const x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
    const squad = { x, z, n, charge: true, kind: special ? loc.kind : null };
    if (special && loc.kind === KIND.SKY) {                   // SKY: a warning shadow, then the drop
      skyQ.push({ squad, at: S.t + SKY_WARN });
      emit('story:banner', { html: '<em>Look up</em> — the sky brings them', dur: 90 });
    } else c.spawnSquad(squad);
    if (special && loc.kind === KIND.NINJA) emit('rogue:fog', { x, z });  // NINJA: the fog they step out of
  }

  // ---- challenge targets: 1-5, non-conflicting by construction
  function makeTargets(n) {
    const kinds = ['kos', 'coins', 'musou', 'survive', 'boss'];
    const t = [];
    const threat = threatOf(cfg.char);
    for (let k = 0; k < n; k++) {
      const kind = kinds.splice(rng.int(0, kinds.length - 1), 1)[0];
      if (kind === 'kos') t.push({ kind, n: Math.round(40 + 30 * threat * (k + 1) * 0.6), progress: 0, label: 'slay' });
      else if (kind === 'coins') t.push({ kind, n: 8 + k * 4, progress: 0, label: 'loot' });
      else if (kind === 'musou') t.push({ kind, n: 1 + Math.floor(k / 2), progress: 0, label: 'unleash' });
      else if (kind === 'survive') t.push({ kind, n: 45 + k * 30, progress: 0, label: 'endure' });
      else if (kind === 'boss') t.push({ kind, n: 1 + Math.floor(k / 2), progress: 0, label: 'fell a giant' });
    }
    return t;
  }

  st.reset = (c) => {
    cfg = c; loc = c.loc;
    Object.assign(S, { mode: c.mode, t: 0, done: false, maxChain: 0, dmg: 0, won: -1 });
    cycle = 0; bossI = 0; sinceBoss = 0; sinceCoin = 0; waveT = 8 * 60; bossKey = null; bossDown = -1e9;
    downT = -1; earned = { coins: 0, xp: 0, allyXp: 0, bodycoins: 0 };
    targets = c.mode === 'challenge' ? (c.targets || makeTargets(c.targetCount || 3)) : [];
    skyQ = []; rivals = []; musouStarts = 0; coinsLooted = 0; allyForward = true;
    S.mods = heroMods(c.char);
    st.morale = 0.5; st.target = null; st.timer = null; st.defend = null;
    const h = game.hero, cw = game.crowd;
    cw.setWaves(false);                                      // the director, not the crowd's default waves
    if (c.mode === 'trainally') {
      // the allies are the point: a big trained block, aggressive from the start
      cw.spawnAllies({ x: h.x, z: h.z - 8, n: 24 + (S.mods.allies | 0), cols: 6, hold: false });
      cw.setAllies(true);
    } else if (c.mode === 'trainchar') {
      // alone against the rivals: no block behind the hero
      cw.spawnAllies({ x: h.x, z: h.z - 9, n: 0, cols: 5, hold: false });
    } else {
      cw.spawnAllies({ x: h.x, z: h.z - 9, n: 12 + (S.mods.allies | 0), cols: 5, hold: false });
      cw.setAllies(true);
    }
    if (cfg.mode === 'trainchar') {
      // the deadly elimination: 3 rival officers close in from the arc (they are actors: real kits, real AI)
      const pool = ['guanyu', 'zhangfei', 'huangzhong', 'zhugeliang', 'lubu', 'zhaoyun', 'liubei'].filter((id) => id !== cfg.char);
      for (let k = 0; k < 3; k++) {
        const id = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        const a = (k / 3) * Math.PI * 2;
        const r = game.actors.spawn('rival' + k, {
          kit: id, role: 'boss', name: CHARS[id].name,
          at: [h.x + Math.sin(a) * 17, h.z + Math.cos(a) * 17],
          hp: Math.round(420 * threatOf(cfg.char) * (1 + k * 0.22)), invuln: false, retreatAt: 0,
          attacks: CHARS[id].kit.bossAttacks || SPEAR,
        });
        if (r) rivals.push({ key: r.key, name: CHARS[id].name });
      }
      emit('story:banner', { html: 'Last one standing takes the lesson', dur: 200, big: true });
    } else {
      // the opening field: the army standing (the classic free battle, minus its default waves)
      cw.spawnArmy();
      if (loc.kind && loc.kindShare > 0.2) {                  // the exclusive kind announces itself
        const line = { [KIND.SKELETON]: 'The ground stirs — the fallen do not stay down', [KIND.SKY]: 'Eyes to the sky', [KIND.NINJA]: 'The fog is moving' }[loc.kind];
        if (line) emit('story:banner', { html: line, dur: 190, big: true });
      }
    }
    emit('story:objective', { text: st.objective() });
  };

  st.step = () => {
    if (S.done) return;
    S.t++;
    const h = game.hero, c = game.crowd;
    if (h.combo > S.maxChain) S.maxChain = h.combo;

    // the hero fell: the run ends (training keeps its gains either way — the result says what was earned)
    if (h.dead) { if (downT < 0) downT = S.t; if (S.t - downT >= 150) S.end(false); return; }
    if (S.won >= 0) { if (S.t - S.won >= 160) S.end(true); return; }

    if (cfg.mode === 'trainchar') {
      // rivals close in; the run is the duel
      st.morale += ((rivals.length ? 0.35 + 0.2 * (3 - rivals.length) : 1) - st.morale) * 0.02;
      if (!rivals.length) { /* handled by actor:down */ }
    } else {
      waves();
      // sky drop queue: when the warning lands, the squad falls in
      for (let i = skyQ.length - 1; i >= 0; i--) {
        if (S.t >= skyQ[i].at) { const q = skyQ[i].squad; c.spawnSquad({ ...q, sky: true, kind: loc.kind }); skyQ.splice(i, 1); }
      }
      // challenge target progress
      for (const q of targets) {
        if (q.kind === 'kos') q.progress = Math.min(q.n, h.kos);
        else if (q.kind === 'coins') q.progress = Math.min(q.n, coinsLooted);
        else if (q.kind === 'musou') q.progress = Math.min(q.n, musouStarts);
        else if (q.kind === 'survive') q.progress = Math.min(q.n, Math.round(S.t / 60));
      }
      if (targets.length && targets.every((q) => q.progress >= q.n)) { S.won = S.t; st.morale = 1; emit('story:banner', { html: '<em>Challenge complete</em>', dur: 220, big: true }); }
      // the objective line refreshes on its own cadence (the HUD's objective lane)
      if (S.t % 45 === 0) emit('story:objective', { text: st.objective() });
      // the objective line: the next unfinished target, or the cycle count
      const next = targets.find((q) => q.progress < q.n);
      st.timer = null;
      st.target = bossKey ? (() => { const b = game.actors.get(bossKey); return b && !b.dead ? { x: b.x, z: b.z } : null; })() : null;
      st.morale += ((bossKey ? 0.85 : 0.5 + Math.min(0.3, cycle * 0.05)) - st.morale) * 0.01;
    }
  };

  /** The HUD's objective line (hud.js reads game.story.obj via story:objective — the rogue HUD reads this). */
  st.objective = () => {
    if (cfg?.mode === 'trainchar') return rivals.length ? `Defeat the rivals — ${rivals.length} stand` : 'The field is yours';
    if (cfg?.mode === 'trainally') return allyForward ? 'Your men fight forward — O recalls them' : 'Your men guard you — O sends them in';
    const next = targets.find((q) => q.progress < q.n);
    if (next) {
      const left = next.n - (next.progress | 0);
      const unit = { kos: 'more to slay', coins: 'coins to loot', musou: 'musou to unleash', survive: 's to endure', boss: 'giants to fell' }[next.kind] || '';
      return `${next.label}: ${left} ${unit}`;
    }
    return `Cycle ${cycle + 1} — the field deepens`;
  };

  /** The 'O' ally order (main.js forwards the key): forward → guard and back. */
  st.orderAllies = () => {
    allyForward = !allyForward;
    game.crowd.setAllies(!allyForward ? 'hold' : true);
    emit('story:banner', { html: allyForward ? '<em>Advance</em> — your men push on' : '<em>To me</em> — your men guard you', dur: 130 });
  };

  return st;
}
