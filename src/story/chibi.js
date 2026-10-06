// CHAPTER III "Red Cliffs" — chapter data (format: ./chapters.js header): metadata, speakers, the battle script (BEATS), the
// prologue cards over the Red Cliffs ink map (PL_MAP) and the epilogue.
// History (winter 208 AD): Cao Cao, master of Jing Province, sails down the Yangtze and chains his fleet at Wulin; Sun Quan and
// Liu Bei ally; Zhou Yu plans a fire attack with Huang Gai's feigned surrender, but the winter wind blows from the north-west — Zhuge Liang
// Liu Bei stand together. Kongming raises the Altar of the Seven Stars on Nanping Hill and "borrows" the south-east wind; Zhou Yu sends Ding Feng
// and Xu Sheng to kill him, but he slips away on Zhao Yun's boat; Huang Gai's fire ships ram the chained fleet and the fire spreads to the camps ashore,
// and Cao Cao flees by Wulin and the Huarong Road (Zhao Yun's ambush west of Wulin, Zhang Liao covering him). Played as either officer: `hero` =
// the chosen one, `ally` = the other one (his pixel portrait). Everyone else speaks under a seal portrait.
// Map (src/world/maps/chibi.js): anchors altar / gate / boat / tent / mouth / road; gate 'shuizhai'; set pieces 'wind'
// (the east wind), 'ignite' (Huang Gai's fire boats and the burning fleet), 'forest' (Wulin catches).

export const CH = {
  id: 'chibi', num: 'CHAPTER III', title: 'Red Cliffs',
  seal: 'FIRE ATTACK', era: 'Winter, 208 AD', map: 'chibi',
  heroes: ['zhugeliang', 'zhaoyun'],
  ally: { zhugeliang: 'zhaoyun', zhaoyun: 'zhugeliang' },
  army: { foe: 'cao', ally: 'liu' },
  // the altar guard drawn up either side of the altar, holding rank until the hero leaves the mesa
  van: [{ x: -24, z: -158, n: 10, cols: 5, hold: true }, { x: 12, z: -166, n: 10, cols: 5, hold: true }],
  hq: [-12, 130],                                  // Cao Cao's command pavilion at Wulin
  rank: { kos: [600, 1200, 2000], time: [600, 780, 960] },   // tuned to the pacing note above BEATS
};

export const SPK = {
  zhouyu: { name: 'Zhou Yu', seal: 'ZY', side: 'shu' },
  huanggai: { name: 'Huang Gai', seal: 'HG', side: 'shu' },
  lusu: { name: 'Lu Su', seal: 'LS', side: 'shu' },
  caocao: { name: 'Cao Cao', seal: 'CC', side: 'wei' },
  caihe: { name: 'Cai He', seal: 'CH2', side: 'wei' },
  dingfeng: { name: 'Ding Feng', seal: 'DF', side: 'wei' },
  xusheng: { name: 'Xu Sheng', seal: 'XS2', side: 'wei' },
  zhangnan: { name: 'Zhang Nan', seal: 'ZN', side: 'wei' },
  maojie: { name: 'Mao Jie', seal: 'MJ', side: 'wei' },
  yujin: { name: 'Yu Jin', seal: 'YJ', side: 'wei' },
  caoren: { name: 'Cao Ren', seal: 'CR', side: 'wei' },
  xuhuang: { name: 'Xu Huang', seal: 'XH', side: 'wei' },
  zhangliao: { name: 'Zhang Liao', seal: 'ZL', side: 'wei' },
  soldier: { name: 'Cao Soldier', seal: 'SOL', side: 'wei' },
};

