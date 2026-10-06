// CHAPTER IV "Mount Dingjun" — chapter data (format: ./chapters.js header): metadata, speakers, the battle script (BEATS), the
// prologue cards over the Hanzhong ink map (PL_MAP) and the epilogue.
// History (219 AD, the Hanzhong campaign): Liu Bei camps at Yangping Pass; Fa Zheng counsels seizing the heights of Mount Dingjun; Xiahou Yuan holds the
// mountain, ZHANGHe the eastern lines; Huang Zhong storms the heights and cuts down Xiahou Yuan (older and stronger); Zhao Yun later saves Huang Zhong at
// the Han River and holds the empty camp (the empty-camp stratagem). Played as either officer: `hero` = the chosen one, `ally` = the other one,
// who appears in the dialogue with his pixel portrait (chars/index.js). Everyone else speaks under a seal portrait.
// Map gates (world/map.js GATES): 'pass' barricade, 'weiCamp' castle gate, 'summit' barricade — all shut at the start.
// ['gate', dx, dz] = metres from the camp gate (the map's 'gate' anchor).

export const CH = {
  id: 'dingjun', num: 'CHAPTER IV', title: 'Mount Dingjun',
  seal: 'HANZHONG', era: '219 AD', map: 'dingjun',
  heroes: ['huangzhong', 'zhaoyun'],
  ally: { huangzhong: 'zhaoyun', zhaoyun: 'huangzhong' },
  army: { foe: 'wei', ally: 'shu' },
  // the van drawn up either side of the road inside the HQ gate, holding rank until the hero marches past
  van: [{ x: -5.575, z: -121.6, n: 12, cols: 4, hold: true }, { x: 5.575, z: -121.6, n: 12, cols: 4, hold: true }],
  hq: [4, 208],                                    // Xiahou Yuan's pavilion on the summit
  rank: { kos: [600, 1200, 2000], time: [540, 720, 900] },   // tuned to the pacing note above BEATS
};

export const SPK = {
  liubei: { name: 'Liu Bei', seal: 'LB', side: 'shu' },
  fazheng: { name: 'Fa Zheng', seal: 'FZ', side: 'shu' },
  yuan: { name: 'Xiahou Yuan', seal: 'XY', side: 'wei', char: 'xiahouyuan' },
  zhanghe: { name: 'Zhang He', seal: 'ZH', side: 'wei' },
  shang: { name: 'Xiahou Shang', seal: 'XS', side: 'wei' },
  duxi: { name: 'Du Xi', seal: 'DX', side: 'wei' },
  soldier: { name: 'Wei Soldier', seal: 'SOL', side: 'wei' },
};

// officers (crowd.spawnOfficer). HP: a default officer has 520 (≈ 5 full combos); the boss ≈ 4.5× that, so the
// summit duel runs ~1.5-2 min with a Musou or two, like a DW8 commander.
const YUAN_HP = 2400;                            // Xiahou Yuan: a boss actor (src/actors, NPC kit 'xiahouyuan'), × game.diff.officerHp
export const OFF = {
  shang: { name: 'XIAHOU SHANG', hp: 650 },
  duxi: { name: 'DU XI', hp: 650 },
  zhanghe: { name: 'ZHANG HE', hp: 1100 },
  guard: { name: 'GUARD CAPTAIN', hp: 320 },
};

const SUMMIT_GATE = ['summit', -0.65, -0.53];   // the 'summit' barricade across the ramp (≈ -20, 176)
const NAG = { who: 'fazheng', en: 'Wait, General! The way ahead isn\'t secured — don\'t go in alone.' };
const NAG_GATE = { who: 'fazheng', en: 'The gate is barred. Defeat Zhang He, who guards it!' };

