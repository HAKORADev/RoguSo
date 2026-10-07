// Input → actions from keyboard, mouse and gamepad, driven by the user's bindings (controls.json, edited in the
// Settings → Controls tab).
//   bindings: actions: { attack: ['KeyJ', 'Mouse0'], ... }  — up to two slots per action, each slot is any of
//             'KeyX' (KeyboardEvent.code) | 'Mouse0..4' (pointer button) | 'Pad0..15' (standard-mapping gamepad button)
//             move: { up: ['KeyW', 'ArrowUp'], ... }     camera: { left: ['KeyQ'], right: ['KeyE'] }
//             v: 2. Sensitivities live in settings.json (controls.mouseSens / controls.padSens).
// A slot maps to a holder: { kind:'action', a } | { kind:'dir', mx, my } | { kind:'cam', d }. Held state is per holder
// in a Set per action, so two slots on one action (pad + key) hold independently and a release of one never drops the
// other. The sim calls sample() exactly once per fixed step; "pressed" edges are latched so a tap between two steps is
// never lost. Camera look: mouse = pointer lock while the battle is on (the click that takes the lock does not attack;
// later clicks attack / charge as usual; losing the lock mid-battle pauses like a window blur), camera keys ramp,
// pad right stick yaw + pitch with cubic response and easing.
// Device names for the UI: labelSlot() resolves keyboard names, mouse buttons, or Xbox / PlayStation face labels
// depending on the connected pad (psPad()). No touch input exists anywhere in this game — desktop only.
import { on } from './events.js';
import { values } from './settings.js';

export const ACTIONS = ['attack', 'charge', 'jump', 'dodge', 'musou', 'target'];
export const MOVE_KEYS = ['up', 'down', 'left', 'right'];

const DEFAULT_ACTIONS = {
  attack: ['KeyJ', 'Mouse0'], charge: ['KeyK', 'Mouse2'], jump: ['Space', null], dodge: ['KeyL', 'ShiftLeft'],
  musou: ['KeyI', 'Mouse1'], target: ['KeyR', 'Pad4'],
};
const DEFAULT_MOVE = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
const DEFAULT_CAM = { left: ['KeyQ'], right: ['KeyE'] };

export const bindingsTemplate = () => ({ v: 2, actions: JSON.parse(JSON.stringify(DEFAULT_ACTIONS)), move: JSON.parse(JSON.stringify(DEFAULT_MOVE)), camera: JSON.parse(JSON.stringify(DEFAULT_CAM)) });

let B = null;
export const bindings = () => B;

export function applyBindings(b) {
  const t = bindingsTemplate();
  if (!b || b.v !== 2) { B = t; return; }
  B = {
    v: 2,
    actions: Object.fromEntries(ACTIONS.map((a) => [a, sanitize(b.actions?.[a], DEFAULT_ACTIONS[a])])),
    move: Object.fromEntries(MOVE_KEYS.map((m) => [m, sanitize(b.move?.[m], DEFAULT_MOVE[m])])),
    camera: { left: sanitize(b.camera?.left, DEFAULT_CAM.left), right: sanitize(b.camera?.right, DEFAULT_CAM.right) },
  };
  // migrate saves from before MMB carried the Musou (a user could not have unbound it: it never existed)
  if (B.actions.musou[0] === 'KeyI' && B.actions.musou[1] === null) B.actions.musou[1] = 'Mouse1';
}
const sanitize = (slots, def) => {
  const out = [slots?.[0] || null, slots?.[1] || null];
  if (!out[0] && !out[1]) return [...def];
  return out;
};

/** Every slot bound to `code`: { group, key, slot } (group 'actions' | 'move' | 'camera'). */
export function findHolders(code) {
  const out = [];
  if (!B) return out;
  for (const a of ACTIONS) for (let i = 0; i < 2; i++) if (B.actions[a][i] === code) out.push({ group: 'actions', key: a, slot: i });
  for (const m of MOVE_KEYS) for (let i = 0; i < 2; i++) if (B.move[m][i] === code) out.push({ group: 'move', key: m, slot: i });
  for (const c of ['left', 'right']) if (B.camera[c][0] === code) out.push({ group: 'camera', key: c, slot: 0 });
  return out;
}

/** Remove every occurrence of `code` (the duplicates dialog's Overwrite). */
export function unbindEverywhere(code) {
  for (const h of findHolders(code)) {
    if (h.group === 'actions') B.actions[h.key][h.slot] = null;
    else if (h.group === 'move') B.move[h.key][h.slot] = null;
    else B.camera[h.key][h.slot] = null;
  }
}