// officers (crowd.spawnOfficer). Ding Feng / Xu Sheng are Zhou Yu's men (Wu red lacquer), sent for Kongming: no KO banner, the
// script says they fall back. The admirals and Wulin's generals ≈ 2 combos more than a default officer each.
const WU = { armor: 0x4a1a14, trim: 0xd8b050, cape: 0x8a2418 };
export const OFF = {
  caihe: { name: 'CAI HE', hp: 600, look: { helm: 'cap', armor: 0x243048, trim: 0xc0c8d4, cape: 0x1a2a50, plume: 0x3c7cf0 } },
  dingfeng: { name: 'DING FENG', hp: 520, boss: true, look: { ...WU, helm: 'wing', plume: 0xe8c050 } },
  xusheng: { name: 'XU SHENG', hp: 520, boss: true, look: { ...WU, helm: 'crest', plume: 0xf0e0c0 } },
  zhangnan: { name: 'ZHANG NAN', hp: 700 },
  maojie: { name: 'MAO JIE', hp: 850, look: { helm: 'cap', armor: 0x243048, trim: 0xc0c8d4, cape: 0x1a2a50, plume: 0x3c7cf0 } },
  yujin: { name: 'YU JIN', hp: 1000, look: { helm: 'crest', armor: 0x1e2436, trim: 0xe0b450, cape: 0x2a3a7a, plume: 0xe8eef8 } },
  caoren: { name: 'CAO REN', hp: 1100, look: { helm: 'horn', armor: 0x2a2a34, trim: 0xb08a50, cape: 0x3a2e44, plume: 0x2a64dc } },
  xuhuang: { name: 'XU HUANG', hp: 1100, look: { helm: 'crest', armor: 0x28304a, trim: 0xc0c8d4, cape: 0x1a2a50, plume: 0x3c7cf0 } },
  guard: { name: 'GUARD CAPTAIN', hp: 320 },
};

const NAG = { who: 'lusu', en: 'Wait, General! The wind has not risen yet — the altar must not fall!' };
const NAG_BANK = { who: 'zhouyu', en: 'Don\'t press on alone! Join Huang Gai at the landing first.' };
const NAG_GATE = { who: 'huanggai', en: 'The water camp gate is barred! Cut down Mao Jie and Yu Jin who hold it!' };
const NAG_WOOD = { who: 'zhouyu', en: 'Cao Ren and Xu Huang still hold Wulin. Don\'t push on yet!' };
// The altar anchor lies inside its solid base. Guard its walkable south stair, within reach of a close-range sweep.
const ALTAR_GUARD = ['altar', 0, -15];

