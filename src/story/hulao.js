// CHAPTER I "Hulao Gate" — chapter data (format: ./chapters.js header): metadata, speakers, the battle script (BEATS), the
// prologue cards over the Sishui / Hulao / Luoyang ink map (PL_MAP) and the epilogue.
// History (190 AD, per the Romance): the lords east of the passes rise against Dong Zhuo under the coalition leader Yuan Shao; Shao; Dong Zhuo's vanguard Hua Xiong
// holds Sishuipass and cuts down the coalition's champions until Guan Yu — then a mere mounted archer under Liu Bei — kills him
// Hua Xiong holds Sishui Pass and cuts down the coalition's champions until Guan Yu kills him before the poured wine could cool;
// at Hulao Gate Lü Bu routs Gongsun Zan until the three sworn brothers drive him back through the gate; Dong Zhuo burns Luoyang and flees west.
// Played as any of the three brothers: `hero` = the chosen one, `ally` = CH.ally[hero]; the other two come onto the field
// as ally actors for the duel with Lü Bu (the boss actor, game.actors). The brothers also speak by CHARS id: a line whose
// `who` is the current hero's id is his own.
// Map (world/maps/hulao.js): gates 'gorge' (barricade) and 'hulao' (the gate's doors), shut at the start; anchors
// 'hulao' (the gate's face, z 136), 'outworks' (Hua Xiong's palisade gap), 'wine' (the wine table in the camp).
import { CHARS } from '../chars/index.js';


export const CH = {
  id: 'hulao', num: 'CHAPTER I', title: 'Hulao Gate',
  seal: 'COALITION', era: '190 AD', map: 'hulao',
  heroes: ['liubei', 'guanyu', 'zhangfei'],
  ally: { liubei: 'guanyu', guanyu: 'liubei', zhangfei: 'liubei' },
  army: { foe: 'dong', ally: 'liu' },
  // the brothers' own men drawn up either side of the road inside the camp gate, holding rank until the hero marches out
  van: [{ x: -5.575, z: -131.6, n: 12, cols: 4, hold: true }, { x: 5.575, z: -131.6, n: 12, cols: 4, hold: true }],
  hq: [0, 150],                                    // behind the gate: Lü Bu
  rank: { kos: [500, 1000, 1700], time: [540, 720, 900] },   // tuned to the pacing note above BEATS
};

export const SPK = {
  yuanshao: { name: 'Yuan Shao', seal: 'YS', side: 'shu' },
  yuanshu: { name: 'Yuan Shu', seal: 'YU', side: 'shu' },
  caocao: { name: 'Cao Cao', seal: 'CC', side: 'shu' },
  gongsun: { name: 'Gongsun Zan', seal: 'GZ', side: 'shu' },
  // the brothers: their pixel portrait once their kits are in CHARS, a seal until then
  liubei: { name: 'Liu Bei', seal: 'LB', side: 'shu', char: 'liubei' },
  guanyu: { name: 'Guan Yu', seal: 'GY', side: 'shu', char: 'guanyu' },
  zhangfei: { name: 'Zhang Fei', seal: 'ZF', side: 'shu', char: 'zhangfei' },
  huaxiong: { name: 'Hua Xiong', seal: 'HX', side: 'wei' },
  lijue: { name: 'Li Jue', seal: 'LJ', side: 'wei' },
  guosi: { name: 'Guo Si', seal: 'GS', side: 'wei' },
  zhangliao: { name: 'Zhang Liao', seal: 'ZL', side: 'wei' },
  gaoshun: { name: 'Gao Shun', seal: 'GA', side: 'wei' },
  lubu: { name: 'Lü Bu', seal: 'LU', side: 'wei', char: 'lubu' },
  soldier: { name: 'Dong Zhuo\'s Soldier', seal: 'SOL', side: 'wei' },
};