// Pacing (default difficulty): a scripted bot that attacks nonstop and never dodges clears in ≈ 6 min with ≈ 3200 KOs
// (ford 45 s · pass + ambush 60 s · gate duel 90 s · camp and climb 35 s · summit 2.5 min) and ~250 damage taken; a
// human reading the dialogue and steering lands at ≈ 9-13 min. Officers only come forward after the hero has fought a
// while (kos / wait), so rushing shortens a stage but never skips one. Rank thresholds: CH.rank.
export const BEATS = [
  // ---- ShuarmyHQ: briefing, then the ford
  {
    when: { wait: 30 },
    obj: { en: 'Seize the Han River ford', go: ['ford', 0, 0.4] },
    squads: [{ at: ['ford', -0.5, -0.35], n: 22 }, { at: ['ford', 0.45, -0.25], n: 22 }, { at: ['ford', -0.2, 0.2], n: 24 }, { at: ['ford', 0.35, 0.45], n: 22 }],
    limit: { z: ['pass', 0, -1], nag: NAG },
    morale: 0,
    say: [
      { who: 'liubei', en: 'Mount Dingjun is the gate of Hanzhong. Everything rides on this battle!' },
      { who: 'fazheng', en: 'Xiahou Yuan is brave but rash. Take the ford, then the pass, then strike his camp.' },
      { who: 'hero', huangzhong: 'Seventy winters or not, these old bones still have a war in them!',
        zhaoyun: 'Let me lead the van. My spear will open the road!' },
      { who: 'ally', huangzhong: 'General Hansheng, I\'ll hold the rear. Fight without fear!',
        zhaoyun: 'Go on, Zilong. But this old man won\'t let you take all the glory!' },
    ],
  },
  {
    when: [{ zone: 'ford' }, { kos: 60 }],
    waves: true,
    say: [
      { who: 'shang', en: 'Not one Shu soldier crosses the Han! Archers, loose!' },
      { who: 'hero', huangzhong: 'Arrows? You\'d trade shots with me?',
        zhaoyun: 'The ford is thinly held. Through them in one charge!' },
    ],
  },
  {
    when: [{ kos: 60, wait: 15 * 60 }, { wait: 60 * 60 }],
    officers: { shang: { at: ['ford', 0, 0.55], engaged: true } },
    obj: { en: 'Defeat the ford commander, Xiahou Shang', go: 'shang' },
    say: [{ who: 'shang', en: 'I am Xiahou Shang! Name yourself!' }],
  },
  {
    when: { down: 'shang' },
    banner: { html: '<em>Han River ford</em> captured — the army\'s spirit rises', dur: 180 },
    heal: 0.35, morale: 0.12, waves: false, retire: true, hush: true,
    obj: { en: 'Break through the mountain pass', go: ['pass', 0, 0.2] },
    limit: { z: ['pass', 0, 0.68], nag: NAG },                      // just short of the 'pass' barricade (z 59.5)
    say: [{ who: 'fazheng', en: 'The ford is ours! The pass is narrow. Wei will have an ambush waiting.' }],
  },

  // ---- the mountain road: the ambush (mid-battle twist)
  {
    when: { zone: 'pass' },
    squads: [{ at: ['pass', -0.45, -0.55], n: 18 }, { at: ['pass', 0.4, -0.3], n: 20 }],
    waves: true,
    say: [{ who: 'soldier', en: 'Shu troops in the pass! Warn General Xiahou!' }],
  },
  {
    when: [{ at: ['pass', 0, -0.1] }, { kos: 150 }],
    banner: { html: '<em>Ambush!</em> Wei troops pour down both slopes', dur: 170 },
    squads: [{ at: ['pass', -0.85, -0.35], n: 16, charge: true }, { at: ['pass', 0.85, -0.2], n: 16, charge: true },
      { at: ['pass', 0, -0.65], n: 18, charge: true }, { at: ['pass', 0, 0.15], n: 20, charge: true }],
    officers: { duxi: { at: ['pass', 0.3, 0.1], engaged: true } },
    morale: -0.1,
    obj: { en: 'Defeat the ambush leader, Du Xi', go: 'duxi' },
    say: [
      { who: 'duxi', en: 'Ha! You walked right in. This pass will be your grave!' },
      { who: 'fazheng', en: 'An ambush! Cut down Du Xi and the rest will scatter!' },
    ],
  },
  {
    when: { down: 'duxi' },
    banner: { html: '<em>The ambush is broken</em>', dur: 150 },
    heal: 0.3, morale: 0.12, retire: true, hush: true, gate: 'pass',
    obj: { en: 'Defeat Zhang He and open the camp gate', go: 'zhanghe' },
    officers: { zhanghe: { at: ['gate', 0, -9] } },
    squads: [{ at: ['gate', -13, -14], n: 18 }, { at: ['gate', 13, -14], n: 18 }],
    limit: { z: ['gate', 0, -3], nag: NAG_GATE },
    say: [{ who: 'ally', huangzhong: 'General Hansheng! The road behind is clear. The gate is yours!',
      zhaoyun: 'Well fought, Zilong! The gate is ahead, and Zhang He stands before it!' }],
  },

  // ---- Weiarmycampstockade: Zhang He at the gate
  {
    when: { at: ['gate', 0, -28] },
    skip: { down: 'zhanghe' },
    say: [
      { who: 'zhanghe', en: 'While Zhang He stands here, no Shu soldier sets foot past this gate!' },
      { who: 'hero', huangzhong: 'Zhang Junyi! I\'ve long wanted to test your famous blade!',
        zhaoyun: 'Zhang He. Not since Changban. Let us settle it!' },
    ],
  },
  {
    when: { down: 'zhanghe' },
    gate: 'weiCamp', limit: { z: null }, heal: 0.3, morale: 0.15, retire: true, hush: true, waves: false,
    banner: { html: '<em>The Wei camp gate is open!</em>', dur: 180 },
    obj: { en: 'Take the summit and defeat Xiahou Yuan', go: ['gate', 0, 10] },   // through the gate first
    squads: [{ at: ['camp', -0.5, 0.35], n: 20 }, { at: ['camp', 0.5, 0.5], n: 20 }, { at: ['camp', -0.6, 0.62], n: 16 }],   // courtyard ×2, foot of the ramp
    say: [
      { who: 'zhanghe', en: '...Curse it, the camp is lost. All troops, fall back!' },
      { who: 'fazheng', en: 'Zhang He has fled. Xiahou Yuan stands alone! Take the summit and end this!' },
    ],
  },
  {
    when: { at: ['gate', 0, 6] },
    // Xiahou Yuan takes the field before his pavilion and holds it (a boss actor: telegraphed blows, poise, the boss bar)
    actors: { yuan: { kit: 'xiahouyuan', role: 'boss', at: ['summit', 0, 0.2], hp: YUAN_HP } },
    actor: { key: 'yuan', do: 'hold' },
    squads: [{ at: ['summit', -0.55, -0.45], n: 18 }, { at: ['summit', 0.55, -0.4], n: 18 }],
    obj: { en: 'Break through the summit barricade', go: SUMMIT_GATE },
    say: [{ who: 'soldier', en: 'Hold him! Don\'t let him near General Xiahou!' }],
  },
  {
    // the camp's defenders thinned, 40 s passed, or he is up the ramp at the barricade 8 s in: the summit barricade burns
    when: [{ kos: 45 }, { wait: 40 * 60 }, { at: ['summit', 0, -0.9], wait: 8 * 60 }],
    gate: 'summit',
    banner: { html: '<em>The summit barricade is down</em> — the road to the top is open', dur: 160 },
    obj: { en: 'Defeat the enemy commander, Xiahou Yuan', go: 'yuan' },
  },

  // ---- the Dingjun summit: Xiahou Yuan (boss actor), the drums at half HP, the win on his fall (no retreat)
  {
    when: { at: ['summit', 0, -0.35] },           // z ≈ 182: over the barricade (the ramp below it tops out at z ≈ 177)
    skip: { down: 'yuan' },
    banner: { html: 'the enemy commander-in-chief <em>Xiahou Yuan</em>', en: 'Enemy commander: Xiahou Yuan', dur: 150, big: true },
    actor: { key: 'yuan', do: 'join' },          // he leaves his post: a taunt, then at the hero
    waves: true,
    say: [
      { who: 'yuan', huangzhong: 'A white-haired old man, come here to die?',
        zhaoyun: 'Zhao Zilong! Today I repay you for Changban!' },
      { who: 'hero', huangzhong: 'Old, and only stronger for it! Xiahou Yuan, your head is mine!',
        zhaoyun: 'Xiahou Yuan, this mountain belongs to the Han today!' },
    ],
  },
  {
    when: { below: ['yuan', 0.5] },
    skip: { down: 'yuan' },
    banner: { html: 'The Wei war drums thunder — <em>reinforcements!</em>', dur: 170 },
    morale: -0.12,
    squads: [{ at: ['summit', -0.9, 0.5], n: 16, charge: true }, { at: ['summit', 0.9, 0.4], n: 16, charge: true }, { at: ['summit', 0, 0.95], n: 16, charge: true }],
    officers: { guard1: { at: ['summit', -0.5, 0.6], engaged: true, like: 'guard' }, guard2: { at: ['summit', 0.5, 0.6], engaged: true, like: 'guard' } },
    say: [
      { who: 'yuan', en: 'Beat the drums! All troops, crush him!' },
      { who: 'ally', huangzhong: 'Leave the reinforcements to me. Take Xiahou Yuan!',
        zhaoyun: 'This old man will hold their reinforcements. Go, Zilong!' },
    ],
  },
  {
    when: { down: 'yuan' },
    win: true, waves: false, morale: 1,
    banner: { html: 'the enemy commander-in-chief <em>Xiahou Yuan</em> slain！', en: 'Enemy commander Xiahou Yuan has fallen!', dur: 260, big: true },
    say: [{ who: 'hero', huangzhong: 'Old Huang Zhong has cut down Xiahou Yuan!',
      zhaoyun: 'Xiahou Yuan has fallen to Zhao Zilong of Changshan!' }],
  },
];

