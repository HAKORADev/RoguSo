// The Bio-Lab (rogue/body.js): the owner's body-weapons system. Voxel bodies, clothes stripped part by part (free,
// always), and body mods with battle abilities on the ZXCVB row — no photorealism, no scenes: the lab is a workshop
// that turns anatomy into arsenal (the owner's brief; +16 AO, LEGO-law all the way).
// Data (economy.bio[charId]):
//   clothes { head, armL, armR, legL, legR, upper, lower }   1 = worn, 0 = off (stripping is free; parts under
//                                                            clothes have NO effect — the owner's law)
//   nude        derived: every clothes slot off
//   parts       { penis, eunuchs, breasts, butt, vagina }    0 = not grown, 1 = grown (penis XOR eunuchs: the lab
//                                                            never grows both at once; science otherwise is welcome)
//   upg         per part level (bigger / more / stronger effects)
// Wallet: bodycoins ❋ — dropped by nude enemies (the director asks; the lab's upgrades are priced to feel heavy).
// Battle (bodyStep / bodyAbility, driven by main.js): each grown, EXPOSED part fires on its button with per-battle
//   ammo. Z milk (breasts): a cone spray that slows the wind-up of everyone hit. X fart (butt): a ring that shoves
//   the mob back; HOLD drops a mine that blows the first foe to walk over it. C boner (penis): a lunging strike that
//   steals life (life-steal per the brief); V cum (eunuchs): a splash that sets foes burning and slow; B squirt
//   (vagina): a freeze burst; the dribble after (pee) buffs the allies when the ammo runs dry. Effects land through
//   the crowd arrays and the vfx bus ('rogue:bodyfx') — no new render machinery.
import { on, emit } from '../core/events.js';
import { readBody, writeBody } from '../core/economy.js';

export const CLOTHES = { head: 'Head', upper: 'Upper body', lower: 'Lower body', armL: 'Left arm', armR: 'Right arm', legL: 'Left leg', legR: 'Right leg' };

export const BIO = {
  breasts: { label: 'Breasts', group: 'mod', cost: 40, price: 60, step: 50, max: 5, ability: 'milk spray — their arms slow', ammo: (l) => 3 + l },
  butt:    { label: 'Butt', group: 'mod', cost: 30, price: 60, step: 50, max: 5, ability: 'fart ring · hold: a mine', ammo: (l) => 3 + l },
  penis:   { label: 'Penis', group: 'mod', cost: 50, price: 70, step: 60, max: 5, ability: 'steering strike · life steal', ammo: (l) => 6 + l * 2, alt: 'eunuchs' },
  eunuchs: { label: 'Eunuchs', group: 'mod', cost: 50, price: 70, step: 60, max: 5, ability: 'cum splash — they burn and slow', ammo: (l) => 3 + l, alt: 'penis' },
  vagina:  { label: 'Vagina', group: 'mod', cost: 50, price: 70, step: 60, max: 5, ability: 'squirt freeze · pee buffs the men', ammo: (l) => 3 + l },
};
export const BIO_PARTS = Object.keys(BIO).map((k) => ({ key: k, group: 'mod', ...BIO[k] }));
export const BIO_BUTTON = { KeyZ: 'breasts', KeyX: 'butt', KeyC: 'penis', KeyV: 'eunuchs', KeyB: 'vagina' };

const fresh = (male) => ({
  clothes: { head: 1, upper: 1, lower: 1, armL: 1, armR: 1, legL: 1, legR: 1 },
  nude: false,
  parts: { penis: male ? 1 : 0, eunuchs: 0, breasts: 0, butt: 0, vagina: 0 },
  upg: {},
});
export const sexOf = () => 'male';               // the historical roster is male; the lab offers every mod regardless
export const hasGenitals = () => true;           // (a future female roster flips penis/eunuchs defaults, not the lab)

export const bodyOf = (id) => readBody(id, () => fresh(sexOf(id)));
export function buyBody(id, key, cost, isUpgrade = false) {
  const b = bodyOf(id);
  if (!isUpgrade) {
    if (b.parts[key]) return false;
    const B = BIO[key];
    if (B.alt && b.parts[B.alt]) b.parts[B.alt] = 0;          // the pair law: one or the other, never both
    b.parts[key] = 1;
  } else {
    if (!b.parts[key] || (b.upg[key] | 0) >= BIO[key].max) return false;
    b.upg[key] = (b.upg[key] | 0) + 1;
  }
  writeBody(id, b, cost);
  return true;
}

// ---- battle state (per run; main.js resets it with the battle)
const run = { ammo: {}, mines: [], burn: [], buffT: 0, ready: false };

export function bodyReset() {
  run.ammo = {}; run.mines.length = 0; run.burn.length = 0; run.buffT = 0; run.ready = true;
}
const ammoOf = (charId, key) => {
  if (run.ammo[key] === undefined) {
    const b = bodyOf(charId), l = b.upg[key] | 0;
    run.ammo[key] = b.parts[key] ? BIO[key].ammo(l) : 0;
  }
  return run.ammo[key];
};

const exposed = (id, part) => {
  const b = bodyOf(id);
  if (!b.parts[part]) return false;
  if (part === 'breasts') return !b.clothes.upper && !b.clothes.head;
  if (part === 'butt' || part === 'penis' || part === 'eunuchs' || part === 'vagina') return !b.clothes.lower;
  return true;
};

/** One ability press (main.js forwards the key). Returns true when something fired. All damage goes through the
 *  combat's own strike path (KOs, rewards, reactions stay honest); key: a unique press key per window. */