// crowd officers. Hua Xiong ≈ 2 officers' worth (he has killed four champions); the gate pair are sturdy; the boss is Lü Bu,
// an actor (BEATS), not a crowd officer. Looks: Dong Zhuoarmy lacquer (crowd/armies.js), each his own helm and plume.
export const OFF = {
  huaxiong: { name: 'HUA XIONG', hp: 1100, look: { helm: 'horn', armor: 0x2a1a1e, trim: 0xe0b450, cape: 0x6e1830, plume: 0x9a2ad0 } },
  lijue: { name: 'LI JUE', hp: 700, look: { helm: 'crest', armor: 0x2e2238, trim: 0xb88a48, cape: 0x3a1a50, plume: 0xc060f0 } },
  guosi: { name: 'GUO SI', hp: 700, look: { helm: 'wing', armor: 0x28202e, trim: 0xa88048, cape: 0x4a1a3a, plume: 0x8a3ab0 } },
  zhangliao: { name: 'ZHANG LIAO', hp: 1000, look: { helm: 'crest', armor: 0x1e2230, trim: 0xd8b050, cape: 0x3a2a6a, plume: 0xf0f4fa } },
  gaoshun: { name: 'GAO SHUN', hp: 1000, look: { helm: 'horn', armor: 0x1a1a1e, trim: 0x9a9aa4, cape: 0x3a1a2a, plume: 0x6a2a90 } },
};

// Lü Bu (boss actor, C5) and the brothers who come to fight him beside the hero (ally actors, invulnerable)
const LUBU = { kit: 'lubu', role: 'boss', at: ['hulao', 0, 16], yaw: Math.PI, hp: 4400, poise: 460, retreatAt: 0.25,
  name: 'LÜ BU', seal: 'LU' };
const BRO = {
  liubei: { kit: 'liubei', role: 'ally', name: 'LIU BEI', seal: 'LB' },
  guanyu: { kit: 'guanyu', role: 'ally', name: 'GUAN YU', seal: 'GY' },
  zhangfei: { kit: 'zhangfei', role: 'ally', name: 'ZHANG FEI', seal: 'ZF' },
};
const bros = (a, b) => ({ [a]: { ...BRO[a], at: ['hulao', -7, -26] }, [b]: { ...BRO[b], at: ['hulao', 7, -26] } });

const NAG = { who: 'caocao', en: 'Hold! Hua Xiong still stands. Don\'t push on alone.' };
const NAG_GORGE = { who: 'gongsun', en: 'The gorge is barred. Break the ambush first!' };
const NAG_GATE = { who: 'gongsun', en: 'The gate is shut fast. Beat its guards first!' };