// Pacing (default difficulty): a scripted bot that attacks nonstop clears in ≈ 7.5 min with ≈ 3000 KOs (altar 2 min
// fixed by the wind's timer · the pursuers and the landing 70 s · the fire and the gate 90 s · camp and Wulin 80 s ·
// Zhang Liao 2 min); a human reading the dialogue lands at ≈ 10-13 min. Rank thresholds: CH.rank.
export const BEATS = [
  // ---- Nanping Hill the Altar of the Seven Stars: hold the altar until the third watch, when the wind turns
  {
    when: { wait: 30 },
    obj: { en: 'Guard the Altar of the Seven Stars until the east wind rises', go: ALTAR_GUARD, timer: 120 },
    defend: { key: 'altar', at: ALTAR_GUARD, r: 6, hp: 600, name: 'Seven Stars Altar' },
    fail: { when: { hp: ['altar', 0.001] }, en: 'The altar has fallen — and the east wind never came.' },
    limit: { z: ['altar', 0, 13], nag: NAG },
    squads: [{ at: ['altar', 22, 2], n: 14 }, { at: ['altar', -24, -4], n: 14 }],
    morale: 0,
    say: [
      { who: 'lusu', en: 'The third watch is near, and still the wind blows from the north-west... Master Kongming, can you truly borrow the wind?' },
      { who: 'hero', zhugeliang: 'Rest easy, Zijing. At the third watch tonight, the south-east wind will rise.',
        zhaoyun: 'The Strategist works his rite above. While Zilong stands here, no one comes one step nearer!' },
      { who: 'ally', zhugeliang: 'Call the wind, Strategist. Leave the foot of the altar to me!',
        zhaoyun: 'Zilong, Cao Cao\'s spies know of this altar. Hold it — let no one set foot on it.' },
    ],
  },
  {
    when: [{ kos: 30 }, { wait: 20 * 60 }],
    waves: true,
    say: [{ who: 'soldier', en: 'There\'s a witch\'s altar on the hill! Burn it!' }],
  },
  {
    when: [{ kos: 50, wait: 10 * 60 }, { wait: 45 * 60 }],
    skip: { timer: true },
    officers: { caihe: { at: ['altar', 20, 8], engaged: true } },
    squads: [{ at: ['altar', 18, 11], n: 12, charge: true }],
    obj: { en: 'Cut down the spy, Cai He', go: 'caihe', keepTimer: true },
    say: [
      { who: 'caihe', en: 'By the Chancellor\'s secret order — tear down this witch\'s altar!' },
      { who: 'hero', zhugeliang: 'Cai He? Zhou Yu saw through your false surrender long ago.',
        zhaoyun: 'You want the altar? Get past me first!' },
    ],
  },
  {
    when: { down: 'caihe' },
    skip: { timer: true },
    banner: { html: 'spy <em>Cai He</em> slain！', en: 'The spy Cai He is cut down', dur: 150 },
    obj: { en: 'Guard the Altar of the Seven Stars until the east wind rises', go: ALTAR_GUARD, keepTimer: true },
    heal: 0.25, morale: 0.1, hush: true,
    say: [{ who: 'lusu', en: 'Well fought! The altar holds. But the wind...' }],
  },
  // the third watch: the wind turns (set 'wind'); Zhou Yu, afraid of such a man, sends Ding Feng and Xu Sheng to kill him
  {
    when: { timer: true },
    set: 'wind', defend: null, fail: null, waves: false, heal: 0.3, morale: 0.2, hush: true,
    banner: { html: '<em>the east wind</em> rises！', en: 'The south-east wind rises!', dur: 260, big: true },
    obj: { en: 'Make for the riverbank', go: ['beach', 0.25, -0.7] },
    limit: { z: ['beach', 0, -0.62], nag: NAG_BANK },
    say: [
      { who: 'lusu', en: 'The wind... the wind has turned! It truly blows from the south-east!' },
      { who: 'hero', zhugeliang: 'The gusts favor our course. Send Huang Gai the signal and put the plan in motion.',
        zhaoyun: 'The Strategist commands heaven itself!' },
      { who: 'zhouyu', en: 'This man bends heaven and earth to his will... Leave him alive and he will ruin Wu. Ding Feng, Xu Sheng — to the altar!' },
      { who: 'ally', zhugeliang: 'Strategist, Zhou Yu\'s men are coming up the hill! My boat waits at the river — quickly!',
        zhaoyun: 'Zilong, Zhou Yu will not suffer me to live. The boat is at the river — let us go.' },
    ],
  },
  {
    when: { wait: 6 * 60 },
    officers: { dingfeng: { at: ['altar', 17, 12], engaged: true }, xusheng: { at: ['altar', 11, 14], engaged: true } },
    obj: { en: 'Drive off Ding Feng and Xu Sheng', go: 'dingfeng' },
    say: [
      { who: 'dingfeng', en: 'By the Commander\'s order — Zhuge Liang\'s head!' },
      { who: 'hero', zhugeliang: 'So Zhou Yu sends for me after all. A pity — I shan\'t be staying.',
        zhaoyun: 'Harm the Strategist? Ask my spear first!' },
      { who: 'xusheng', en: 'Don\'t let him get away!' },
    ],
  },
  {
    when: { down: 'dingfeng' },
    say: [{ who: 'dingfeng', en: 'Too strong... General Xu, fall back!' }],
  },
  {
    when: { down: 'xusheng' },
    banner: { html: '<em>Ding Feng・Xu Sheng</em> withdraw', en: 'Ding Feng and Xu Sheng fall back', dur: 150 },
    heal: 0.2, morale: 0.1, hush: true, retire: true,
    obj: { en: 'Join Huang Gai at the riverbank landing', go: ['boat', -8, 0] },
    limit: { z: ['gate', 0, -12], nag: NAG_BANK },
    say: [
      { who: 'xusheng', en: 'Zhuge Liang was ready for us... Report to the Commander!' },
      { who: 'ally', zhugeliang: 'Strategist, old General Huang\'s boats are at the landing!',
        zhaoyun: 'To the riverbank, Zilong. Huang Gongfu\'s fire ships wait only for this wind.' },
    ],
  },

  // ---- the river bank: ZHANGNan's pickets on the landing, then Huang Gai's fire ships
  {
    when: { zone: 'beach' },
    squads: [{ at: ['beach', -0.5, -0.35], n: 20 }, { at: ['beach', 0.3, -0.15], n: 20 }, { at: ['beach', -0.3, 0.3], n: 22 }, { at: ['beach', 0.4, 0.55], n: 20 }],
    officers: { zhangnan: { at: ['beach', 0.1, 0.6] } },
    waves: true,
    obj: { en: 'Defeat the riverbank commander, Zhang Nan', go: 'zhangnan' },
    say: [
      { who: 'huanggai', en: 'Cao\'s picket boats have spotted us! Clear the bank so the fire ships can put out!' },
      { who: 'zhangnan', en: 'Not one step nearer the water camp, Wu dogs!' },
    ],
  },
  {
    when: { down: 'zhangnan' },
    banner: { html: '<em>the river bank</em> taken！', en: 'The riverbank is ours', dur: 150 },
    heal: 0.3, morale: 0.15, hush: true, retire: true, waves: false,
    set: 'ignite',
    obj: { en: 'Watch the fire ships go in', go: ['gate', 0, -14] },
    say: [
      { who: 'zhouyu', en: 'The south-east wind is strong! Huang Gongfu — loose the ships!' },
      { who: 'huanggai', en: 'At your command! All fire ships — into Cao\'s chained fleet!' },
      { who: 'hero', zhugeliang: 'Ships chained together: set one alight, and a hundred burn.',
        zhaoyun: 'Look! The fire ships run before the wind like arrows!' },
    ],
  },
  {
    when: { wait: 9 * 60 },
    banner: { html: '<em>Fire on the chained fleet!</em>', dur: 300, big: true },
    morale: 0.25, waves: true,
    officers: { maojie: { at: ['gate', -8, -7] }, yujin: { at: ['gate', 8, -7] } },
    squads: [{ at: ['gate', -10, -13], n: 18 }, { at: ['gate', 10, -13], n: 18 }, { at: ['beach', 0.2, 0.3], n: 18, charge: true }],
    obj: { en: 'Defeat Mao Jie and Yu Jin and break into the water camp', go: 'maojie' },
    limit: { z: ['gate', 0, -3], nag: NAG_GATE },
    say: [
      { who: 'soldier', en: 'The ships... the ships are burning! They\'re chained — we can\'t cut them loose!' },
      { who: 'maojie', en: 'Hold your nerve! Hold the gate — let no one through!' },
      { who: 'yujin', en: 'Yu Jin stands here. This camp will not fall easily!' },
    ],
  },
  {
    when: { down: 'maojie' },
    obj: { en: 'Defeat Yu Jin and break into the water camp', go: 'yujin' },
    say: [{ who: 'yujin', en: 'Mao Jie!... Curse it, the fire is at the stockade!' }],
  },
  {
    when: { down: 'yujin' },
    gate: 'shuizhai', heal: 0.3, morale: 0.15, retire: true, hush: true,
    banner: { html: '<em>CAOarmywaterstockade</em> broken！', en: 'The Cao water camp is broken open!', dur: 180 },
    obj: { en: 'Cut through the water camp to Wulin', go: ['wulin', 0, -0.8] },
    limit: { z: ['wulin', 0, 0.1], nag: NAG_WOOD },
    squads: [{ at: ['shuizhai', -0.3, -0.5], n: 18 }, { at: ['shuizhai', 0.3, -0.1], n: 18 }, { at: ['shuizhai', -0.2, 0.4], n: 20 }],
    say: [
      { who: 'huanggai', en: 'Ha! Cao, you traitor — how do you like the old man\'s false surrender now?' },
      { who: 'ally', zhugeliang: 'Strategist, the fire has spread ashore — Cao\'s army is in chaos!',
        zhaoyun: 'Zilong, straight on to Wulin! That is where Cao Cao will run.' },
    ],
  },

  // ---- Wulin: the woods catch (set 'forest'); Cao Ren and Xu Huang hold the land camp
  {
    when: { zone: 'wulin' },
    set: 'forest', waves: true,
    banner: { html: 'the wind feeds the fire <em>Wulin</em> spreads！', en: 'The wind drives the fire into the woods of Wulin!', dur: 200 },
    officers: { caoren: { at: ['wulin', -0.35, 0.05] }, xuhuang: { at: ['wulin', 0.4, 0.15] } },
    squads: [{ at: ['wulin', -0.4, -0.2], n: 20 }, { at: ['wulin', 0.35, -0.1], n: 20 }, { at: ['wulin', 0, 0.35], n: 22 }],
    obj: { en: 'Defeat Cao Ren and Xu Huang', go: 'caoren' },
    say: [
      { who: 'caoren', en: 'Hold Wulin to the death! No enemy sets foot in the Chancellor\'s camp!' },
      { who: 'xuhuang', en: 'The woods are burning... hold your ranks!' },
    ],
  },
  {
    when: { down: 'caoren' },
    obj: { en: 'Defeat Xu Huang', go: 'xuhuang' },
    say: [{ who: 'xuhuang', en: 'General Cao Ren!... I\'m coming!' }],
  },
  {
    when: { down: 'xuhuang' },
    heal: 0.3, morale: 0.15, retire: true, hush: true, waves: false,
    banner: { html: 'The camp at <em>Wulin</em> is taken!', dur: 170 },
    // Cao Cao (npc actor: he never fights) stands before his pavilion and laughs at his enemies — then the ambush
    actors: { caocao: { kit: 'caocao', role: 'npc', at: ['tent', 0, -9], name: 'CAO CAO', seal: 'CC' } },
    actor: { key: 'caocao', do: 'hold', at: ['tent', 0, -9] },
    obj: { en: 'Pursue Cao Cao', go: 'caocao' },
    limit: { z: ['mouth', 0, 2], nag: NAG_WOOD },
    say: [
      { who: 'caocao', en: 'Ha ha ha... They call Zhou Yu and Zhuge Liang masters of strategy. Fools! Had they set one ambush here, we would all be taken.' },
      { who: 'hero', zhugeliang: 'You laugh too soon, Chancellor. I have been waiting for you.',
        zhaoyun: 'Zhao Zilong, by the Strategist\'s order — I have been waiting for you!' },
    ],
  },
  {
    when: [{ near: [['tent', 0, -9], 18] }, { wait: 14 * 60 }],
    actors: { zhangliao: { kit: 'zhangliao', role: 'boss', at: ['mouth', 0, -4], hp: 2600, name: 'ZHANG LIAO', seal: 'ZL',
      retreatAt: 0.3, intro: 'Zhang Wenyuan, terror of the south' } },
    actor: { key: 'caocao', do: 'retreat', at: ['road', 0, 0] },
    banner: { html: '<em>Zhang Liao</em> covers the retreat!', dur: 170, big: true },
    obj: { en: 'Drive back Zhang Liao', go: 'zhangliao' },
    waves: true,
    say: [
      { who: 'caocao', en: 'Wenyuan, hold the rear! We take the Huarong road!' },
      { who: 'zhangliao', en: 'Go, my lord! While Zhang Liao holds this road, no one passes!' },
      { who: 'hero', zhugeliang: 'Zhang Wenyuan — loyal and brave. What a pity about the master you serve.',
        zhaoyun: 'Out of my way, Zhang Liao!' },
    ],
  },
  {
    when: { below: ['zhangliao', 0.6] },
    skip: { down: 'zhangliao' },
    banner: { html: 'Cao\'s last men throw themselves <em>into the fight!</em>', dur: 160 },
    morale: -0.1,
    squads: [{ at: ['mouth', -8, 10], n: 16, charge: true }, { at: ['mouth', 8, 6], n: 16, charge: true }, { at: ['mouth', 0, -16], n: 16, charge: true }],
    officers: { guard1: { at: ['mouth', -4, 8], engaged: true, like: 'guard' }, guard2: { at: ['mouth', 4, 8], engaged: true, like: 'guard' } },
    say: [
      { who: 'zhangliao', en: 'Is the Chancellor clear yet?... A little longer!' },
      { who: 'ally', zhugeliang: 'Strategist, leave their reinforcements to me — you take Zhang Liao!',
        zhaoyun: 'Zilong, don\'t tarry. Drive Zhang Liao off — Cao Cao runs straight into Yunchang\'s hands.' },
    ],
  },
  {
    when: { down: 'zhangliao' },
    win: true, waves: false, morale: 1,
    banner: { html: '<em>Cao Cao</em> routflee！', en: 'Cao Cao is put to flight!', dur: 260, big: true },
    say: [{ who: 'hero', zhugeliang: 'Eight hundred thousand, gone to ash in a night. So begins the land\'s division in three.',
      zhaoyun: 'Cao Cao flees down the Huarong road! The day is ours!' }],
  },
];

