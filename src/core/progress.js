// Progress: every battle record and what it unlocks, kept in save.json (core/storage.js).
//   rec: { [stage id]: { [char id]: { [difficulty id]: { rank, time, kos } } } }
// A stage = a story chapter or a trial (story/chapters.js chapter(id)). A win (main.js, story:end → record()) keeps each
// best on its own: the best rank, the fastest clear (s), the most KOs. Nothing else is stored — every unlock is derived
// from the records (UNLOCKS: open(rec)), so no flag can fall out of step with them. Story chapters open in order
// (chapters.js chapterOpen, same records). Readers: the title (chapter / trial / difficulty panels, the records wall),
// select (rank chips, locked officers), result (new records, unlock lines).
import { read, write, remove } from './storage.js';
const ORDER = 'SABC';
const load = () => read('save.json') || { v: 1, rec: {} };
const better = (a, b) => ORDER.indexOf(a) < ORDER.indexOf(b);

/** The whole record tree { [stage]: { [char]: { [difficulty]: { rank, time, kos } } } } (read it, never write it). */
export const records = () => load().rec;

/** Bests over every record matching the given ids (an omitted one = any): { rank, time, kos }, or null when none. */
export function best(stage, char, diff) {
  const R = load().rec;
  let out = null;
  for (const s in R) if (!stage || s === stage) for (const c in R[s]) if (!char || c === char) for (const d in R[s][c]) if (!diff || d === diff) {
    const r = R[s][c][d];
    out = out ? { rank: better(r.rank, out.rank) ? r.rank : out.rank, time: Math.min(out.time, r.time), kos: Math.max(out.kos, r.kos) } : { ...r };
  }
  return out;
}
/** Best rank on a stage by anyone on any tier, or undefined while it is uncleared. */
export const cleared = (stage) => best(stage)?.rank;

// What the records open. id = the thing's own id (a difficulty, an officer, a trial); anything without an entry is always
// open. rule: the line shown on the locked thing.
const onHard = (R) => Object.values(R).some((s) => Object.values(s).some((c) => c.hard || c.chaos));
export const UNLOCKS = [
  { id: 'chaos', text: 'Chaos difficulty', rule: 'Clear any battle on Hard to unlock', open: onHard },
  { id: 'lubu', text: 'Officer Lü Bu', rule: 'Clear Chapter I · Hulao Gate to unlock', open: (R) => !!R.hulao },
  { id: 'hold', text: 'Trial · Hold the Bridge', rule: 'Clear Chapter II · Changban to unlock', open: (R) => !!R.changban },
  { id: 'gauntlet', text: 'Trial · The Gauntlet', rule: 'Clear Chapter IV · Mount Dingjun to unlock', open: (R) => !!R.dingjun },
];
/** The UNLOCKS entry still keeping `id` shut (its rule is what to show), or null when it is open. */
export function locked(id) {
  const u = UNLOCKS.find((q) => q.id === id);
  return u && !u.open(load().rec) ? u : null;
}

/** A win on stage / char / difficulty id with stats { rank, time, kos } (story/index.js stats()). Returns { first: the
 *  stage's first clear, prev: this cell before ({ rank, time, kos } | null), fresh: { rank, time, kos } = which bests it
 *  beat (all false on a first entry), unlocks: the UNLOCKS entries this win opened }. */
export function record(stage, char, diff, { rank = 'C', time, kos }) {
  const s = load(), was = UNLOCKS.filter((u) => u.open(s.rec)), first = !s.rec[stage];
  const row = (s.rec[stage] ||= {})[char] ||= {}, prev = row[diff] || null;
  const fresh = { rank: !!prev && better(rank, prev.rank), time: !!prev && time < prev.time, kos: !!prev && kos > prev.kos };
  row[diff] = prev ? { rank: fresh.rank ? rank : prev.rank, time: Math.min(time, prev.time), kos: Math.max(kos, prev.kos) } : { rank, time, kos };
  write('save.json', s);
  return { first, prev, fresh, unlocks: UNLOCKS.filter((u) => u.open(s.rec) && !was.includes(u)) };
}