// Pacing (default difficulty): a bot that attacks nonstop clears in ≈ 6 min with ≈ 2800 KOs (plain + Hua Xiong 70 s · gorge
// ambush 70 s · forecourt pair 80 s · Lü Bu ≈ 2.5 min); a human reading the dialogue and steering lands at ≈ 9-12 min.
// Officers come forward only after the hero has fought a while (kos / wait), so rushing never skips a stage.
// The warm wine (Guan Yu only): Cao Cao pours the wine as Hua Xiong comes out, obj.timer counts it cooling (150 s). Killed in time: the
// banner and Cao Cao's "the wine is still warm!"; the timer out first: Cao Cao remarks the wine has gone cold (no fail).
export const BEATS = [
  // ---- the coalition HQ: the war council, then the plain
  {
    when: { wait: 30 },
    obj: { en: 'Break Dong Zhuo\'s army on the plain', go: ['plain', 0, 0.1] },
    squads: [{ at: ['plain', -0.5, -0.4], n: 22 }, { at: ['plain', 0.45, -0.3], n: 22 }, { at: ['plain', -0.25, 0.15], n: 24 }, { at: ['plain', 0.35, 0.4], n: 22 }],
    limit: { z: ['gorge', 0, -1], nag: NAG },
    morale: 0,
    say: [
      { who: 'yuanshao', en: 'Hua Xiong has cut down Bao Zhong, Zu Mao, Yu She and Pan Feng. The coalition has lost its nerve...' },
      { who: 'yuanshao', en: 'If only Yan Liang or Wen Chou were here! With either of them, who would fear Hua Xiong?' },
      { who: 'hero', liubei: 'Unworthy as I am, my brothers and I will go, and lift this burden from you!',
        guanyu: 'Let this humble soldier go. I will lay Hua Xiong\'s head before your tent!',
        zhangfei: 'One Hua Xiong? I\'ll go and twist his head off!' },
      { who: 'yuanshu', guanyu: 'A mere archer, talking out of turn? Throw him out!',
        liubei: 'A petty magistrate of Pingyuan, boasting before the lords?',
        zhangfei: 'A petty magistrate\'s man, boasting before the lords?' },
      { who: 'caocao', en: 'Calm yourself, Gonglu. A man who speaks so boldly must have the courage to match. If he fails, blame him then.' },
    ],
  },
  {
    when: [{ zone: 'plain' }, { kos: 60 }],
    waves: true,
    say: [{ who: 'soldier', en: 'More coalition fools come to die! General Hua\'s blade is still thirsty!' }],
  },
  {
    hero: ['guanyu'],
    when: [{ kos: 60, wait: 15 * 60 }, { wait: 60 * 60 }],
    officers: { huaxiong: { at: ['outworks', 0, -9], engaged: true } },
    obj: { en: 'Slay Hua Xiong before the wine cools', go: 'huaxiong', timer: 150 },
    say: [
      { who: 'caocao', en: 'General, drink this cup of warm wine before you ride.' },
      { who: 'guanyu', en: 'Pour it and leave it. I\'ll be back before it cools.' },
      { who: 'huaxiong', en: 'Another one come to die! Name yourself!' },
    ],
  },
  {
    hero: ['liubei', 'zhangfei'],
    when: [{ kos: 60, wait: 15 * 60 }, { wait: 60 * 60 }],
    officers: { huaxiong: { at: ['outworks', 0, -9], engaged: true } },
    obj: { en: 'Defeat Dong Zhuo\'s vanguard, Hua Xiong', go: 'huaxiong' },
    say: [
      { who: 'huaxiong', en: 'I am Hua Xiong! Every champion the coalition sends dies on my blade!' },
      { who: 'hero', liubei: 'Enough boasting, Hua Xiong! Liu Xuande of Zhuo is here!',
        zhangfei: 'Zhang Yide of Yan is here! Hua Xiong, taste my spear!' },
    ],
  },
  {
    hero: ['guanyu'],
    when: { timer: true },
    skip: { down: 'huaxiong' },
    say: [{ who: 'caocao', en: '...The wine has gone cold. Yunchang, don\'t keep me waiting!' }],
  },
  {
    hero: ['guanyu'],
    when: { down: 'huaxiong' },
    skip: { timer: true },
    hush: true,
    banner: { html: 'Hua Xiong slain — <em>the wine is still warm!</em>', dur: 260, big: true },
    say: [{ who: 'caocao', en: 'The wine is still warm! Yunchang, you are a god of war!' }],
  },
  {
    hero: ['liubei', 'zhangfei'],
    when: { down: 'huaxiong' },
    hush: true,
    banner: { html: 'enemy officer <em>Hua Xiong</em> slain！', en: 'Hua Xiong has fallen!', dur: 200 },
  },
  {
    when: { down: 'huaxiong' },
    heal: 0.35, morale: 0.12, waves: false, retire: true,
    obj: { en: 'Push through the gorge toward Hulao Gate', go: ['gorge', 0, -0.3] },
    limit: { z: ['gorge', 0, 0.62], nag: NAG_GORGE },                 // just short of the 'gorge' barricade (z 58.5)
    say: [
      { who: 'hero', liubei: 'Hua Xiong is dead! Brothers, into the gorge with me!',
        guanyu: 'Here is Hua Xiong\'s head. My lords, advance.',
        zhangfei: 'Ha! So much for Hua Xiong!' },
      { who: 'yuanshao', en: 'Dong Zhuo\'s vanguard is broken! All armies advance on Hulao Gate!' },
    ],
  },

  // ---- the gorge: the ambush from both walls (the mid-battle twist)
  {
    when: { zone: 'gorge' },
    squads: [{ at: ['gorge', -0.3, -0.55], n: 18 }, { at: ['gorge', 0.25, -0.35], n: 20 }],
    waves: true,
    say: [{ who: 'soldier', en: 'The coalition is in the gorge! Warn General Li and General Guo!' }],
  },
  {
    when: [{ at: ['gorge', 0, -0.05] }, { kos: 150 }],
    banner: { html: '<em>Ambush!</em> Troops pour down both walls of the gorge', dur: 170 },
    squads: [{ at: ['gorge', -0.3, 0.05], n: 16, charge: true }, { at: ['gorge', 0.3, 0.1], n: 16, charge: true },
      { at: ['gorge', 0, -0.35], n: 18, charge: true }, { at: ['gorge', 0.05, 0.3], n: 18, charge: true }],
    officers: { lijue: { at: ['gorge', -0.25, 0.22], engaged: true }, guosi: { at: ['gorge', 0.25, 0.26], engaged: true } },
    morale: -0.1,
    obj: { en: 'Defeat the ambush leaders, Li Jue and Guo Si', go: 'lijue' },
    say: [
      { who: 'lijue', en: 'Ha! Both walls are ours. Where will you run now?' },
      { who: 'guosi', en: 'Loose! Let none of them through!' },
      { who: 'ally', liubei: 'Careful, brother! Cut down their leaders and the rest will break!',
        guanyu: 'Brother, Li Jue and Guo Si lead them. Strike them down!',
        zhangfei: 'Don\'t get bogged down, brother. Take their leaders first!' },
    ],
  },
  {
    when: { down: 'lijue' },
    obj: { en: 'Defeat the ambush leader, Guo Si', go: 'guosi' },
    say: [{ who: 'lijue', en: 'Curse it... Guo Si, it\'s yours now!' }],
  },
  {
    when: { down: 'guosi' },
    banner: { html: 'The ambush is broken — <em>the gorge is open</em>', dur: 160 },
    heal: 0.3, morale: 0.12, retire: true, hush: true, gate: 'gorge',
    obj: { en: 'Advance on Hulao Gate', go: ['fore', 0, 0.2] },
    limit: { z: ['hulao', 0, -4], nag: NAG_GATE },
    say: [{ who: 'gongsun', en: 'The ambush is beaten! Hulao Gate lies ahead. I\'ll lead my riders on first!' }],
  },

  // ---- before the gate: Zhang Liao and Gao Shun hold the gate; Gongsun Zan comes back past, routed by Lü Bu
  {
    when: { zone: 'fore' },
    officers: { zhangliao: { at: ['hulao', -9, -15] }, gaoshun: { at: ['hulao', 9, -15] } },
    squads: [{ at: ['fore', -0.5, -0.1], n: 20 }, { at: ['fore', 0.5, 0], n: 20 }, { at: ['fore', 0, 0.45], n: 18 }],
    waves: true,
    obj: { en: 'Defeat the gate\'s guardians, Zhang Liao and Gao Shun', go: 'zhangliao' },
    say: [
      { who: 'zhangliao', en: 'I am Zhang Liao of Yanmen! While I hold this gate, none pass!' },
      { who: 'gaoshun', en: 'The Vanguard Breakers know no retreat — only death!' },
    ],
  },
  {
    when: [{ kos: 70, wait: 12 * 60 }, { wait: 40 * 60 }, { down: 'zhangliao' }, { down: 'gaoshun' }],   // (a guard falling brings Lü Bu on)
    banner: { html: 'Gongsun Zan falls back — <em>Lü Bu is coming</em>', dur: 170 },
    morale: -0.08,
    squads: [{ at: ['hulao', -6, -12], n: 16, charge: true }, { at: ['hulao', 6, -12], n: 16, charge: true }],
    say: [
      { who: 'gongsun', en: 'That Lü Bu is too strong! I can\'t hold him — fall back!' },
      { who: 'hero', liubei: 'Hold fast, Bogui! Liu Bei is here!',
        guanyu: 'Fall back, General Gongsun. Guan Yu stands here!',
        zhangfei: 'Don\'t panic, General! If Lü Bu shows his face, I\'ll fight him three hundred bouts!' },
    ],
  },
  {
    when: { down: 'zhangliao' },
    obj: { en: 'Defeat the gate\'s guardian, Gao Shun', go: 'gaoshun' },
    say: [{ who: 'zhangliao', en: '...Well fought. Gao Shun, the gate is yours!' }],
  },

  // ---- Hulao Gate: the gate opens and Lü Bu rides out; the brothers fight him together
  {
    when: { down: 'gaoshun' },
    gate: 'hulao', hush: true, retire: true, waves: false, heal: 0.3, morale: 0.1,
    actors: { lubu: LUBU },
    banner: { html: '<em>Lü Bu</em> among men — <em>Red Hare</em> among horses', dur: 240, big: true },
    obj: { en: 'Drive back Lü Bu', go: 'lubu' },
    limit: { z: ['hulao', 0, 2] },
    say: [
      { who: 'lubu', en: 'Who dares stand before Lü Fengxian!' },
      { who: 'hero', liubei: 'Lü Bu has no equal. We cannot take him lightly...',
        guanyu: 'Lü Bu. Guan Yu will face you!',
        zhangfei: 'Fengxian, you have judged every man here too lightly. My spear will correct you!' },
    ],
  },
  {
    hero: ['liubei'],
    when: { wait: 7 * 60 },
    actors: bros('guanyu', 'zhangfei'),
    banner: { html: 'Three heroes against <em>Lü Bu</em>', dur: 200, big: true },
    say: [
      { who: 'zhangfei', en: 'Brother! I\'m here!' },
      { who: 'guanyu', en: 'Fear not, brother. Yide and I are with you!' },
    ],
  },
  {
    hero: ['guanyu'],
    when: { wait: 7 * 60 },
    actors: bros('liubei', 'zhangfei'),
    banner: { html: 'Three heroes against <em>Lü Bu</em>', dur: 200, big: true },
    say: [
      { who: 'zhangfei', en: 'Brother! Save half of Lü Bu for me!' },
      { who: 'liubei', en: 'We three brothers fight as one today!' },
    ],
  },
  {
    hero: ['zhangfei'],
    when: { wait: 7 * 60 },
    actors: bros('liubei', 'guanyu'),
    banner: { html: 'Three heroes against <em>Lü Bu</em>', dur: 200, big: true },
    say: [
      { who: 'guanyu', en: 'Yide! I\'m with you!' },
      { who: 'liubei', en: 'We three brothers fight as one today!' },
    ],
  },
  {
    when: { below: ['lubu', 0.5] },
    skip: { down: 'lubu' },
    banner: { html: 'Lü Bu rages — <em>reinforcements pour out!</em>', dur: 170 },
    waves: true, morale: -0.1,
    squads: [{ at: ['hulao', -14, -10], n: 16, charge: true }, { at: ['hulao', 14, -10], n: 16, charge: true }, { at: ['fore', 0, -0.3], n: 16, charge: true }],
    say: [
      { who: 'lubu', en: 'Good! Good! It\'s been too long since I had a real fight!' },
      { who: 'ally', liubei: 'Leave their reinforcements to me, brother. Keep at Lü Bu!',
        guanyu: 'Brother, press him harder!',
        zhangfei: 'Brother, press him harder!' },
    ],
  },
  {
    when: { below: ['lubu', 0.3] },
    skip: { down: 'lubu' },
    actor: { key: 'lubu', do: 'retreat', at: ['hulao', 0, 18] },      // (his withdrawal counts as down: the win beat follows)
  },
  {
    when: { down: 'lubu' },
    win: true, waves: false, morale: 1,
    banner: { html: 'Three heroes against <em>Lü Bu</em> — he flees behind the gate!', dur: 280, big: true },
    say: [{ who: 'lubu', en: '...Three on one — some heroes! I\'ll spare you today!' },
      { who: 'hero', liubei: 'Lü Bu runs! Dong Zhuo\'s fortune is spent!',
      guanyu: 'So that is Lü Bu.',
      zhangfei: 'Come back, Lü Bu! Three hundred more bouts!' }],
  },
];

