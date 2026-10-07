// Game settings: the model, the defaults, the persistence (settings.json through core/storage.js, next to
// save.json / controls.json) and a tiny pub/sub bus. Every consumer (post.js quality, the scheduler, audio buses,
// the input sensitivities) reads values() and subscribes to on('key', ...) — the settings screen writes a key and
// each system applies what it owns. difficulty stays in this file too (difficulty.js owns the picker; storage here).
import { read, write } from './storage.js';

export const DEFAULTS = {
  difficulty: 'normal',
  sound: { sfx: 1.0, music: 0.8, out: 'spatial' },
  display: { hz: 'auto', fps: 0, res: 'native', vsync: true, pacer: false, customCursor: true },
  graphics: {
    shadow: 'high', reflections: 'med', lod: 'high', aa: '4', ssaa: 'off',
    mbCam: 'off', mbObj: 'off', bloom: 'med', gi: 'med', ao: 'off',
    fsrUpscale: 'off', fsrFramegen: 'off', fsrNa: false,
  },
  controls: { mouseSens: 1.0, padSens: 1.0 },
};

const sub = {};
export const on = (key, fn) => (sub[key] || (sub[key] = [])).push(fn);
export const off = (key, fn) => { const a = sub[key], k = a ? a.indexOf(fn) : -1; if (k >= 0) a.splice(k, 1); };
const emit = (key, val) => (sub[key] || []).forEach((fn) => fn(val));

let S = load();

function load() {
  const saved = read('settings.json') || {};
  const merge = (base, over) => {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k of Object.keys(over || {})) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') out[k] = merge(base[k], over[k]);
      else if (over[k] !== undefined) out[k] = over[k];
    }
    return out;
  };
  return merge(DEFAULTS, saved);
}

/** Re-read after the shell bridge has answered (storage.init): modules pre-load from the localStorage mirror alone,
 *  the Documents/RoguSo files are the truth in the shell. */
export function reload() {
  S = load();
  emit('*', 'reload');
}

export const values = () => S;

/** Set one leaf path ('sound.sfx') and persist + notify. */
export function set(path, val) {
  const keys = path.split('.');
  let o = S;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  if (o[keys[keys.length - 1]] === val) return;
  o[keys[keys.length - 1]] = val;
  write('settings.json', S);
  emit(path, val);
  emit('*', path);
}

