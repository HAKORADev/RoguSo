// Settings screen (#settings, ui lane): Sound / Display / Graphics / Controls, over the idle HOME field like the
// other screens. Data-driven from core/settings.js SCHEMA (sliders, segmented ◄ value ► pickers, toggles) plus the
// Controls pane: the mapping list (primary / secondary chips per action), the Modify arm, live capture ("press a
// key, mouse button or gamepad button"), the duplicates dialog (Overwrite / Change / Cancel), the two sensitivity
// sliders and a reset-to-defaults. Bindings persist to controls.json through core/input.js (setSlot → write → the
// 'bindings' event rebuilds the live maps). Back (Esc / the button) returns to the title. Display changes apply
// live: the scheduler, post.js quality and the audio buses all subscribe to the settings bus.
import { SCHEMA, values, set, measureHz, on, off } from '../core/settings.js';
import { bindings, setSlot, unbindEverywhere, bindingsTemplate, labelSlot, psPad, ACTIONS, MOVE_KEYS } from '../core/input.js';
import { emit } from '../core/events.js';
import { sfx, inkWipe, afterWipe } from './menu.js';
import { read, write } from '../core/storage.js';

const PANE_LABEL = { sound: 'Sound', display: 'Display', graphics: 'Graphics', controls: 'Controls' };
const ACTION_LABEL = { attack: 'Attack', charge: 'Charge attack', jump: 'Jump', dodge: 'Dodge', musou: 'Musou', target: 'Camera target' };
const MOVE_LABEL = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right' };
const CAM_LABEL = { left: 'Camera left', right: 'Camera right' };

const get = (path) => path.split('.').reduce((o, k) => o[k], values());
const fmt = (v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);