let press = 0;
export function bodyAbility(game, key) {
  if (!run.ready) return false;
  const h = game.hero, id = h.char.id, part = BIO_BUTTON[key], B = part && BIO[part];
  if (!part || !B || !exposed(id, part)) return false;
  const l = bodyOf(id).upg[part] | 0;
  if (ammoOf(id, part) <= 0) { sfxDeny(); return false; }
  run.ammo[part]--;
  const c = game.crowd, reach = 7 + l * 1.4, yaw = h.yaw;
  const k = `body${part}${++press}`;
  const hit = { shape: 'circle', r: reach, dmg: 14 + l * 6, heavy: true, kb: 'blow', force: 5, lift: 2 };
  if (part === 'breasts') {
    game.combat.strike({ ...hit, dmg: 4, force: 1, lift: 0, heavy: false }, h.x, h.z, yaw, k);
    for (let i = 0; i < c.N; i++) if (c.lastHit[i] === k) c.cd[i] += 60 + l * 18;   // their wind-ups drag: slower attacks
    emit('rogue:bodyfx', { kind: 'milk', x: h.x, y: h.y + 1.2, z: h.z, yaw, r: reach });
  } else if (part === 'butt') {
    game.combat.strike({ ...hit, dmg: 6, force: 9, lift: 0, heavy: false }, h.x, h.z, yaw, k);
    emit('rogue:bodyfx', { kind: 'fart', x: h.x, z: h.z, r: reach });
  } else if (part === 'penis') {
    const n = game.combat.strike({ ...hit, dmg: 16 + l * 6, force: 7, lift: 3 }, h.x, h.z, yaw, k);
    h.hp = Math.min(h.hpMax, h.hp + n * (2 + l));                             // the life-steal law
    emit('rogue:bodyfx', { kind: 'boner', x: h.x, y: h.y + 1, z: h.z, yaw, r: reach });
  } else if (part === 'eunuchs') {
    game.combat.strike({ ...hit, dmg: 8, force: 2, lift: 0, heavy: false }, h.x, h.z, yaw, k);
    for (let i = 0; i < c.N; i++) if (c.lastHit[i] === k && c.st[i] !== 0 && c.st[i] !== 10) {
      run.burn.push({ i, until: game.frame + 240 + l * 40, dps: 1.4 + l * 0.6 });
    }
    emit('rogue:bodyfx', { kind: 'cum', x: h.x, y: h.y + 1, z: h.z, yaw, r: reach });
  } else if (part === 'vagina') {
    game.combat.strike({ ...hit, dmg: 5, force: 0, lift: 0, heavy: false }, h.x, h.z, yaw, k);
    for (let i = 0; i < c.N; i++) if (c.lastHit[i] === k) c.hs[i] = Math.max(c.hs[i], 90 + l * 24);   // frozen where they stand
    emit('rogue:bodyfx', { kind: 'squirt', x: h.x, y: h.y + 1, z: h.z, yaw, r: reach });
  }
  return true;
}
function sfxDeny() { emit('story:banner', { html: '<em>Spent</em> — the body needs a moment', dur: 60 }); }

/** HOLD detection for the mine (main.js tracks KeyX down/up): X pressed long = plant a mine instead of the ring. */
export function bodyMine(game) {
  const h = game.hero, id = h.char.id;
  if (!exposed(id, 'butt') || ammoOf(id, 'butt') <= 0) return false;
  run.ammo.butt--;
  run.mines.push({ x: h.x, z: h.z, t: 0, pow: 30 + (bodyOf(id).upg.butt | 0) * 12 });
  emit('rogue:bodyfx', { kind: 'mine', x: h.x, z: h.z });
  return true;
}

/** Per sim step (main.js calls it inside the guarded step list): mines arm, burns tick, pee buffers the men. */
export function bodyStep(game) {
  if (!run.ready) return;
  const c = game.crowd;
  for (let k = run.mines.length - 1; k >= 0; k--) {
    const m = run.mines[k];
    if (++m.t > 3600) { run.mines.splice(k, 1); continue; }      // a mine waits a minute, then crumbles
    let boom = false;
    for (let i = 0; i < c.N; i++) {
      const s = c.st[i];
      if (s === 0 || s === 10) continue;
      if ((c.x[i] - m.x) ** 2 + (c.z[i] - m.z) ** 2 < 3.2) { boom = true; break; }
    }
    if (boom) {
      game.combat.strike({ shape: 'circle', r: 6, dmg: m.pow, heavy: true, kb: 'launch', force: 8, lift: 7 }, m.x, m.z, 0, `mine${++press}`);
      emit('rogue:bodyfx', { kind: 'minego', x: m.x, z: m.z, r: 6 });
      run.mines.splice(k, 1);
    }
  }
  for (let k = run.burn.length - 1; k >= 0; k--) {
    const b = run.burn[k];
    if (game.frame > b.until || c.st[b.i] === 0 || c.st[b.i] === 10) { run.burn.splice(k, 1); continue; }
    if (game.frame % 24 === 0) {
      game.combat.strike({ shape: 'circle', r: 0.4, dmg: b.dps * 2, heavy: false, kb: 'blow', force: 0, lift: 0 }, c.x[b.i], c.z[b.i], 0, `burn${b.i}_${++press}`, true);
      emit('rogue:bodyfx', { kind: 'burntick', x: c.x[b.i], y: 1.2, z: c.z[b.i] });
    }
  }
}

/** HUD helper: the five parts' state for the battle keys row (exposed? ammo?). */
export function bodyRow(id) {
  return Object.keys(BIO_BUTTON).reduce((out, key) => {
    const part = BIO_BUTTON[key];
    out.push({ key: key.slice(3), part, label: BIO[part].label, ammo: ammoOf(id, part), on: exposed(id, part) });
    return out;
  }, []);
}