// ---- prologue ink map of the middle Yangtze (viewBox 1600×900, north up): Jiangling upstream, the river bending past Red Cliffs
// (south bank) and Wulin (north bank) to Xiakou, the Yunmeng marshes, the road north-west from Wulin through Huarong
const JIANG = 'M-20 330 C120 318 220 350 320 392 S520 520 640 548 S800 600 900 580 S1080 470 1200 430 S1420 372 1620 360';
const HAN = 'M1240 120 C1260 220 1238 320 1262 402';
const marsh = (list) => list.map(([x, y, w]) => `<path d="M${x - w} ${y} q${w * 0.5} -9 ${w} 0 t${w} 0"/>`).join('');
const peaks = (list, h, w) => list.map(([x, y, k = 1]) =>
  `<path d="M${x - w * k} ${y} Q${x - w * k * 0.35} ${y - h * k * 0.55} ${x} ${y - h * k} Q${x + w * k * 0.3} ${y - h * k * 0.5} ${x + w * k} ${y}Z"/>`).join('');
export const PL_MAP = {
  art: `<g class="pl-mtns" fill="url(#pl-mtn)" filter="url(#pl-ink)">
    ${peaks([[90, 160, 1.1], [240, 140], [380, 170, 0.9], [1360, 150, 1.1], [1500, 170], [1580, 140, 0.9]], 110, 90)}
    ${peaks([[160, 900, 1.2], [360, 880], [560, 905, 1.1], [1060, 890, 0.9], [1260, 905, 1.2], [1460, 885]], 120, 100)}
  </g>
  <g class="pl-mark" data-id="chibi" fill="url(#pl-mtn)" filter="url(#pl-ink)">${peaks([[780, 660, 0.7], [840, 650, 0.9], [900, 668, 0.6]], 90, 60)}</g>
  <g class="pl-mark" data-id="yunmeng" filter="url(#pl-ink)" fill="none" stroke="#56625e" stroke-width="3" opacity=".55" stroke-linecap="round">
    ${marsh([[430, 420, 26], [520, 440, 22], [470, 470, 30], [600, 470, 24], [380, 460, 20], [560, 405, 18], [650, 440, 20]])}
  </g>
  <g class="pl-mark" data-id="jiang" filter="url(#pl-ink)" fill="none" stroke-linecap="round">
    <path d="${JIANG}" stroke="#6f7c78" stroke-width="42" opacity=".32"/><path d="${JIANG}" stroke="#46524f" stroke-width="8" opacity=".7"/>
    <path d="${HAN}" stroke="#6f7c78" stroke-width="18" opacity=".3"/><path d="${HAN}" stroke="#46524f" stroke-width="5" opacity=".6"/>
  </g>
  <g class="pl-mark" data-id="huarong" filter="url(#pl-ink)" fill="none" stroke="#3e3430" stroke-width="4" stroke-dasharray="3 11" stroke-linecap="round" opacity=".7">
    <path d="M760 520 C660 470 560 380 470 330 S300 318 214 318"/>
  </g>
  <g class="pl-labels">
    <g class="pl-mark wei" data-id="jiangling"><rect x="186" y="290" width="32" height="32" rx="3"/><text x="146" y="274">Jiangling</text></g>
    <g class="pl-mark wei" data-id="huarong"><rect x="456" y="300" width="26" height="26" rx="3"/><text x="440" y="284">Huarong</text></g>
    <g class="pl-mark wei" data-id="wulin"><text x="700" y="488">Wulin</text><text class="sm" x="742" y="530">the chained ships</text></g>
    <g class="pl-mark" data-id="chibi"><text x="800" y="718">Red Cliffs</text></g>
    <g class="pl-mark" data-id="xiakou"><rect x="1250" y="412" width="30" height="30" rx="3"/><text x="1234" y="480">Xiakou</text></g>
    <g class="pl-mark" data-id="yunmeng"><text class="sm" x="470" y="520">the Yunmeng marshes</text></g>
    <g class="pl-mark" data-id="jiang"><text class="sm river" x="1020" y="560">THE YANGTZE</text></g>
  </g>`,
  arrows: [
    ['cao1', 'wei', 'M214 336 C340 376 520 470 700 500'],
    ['ally1', 'shu', 'M1250 440 C1130 490 1000 590 880 626'],
    ['fire', 'shu', 'M880 640 C900 600 870 562 800 530'],
    ['flee', 'wei', 'M740 500 C640 450 560 372 482 326'],
  ],
};