// ---- prologue ink map of Hanzhong (viewBox 1600x900): the ranges, Mount Dingjun, the Han River, places and troop arrows
const peaks = (list, h, w) => list.map(([x, y, k = 1]) =>
  `<path d="M${x - w * k} ${y} Q${x - w * k * 0.35} ${y - h * k * 0.55} ${x} ${y - h * k} Q${x + w * k * 0.3} ${y - h * k * 0.5} ${x + w * k} ${y}Z"/>`).join('');
const RIVER = 'M-20 360 C180 330 300 420 460 430 S760 360 920 420 S1220 470 1380 420 S1560 400 1620 430';
export const PL_MAP = {
  art: `<g class="pl-mtns" fill="url(#pl-mtn)" filter="url(#pl-ink)">
    ${peaks([[90, 190, 1.1], [210, 170], [330, 200, 1.2], [470, 160, .9], [600, 190, 1.1], [760, 170], [900, 185, 1.2], [1060, 160], [1200, 190, 1.1], [1350, 170, .9], [1500, 195, 1.2]], 120, 90)}
    ${peaks([[120, 900, 1.2], [300, 880], [480, 905, 1.1], [820, 890, .9], [1000, 905, 1.2], [1180, 885], [1380, 900, 1.1], [1540, 890]], 130, 100)}
    ${peaks([[250, 330, .7], [340, 318, .8]], 110, 70)}
  </g>
  <g class="pl-mark" data-id="dingjun" fill="url(#pl-mtn)" filter="url(#pl-ink)">${peaks([[560, 640, .9], [640, 620, 1.35], [730, 645, .85]], 150, 80)}</g>
  <g class="pl-mark" data-id="river" filter="url(#pl-ink)" fill="none" stroke-linecap="round">
    <path d="${RIVER}" stroke="#6f7c78" stroke-width="30" opacity=".35"/><path d="${RIVER}" stroke="#46524f" stroke-width="7" opacity=".7"/>
  </g>
  <g class="pl-labels">
    <g class="pl-mark" data-id="yangping"><rect x="276" y="286" width="30" height="30" rx="3"/><text x="330" y="312">Yangping Pass</text></g>
    <g class="pl-mark" data-id="nanzheng"><rect x="1042" y="282" width="36" height="36" rx="3"/><text x="1034" y="350">Nanzheng</text></g>
    <g class="pl-mark wei" data-id="dingjun"><text x="600" y="690">Mount Dingjun</text><text class="sm" x="686" y="520">Xiahou Yuan</text></g>
    <g class="pl-mark wei" data-id="east"><text class="sm" x="880" y="650">Zhang He holds the east</text></g>
    <g class="pl-mark" data-id="river"><text class="sm river" x="190" y="412">HAN water</text></g>
  </g>`,
  arrows: [
    ['shu1', 'shu', 'M150 880 C185 720 250 520 292 342'],
    ['wei1', 'wei', 'M1040 330 C930 370 810 450 712 548'],
    ['wei2', 'wei', 'M1060 350 C1040 450 990 540 930 590'],
    ['shu2', 'shu', 'M318 338 C390 400 440 480 530 612'],
    ['shu3', 'shu', 'M540 652 C570 616 596 574 626 536'],
    ['shu4', 'shu', 'M668 520 C780 420 900 340 1020 318'],
  ],
};

