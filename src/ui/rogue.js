// The roguelike screens (ui/rogue.js): Battle, Fighters, Train — the owner's redesign of the front end
// (no story, no trials on the menu; the war is the loop). All three stand over the idle HOME field like the other
// screens, share the paper/ink design language, and are click + keyboard driven (Esc back to the title).
//   Battle    the locations (every field, each with its exclusive enemy), a difficulty row, GO → the officer select;
//             the Challenge card throws a random field with 1-5 generated targets at a coin bonus.
//   Fighters  the roster: the first officer is free, the rest cost coins — and every officer's upgrades table
//             (power/speed/muso/luck/health/defense/allies/combos for coins; training crits/guard/counter for XP;
//             the ally block's count/power/vigor for ally XP banked in Train).
//   Train     pick the officer, pick the lesson: the deadly elimination (officer) or the ally war (allies).
import { CHARS, CHAR_ORDER, paintPortrait } from '../chars/index.js';
import { inkWipe, afterWipe, wiping, sfx, replay } from './menu.js';
import { DIFFS, unlocked, difficulty, setDifficulty } from '../core/difficulty.js';
import {
  economy, coins, owned, isOwned, charPrice, buyChar,
  upgradeList, allyUpgradeList, trainList, levelOf, allyLevelOf, trainLevelOf,
  upgradePrice, allyPrice, trainPrice, buyUpgrade, buyAlly, buyTrain, xpOf, allyXpOf, heroMods,
} from '../core/economy.js';
import { LOCATIONS, location } from '../rogue/locations.js';
import { fitText } from './fittext.js';

const KIND_TAG = { 5: 'The fallen rise', 6: 'They drop from the sky', 7: 'They fog in' };
const ELEM_TAG = { fire: 'Fire spells', water: 'Water spells', rock: 'Stone spells', air: 'Wind spells' };

const wallet = () => `<div class="rg-wallet"><span>◈ ${coins()}</span></div>`;

// shared keyboard driver: ↑/↓ move the cursor among [data-nav] items, Enter activates the focused button,
// ←/→ nudge seg rows. Everything also answers the mouse.
function navKeys(el, opts) {
  const items = () => [...el.querySelectorAll('[data-nav]:not([hidden]):not(.dis)')];
  let cur = -1;
  const focus = (i) => {
    const its = items();
    if (!its.length) return;
    cur = (i + its.length) % its.length;
    its.forEach((q, k) => q.classList.toggle('on', k === cur));
    its[cur].scrollIntoView?.({ block: 'nearest' });
  };
  const key = (e) => {
    if (!el.isConnected || el.hidden) return;
    if (e.code === 'Escape' && opts?.back) { e.preventDefault(); opts.back(); return; }
    if (e.code === 'ArrowDown') { e.preventDefault(); focus(cur + 1); sfx('move'); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); focus(cur - 1); sfx('move'); }
    else if (e.code === 'Enter' || e.code === 'Space') {
      const it = items()[cur];
      if (it) { e.preventDefault(); it.click(); }
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const it = items()[cur];
      if (it?.dataset.nav === 'seg') { e.preventDefault(); it.querySelector(e.code === 'ArrowLeft' ? '.st-prev' : '.st-next')?.click(); }
    }
  };
  addEventListener('keydown', key);
  opts?.exit?.push(() => removeEventListener('keydown', key));
  return { focus };
}