// ---- prologue cards (format: chapters.js). Card 4 branches on the hero.
export const PROLOGUE = [
  { cols: ['the thirteenth year of Jian-anwinter', 'Cao CaoholdingJing Province', 'sails east down the river'], en: 'Winter, 208 AD. Master of Jingzhou, Cao Cao sails east down the Yangtze from Jiangling.',
    show: ['jiang', 'jiangling', 'cao1'], focus: [470, 420, 1.12] },
  { cols: ['His northerners are no sailors', 'He chains the ships with iron', 'And moors them at Wulin'], en: 'His northerners are no sailors: he chains his ships together with iron and moors them at Wulin.',
    show: ['wulin', 'yunmeng'], focus: [720, 480, 1.3] },
  { cols: ['Sun and Liu join hands', 'Zhou Yu holds the Red Cliffs', 'Huang Gai offers the fire'], en: 'Sun Quan and Liu Bei join hands. Zhou Yu holds the Red Cliffs, and Huang Gai proposes an attack by fire.',
    show: ['ally1', 'chibi', 'xiakou'], focus: [980, 540, 1.15] },
  { zhugeliang: { cols: ['"All is ready"', '"All but the east wind"', 'Kongming raises the altar'], en: '"All is ready — all but the east wind." Kongming raises an altar on Nanping Hill to call it.' },
    zhaoyun: { cols: ['Zhao Yun of Changshan', 'Guards the strategist', 'Holds the altar'], en: 'Zhao Yun of Changshan is ordered to guard the Strategist at the Altar of the Seven Stars.' },
    show: ['fire'], focus: [830, 590, 1.42] },
  { cols: ['Win or lose', 'One night decides', 'The fate of the realm'], en: 'Win or lose, a single night will decide whether the land splits in three.',
    show: ['flee', 'huarong'], focus: [700, 460, 1.04] },
];

// ---- result screen epilogue (win), branched on the hero
export const EPILOGUE = {
  zhugeliang: {
    en: ['The south-east wind roared. Huang Gai\'s fire ships drove into Cao\'s lines; the chained fleet became a sea of flame that spread to the camps ashore.',
      'Cao Cao fled by the Huarong road, where Guan Yu, remembering an old debt, let him pass. Kongming only smiled: "His time has not yet come. Let Yunchang repay his kindness — that too is well."'],
  },
  zhaoyun: {
    en: ['Zhao Yun sprang his ambush west of Wulin and cut the fleeing army to pieces; Cao Cao escaped with his life alone, down the Huarong road.',
      'There Guan Yu, remembering an old debt, let him go. Cao Cao went north, Sun and Liu divided Jingzhou — and the land was set to split in three.'],
  },
};
