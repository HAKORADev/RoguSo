// The roguelike economy (core/economy.js): coins, XP, ownership and the upgrade tables, kept in rogu.json next to
// save.json (Documents/RoguSo through the shell bridge, localStorage in a plain browser). The design law: nothing is
// lost on death — a battle banks what it earned, upgrades are permanent, the run is the fun, the shop is the meta.
//   coins        the shared wallet (loot drops in battle, challenge rewards)
//   owned        characters the player can deploy (the first officer is free and always owned)
//   upg          per character: { power, speed, muso, luck, health, defense, allies, combo } levels
//   ally         per character: ally training levels { count, power, hp } (trained with the allies in Train)
//   xp           per character: banked XP (spent on training exclusives: crit, block, counter)
//   train        per character: { crit, block, counter } levels (bought with XP only)
// Upgrade effects are applied by readers: hero.js reset (stats), crowd.js (ally count/power), combat.js (crit).
// Everything levels from 0; level L costs PRICE.base + L * PRICE.step of its currency; tables here are the single truth.
import { read, write } from './storage.js';

const FREE_CHAR = 'zhaoyun';                       // the main officer: owned from the first boot

const FRESH = () => ({
  v: 1,
  coins: 0,
  owned: [FREE_CHAR],
  upg: {},                                         // [char] -> { power: 0..MAX, ... }
  ally: {},                                        // [char] -> { count: 0..MAX, power: 0..MAX, hp: 0..MAX }
  allyxp: {},                                      // [char] -> ally XP banked in Train (spends on ally upgrades)
  xp: {},                                          // [char] -> banked xp
  train: {},                                       // [char] -> { crit, block, counter }
  stats: {},                                       // [char] -> lifetime { kills, coins, runs, bestKos, xp }
});

let E = load();

function load() {
  const saved = read('rogu.json');
  const e = FRESH();
  if (!saved) return e;
  for (const k of Object.keys(e)) if (saved[k] !== undefined) e[k] = saved[k];
  if (!e.owned.includes(FREE_CHAR)) e.owned.unshift(FREE_CHAR);
  return e;
}

export const economy = () => E;
export const coins = () => E.coins | 0;
export const owned = () => E.owned.slice();
export const isOwned = (id) => E.owned.includes(id);
export const xpOf = (id) => E.xp[id] | 0;

export function addCoins(n) {
  E.coins = Math.max(0, (E.coins | 0) + (n | 0));
  save();
}
export function own(id) {
  if (!E.owned.includes(id)) { E.owned.push(id); save(); }
}
/** Bank XP for a character; returns the new total. */
export function addXp(id, n) {
  E.xp[id] = Math.max(0, (E.xp[id] | 0) + (n | 0));
  save();
  return E.xp[id];
}
export function spendXp(id, n) {
  if ((E.xp[id] | 0) < n) return false;
  E.xp[id] -= n; save();
  return true;
}
export const allyXpOf = (id) => E.allyxp[id] | 0;
export function addAllyXp(id, n) {
  E.allyxp[id] = Math.max(0, (E.allyxp[id] | 0) + (n | 0));
  save();
  return E.allyxp[id];
}
/** Lifetime stat line for the records (addLifetime on every run end). */
export function addLifetime(id, { kills = 0, coins: c = 0, runs = 0, xp = 0, bestKos = false } = {}) {
  const s = E.stats[id] || (E.stats[id] = { kills: 0, coins: 0, runs: 0, xp: 0, bestKos: 0 });
  s.kills += kills; s.coins += c; s.runs += runs; s.xp += xp;
  if (bestKos && typeof bestKos === 'number') s.bestKos = Math.max(s.bestKos, bestKos);
  save();
}

// ---- upgrade tables. Effects (read by the sim):
//   power   +14% melee damage / level        speed    +6% run speed, +4% attack rate / level
//   muso    +15% musou gauge gain & musou damage / level    luck    +12% coin drop chance / level
//   health  +12% max HP / level              defense  -7% damage taken / level (multiplicative)
//   allies  +3 allied soldiers / level       combo    combo extensions unlock at levels 1/2/3 (moveset.js reads >=)
const UPGRADES = [
  { key: 'power', label: 'Power', line: 'Every strike hits harder', eff: (l) => `+${l * 14}% damage`, max: 12 },
  { key: 'speed', label: 'Speed', line: 'Faster feet, faster hands', eff: (l) => `+${l * 6}% speed`, max: 10 },
  { key: 'muso', label: 'Muso Power', line: 'The gauge fills faster, the Musou bites deeper', eff: (l) => `+${l * 15}% musou`, max: 10 },
  { key: 'luck', label: 'Luck', line: 'Coins fall more often', eff: (l) => `+${l * 12}% coin find`, max: 10 },
  { key: 'health', label: 'Health', line: 'More blood before the fall', eff: (l) => `+${l * 12}% HP`, max: 12 },
  { key: 'defense', label: 'Defense', line: 'Blows land softer', eff: (l) => `-${l * 7}% taken`, max: 10 },
  { key: 'allies', label: 'Allies', line: 'More soldiers follow your banner', eff: (l) => `+${l * 3} allies`, max: 8 },
  { key: 'combo', label: 'Combos', line: 'Longer chains, new finishers', eff: (l) => `chain ${Math.min(6, 4 + l)} hits`, max: 3 },
];
const PRICE = { base: 120, step: 90 };             // coins: level 0 → 120, each next level +90
const ALLY_UPGRADES = [
  { key: 'count', label: 'Ally Count', line: 'A bigger block follows you', eff: (l) => `+${l * 3} soldiers`, max: 8 },
  { key: 'power', label: 'Ally Power', line: 'Your men cut deeper', eff: (l) => `+${l * 10}% damage`, max: 10 },
  { key: 'hp', label: 'Ally Vigor', line: 'Your men stand longer', eff: (l) => `+${l * 10}% HP`, max: 10 },
];
const ALLY_PRICE = { base: 150, step: 110 };       // ally XP: training the block is the only way to earn it
const TRAIN_UPGRADES = [
  { key: 'crit', label: 'Critical Eye', line: 'Chance to strike a true killing blow', eff: (l) => `${l * 6}% critical`, max: 6 },
  { key: 'block', label: 'Guard', line: 'Some blows are turned aside', eff: (l) => `${l * 5}% block`, max: 6 },
  { key: 'counter', label: 'Counter', line: 'A blocked blow answers back', eff: (l) => `${l * 8}% counter damage`, max: 6 },
];
const TRAIN_PRICE = { base: 200, step: 150 };      // XP: training is the only XP sink

