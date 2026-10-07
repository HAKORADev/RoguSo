// The rogue battlefields (rogue/locations.js): every field the war offers, each with its own exclusive enemy kind,
// its boss cycle (who comes back bigger and meaner every time) and the element his spells burn with. The run director
// (rogue/director.js) reads these; the Battle screen (ui/battle.js) lists them.
//   id, name, seal      the card
//   map                 world/maps id
//   army                the foe / ally army pair (crowd/armies.js glyphs + flags + the field's dressing)
//   line                the card's line (why this field fights differently)
//   kind                the exclusive KIND (crowd.js): SKELETON (rise once), SKY (drop in), NINJA (fog in fast), null
//   kindShare           share of spawned squads that carry the exclusive kind (grows with the run's cycles)
//   elem                the bosses' spell element: fire | water | rock | air (vfx palettes)
//   bosses              the boss cycle: actors kit ids (CHARS or NPCS), spawned round-robin, each cycle bigger
//   bossNames           display names for the same cycle (actors need a CHARS/NPCS kit + a name)
//   wave                seconds between reinforcement squads (the pressure knob)
import { KIND } from '../crowd/crowd.js';

export const LOCATIONS = [
  {
    id: 'hulao', name: 'Hulao Gate', seal: 'HL', map: 'hulao',
    army: { foe: 'dong', ally: 'liu' },
    line: 'The fallen of the pass do not stay fallen. Cut them twice.',
    kind: KIND.SKELETON, kindShare: 0.45, elem: 'fire',
    bosses: ['lubu', 'zhangliao', 'xiahouyuan'],
    bossNames: ['Lü Bu', 'Zhang Liao', 'Xiahou Yuan'],
    wave: 17,
  },
  {
    id: 'changban', name: 'Changban', seal: 'CB', map: 'changban',
    army: { foe: 'cao', ally: 'liu' },
    line: 'Cao\'s host arrives from the sky itself — watch the clouds.',
    kind: KIND.SKY, kindShare: 0.4, elem: 'air',
    bosses: ['caocao', 'zhangliao', 'guanyu'],
    bossNames: ['Cao Cao', 'Zhang Liao', 'Guan Yu'],
    wave: 15,
  },
  {
    id: 'chibi', name: 'Red Cliffs', seal: 'RC', map: 'chibi',
    army: { foe: 'cao', ally: 'liu' },
    line: 'In the river fog the assassins are already among you.',
    kind: KIND.NINJA, kindShare: 0.5, elem: 'water',
    bosses: ['caocao', 'zhugeliang', 'zhangfei'],
    bossNames: ['Cao Cao', 'Zhuge Liang', 'Zhang Fei'],
    wave: 16,
  },
  {
    id: 'dingjun', name: 'Mount Dingjun', seal: 'DJ', map: 'dingjun',
    army: { foe: 'wei', ally: 'shu' },
    line: 'The mountain answers Wei\'s drums with falling stone.',
    kind: null, kindShare: 0, elem: 'rock',
    bosses: ['xiahouyuan', 'zhangliao', 'caocao'],
    bossNames: ['Xiahou Yuan', 'Zhang Liao', 'Cao Cao'],
    wave: 18,
  },
];

export const location = (id) => LOCATIONS.find((l) => l.id === id) || LOCATIONS[0];

/** The run modes (main.js startBattle / the director / the result screen all branch on them). */
export const ROGUE_MODES = new Set(['rogue', 'challenge', 'trainchar', 'trainally']);

// ---- boss spell sets (actors.js attack format + elem). One per element: a targeted blast (the spell shape: the
// caster plants, the mark lands where the hero stood), kept honest with the melee kits (weight: spells cost actions).
export const SPELLS = {
  fire: { id: 'fireblast', clip: 'c6', windup: 46, active: 10, recover: 34, dmg: 40, shape: 'spell', r: 4.6, len: 22, elem: 'fire', range: [5, 30], weight: 2 },
  water: { id: 'tidewave', clip: 'c6', windup: 44, active: 10, recover: 34, dmg: 34, shape: 'spell', r: 5.4, len: 22, elem: 'water', range: [5, 30], weight: 2 },
  rock: { id: 'stonerain', clip: 'c6', windup: 48, active: 10, recover: 36, dmg: 46, shape: 'spell', r: 4.2, len: 22, elem: 'rock', range: [5, 30], weight: 2 },
  air: { id: 'airslice', clip: 'c6', windup: 40, active: 10, recover: 30, dmg: 32, shape: 'spell', r: 5, len: 22, elem: 'air', range: [5, 30], weight: 2 },
};