// ---- prologue cards (format: chapters.js). Card 4 branches on the hero.
export const PROLOGUE = [
  { cols: ['Spring, the twenty-fourth of Jian-an', 'Liu Bei marches north', 'He camps at Yangping Pass'], en: 'Spring, 219 AD. Liu Bei marches north and makes camp at Yangping Pass.',
    show: ['shu1', 'yangping'], focus: [360, 470, 1.22] },
  { cols: ['Wei’s great general Xiahou Yuan', 'Holds Mount Dingjun', 'Zhang He guards the east'], en: 'Wei\'s great general Xiahou Yuan holds Mount Dingjun; Zhang He guards the eastern lines.',
    show: ['wei1', 'wei2', 'nanzheng', 'dingjun', 'east'], focus: [860, 470, 1.1] },
  { cols: ['Fa Zheng counsels:', '"Take the heights of Dingjun"', '"And Hanzhong is ours"'], en: 'Fa Zheng counsels: "Take the heights of Dingjun, and Hanzhong is ours."',
    show: ['shu2', 'river'], focus: [520, 500, 1.2] },
  { huangzhong: { cols: ['The old general Huang Zhong', 'Asks to lead the van', 'Swears to take Xiahou Yuan'], en: 'The old general Huang Zhong asks to lead the van, and swears to take Xiahou Yuan\'s head.' },
    zhaoyun: { cols: ['Zhao Yun of Changshan', 'Rides beside Huang Zhong', 'Across the Han River'], en: 'Zhao Yun of Changshan rides beside Huang Zhong across the Han to strike.' },
    show: ['shu3'], focus: [650, 560, 1.45] },
  { cols: ['Drums shake the sky', 'War cries fill the valleys', 'One battle decides Hanzhong'], en: 'Drums shake the sky and war cries fill the valleys. One battle will decide Hanzhong.',
    show: ['shu4'], focus: [700, 450, 1.04] },
];

// ---- result screen epilogue (win), branched on the hero
export const EPILOGUE = {
  huangzhong: {
    en: ['Huang Zhong drove on without pause; to the roar of drums he cut down Xiahou Yuan, and the Wei army broke.',
      'Liu Bei took Hanzhong and was proclaimed King of Hanzhong. Huang Zhong was named General of the Rear.'],
  },
  zhaoyun: {
    en: ['With Xiahou Yuan slain, Cao Cao came himself. Zhao Yun rescued Huang Zhong at the Han, then threw open his camp gate and silenced the drums.',
      'Fearing an ambush, Wei withdrew. Liu Bei said: "Zilong is courage through and through."'],
  },
};