/** Settings screen helpers: enumerate options per key (label + value) so the UI is data-driven. */
export const SCHEMA = {
  'sound.sfx': { kind: 'slider', label: 'SFX volume', min: 0, max: 1, step: 0.05 },
  'sound.music': { kind: 'slider', label: 'Music volume', min: 0, max: 1, step: 0.05 },
  'sound.out': {
    kind: 'seg', label: 'Audio output',
    options: [
      { v: 'spatial', label: 'Spatial', hint: 'Stereo with built-in virtual surround' },
      { v: 'mono', label: 'Mono', hint: 'Everything summed to one channel' },
    ],
  },
  'display.hz': { kind: 'seg', label: 'Refresh rate', options: () => hzOptions() },
  'display.fps': {
    kind: 'seg', label: 'FPS cap',
    options: [
      { v: 0, label: 'Off' }, { v: 30, label: '30' }, { v: 45, label: '45' }, { v: 60, label: '60' },
      { v: 72, label: '72' }, { v: 90, label: '90' }, { v: 120, label: '120' },
    ],
  },
  'display.res': { kind: 'seg', label: 'Internal resolution', options: () => resOptions(), wide: true },
  'display.vsync': { kind: 'toggle', label: 'V-Sync', hint: 'Off renders as fast as the machine can' },
  'display.pacer': { kind: 'toggle', label: 'Frame pacer', hint: 'Eases the FPS target toward the most stable frame time' },
  'display.customCursor': { kind: 'toggle', label: 'Custom cursor', hint: 'The voxel fire cursor steers with your hand; off uses the system arrow' },
  'graphics.shadow': {
    kind: 'seg', label: 'Shadow detail',
    options: [
      { v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' },
      { v: 'high', label: 'High' }, { v: 'ultra', label: 'Ultra' },
    ],
  },
  'graphics.reflections': {
    kind: 'seg', label: 'Reflections',
    options: [
      { v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' }, { v: 'high', label: 'High' },
    ],
  },
  'graphics.lod': { kind: 'slider', label: 'Detail distance (LOD)', min: 0, max: 1, step: 0.25 },
  'graphics.aa': {
    kind: 'seg', label: 'Anti-aliasing (MSAA)',
    options: [
      { v: '0', label: 'Off' }, { v: '2', label: '2x' }, { v: '4', label: '4x' }, { v: '8', label: '8x' }, { v: '16', label: '16x' },
    ],
  },
  'graphics.ssaa': {
    kind: 'seg', label: 'Supersampling',
    options: [
      { v: 'off', label: 'Off' }, { v: '2', label: '2x' }, { v: '4', label: '4x' }, { v: '8', label: '8x' },
    ],
  },
  'graphics.mbCam': {
    kind: 'seg', label: 'Camera motion blur',
    options: [{ v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' }, { v: 'high', label: 'High' }],
  },
  'graphics.mbObj': {
    kind: 'seg', label: 'Object motion blur',
    options: [{ v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' }, { v: 'high', label: 'High' }],
  },
  'graphics.bloom': {
    kind: 'seg', label: 'Bloom',
    options: [{ v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' }, { v: 'high', label: 'High' }],
  },
  'graphics.gi': {
    kind: 'seg', label: 'Global illumination',
    options: [{ v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' }, { v: 'high', label: 'High' }, { v: 'ultra', label: 'Ultra' }],
  },
  'graphics.ao': {
    kind: 'seg', label: 'Ambient occlusion',
    options: [{ v: 'off', label: 'Off' }, { v: 'low', label: 'Low' }, { v: 'med', label: 'Medium' }, { v: 'high', label: 'High' }],
  },
  'graphics.vfx': { kind: 'toggle', label: 'Visual effects', hint: 'The master switch for every look effect' },
  'graphics.cinematic': { kind: 'toggle', label: 'Cinematic lens', hint: 'The blue-red fringe, film grain and vignette' },
  'graphics.rays': { kind: 'toggle', label: 'God rays', hint: 'Shafts from the sun through the smoke' },
  'graphics.fog': { kind: 'toggle', label: 'Atmospheric fog', hint: 'The distance haze' },
  'graphics.fsrUpscale': {
    kind: 'seg', label: 'FSR upscaler', wide: true, tag: 'FSR',
    options: [
      { v: 'off', label: 'Off' }, { v: 'ultra', label: 'Ultra Perf (2.0x)' }, { v: 'perf', label: 'Performance (1.7x)' },
      { v: 'bal', label: 'Balanced (1.5x)' }, { v: 'qual', label: 'Quality (1.3x)' }, { v: 'uqual', label: 'Ultra Quality (1.2x)' },
    ],
  },
  'graphics.fsrFramegen': {
    kind: 'seg', label: 'FSR frame generation', tag: 'FSR · experimental',
    options: [{ v: 'off', label: 'Off' }, { v: '2', label: 'x2' }, { v: '3', label: 'x3' }, { v: '4', label: 'x4' }],
  },
  'graphics.fsrNa': { kind: 'toggle', label: 'FSR native AA', tag: 'FSR', hint: 'Temporal full-resolution anti-aliasing, the DLAA-grade mode' },
  'controls.mouseSens': { kind: 'slider', label: 'Mouse sensitivity', min: 0.25, max: 3, step: 0.05 },
  'controls.padSens': { kind: 'slider', label: 'Analog sensitivity', min: 0.25, max: 3, step: 0.05 },
};

// ---- display option builders (built lazily: they measure the machine)
let measuredHz = 0;
export function detectedHz() { return measuredHz; }
export function measureHz() {
  return new Promise((res) => {
    if (measuredHz) return res(measuredHz);
    const t = [];
    let n = 0;
    const tick = (now) => {
      t.push(now);
      if (++n < 40) return requestAnimationFrame(tick);
      const dt = (t[t.length - 1] - t[0]) / (t.length - 1);
      measuredHz = [240, 165, 144, 120, 90, 75, 60].find((hz) => Math.abs(1000 / hz - dt) < 1000 / hz * 0.12) || 60;
      res(measuredHz);
    };
    requestAnimationFrame(tick);
  });
}

function hzOptions() {
  const list = [30, 45, 60, 75, 90, 120, 144, 165, 240].filter((hz) => hz <= (measuredHz || 60) * 1.02);
  const opts = [{ v: 'auto', label: `Auto (${measuredHz || '?'} Hz)` }, ...list.map((hz) => ({ v: hz, label: `${hz} Hz` }))];
  return opts;
}

const RES = [
  { v: 'native', label: 'Native' },
  { v: '720', label: 'HD 1280x720' },
  { v: '900', label: 'HD+ 1600x900' },
  { v: '1080', label: 'FHD 1920x1080' },
  { v: '1440', label: 'QHD 2560x1440' },
  { v: '2160', label: '4K UHD 3840x2160' },
  { v: '4320', label: '8K UHD 7680x4320' },
];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function resOptions() {
  const w = innerWidth, h = innerHeight;
  return RES.map((r) => {
    if (r.v === 'native') return { ...r, label: `Native · ${w}x${h} (${arLabel(w, h)})`, hint: 'Current window size' };
    const rh = +r.v, rw = Math.round((rh * w) / h / 2) * 2;
    return { ...r, label: `${rw}x${rh} (${arLabel(rw, rh)})`, hint: 'Higher resolution costs more resources' };
  });
}
export const arLabel = (w, h) => {
  const r = [[32, 9], [21, 9], [16, 10], [16, 9], [5, 4], [4, 3]].find(([a, b]) => Math.abs(w / h - a / b) < 0.02);
  return r ? `${r[0]}:${r[1]}` : `${Math.round((w / h) * 100) / 100}`;
};

/** Internal render size for the current setting (display.res): [w, h] or null for native. */
export function internalRes() {
  const v = S.display.res;
  if (v === 'native') return null;
  const rh = +v;
  return [Math.round((rh * innerWidth) / innerHeight / 2) * 2, rh];
}