// ---- prologue ink map of the Luoyang - Hulao - Suanzao country (viewBox 1600x900): the Yellow River across the north,
// Mangshan over Luoyang, Mount Song to the south, the pass between them, Sishui running up into the river, the coalition's camp at Suanzao in the east
const peaks = (list, h, w) => list.map(([x, y, k = 1]) =>
  `<path d="M${x - w * k} ${y} Q${x - w * k * 0.35} ${y - h * k * 0.55} ${x} ${y - h * k} Q${x + w * k * 0.3} ${y - h * k * 0.5} ${x + w * k} ${y}Z"/>`).join('');
const HE = 'M-20 190 C180 235 400 160 620 205 S960 262 1180 205 S1480 160 1620 214';
const SI = 'M932 760 C918 650 940 560 918 470 S902 330 924 222';
const LUO = 'M-20 610 C140 585 250 575 420 598 S600 640 700 610';
export const PL_MAP = {
  art: `<g class="pl-mtns" fill="url(#pl-mtn)" filter="url(#pl-ink)">
    ${peaks([[150, 360, 0.9], [260, 340, 1.1], [380, 355], [500, 345, 0.9], [610, 370, 0.8]], 110, 80)}
    ${peaks([[480, 820, 1.1], [620, 790, 1.3], [760, 815, 1.1], [900, 800, 1.2], [1040, 830, 0.9], [1200, 850, 1.1], [1380, 870]], 140, 100)}
    ${peaks([[1240, 150, 0.7], [1380, 140, 0.8], [1500, 160, 0.7]], 90, 70)}
  </g>
  <g class="pl-mark" data-id="hulao" fill="url(#pl-mtn)" filter="url(#pl-ink)">${peaks([[720, 520, 0.9], [790, 505, 1.2], [860, 530, 0.8]], 130, 70)}</g>
  <g class="pl-mark" data-id="he" filter="url(#pl-ink)" fill="none" stroke-linecap="round">
    <path d="${HE}" stroke="#6f7c78" stroke-width="44" opacity=".35"/><path d="${HE}" stroke="#46524f" stroke-width="9" opacity=".7"/>
  </g>
  <g class="pl-mark" data-id="sishui" filter="url(#pl-ink)" fill="none" stroke-linecap="round">
    <path d="${SI}" stroke="#6f7c78" stroke-width="16" opacity=".35"/><path d="${SI}" stroke="#46524f" stroke-width="4" opacity=".7"/>
  </g>
  <g class="pl-mark" data-id="luoyang" filter="url(#pl-ink)" fill="none" stroke-linecap="round">
    <path d="${LUO}" stroke="#6f7c78" stroke-width="18" opacity=".3"/><path d="${LUO}" stroke="#46524f" stroke-width="4" opacity=".6"/>
  </g>
  <g class="pl-labels">
    <g class="pl-mark wei" data-id="luoyang"><rect x="262" y="486" width="40" height="40" rx="3"/><text x="236" y="566">Luoyang</text><text class="sm" x="236" y="610">Dong Zhuo</text></g>
    <g class="pl-mark wei" data-id="hulao"><rect x="772" y="452" width="30" height="30" rx="3"/><text x="728" y="420">Hulao Gate</text></g>
    <g class="pl-mark wei" data-id="sishui"><text x="956" y="520">Sishuipass</text><text class="sm" x="956" y="562">Hua Xiong</text></g>
    <g class="pl-mark" data-id="suanzao"><rect x="1330" y="330" width="34" height="34" rx="3"/><text x="1300" y="410">Suanzao</text><text class="sm" x="1300" y="452">the coalition leader Yuan Shao</text></g>
    <g class="pl-mark" data-id="he"><text class="sm river" x="520" y="168">YELLOW RIVER</text></g>
    <g class="pl-mark" data-id="lubu"><text class="sm" x="720" y="640">Lü Bu</text></g>
  </g>`,
  arrows: [
    ['dong0', 'wei', 'M320 500 C440 480 600 470 760 470'],
    ['dong1', 'wei', 'M810 470 C860 480 900 490 944 492'],
    ['coal', 'shu', 'M1330 360 C1240 380 1120 430 1010 480'],
    ['liu', 'shu', 'M1560 70 C1500 150 1440 250 1372 322'],
    ['shu1', 'shu', 'M1000 500 C960 505 920 506 880 500'],
    ['lubu1', 'wei', 'M790 490 C790 540 760 580 730 612'],
  ],
};