/** Set one slot (code null clears). */
export function setSlot(group, key, slot, code) {
  if (group === 'actions') B.actions[key][slot] = code;
  else if (group === 'move') B.move[key][slot] = code;
  else B.camera[key][slot] = code;
}

// ---- device labels for the UI (the connected pad decides Xbox vs PlayStation names)
const KEYS = {
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT', AltRight: 'R-ALT', Enter: 'ENTER', NumpadEnter: 'ENTER', Backspace: 'BKSP', Tab: 'TAB',
  CapsLock: 'CAPS', Escape: 'ESC', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN',
};
const MOUSE = ['LMB', 'RMB', 'MMB', 'MB4', 'MB5'];
const XBOX = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'LS', 'RS', 'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT'];
const PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3', 'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT'];
export const psPad = () => {
  const p = navigator.getGamepads?.()[0];
  return !!(p && !/xbox|045e|microsoft/i.test(p.id) && /054c|sony|dualshock|dualsense|wireless controller/i.test(p.id));
};
export function labelSlot(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return MOUSE[+code.slice(5)] || code;
  if (code.startsWith('Pad')) return (psPad() ? PS : XBOX)[+code.slice(3)] || code;
  if (KEYS[code]) return KEYS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

const LOOK = {
  mouseYaw: 0.0024, mousePitch: 0.0022,   // rad per px of pointer-lock movement, before the sensitivity setting
  keyRate: [0.9, 2.6], keyRamp: 21,        // camera keys: rad/s on the tap → held, steps to reach full rate
  padYaw: 2.8, padPitch: 1.3, padEase: 0.3, padDead: 0.18,   // right stick: max rad/s, per-step easing, radial deadzone
};

export function createInput() {
  const dev = { latch: {}, heldSets: {}, lookX: 0, lookY: 0, keyT: 0, padYaw: 0, padPitch: 0, padBtn: {} };
  const out = { mx: 0, my: 0, orbit: 0, tilt: 0, pressed: {}, held: {} };
  const canvas = document.getElementById('c'), menu = document.getElementById('menu');
  let battle = false, unlockT = -1e9, noLock = false, clickLock = false;
  const locked = () => document.pointerLockElement === canvas;
  const live = () => battle && menu && menu.hidden;
  const lock = (click = false) => { clickLock = click; if (live() && !locked() && !noLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { noLock = true; } } };

  on('flow', (e) => {
    battle = e.state === 'battle';
    if (battle) { noLock = false; lock(); }
    else if (locked()) document.exitPointerLock();
  });
  document.addEventListener('pointerlockerror', () => { if (clickLock) noLock = true; });
  document.addEventListener('pointerlockchange', () => {
    if (locked() || !live()) return;
    unlockT = performance.now();
    dispatchEvent(new Event('blur'));
  });
  document.getElementById('go')?.addEventListener('click', () => { noLock = false; setTimeout(lock); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && performance.now() - unlockT < 300) e.stopImmediatePropagation();
  }, true);

  // code → holders, rebuilt when the bindings change and at boot
  const byCode = {};                 // code → holder[]
  const dirs = [];                   // dir holders (move)
  const cams = [];                   // cam holders (camera.left/right)
  const actionHolders = {};          // action → holder[] (to recompute held from sets)
  function holder(kind, extra) { const h = { kind, down: false, ...extra }; return h; }
  function put(code, h) {
    if (!code) return;
    (byCode[code] || (byCode[code] = [])).push(h);
    if (h.kind === 'action') (actionHolders[h.a] || (actionHolders[h.a] = [])).push(h);
    else if (h.kind === 'dir') dirs.push(h);
    else cams.push(h);
  }
  function rebuild() {
    for (const k in byCode) delete byCode[k];
    dirs.length = 0; cams.length = 0;
    for (const k in actionHolders) delete actionHolders[k];
    if (!B) return;
    for (const a of ACTIONS) {
      const h0 = holder('action', { a }), h1 = holder('action', { a });
      put(B.actions[a][0], h0); put(B.actions[a][1], h1);
    }
    const MX = { up: 0, down: 0, left: -1, right: 1 }, MY = { up: 1, down: -1, left: 0, right: 0 };
    for (const m of MOVE_KEYS) { put(B.move[m][0], holder('dir', { mx: MX[m], my: MY[m] })); put(B.move[m][1], holder('dir', { mx: MX[m], my: MY[m] })); }
    put(B.camera.left[0], holder('cam', { d: -1 }));
    put(B.camera.right[0], holder('cam', { d: 1 }));
    for (const a of ACTIONS) { dev.heldSets[a] = new Set(); out.held[a] = false; out.pressed[a] = false; }
    for (const h of [...dirs, ...cams, ...Object.values(actionHolders).flat()]) h.down = false;
    dev.padBtn = {};
  }
  rebuild();
  on('bindings', rebuild);

  const isKeyCode = (code) => code && !code.startsWith('Mouse') && !code.startsWith('Pad');
  function setDown(code, down) {
    const hs = byCode[code];
    if (!hs) return;
    for (const h of hs) {
      if (h.down === down) continue;
      h.down = down;
      if (h.kind === 'action') {
        const set = dev.heldSets[h.a];
        if (down) {
          set.add(h);
          if (set.size === 1) dev.latch[h.a] = true;    // rising edge of the whole action
        } else set.delete(h);
      }
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    setDown(e.code, true);
  });
  addEventListener('keyup', (e) => setDown(e.code, false));
  addEventListener('blur', () => {
    for (const code in byCode) setDown(code, false);
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button,a,input')) return;
    if (live() && !locked() && !noLock) { lock(true); return; }   // this click only takes the mouse
    setDown('Mouse' + e.button, true);
  });
  addEventListener('pointerup', (e) => setDown('Mouse' + e.button, false));
  addEventListener('pointermove', (e) => { if (locked()) { dev.lookX += e.movementX; dev.lookY += e.movementY; } });

  function pollPad() {
    const p = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!p) return null;
    for (let i = 0; i < p.buttons.length; i++) {
      const down = !!(p.buttons[i] && p.buttons[i].pressed);
      if (down === !!dev.padBtn[i]) continue;
      dev.padBtn[i] = down;
      setDown('Pad' + i, down);
    }
    return p;
  }

  function sample() {
    const sens = values().controls;
    let mx = 0, my = 0, orbit = 0, tilt = 0;
    for (const h of dirs) if (h.down) { mx += h.mx; my += h.my; }
    const pad = pollPad();
    let wantYaw = 0, wantPitch = 0;
    if (pad) {
      const dz = (v) => (Math.abs(v) < LOOK.padDead ? 0 : v);
      mx += dz(pad.axes[0] || 0); my -= dz(pad.axes[1] || 0);
      const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0, r = Math.hypot(rx, ry);
      if (r > LOOK.padDead) {                                        // radial deadzone, rescaled, cubic response
        const k = Math.min(1, (r - LOOK.padDead) / (1 - LOOK.padDead)) ** 3 / r;
        wantYaw = -rx * k * LOOK.padYaw * (sens?.padSens ?? 1); wantPitch = ry * k * LOOK.padPitch * (sens?.padSens ?? 1);
      }
    }
    // eased toward the stick; snapped to 0 once released and settled, so a stale tail never counts as a manual look
    dev.padYaw += (wantYaw - dev.padYaw) * LOOK.padEase; dev.padPitch += (wantPitch - dev.padPitch) * LOOK.padEase;
    if (!wantYaw && Math.abs(dev.padYaw) < 0.02) dev.padYaw = 0;
    if (!wantPitch && Math.abs(dev.padPitch) < 0.02) dev.padPitch = 0;
    orbit += dev.padYaw / 60; tilt += dev.padPitch / 60;
    const camNow = cams.reduce((s, h) => s + (h.down ? h.d : 0), 0);
    dev.keyT = camNow ? dev.keyT + 1 : 0;
    if (camNow) orbit += camNow * (LOOK.keyRate[0] + (LOOK.keyRate[1] - LOOK.keyRate[0]) * Math.min(1, dev.keyT / LOOK.keyRamp)) / 60;
    orbit -= dev.lookX * LOOK.mouseYaw * (sens?.mouseSens ?? 1); tilt += dev.lookY * LOOK.mousePitch * (sens?.mouseSens ?? 1); dev.lookX = dev.lookY = 0;
    for (const a of ACTIONS) {
      out.pressed[a] = !!dev.latch[a];
      out.held[a] = dev.heldSets[a].size > 0;
      dev.latch[a] = false;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    out.mx = mx; out.my = my; out.orbit = orbit; out.tilt = tilt;
    return out;
  }

  return { sample, rebuild };
}