export function createSettings(el, flow) {
  el.innerHTML = `
    <div class="s-veil"></div>
    <header class="st-head"><h2>Settings</h2><small>RoguSo</small><span class="st-note"></span></header>
    <nav class="st-tabs">${Object.keys(PANE_LABEL).map((p, i) => `<button data-p="${p}" style="--i:${i}"><b>${PANE_LABEL[p]}</b></button>`).join('')}</nav>
    <div class="st-body"></div>
    <div class="st-capture" hidden><p><b>Press a control</b><small>Keyboard, mouse button or gamepad button · Esc cancels</small></p></div>
    <div class="st-modal" hidden><div class="st-mcard"><p class="st-q"></p>
      <div class="st-mbtns"><button data-m="overwrite"><b>Overwrite</b></button><button data-m="change"><b>Change</b></button><button data-m="cancel"><b>Cancel</b></button></div>
    </div></div>
    <footer class="ui-foot"><span><kbd>Esc</kbd><kbd class="pad">B</kbd>Back</span><span><kbd>Click</kbd>Adjust</span></footer>`;

  const $ = (s) => el.querySelector(s);
  const body = $('.st-body');
  let pane = 'sound', armed = false, capture = null, pending = null, padPoll = 0, paneEls = {};
  let subs = [];                                    // this pane's settings-bus subscriptions (dropped on rebuild)
  const watch = (key, fn) => { subs.push([key, fn]); on(key, fn); };
  const unwatch = () => { for (const [k, f] of subs) off(k, f); subs = []; };

  const capEl = $('.st-capture'), modal = $('.st-modal');

  // ---- widget builders (each returns an element bound to its settings path)
  function rowSlider(path, def) {
    const v = get(path);
    const r = document.createElement('div');
    r.className = 'st-row';
    r.innerHTML = `<label>${def.label}</label><div class="st-sl"><div class="st-track"><i></i></div><b>${fmt(v)}</b></div>`;
    const fill = r.querySelector('i'), num = r.querySelector('b'), track = r.querySelector('.st-track');
    const paint = (val) => { fill.style.width = ((val - def.min) / (def.max - def.min)) * 100 + '%'; num.textContent = fmt(val); };
    paint(v);
    const apply = (val) => { val = Math.round(Math.min(def.max, Math.max(def.min, val)) / def.step) * def.step; val = Math.round(val * 1000) / 1000; set(path, val); paint(val); };
    const fromEvent = (e) => {
      const rc = track.getBoundingClientRect();
      apply(def.min + ((e.clientX - rc.left) / rc.width) * (def.max - def.min));
    };
    let drag = false;
    track.addEventListener('pointerdown', (e) => { drag = true; track.setPointerCapture(e.pointerId); fromEvent(e); sfx('move'); });
    track.addEventListener('pointermove', (e) => drag && fromEvent(e));
    track.addEventListener('pointerup', () => { drag = false; });
    watch(path, paint);
    return r;
  }
  function rowSeg(path, def) {
    const r = document.createElement('div');
    r.className = 'st-row' + (def.wide ? ' wide' : '');
    r.innerHTML = `<label>${def.label}${def.tag ? `<em class="st-tag">${def.tag}</em>` : ''}</label>
      <div class="st-seg"><button class="st-prev" aria-label="previous"><b>◄</b></button><b class="st-val"></b><button class="st-next" aria-label="next"><b>►</b></button></div>`;
    const opts = typeof def.options === 'function' ? def.options() : def.options;
    const val = r.querySelector('.st-val');
    let cur = Math.max(0, opts.findIndex((o) => String(o.v) === String(get(path))));
    const paint = () => {
      val.textContent = opts[cur]?.label ?? '—';
      val.title = opts[cur]?.hint || '';
      r.querySelector('.st-prev').classList.toggle('dis', cur <= 0);
      r.querySelector('.st-next').classList.toggle('dis', cur >= opts.length - 1);
    };
    const go = (d) => {
      cur = Math.min(opts.length - 1, Math.max(0, cur + d));
      set(path, opts[cur].v); paint(); sfx('move');
    };
    r.querySelector('.st-prev').addEventListener('click', () => go(-1));
    r.querySelector('.st-next').addEventListener('click', () => go(1));
    val.addEventListener('click', () => go(1));
    if (typeof def.options === 'function') watch('display.*', () => { const o = def.options(); cur = Math.max(0, o.findIndex((q) => String(q.v) === String(get(path)))); });
    paint();
    return r;
  }
  function rowToggle(path, def) {
    const r = document.createElement('div');
    r.className = 'st-row';
    r.innerHTML = `<label>${def.label}${def.tag ? `<em class="st-tag">${def.tag}</em>` : ''}</label><button class="st-tgl"><b></b></button>`;
    const b = r.querySelector('button b');
    const paint = (v) => { b.textContent = v ? 'On' : 'Off'; r.querySelector('.st-tgl').classList.toggle('on', !!v); };
    paint(get(path));
    r.querySelector('.st-tgl').addEventListener('click', () => { set(path, !get(path)); paint(get(path)); sfx('ok'); });
    watch(path, paint);
    return r;
  }

  function buildPane(name) {
    const p = document.createElement('div');
    p.className = 'st-pane';
    p.dataset.pane = name;
    if (name !== 'controls') {
      for (const [path, def] of Object.entries(SCHEMA)) {
        if (!path.startsWith(name + '.')) continue;
        if (def.kind === 'slider') p.append(rowSlider(path, def));
        else if (def.kind === 'seg') p.append(rowSeg(path, def));
        else if (def.kind === 'toggle') p.append(rowToggle(path, def));
      }
      if (name === 'sound') {
        const note = document.createElement('p');
        note.className = 'st-note2';
        note.textContent = 'Spatial is stereo with a built-in virtual surround; mono sums everything to one channel.';
        p.append(note);
      }
      if (name === 'display') {
        measureHz().then(() => set('display.hz', get('display.hz')));   // refresh the Auto label + cap the list
        const note = document.createElement('p');
        note.className = 'st-note2';
        note.textContent = 'The simulation always advances at its fixed 60 Hz; these set how often frames are presented. Internal resolution is the render target size — the window keeps its own size.';
        p.append(note);
      }
    } else p.append(buildControls());
    return p;
  }

  // ---- Controls pane: mapping list + sensitivities
  function buildControls() {
    const w = document.createElement('div');
    w.innerHTML = `
      <div class="st-cbar"><button class="st-modify"><b>Modify</b></button><button class="st-reset"><b>Restore defaults</b></button></div>
      <div class="st-map"></div>`;
    const map = w.querySelector('.st-map');
    const rowFor = (group, key, label) => {
      const row = document.createElement('div');
      row.className = 'st-row st-bind';
      row.innerHTML = `<label>${label}</label><div class="st-slots">
        <button class="st-chip" data-slot="0"><b></b></button><button class="st-chip" data-slot="1"><b></b></button></div>`;
      const chips = [...row.querySelectorAll('.st-chip')];
      const paint = () => {
        const slots = group === 'actions' ? bindings().actions[key] : group === 'move' ? bindings().move[key] : bindings().camera[key];
        chips.forEach((c, i) => {
          c.querySelector('b').textContent = labelSlot(slots[i]);
          c.classList.toggle('empty', !slots[i]);
          c.classList.toggle('armed', armed);
        });
      };
      chips.forEach((c, i) => c.addEventListener('click', () => {
        if (!armed) { flashNote('Press Modify first, then click a binding.'); sfx('back'); return; }
        sfx('ok');
        startCapture(group, key, i);
      }));
      paint();
      watch('bindings', paint);
      row.dataset.key = key;
      return row;
    };
    const head = document.createElement('div');
    head.className = 'st-sect';
    head.textContent = 'Battle actions';
    map.append(head);
    for (const a of ACTIONS) map.append(rowFor('actions', a, ACTION_LABEL[a]));
    const head2 = document.createElement('div');
    head2.className = 'st-sect';
    head2.textContent = 'Movement';
    map.append(head2);
    for (const m of MOVE_KEYS) map.append(rowFor('move', m, MOVE_LABEL[m]));
    const head3 = document.createElement('div');
    head3.className = 'st-sect';
    head3.textContent = 'Camera';
    map.append(head3);
    for (const c of ['left', 'right']) map.append(rowFor('camera', c, CAM_LABEL[c]));
    const head4 = document.createElement('div');
    head4.className = 'st-sect';
    head4.textContent = 'Sensitivity';
    map.append(head4);
    map.append(rowSlider('controls.mouseSens', SCHEMA['controls.mouseSens']));
    map.append(rowSlider('controls.padSens', SCHEMA['controls.padSens']));

    w.querySelector('.st-modify').addEventListener('click', () => {
      armed = !armed;
      w.querySelector('.st-modify').classList.toggle('on', armed);
      w.querySelector('.st-modify b').textContent = armed ? 'Done' : 'Modify';
      map.classList.toggle('armed', armed);
      sfx(armed ? 'ok' : 'back');
      map.dispatchEvent(new Event('repaint'));
    });
    w.querySelector('.st-reset').addEventListener('click', () => {
      write('controls.json', bindingsTemplate());
      location.reload();
    });
    watch('bindings', () => map.dispatchEvent(new Event('repaint')));
    map.addEventListener('repaint', () => map.querySelectorAll('.st-row').forEach(() => {}));
    return w;
  }

  const noteEl = $('.st-note');
  let noteT = 0;
  function flashNote(text) { noteEl.textContent = text; clearTimeout(noteT); noteT = setTimeout(() => (noteEl.textContent = ''), 2600); }

  // ---- live capture (keys, mouse buttons, pad buttons)
  function startCapture(group, key, slot) {
    capture = { group, key, slot };
    capEl.hidden = false;
    const keyH = (e) => {
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.code === 'Escape') return endCapture();
      if (e.code === 'F11' || e.code.startsWith('F') && e.code.length <= 3) return acceptCapture('Key' + e.code === 'KeyF11' ? null : e.code);
      acceptCapture(e.code);
    };
    const mouseH = (e) => { e.stopImmediatePropagation(); e.preventDefault(); acceptCapture('Mouse' + e.button); };
    const down = { keyH, mouseH, capture: true };
    addEventListener('keydown', keyH, true);
    addEventListener('mousedown', mouseH, true);
    const poll = () => {
      if (!capture) return;
      const p = navigator.getGamepads?.()[0];
      if (p) for (let i = 0; i < p.buttons.length; i++) if (p.buttons[i].pressed) return acceptCapture('Pad' + i);
      padPoll = requestAnimationFrame(poll);
    };
    padPoll = requestAnimationFrame(poll);
    capture.cleanup = () => {
      removeEventListener('keydown', keyH, true);
      removeEventListener('mousedown', mouseH, true);
      cancelAnimationFrame(padPoll);
    };
  }
  function endCapture() {
    capture?.cleanup?.();
    capture = null;
    capEl.hidden = true;
    sfx('back');
  }
  function acceptCapture(code) {
    const c = capture;
    if (!c) return;
    if (!code) return endCapture();
    const holders = [];
    for (const g of ['actions', 'move', 'camera']) {
      const table = g === 'actions' ? bindings().actions : g === 'move' ? bindings().move : bindings().camera;
      for (const key in table) for (let i = 0; i < table[key].length; i++) if (table[key][i] === code && !(g === c.group && key === c.key && i === c.slot)) holders.push({ g, key, i });
    }
    if (holders.length) {
      pending = { ...c, code };
      capEl.hidden = true;
      $('.st-q').innerHTML = `<b>${labelSlot(code)}</b> is already bound to <b>${holders.map((h) => nameOf(h)).join(', ')}</b>. Overwrite it?`;
      modal.hidden = false;
    } else commit(c, code);
  }
  const nameOf = (h) => (h.g === 'actions' ? ACTION_LABEL[h.key] : h.g === 'move' ? MOVE_LABEL[h.key] : CAM_LABEL[h.key]);
  function commit(c, code) {
    if (code) unbindEverywhere(code);           // the same device slot must never drive two actions
    setSlot(c.group, c.key, c.slot, code);
    write('controls.json', bindings());
    emit('bindings', bindings());
    endCapture();
    sfx('stamp');
  }
  modal.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-m]');
    if (!b || !pending) return;
    if (b.dataset.m === 'overwrite') { for (const h of findHoldersOf(pending.code)) setSlot(h.g, h.key, h.i, null); commit(pending, pending.code); }
    else if (b.dataset.m === 'change') { modal.hidden = true; startCapture(pending.group, pending.key, pending.slot); }
    else { pending = null; modal.hidden = true; endCapture(); }
    pending = null;
  });
  const findHoldersOf = (code) => {
    const out = [];
    for (const g of ['actions', 'move', 'camera']) {
      const table = g === 'actions' ? bindings().actions : g === 'move' ? bindings().move : bindings().camera;
      for (const key in table) for (let i = 0; i < table[key].length; i++) if (table[key][i] === code) out.push({ g, key, i });
    }
    return out;
  };

  // ---- tabs
  function showPane(p) {
    pane = p;
    unwatch();                                     // dead panes must not keep repainting removed widgets
    for (const el of Object.values(paneEls)) el.remove();
    paneEls = {};
    paneEls[p] = buildPane(p);
    body.append(paneEls[p]);
    for (const b of el.querySelectorAll('.st-tabs button')) b.classList.toggle('on', b.dataset.p === p);
    sfx('move');
  }
  el.addEventListener('click', (e) => {
    const t = e.target.closest('.st-tabs button');
    if (t && t.dataset.p !== pane) showPane(t.dataset.p);
  });
  addEventListener('keydown', (e) => {
    if (!el.isConnected || el.hidden || e.code !== 'Escape' || e.defaultPrevented) return;
    if (capture) { e.preventDefault(); return endCapture(); }
    if (!modal.hidden) { e.preventDefault(); pending = null; modal.hidden = true; endCapture(); return; }
    if (armed) {
      e.preventDefault();
      armed = false;
      const m = el.querySelector('.st-modify');
      if (m) { m.classList.remove('on'); m.querySelector('b').textContent = 'Modify'; }
      el.querySelector('.st-map')?.classList.remove('armed');
      sfx('back');
      return;
    }
    e.preventDefault();
    sfx('back');
    inkWipe(() => flow.go('title'));
  });

  return {
    enter() {
      armed = false; capture = null; pending = null;
      modal.hidden = true; capEl.hidden = true;    // no stale dialog survives into a visit
      showPane('sound');                           // every visit opens on the first tab
      replayIn();
    },
    exit() { unwatch(); if (capture) endCapture(); modal.hidden = true; },
  };
  function replayIn() { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
}