// ---- prologue cards (format: chapters.js). Card 4 branches on the hero.
export const PROLOGUE = [
  { cols: ['The first year of Chuping', 'The emperor held hostage', 'The capital ruled by terror'], en: '190 AD. Dong Zhuo holds the boy emperor hostage and rules the capital by terror.',
    show: ['luoyang', 'he'], focus: [420, 440, 1.2] },
  { cols: ['Cao Cao sends out the call', 'The lords rise in the east', 'Yuan Shao named leader'], en: 'Cao Cao sends out the call; the lords east of the passes rise and name Yuan Shao their leader.',
    show: ['suanzao', 'coal'], focus: [1180, 420, 1.2] },
  { cols: ['Dong Zhuo sends Hua Xiong', 'To hold Sishui Pass', 'Champion after champion falls'], en: 'Dong Zhuo sends Hua Xiong to hold Sishui Pass. General after general of the coalition falls to him.',
    show: ['dong0', 'dong1', 'sishui', 'hulao'], focus: [760, 500, 1.15] },
  { liubei: { cols: ['Liu Bei of Pingyuan', 'With his sworn brothers', 'Rides in with Gongsun Zan'], en: 'Liu Bei, magistrate of Pingyuan, rides in with Gongsun Zan, his sworn brothers Guan Yu and Zhang Fei at his side.' },
    guanyu: { cols: ['A mere mounted archer', 'Guan Yu steps forward', '"Let me take Hua Xiong"'], en: 'Guan Yu, a mere mounted archer under Liu Bei, asks leave to cut down Hua Xiong.' },
    zhangfei: { cols: ['Zhang Fei of Yan', 'Beside his elder brother', 'Joins the coalition'], en: 'Zhang Fei of Yan rides with his elder brother Liu Bei to join the coalition.' },
    show: ['liu', 'shu1'], focus: [1180, 330, 1.3] },
  { cols: ['On Hulao Gate waits', 'Lü Bu, at the head of his host', 'Peerless under heaven'], en: 'And on Hulao Gate waits Lü Bu — the mightiest warrior under heaven.',
    show: ['lubu', 'lubu1'], focus: [780, 520, 1.4] },
];

// ---- result screen epilogue (win), branched on the hero
export const EPILOGUE = {
  liubei: {
    en: ['Lü Bu fled behind the gate. Fearing the coalition, Dong Zhuo burned Luoyang and dragged the emperor west to Chang\'an.',
      'From that day the names of Liu, Guan and Zhang were known across the land — but the lords, each with his own ambitions, soon went their separate ways.'],
  },
  guanyu: {
    en: ['One stroke over a cup of warm wine made Guan Yu the talk of the lords; before Hulao Gate the three brothers drove Lü Bu back.',
      'Dong Zhuo burned Luoyang and fled west to Chang\'an. The name of Guan Yunchang was known across the land.'],
  },
  zhangfei: {
    en: ['Zhang Fei took on Lü Bu with his serpent spear for fifty bouts; Guan Yu and Liu Bei joined him, and Lü Bu fled.',
      'Dong Zhuo burned Luoyang and moved the capital to Chang\'an. The name "Zhang Fei of Yan" rang across the land.'],
  },
};