function segRow(path, get, set, list, fmt) {
  const cur = Math.max(0, list.findIndex((o) => String(o.v) === String(get())));
  const r = document.createElement('div');
  r.className = 'st-row'; r.dataset.nav = 'seg';
  r.innerHTML = `<label>${path}</label><div class="st-seg"><button class="st-prev"><b>◄</b></button><b class="st-val"></b><button class="st-next"><b>►</b></button></div>`;
  let i = cur;
  const paint = () => {
    r.querySelector('.st-val').textContent = fmt ? fmt(list[i]) : list[i].label;
    r.querySelector('.st-prev').classList.toggle('dis', i <= 0);
    r.querySelector('.st-next').classList.toggle('dis', i >= list.length - 1);
  };
  r.querySelector('.st-prev').addEventListener('click', () => { if (i > 0) { i--; set(list[i].v); paint(); sfx('move'); } });
  r.querySelector('.st-next').addEventListener('click', () => { if (i < list.length - 1) { i++; set(list[i].v); paint(); sfx('move'); } });
  paint();
  return r;
}

// ---------------------------------------------------------------- Battle
export function createBattle(el, flow) {
  const exitHooks = [];
  el.innerHTML = `
    <div class="rg">
      <header class="rg-head"><h2>Battle</h2><small>pick the field · the war never ends</small>${wallet()}</header>
      <div class="rg-body">
        <nav class="rg-locs"></nav>
        <aside class="rg-side">
          <div class="rg-diff"></div>
          <button class="rg-go" data-nav="go" disabled><b>March</b><small>choose your officer</small></button>
          <div class="rg-chal">
            <h4>Challenge</h4>
            <p>A random field, 1 to 5 targets, a fatter purse. Harder on purpose.</p>
            <button class="rg-chalgo" data-nav="chal"><b>Take the challenge</b><small>targets roll on entry</small></button>
          </div>
        </aside>
      </div>
      <footer class="ui-foot"><span><kbd>Esc</kbd>Back</span><span><kbd>Click</kbd>Adjust</span></footer>
    </div>`;
  const $ = (s) => el.querySelector(s);
  let picked = null;
  const locs = $('.rg-locs');
  locs.innerHTML = LOCATIONS.map((l) => `
    <button class="rg-loc" data-loc="${l.id}" data-nav="loc">
      <i>${l.seal}</i>
      <div><b>${l.name}</b><small>${l.line}</small>
      <em>${[KIND_TAG[l.kind], ELEM_TAG[l.elem]].filter(Boolean).join(' · ')}</em></div>
    </button>`).join('');
  const paintPick = () => {
    locs.querySelectorAll('.rg-loc').forEach((b) => b.classList.toggle('on', b.dataset.loc === picked));
    $('.rg-go').disabled = !picked;
  };
  locs.addEventListener('click', (e) => {
    const b = e.target.closest('.rg-loc');
    if (!b) return;
    picked = b.dataset.loc; paintPick(); sfx('ok');
  });
  const difRow = segRow('Difficulty', () => difficulty().id,
    (v) => setDifficulty(DIFFS.find((d) => d.id === v)),
    DIFFS.map((d) => ({ v: d.id, label: unlocked(d) ? d.text : `${d.text} · locked` })));
  $('.rg-diff').append(difRow);
  $('.rg-go').addEventListener('click', () => {
    if (!picked || wiping()) return;
    sfx('stamp');
    afterWipe(() => inkWipe(() => flow.go('select', { mode: 'rogue', loc: picked, ch: null, map: null })));
  });
  $('.rg-chalgo').addEventListener('click', () => {
    if (wiping()) return;
    sfx('stamp');
    const L = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    afterWipe(() => inkWipe(() => flow.go('select', { mode: 'challenge', loc: L.id, ch: null, map: null, roll: true })));
  });
  paintPick();
  navKeys(el, { exit: exitHooks, back: () => { if (!wiping()) { sfx('back'); inkWipe(() => flow.go('title')); } } });
  return {
    enter() { $('.rg-wallet')?.replaceWith(Object.assign(document.createElement('template'), { innerHTML: wallet().trim() }).content.firstChild); replay(el, 'in'); fitText(el); },
    exit() { exitHooks.forEach((f) => f()); },
  };
}