export const upgradeList = () => UPGRADES;
export const allyUpgradeList = () => ALLY_UPGRADES;
export const trainList = () => TRAIN_UPGRADES;
export const levelOf = (id, key) => (E.upg[id]?.[key] | 0);
export const allyLevelOf = (id, key) => (E.ally[id]?.[key] | 0);
export const trainLevelOf = (id, key) => (E.train[id]?.[key] | 0);
export const priceOf = (base, step, level) => base + level * step;
export const upgradePrice = (key, id) => {
  const u = UPGRADES.find((q) => q.key === key);
  return priceOf(PRICE.base, PRICE.step, levelOf(id, key));
};
export const allyPrice = (key, id) => {
  const u = ALLY_UPGRADES.find((q) => q.key === key);
  return priceOf(ALLY_PRICE.base, ALLY_PRICE.step, allyLevelOf(id, key));
};
export const trainPrice = (key, id) => {
  const u = TRAIN_UPGRADES.find((q) => q.key === key);
  return priceOf(TRAIN_PRICE.base, TRAIN_PRICE.step, trainLevelOf(id, key));
};

export function buyUpgrade(id, key) {
  const u = UPGRADES.find((q) => q.key === key);
  const l = levelOf(id, key);
  if (!u || l >= u.max) return false;
  const cost = upgradePrice(key, id);
  if (E.coins < cost) return false;
  E.coins -= cost;
  (E.upg[id] || (E.upg[id] = {}))[key] = l + 1;
  save();
  return true;
}
export function buyAlly(id, key) {
  const u = ALLY_UPGRADES.find((q) => q.key === key);
  const l = allyLevelOf(id, key);
  if (!u || l >= u.max) return false;
  const cost = allyPrice(key, id);
  if ((E.allyxp[id] | 0) < cost) return false;
  E.allyxp[id] -= cost;
  (E.ally[id] || (E.ally[id] = {}))[key] = l + 1;
  save();
  return true;
}
export function buyTrain(id, key) {
  const u = TRAIN_UPGRADES.find((q) => q.key === key);
  const l = trainLevelOf(id, key);
  if (!u || l >= u.max) return false;
  const cost = trainPrice(key, id);
  if (!spendXp(id, cost)) return false;
  (E.train[id] || (E.train[id] = {}))[key] = l + 1;
  save();
  return true;
}

// ---- character prices (Fighters): the first officer free, the rest scale with how strong they play
const CHAR_PRICES = { liubei: 400, guanyu: 900, zhangfei: 700, huangzhong: 650, zhugeliang: 800, lubu: 1600 };
export const charPrice = (id) => CHAR_PRICES[id] ?? 0;
export function buyChar(id) {
  const cost = charPrice(id);
  if (E.owned.includes(id) || E.coins < cost) return false;
  E.coins -= cost;
  E.owned.push(id);
  save();
  return true;
}

// ---- derived multipliers the sim reads (hero.js reset, combat, crowd)
export function heroMods(id) {
  const l = (k) => levelOf(id, k);
  return {
    atk: 1 + 0.14 * l('power'),
    speed: 1 + 0.06 * l('speed'),
    rate: 1 + 0.04 * l('speed'),
    muso: 1 + 0.15 * l('muso'),
    luck: 1 + 0.12 * l('luck'),
    hp: 1 + 0.12 * l('health'),
    def: 1 / (1 + 0.07 * l('defense')),            // multiplicative reduction
    allies: 3 * l('allies'),
    combo: l('combo'),
    crit: 0.06 * trainLevelOf(id, 'crit'),
    block: 0.05 * trainLevelOf(id, 'block'),
    counter: 0.08 * trainLevelOf(id, 'counter'),
  };
}
export function allyMods(id) {
  const l = (k) => allyLevelOf(id, k);
  return { count: 3 * l('count'), atk: 1 + 0.1 * l('power'), hp: 1 + 0.1 * l('hp') };
}

/** Dynamic difficulty law (the owner's spec): the field scales with the deployer's total upgrade level — a maxed
 *  monster drags a meaner army in. total 0..~80 → 1.0..~2.6 multiplier on foe hp/dmg/count. */
export function threatOf(id) {
  const U = E.upg[id] || {};
  const total = Object.values(U).reduce((a, b) => a + b, 0) + 0.4 * Object.values(E.train[id] || {}).reduce((a, b) => a + b, 0);
  return 1 + Math.min(1.6, total * 0.033);
}

function save() { write('rogu.json', E); }
/** Re-read after the shell bridge answers (storage.init) — same law as settings/records. */
export function reloadEconomy() { E = load(); }