// ---------------------------------------------------------------- Fighters
export function createFighters(el, flow) {
  const exitHooks = [];
  let cur = owned()[0] || 'zhaoyun';
  el.innerHTML = `
    <div class="rg">
      <header class="rg-head"><h2>Fighters</h2><small>the roster · the upgrades</small>${wallet()}</header>
      <div class="rg-body">
        <nav class="rg-roster"></nav>
        <aside class="rg-upg"></aside>
      </div>
      <footer class="ui-foot"><span><kbd>Esc</kbd>Back</span></footer>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const roster = $('.rg-roster'), upg = $('.rg-upg');

  function paintRoster() {
    roster.innerHTML = CHAR_ORDER.map((id) => {
      const c = CHARS[id], own = isOwned(id), price = charPrice(id);
      return `<button class="rg-char ${own ? '' : 'lock'} ${id === cur ? 'on' : ''}" data-id="${id}" data-nav="char">
        <canvas width="20" height="20"></canvas>
        <div><b>${c.name}</b><small>${c.title}</small>${own ? '' : `<em>◈ ${price}</em>`}</div>
      </button>`;
    }).join('');
    roster.querySelectorAll('canvas').forEach((cv, k) => paintPortrait(cv, CHARS[CHAR_ORDER[k]]));
  }
  function row(label, line, eff, level, max, priceTxt) {
    const r = document.createElement('div');
    r.className = 'rg-urow'; r.dataset.nav = 'upg';
    r.innerHTML = `<div class="rg-ulab"><b>${label}</b><small>${line}</small><em>${eff}</em></div>
      <div class="rg-ulvl">${Array.from({ length: max }, (_, k) => `<u class="${k < level ? 'f' : ''}"></u>`).join('')}</div>
      <button ${level >= max ? 'disabled' : ''}><b>${level >= max ? 'MAX' : priceTxt}</b></button>`;
    return r;
  }
  function paintUpg() {
    const id = cur;
    const head = `<div class="rg-uhead"><i>${CHARS[id].seal}</i><div><b>${CHARS[id].name}</b><small>${isOwned(id) ? 'under your banner' : 'not yet yours'}</small></div></div>`;
    const html = [], binds = [];
    if (!isOwned(id)) {
      const price = charPrice(id), can = coins() >= price;
      html.push(`<div class="rg-buy"><p><b>${CHARS[id].name}</b> fights for whoever pays — ◈ ${price} recruits him for your banner.</p>
        <button class="rg-buybtn ${can ? '' : 'poor'}" ${can ? '' : 'disabled'}><b>Recruit · ◈ ${price}</b><small>${can ? 'he joins on the stamp' : `you hold ◈ ${coins()} — come back richer`}</small></button></div>`);
      binds.push({ sel: '.rg-buybtn', buy: () => buyChar(id), own: true });
    } else {
      html.push(`<h4>War upgrades <span>coins</span></h4>`);
      for (const u of upgradeList()) {
        const l = levelOf(id, u.key);
        html.push(row(u.label, u.line, u.eff(l), l, u.max, `◈ ${upgradePrice(u.key, id)}`).outerHTML);
        binds.push({ buy: () => buyUpgrade(id, u.key) });
      }
      html.push(`<h4>Training <span>XP · ${xpOf(id)} banked</span></h4>`);
      for (const u of trainList()) {
        const l = trainLevelOf(id, u.key);
        html.push(row(u.label, u.line, u.eff(l), l, u.max, `✦ ${trainPrice(u.key, id)}`).outerHTML);
        binds.push({ buy: () => buyTrain(id, u.key) });
      }
      html.push(`<h4>The ally block <span>ally XP · ${allyXpOf(id)} banked</span></h4>`);
      for (const u of allyUpgradeList()) {
        const l = allyLevelOf(id, u.key);
        html.push(row(u.label, u.line, u.eff(l), l, u.max, `✦ ${allyPrice(u.key, id)}`).outerHTML);
        binds.push({ buy: () => buyAlly(id, u.key) });
      }
    }
    upg.innerHTML = head + `<div class="rg-scroll">${html.join('')}</div>`;
    const rows = [...upg.querySelectorAll('.rg-urow')];
    binds.filter((b) => !b.own).forEach((b, i) => rows[i]?.querySelector('button')?.addEventListener('click', () => { if (b.buy()) { sfx('stamp'); paintAll(); } else sfx('back'); }));
    binds.filter((b) => b.own).forEach((b) => upg.querySelector(b.sel)?.addEventListener('click', () => { if (b.buy()) { sfx('stamp'); paintAll(); } else sfx('back'); }));
  }
  function paintAll() {
    paintRoster(); paintUpg();
    $('.rg-wallet')?.replaceWith(Object.assign(document.createElement('template'), { innerHTML: wallet().trim() }).content.firstChild);
  }
  roster.addEventListener('click', (e) => {
    const b = e.target.closest('.rg-char');
    if (!b) return;
    const id = b.dataset.id;
    if (!isOwned(id) && id !== cur) { cur = id; sfx('move'); paintAll(); return; }
    if (!isOwned(id)) { if (buyChar(id)) { sfx('stamp'); paintAll(); } else sfx('back'); return; }
    cur = id; sfx('move'); paintAll();
  });
  navKeys(el, { exit: exitHooks, back: () => { if (!wiping()) { sfx('back'); inkWipe(() => flow.go('title')); } } });
  return {
    enter() { paintAll(); replay(el, 'in'); fitText(el); },
    exit() { exitHooks.forEach((f) => f()); },
  };
}

// ---------------------------------------------------------------- Train
export function createTrain(el, flow) {
  const exitHooks = [];
  let cur = owned()[0] || 'zhaoyun';
  el.innerHTML = `
    <div class="rg">
      <header class="rg-head"><h2>Train</h2><small>blood in, skill out · nothing is lost</small>${wallet()}</header>
      <div class="rg-body">
        <nav class="rg-roster rg-train"></nav>
        <aside class="rg-side">
          <button class="rg-go" data-nav="tc"><b>Train the officer</b><small>a deadly elimination · rivals · XP per kill</small></button>
          <button class="rg-go" data-nav="ta"><b>Train the allies</b><small>hold the field beside your men · ally XP</small></button>
          <p class="rg-note">XP banks even in defeat. The <kbd>O</kbd> key sends your men forward and calls them back.</p>
        </aside>
      </div>
      <footer class="ui-foot"><span><kbd>Esc</kbd>Back</span></footer>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const roster = $('.rg-train');
  function paint() {
    roster.innerHTML = owned().map((id) => {
      const c = CHARS[id];
      if (!c) return '';
      return `<button class="rg-char ${id === cur ? 'on' : ''}" data-id="${id}" data-nav="char">
        <canvas width="20" height="20"></canvas><div><b>${c.name}</b><small>XP ${xpOf(id)} · ally XP ${allyXpOf(id)}</small></div></button>`;
    }).join('');
    roster.querySelectorAll('canvas').forEach((cv, k) => paintPortrait(cv, CHARS[owned()[k]]));
  }
  roster.addEventListener('click', (e) => {
    const b = e.target.closest('.rg-char');
    if (!b) return;
    cur = b.dataset.id; sfx('move'); paint();
  });
  const go = (mode) => {
    if (wiping()) return;
    sfx('stamp');
    afterWipe(() => inkWipe(() => flow.go('select', { mode, loc: 'dingjun', ch: null, map: null })));
  };
  $('[data-nav="tc"]').addEventListener('click', () => go('trainchar'));
  $('[data-nav="ta"]').addEventListener('click', () => go('trainally'));
  navKeys(el, { exit: exitHooks, back: () => { if (!wiping()) { sfx('back'); inkWipe(() => flow.go('title')); } } });
  return {
    enter() { paint(); replay(el, 'in'); fitText(el); },
    exit() { exitHooks.forEach((f) => f()); },
  };
}
