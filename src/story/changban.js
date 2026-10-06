// CHAPTER II "Changban" — chapter data (format: ./chapters.js header): metadata, speakers, the battle script (BEATS), the
// prologue cards over the Dangyang ink map (PL_MAP) and the epilogue.
// History (208 AD, DangyangChangban): LIUCong surrenders Jing Province; Liu Bei flees south toward Jiangling with a hundred thousand refugees and is
// overtaken at Changban by Cao Cao's light horse. Zhao Yun rides back into the host, finds Lady Gan, takes XiahouEn's the Qinggang Sword, and carries
// the infant Adou out (Lady Mi throws herself into a well); Zhang Fei holds the bridge with twenty riders, raising dust in the
// woods behind him, and roars the pursuit to a standstill (holding the bridge). Played as either officer — the script branches by
// `hero`: Zhao Yun rides out to the village and back (riding alone to the rescue, Zhang Fei holding the bridge as an allied actor); Zhang Fei holds the
// bridge on a timer, rides out to meet Zhao Yun (an allied actor) and brings him home, then stands alone on the bridge.
// Map (world/maps/changban.js): anchors 'bridge' (the deck's middle, z -128), 'gan', 'mizhu', 'well', 'cao' (Cao Cao's post
// on Mount Jing); gate 'jingshan' (never opened: Cao Cao stays out of reach); sets 'well' / 'bridge'.

export const CH = {
  id: 'changban', num: 'CHAPTER II', title: 'Changban',
  seal: 'DANGYANG', era: '208 AD', map: 'changban',
  heroes: ['zhaoyun', 'zhangfei'],
  ally: { zhaoyun: 'zhangfei', zhangfei: 'zhaoyun' },
  army: { foe: 'cao', ally: 'liu' },
  // Zhang Fei's riders at the south foot of the bridge (they hold there: the hero rides north, never past them)
  van: [{ x: -5, z: -142, n: 10, cols: 5, hold: true }, { x: 5, z: -142, n: 10, cols: 5, hold: true }],
  hq: [0, 168],                                    // Cao Cao on Mount Jing
  rank: { kos: [500, 1000, 1700], time: [540, 720, 900] },   // tuned to the pacing note above BEATS
};

export const SPK = {
  liubei: { name: 'Liu Bei', seal: 'LB', side: 'shu', char: 'liubei' },
  mifang: { name: 'Mi Fang', seal: 'MF', side: 'shu' },
  jianyong: { name: 'Jian Yong', seal: 'JY', side: 'shu' },
  gan: { name: 'Lady Gan', seal: 'GAN', side: 'shu' },
  mi: { name: 'Lady Mi', seal: 'MI', side: 'shu' },
  mizhu: { name: 'Mi Zhu', seal: 'MZ', side: 'shu' },
  villager: { name: 'Villager', seal: 'VIL', side: 'shu' },
  caocao: { name: 'Cao Cao', seal: 'CC', side: 'wei', char: 'caocao' },
  caohong: { name: 'Cao Hong', seal: 'CH', side: 'wei' },
  caochun: { name: 'Cao Chun', seal: 'CS', side: 'wei' },
  chunyu: { name: 'Chunyu Dao', seal: 'CD', side: 'wei' },
  xiahouen: { name: 'Xiahou En', seal: 'EN', side: 'wei' },
  yanming: { name: 'Yan Ming', seal: 'YM', side: 'wei' },
  zhanghe: { name: 'Zhang He', seal: 'ZH', side: 'wei' },
  zhongjin: { name: 'Zhong Jin', seal: 'JJ', side: 'wei' },
  zhongshen: { name: 'Zhong Shen', seal: 'WS', side: 'wei' },
  xuchu: { name: 'Xu Chu', seal: 'XC', side: 'wei' },
  xiahoujie: { name: 'Xiahou Jie', seal: 'XJ', side: 'wei' },
  soldier: { name: 'Cao Soldier', seal: 'SOL', side: 'wei' },
};

// officers (crowd.spawnOfficer). A default officer has 520 HP (≈ 5 full combos); ZHANGHe and Xu Chu are the heavyweights.
// Looks (armies.js offLook) set the named ones apart from the CAOarmy officer default.
export const OFF = {
  chunyu: { name: 'CHUNYU DAO', hp: 650, look: { helm: 'cap', armor: 0x3a3440 } },
  xiahouen: { name: 'XIAHOU EN', hp: 800, look: { helm: 'crest', cape: 0x3a1a4a, plume: 0xe8e0d0 } },
  yanming: { name: 'YAN MING', hp: 750, look: { helm: 'horn', armor: 0x3a2a24, trim: 0xb08040 } },
  zhanghe: { name: 'ZHANG HE', hp: 1100, look: { helm: 'crest', armor: 0x28283a, cape: 0x6a2a6a, plume: 0xd8d0f0 } },
  zhongjin: { name: 'ZHONG JIN', hp: 600, look: { helm: 'horn', armor: 0x3a3028, cape: 0x5a2a18 } },
  zhongshen: { name: 'ZHONG SHEN', hp: 600, look: { helm: 'horn', armor: 0x2a3028, cape: 0x1a3a4a } },
  caochun: { name: 'CAO CHUN', hp: 800, look: { helm: 'crest', armor: 0x1a1a22, plume: 0x1a1a1a, cape: 0x6a1a14 } },
  caohong: { name: 'CAO HONG', hp: 900, look: { helm: 'wing', armor: 0x2a2240, trim: 0xe0c060 } },
  xuchu: { name: 'XU CHU', hp: 1400, look: { helm: 'horn', armor: 0x4a3a2a, cape: 0x3a2a1a, plume: 0x2a1a10 } },
  xiahoujie: { name: 'XIAHOU JIE', hp: 700, boss: true, look: { helm: 'crest', cape: 0x2a1a3a, plume: 0xc0c0c0 } },
};

const ZY = ['zhaoyun'], ZF = ['zhangfei'];
/** Hero south of z (the return run: `at` only looks north) — a 1 km circle just touching z at x = 0. */
const south = (z) => ({ near: [['bridge', 0, z + 128 - 1000], 1000] });
const DECK = ['bridge', 0, 8];                  // the north foot of the bridge (z -120)
const CAO = ['cao', 0, 0];
const CAOCAO = { kit: 'caocao', role: 'npc', at: CAO, yaw: Math.PI, name: 'CAO CAO', seal: 'CC' };
// Enemies converge on the hero instead of marching past him: defend the actual north bridgehead. At normal difficulty
// (seed 1, hero invulnerable), an idle guard loses it in 27 s; Zhang Fei's N1→N3→C4 guard keeps 92% through the 150 s hold.
const BRIDGE = { key: 'bridge', at: DECK, r: 5, name: 'Changban Bridge' };
const NAG_ZY = { who: 'hero', en: 'Our lady and the young lord are still out there. I can\'t turn back now!' };
const NAG_ZY_FWD = { who: 'hero', en: 'Save the ones in front of me first, then ride on!' };
const NAG_HOME = { who: 'hero', zhaoyun: 'I have A Dou. Back to the bridge, now!',
  zhangfei: 'Zilong is behind me. I\'m not riding further in!' };
const NAG_ZF = { who: 'hero', en: 'My job is this bridge. I\'m not running off and leaving it!' };

// Pacing (default difficulty), a scripted bot attacking nonstop — Zhao Yun: slopes + Lady Gan + Chunyu Dao 2 min · XiahouEn 1 min · the
// well 40 s · the ride back past Yan Ming / ZHANGHe / Zhong brothers 2.5 min · the bridge 20 s ≈ 6.5 min, ≈ 2400 KOs. Zhang Fei: the
// bridge 150 s (timer) · the ride out and ZHANGHe 1.5 min · the ride back 1 min · the bridge stand 1.5-2 min ≈ 7 min. A human
// reading the lines and steering lands at ≈ 9-13 min. Rank thresholds: CH.rank.
export const BEATS = [
  // ================================================================ Zhao Yun — riding alone to the rescue
  // ---- the bridge: Zhang Fei doubts him; into the slopes
  {
    hero: ZY, when: { wait: 30 },
    actors: { zhangfei: { kit: 'zhangfei', role: 'ally', at: ['bridge', 1.2, 5], yaw: 0 }, caocao: CAOCAO },
    actor: [{ key: 'zhangfei', do: 'hold', at: DECK }, { key: 'caocao', do: 'hold', at: CAO }],
    obj: { en: 'Ride into the slopes and find Lady Gan', go: ['gan', 0, 0] },
    squads: [{ at: ['slopes', -0.35, -0.72], n: 18 }, { at: ['slopes', 0.3, -0.6], n: 20 }, { at: ['slopes', -0.45, -0.3], n: 22 }, { at: ['slopes', 0.4, -0.15], n: 20 }],
    limit: { z: ['slopes', 0, 0.55], back: ['bridge', 0, 5], nag: NAG_ZY },
    morale: -0.1,
    say: [
      { who: 'mifang', en: 'My lord! Zilong has ridden north with a few horsemen. He must be going over to Cao Cao!' },
      { who: 'liubei', en: 'Zilong is my old friend. He would never betray me.' },
      { who: 'ally', en: 'Zilong! Don\'t tell me you\'ve gone over to that traitor Cao?' },
      { who: 'hero', en: 'Put your doubts away, Yide. Our lady and the young lord are lost in the fighting. I\'ll find them, in heaven or under the earth!' },
      { who: 'ally', en: 'Fine! I\'ll wait right here on this bridge. And if you don\'t come back... hmph!' },
    ],
  },
  {
    hero: ZY, when: [{ zone: 'slopes' }, { kos: 40 }],
    waves: true,
    say: [{ who: 'soldier', en: 'The general in white is coming back! Stop him!' }],
  },
  // ---- Lady Gan, then Chunyu Dao with Mi Zhu in ropes
  {
    hero: ZY, when: { near: [['gan', 0, 0], 14] },
    banner: { html: 'found <em>Lady Gan</em>', en: 'Lady Gan is found', dur: 150 },
    heal: 0.2,
    officers: { chunyu: { at: ['mizhu', 0, 4], engaged: true } },
    squads: [{ at: ['mizhu', -8, -4], n: 16, charge: true }, { at: ['gan', 10, 8], n: 16, charge: true }],
    obj: { en: 'Defeat Chunyu Dao and free Mi Zhu', go: 'chunyu' },
    say: [
      { who: 'gan', en: 'General! Lady Mi and I had A Dou with us, but we were torn apart in the rout...' },
      { who: 'hero', en: 'Take heart, my lady. I will bring the young lord back!' },
      { who: 'chunyu', en: 'I\'ve got Mi Zhu tied up! You\'re next, Zhao Yun!' },
    ],
  },
  {
    hero: ZY, when: { down: 'chunyu' },
    banner: { html: '<em>Mi Zhu is freed</em>', dur: 150 },
    heal: 0.3, morale: 0.12, hush: true,
    officers: { xiahouen: { at: ['village', -0.05, -0.72] } },
    squads: [{ at: ['slopes', -0.3, 0.45], n: 20 }, { at: ['slopes', 0.35, 0.5], n: 20 }, { at: ['village', 0.2, -0.8], n: 18 }],
    obj: { en: 'Ride north to Dangyang and find Lady Mi and A Dou', go: ['village', 0, -0.9] },
    limit: { z: ['village', 0, -0.35], back: ['bridge', 0, 5], nag: NAG_ZY_FWD },
    say: [
      { who: 'mizhu', en: 'General Zilong! I owe you my life!' },
      { who: 'hero', en: 'Mi Zhu, take Lady Gan to the bridge. I\'m going back for the young lord!' },
    ],
  },
  // ---- XiahouEn, Cao Cao's sword-bearer: the the Qinggang Sword
  {
    hero: ZY, when: [{ at: ['village', 0, -1.1] }, { kos: 80, wait: 40 * 60 }],
    skip: { down: 'xiahouen' },
    obj: { en: 'Defeat Cao Cao\'s sword-bearer, Xiahou En', go: 'xiahouen' },
    say: [
      { who: 'xiahouen', en: 'I am Xiahou En, who carries the Chancellor\'s sword! This is the Qinggang blade. It cuts iron like mud!' },
      { who: 'hero', en: 'A fine sword. Wasted in your hands!' },
    ],
  },
  {
    hero: ZY, when: { down: 'xiahouen' },
    buff: { atk: 1.5, en: 'The Qinggang sword is yours — attack up' },
    heal: 0.25, morale: 0.1, hush: true,
    squads: [{ at: ['village', -0.4, -0.3], n: 18 }, { at: ['village', 0.45, 0.1], n: 20 }, { at: ['well', -6, 12], n: 16 }],
    obj: { en: 'Find Lady Mi by the old well', go: ['well', -3, 0] },
    limit: { z: ['well', 0, 16], back: ['bridge', 0, 5], nag: NAG_ZY_FWD },
    say: [
      { who: 'hero', en: 'The hilt is inlaid with the word Qinggang in gold. Cao Cao\'s own sword!' },
      { who: 'villager', en: 'General... there\'s a lady with a baby, her leg\'s hurt. She\'s by the dry well, under the broken wall...' },
    ],
  },
  // ---- Lady Mi's well
  {
    hero: ZY, when: { near: [['well', 0, 0], 10] },
    banner: { html: 'Found <em>Lady Mi and Adou</em>', dur: 160 },
    waves: false,
    say: [
      { who: 'mi', en: 'Now that you are here, General, A Dou will live!' },
      { who: 'mi', en: 'I entrust this child to you. I am badly hurt — my death means nothing.' },
      { who: 'hero', en: 'Take my horse, my lady. I\'ll fight on foot and see you out of this!' },
      { who: 'mi', en: 'No! What is a general without his horse? Do not let me be your burden...' },
    ],
  },
  {
    hero: ZY, when: { wait: 16 * 60 },
    banner: { html: 'Lady Mi lays Adou down and throws herself into <em>the dry well</em>', dur: 200 },
    say: [
      { who: 'hero', en: 'My lady—!' },
      { who: 'hero', en: '...Cao\'s men will not defile her. I\'ll bring the wall down over the well!' },
    ],
  },
  {
    hero: ZY, when: { wait: 8 * 60 },
    set: 'well',
    banner: { html: 'carryingAdou <em>cut out of the encirclement</em>', en: 'A Dou in his arms, Zhao Yun cuts his way out', dur: 220, big: true },
    waves: true, heal: 0.3,
    officers: { yanming: { at: ['village', 0.1, -0.7], engaged: true } },
    squads: [{ at: ['well', 10, 14], n: 18, charge: true }, { at: ['well', -18, 8], n: 18, charge: true }, { at: ['village', -0.2, -0.55], n: 22 }, { at: ['village', 0.35, -0.7], n: 18 }],
    obj: { en: 'Carry A Dou back to Changban Bridge', go: DECK },
    limit: { z: ['well', 0, 10], back: ['village', 0, -1.05], nag: NAG_HOME },     // Yan Ming bars the village's south edge
    say: [
      { who: 'hero', en: 'Hold tight, A Dou. I\'ll see you back to your father if it costs my life!' },
      { who: 'yanming', en: 'Yan Ming stands here! Zhao Yun, leave the child!' },
    ],
  },
  // ---- the ride back: Yan Ming, ZHANGHe, the Zhong brothers; Cao Cao watches from Mount Jing
  {
    hero: ZY, when: { down: 'yanming' },
    heal: 0.2, morale: 0.1,
    officers: { zhanghe: { at: ['slopes', 0.05, 0.2] } },
    squads: [{ at: ['slopes', -0.35, 0.3], n: 20 }, { at: ['slopes', 0.35, 0.1], n: 20 }, { at: ['village', 0, 0.2], n: 18, charge: true }],
    obj: { en: 'Defeat Zhang He', go: 'zhanghe' },
    limit: { z: ['well', 0, 10], back: ['slopes', 0, 0.05], nag: NAG_HOME },
    say: [
      { who: 'caocao', en: 'Who is that general in white?' },
      { who: 'caohong', en: 'That is Zhao Zilong of Changshan, Chancellor!' },
      { who: 'caocao', en: 'A tiger of a general! Pass the word: take him alive — no arrows from cover!' },
      { who: 'zhanghe', en: 'Zhao Yun! This is as far as you go!' },
    ],
  },
  {
    hero: ZY, when: { down: 'zhanghe' },
    heal: 0.25, morale: 0.1, hush: true,
    officers: { zhongjin: { at: ['bridge', -10, 27], engaged: true }, zhongshen: { at: ['bridge', 10, 27], engaged: true } },
    squads: [{ at: ['bridge', -16, 31], n: 18 }, { at: ['bridge', 16, 33], n: 18 }, { at: ['slopes', 0, 0.3], n: 20, charge: true }],
    obj: { en: 'Defeat Zhong Jin and Zhong Shen', go: 'zhongjin' },
    limit: { z: ['well', 0, 10], back: ['bridge', 0, 18], nag: NAG_HOME },   // the brothers bar the bridge foot
    say: [
      { who: 'hero', en: 'Zhang He lives up to his name... but I can\'t stay to fight him today!' },
      { who: 'zhongjin', en: 'The brothers Zhong Jin and Zhong Shen! You\'re not getting past, Zhao Yun!' },
    ],
  },
  {
    hero: ZY, when: { down: 'zhongjin' },
    obj: { en: 'Defeat Zhong Shen', go: 'zhongshen' },
    say: [{ who: 'zhongshen', en: 'Brother! Zhao Yun, you\'ll pay for that!' }],
  },
  {
    hero: ZY, when: { down: 'zhongshen' },
    heal: 0.2, morale: 0.15, hush: true,
    obj: { en: 'Get back to the bridge', go: DECK },
    limit: { z: ['well', 0, 10], back: ['bridge', 0, 5], nag: NAG_HOME },
    squads: [{ at: ['slopes', -0.2, -0.55], n: 18, charge: true }, { at: ['slopes', 0.2, -0.3], n: 18, charge: true }],
    say: [{ who: 'hero', en: 'Yide! To me!' }],
  },
  // ---- the bridge: Zhang Fei's roar
  {
    hero: ZY, when: { near: [DECK, 14] },
    banner: { html: 'A thunderous challenge checks <em>the pursuit</em> at Changban Bridge', dur: 240, big: true },
    waves: false, morale: 0.3, hush: true,
    actor: { key: 'zhangfei', do: 'hold', at: ['bridge', 0, 12] },
    say: [
      { who: 'ally', en: 'Go, Zilong! Leave the pursuit to me!' },
      { who: 'ally', en: 'My spear bars these planks. Send forward the man willing to cross its point!' },
      { who: 'soldier', en: 'General Xiahou Jie... the roar split his gall — he fell from his horse, dead!' },
    ],
  },
  {
    hero: ZY, when: { wait: 9 * 60 },
    win: true, morale: 1,
    banner: { html: '<em>riding alone to the rescue</em> — Adou safe', en: 'Alone, he saved his lord\'s son — A Dou is safe', dur: 260, big: true },
    say: [{ who: 'hero', en: 'My lord! Your son... is safe and sound!' }],
  },

  // ================================================================ Zhang Fei — holding the bridge
  // ---- hold the bridge (a timer, the dust ruse in the woods)
  {
    hero: ZF, when: { wait: 30 },
    actors: { caocao: CAOCAO }, actor: { key: 'caocao', do: 'hold', at: CAO },
    defend: { ...BRIDGE, hp: 600 },
    fail: { when: { hp: ['bridge', 0.01] }, en: 'Changban Bridge has fallen...' },
    obj: { en: 'Hold Changban Bridge', go: DECK, timer: 150 },
    squads: [{ at: ['bridge', -12, 33], n: 18 }, { at: ['bridge', 14, 36], n: 18 }, { at: ['slopes', -0.2, -0.82], n: 20 }],
    limit: { z: ['slopes', 0, -0.75], back: ['bridge', 0, -6], nag: NAG_ZF },
    morale: -0.1,
    say: [
      { who: 'liubei', en: 'Yide, take twenty riders and hold the rear. Cao\'s men must not get through!' },
      { who: 'hero', en: 'Just go, brother! While I\'m here, not one of Cao\'s men crosses this bridge!' },
      { who: 'hero', en: 'Lads! Cut branches, tie them to your horses\' tails and ride back and forth in the woods. Kick up dust — make Cao think there\'s an ambush!' },
    ],
  },
  {
    hero: ZF, when: [{ kos: 40 }, { wait: 20 * 60 }],
    waves: true,
    squads: [{ at: ['bridge', 0, 34], n: 20, charge: true }],
    say: [
      { who: 'soldier', en: 'Look at the dust in the woods past the bridge... is there an ambush?' },
      { who: 'soldier', en: 'What of it? There\'s only one man on that bridge!' },
    ],
  },
  {
    hero: ZF, when: { wait: 45 * 60 },
    officers: { caochun: { at: ['bridge', 0, 31], engaged: true } },
    squads: [{ at: ['bridge', -16, 30], n: 16, charge: true }, { at: ['bridge', 16, 31], n: 16, charge: true }],
    say: [
      { who: 'caochun', en: 'Cao Chun of the Tiger and Leopard Riders! Out of the way, Zhang Fei!' },
      { who: 'hero', en: 'Tigers and leopards? Jackals, more like! Come on!' },
    ],
  },
  // ---- Jian Yong's news: Zilong is out there alone — ride out to meet him
  {
    hero: ZF, when: { timer: true },
    banner: { html: '<em>Changban Bridge</em> held', en: 'The bridge holds', dur: 150 },
    defend: null, fail: null, heal: 0.35, morale: 0.12, hush: true,
    obj: { en: 'Ride into Dangyang and bring Zhao Yun out', go: ['slopes', 0, 0.35] },
    limit: { z: ['village', 0, -0.3], back: ['bridge', 0, -6], nag: NAG_ZF },
    squads: [{ at: ['slopes', -0.35, -0.4], n: 20 }, { at: ['slopes', 0.3, -0.1], n: 20 }, { at: ['slopes', -0.2, 0.2], n: 22 }],
    say: [
      { who: 'jianyong', en: 'General! Zilong rode back into Cao\'s army alone, and he hasn\'t come back!' },
      { who: 'hero', en: 'What? Mi Fang said he\'d gone over to Cao...' },
      { who: 'jianyong', en: 'He went back for our lady and the young lord!' },
      { who: 'hero', en: '...Then I wronged him! Hold the bridge — I\'m going to bring him back!' },
    ],
  },
  {
    hero: ZF, when: { at: ['slopes', 0, 0.35] },
    officers: { zhanghe: { at: ['village', 0, -0.72], engaged: true } },
    squads: [{ at: ['village', -0.3, -0.85], n: 20 }, { at: ['village', 0.3, -0.8], n: 20 }, { at: ['slopes', 0, 0.75], n: 18, charge: true }],
    obj: { en: 'Defeat Zhang He', go: 'zhanghe' },
    say: [
      { who: 'zhanghe', en: 'Zhao Yun is already surrounded, and here comes another fool to die!' },
      { who: 'hero', en: 'Zhang He! Whoever stands in my way dies!' },
    ],
  },
  {
    hero: ZF, when: { down: 'zhanghe' },
    banner: { html: '<em>Zhao Yun</em> carryingAdou cut out of the encirclement', en: 'Zhao Yun breaks out with A Dou in his arms', dur: 180 },
    heal: 0.3, morale: 0.15, hush: true,
    actors: { zhaoyun: { kit: 'zhaoyun', role: 'ally', at: ['village', 0.1, -0.45] } },
    actor: { key: 'zhaoyun', do: 'follow' },
    squads: [{ at: ['village', -0.35, -0.2], n: 18, charge: true }, { at: ['village', 0.35, -0.3], n: 18, charge: true }, { at: ['slopes', -0.3, 0.1], n: 20 }, { at: ['slopes', 0.3, -0.3], n: 20 }],
    obj: { en: 'Escort Zhao Yun back to the bridge', go: DECK },
    limit: { z: ['village', 0, -0.3], nag: NAG_HOME },
    say: [
      { who: 'ally', en: 'Yide! A Dou is here, safe and sound!' },
      { who: 'hero', en: 'Zilong! Brother, I misjudged you!' },
      { who: 'ally', en: 'There are too many of them. Back to the bridge!' },
      { who: 'hero', en: 'You ride. I\'ll cover you!' },
    ],
  },
  {
    hero: ZF, when: south(-40),
    squads: [{ at: ['slopes', -0.4, -0.6], n: 18, charge: true }, { at: ['slopes', 0.4, -0.5], n: 18, charge: true }],
    say: [
      { who: 'caocao', en: 'Who is that black-faced giant?' },
      { who: 'caohong', en: 'That is Zhang Fei, Zhang Yide, Chancellor!' },
      { who: 'caocao', en: 'Guan Yu once told me Yide could take a general\'s head in an army of a million like picking a pocket. Take no chances!' },
    ],
  },
  // ---- alone on the bridge: CAOHong, Xu Chu, then the roar and XiahouJie
  {
    hero: ZF, when: { near: [DECK, 14] },
    actor: { key: 'zhaoyun', do: 'hold', at: ['bridge', 0, -24] },
    defend: { ...BRIDGE, hp: 500 },
    fail: { when: { hp: ['bridge', 0.01] }, en: 'Changban Bridge has fallen...' },
    heal: 0.3, waves: true,
    officers: { caohong: { at: ['bridge', -14, 33], engaged: true }, xuchu: { at: ['bridge', 14, 34], engaged: true } },
    squads: [{ at: ['bridge', -20, 31], n: 18, charge: true }, { at: ['bridge', 20, 33], n: 18, charge: true }, { at: ['slopes', 0, -0.8], n: 20, charge: true }],
    obj: { en: 'Hold the bridge alone — defeat Cao Hong and Xu Chu', go: 'xuchu' },
    limit: { z: ['bridge', 0, 20], back: ['bridge', 0, -6], nag: NAG_ZF },
    say: [
      { who: 'ally', en: 'Yide, what about you?' },
      { who: 'hero', en: 'Get across and find my brother! This bridge is mine!' },
      { who: 'caohong', en: 'He\'s one man! All together!' },
      { who: 'xuchu', en: 'Xu Chu is here! Try this, you black-faced brute!' },
    ],
  },
  {
    hero: ZF, when: [{ down: 'caohong' }, { down: 'xuchu' }, { wait: 50 * 60 }],
    banner: { html: 'Zhang Fei holds <em>the crossing</em> — the pursuit loses its nerve', dur: 260, big: true },
    morale: 0.25, waves: false, heal: 0.2,
    officers: { xiahoujie: { at: ['bridge', 0, 30], engaged: true } },
    obj: { en: 'Defeat Xiahou Jie', go: 'xiahoujie' },
    say: [
      { who: 'hero', en: 'This road stays open for my brother. Step onto my bridge if your life means so little!' },
      { who: 'hero', en: 'An army of loud voices, yet every pair of feet stays ashore!' },
      { who: 'caocao', en: '...That voice. Like a thunderclap.' },
      { who: 'xiahoujie', en: 'Ah... ahh...!' },
    ],
  },
  {
    hero: ZF, when: { down: 'xiahoujie' },
    win: true, set: 'bridge', waves: false, morale: 1,
    banner: { html: 'XiahouJie his courage shatters — <em>holding the bridge</em>', en: 'Xiahou Jie falls, his courage shattered — Zhang Fei holds the river and breaks the bridge', dur: 260, big: true },
    say: [{ who: 'hero', en: 'Ha! There goes the bridge. Let\'s see you cross now!' }],
  },
];

// ---- prologue ink map of Jing Provincethe north (viewBox 1600×900): the Han River from Fancheng/Xiangyang down to HANford, DangyangChangban, Jiangling, the flight
const peaks = (list, h, w) => list.map(([x, y, k = 1]) =>
  `<path d="M${x - w * k} ${y} Q${x - w * k * 0.35} ${y - h * k * 0.55} ${x} ${y - h * k} Q${x + w * k * 0.3} ${y - h * k * 0.5} ${x + w * k} ${y}Z"/>`).join('');
const HAN = 'M-20 170 C220 150 420 200 640 205 S900 230 1010 330 S1080 520 1150 640 S1300 820 1420 930';
const ZHANG = 'M300 360 C360 460 420 520 500 590 S600 700 640 760';                    // the Ju-Zhang riverswater past Dangyang toward Jiangling
export const PL_MAP = {
  art: `<g class="pl-mtns" fill="url(#pl-mtn)" filter="url(#pl-ink)">
    ${peaks([[80, 330, 1.1], [190, 300], [300, 345, 1.2], [140, 480, 0.9], [250, 520, 1.1], [120, 640], [230, 700, 1.2], [110, 820, 1.1]], 120, 90)}
    ${peaks([[1250, 140, 0.9], [1380, 180, 1.1], [1500, 150], [1560, 260, 0.9]], 110, 90)}
    ${peaks([[640, 520, 0.6], [700, 505, 0.75]], 100, 70)}
  </g>
  <g class="pl-mark" data-id="jingshan" fill="url(#pl-mtn)" filter="url(#pl-ink)">${peaks([[760, 470, 0.8], [820, 455, 1.05]], 130, 70)}</g>
  <g class="pl-mark" data-id="river" filter="url(#pl-ink)" fill="none" stroke-linecap="round">
    <path d="${HAN}" stroke="#6f7c78" stroke-width="30" opacity=".35"/><path d="${HAN}" stroke="#46524f" stroke-width="7" opacity=".7"/>
    <path d="${ZHANG}" stroke="#6f7c78" stroke-width="16" opacity=".3"/><path d="${ZHANG}" stroke="#46524f" stroke-width="4" opacity=".6"/>
  </g>
  <g class="pl-labels">
    <g class="pl-mark wei" data-id="fancheng"><rect x="600" y="118" width="32" height="32" rx="3"/><text x="650" y="145">Fancheng</text></g>
    <g class="pl-mark wei" data-id="xiangyang"><rect x="622" y="236" width="36" height="36" rx="3"/><text x="676" y="265">Xiangyang</text></g>
    <g class="pl-mark" data-id="changban"><text x="590" y="600">Changban</text><text class="sm" x="520" y="660">Dangyang</text></g>
    <g class="pl-mark wei" data-id="jingshan"><text class="sm" x="850" y="500">Mount Jing Cao Cao</text></g>
    <g class="pl-mark" data-id="jiangling"><rect x="600" y="790" width="32" height="32" rx="3"/><text x="650" y="818">Jiangling</text></g>
    <g class="pl-mark" data-id="hanjin"><rect x="1118" y="600" width="30" height="30" rx="3"/><text x="1166" y="626">HANford</text></g>
    <g class="pl-mark" data-id="river"><text class="sm river" x="840" y="200">HAN water</text></g>
  </g>`,
  arrows: [
    ['liu1', 'shu', 'M630 150 C650 200 650 240 640 260'],
    ['cao1', 'wei', 'M760 20 C720 80 690 150 660 240'],
    ['liu2', 'shu', 'M640 290 C630 380 610 470 600 560'],
    ['cao2', 'wei', 'M690 280 C760 360 740 470 660 560'],
    ['liu3', 'shu', 'M620 590 C760 640 940 630 1110 615'],
    ['guan', 'shu', 'M1030 390 C1070 460 1110 520 1130 590'],
  ],
};

// ---- prologue cards (format: chapters.js). Card 4 branches on the hero.
export const PROLOGUE = [
  { cols: ['Autumn, the thirteenth of Jian-an', 'Cao Cao marches south', 'Liu Cong yields the province'], en: 'Autumn, 208 AD. Cao Cao marches south in force, and Liu Cong surrenders Jing Province without a fight.',
    show: ['cao1', 'fancheng', 'xiangyang', 'river'], focus: [680, 220, 1.2] },
  { cols: ['Liu Bei leaves Fancheng', 'A hundred thousand people follow', 'A dozen li a day'], en: 'Liu Bei abandons Fancheng and flees south. A hundred thousand people follow him — ten li a day.',
    show: ['liu1', 'liu2'], focus: [640, 400, 1.15] },
  { cols: ['The Tiger and Leopard Riders', 'Three hundred li in a day and night', 'They catch Changban'], en: 'Cao Cao leads his Tiger and Leopard Riders three hundred li in a day and a night, and overtakes them at Changban.',
    show: ['cao2', 'changban', 'jingshan'], focus: [700, 540, 1.3] },
  { zhaoyun: { cols: ['His family left behind', 'Zhao Yun turns his horse', 'Alone, back into the ring'], en: 'Liu Bei flees, leaving his family behind. Zhao Yun cannot find his lord\'s wife and son, and rides back into the host alone.' },
    zhangfei: { cols: ['Twenty riders to hold the rear', 'Zhang Fei takes the bridge', 'The crossing is his'], en: 'Liu Bei orders Zhang Fei to hold the rear with twenty riders — at the river, at the bridge.' },
    show: ['jiangling'], focus: [620, 600, 1.45] },
  { cols: ['East lies Hanjin', 'Guan Yu’s boats on the river', 'All turns on Changban'], en: 'East lies Hanjin, where Guan Yu\'s boats wait on the river. Everything turns on Changban.',
    show: ['liu3', 'guan', 'hanjin'], focus: [860, 560, 1.05] },
];

// ---- result screen epilogue (win), branched on the hero
export const EPILOGUE = {
  zhaoyun: {
    en: ['Zhao Yun carried the infant — the future emperor — in his arms and kept Lady Gan safe; both escaped.',
      'Liu Bei set the child on the ground and said: "For this little one I nearly lost a great general!" Zhao Yun was made General of the Standard.'],
  },
  zhangfei: {
    en: ['Zhang Fei held the river, broke the bridge, and glared over his leveled spear: "I am Zhang Yide! Come and die with me!" None dared come near.',
      'Liu Bei turned east to Hanjin, met Guan Yu\'s boats, crossed the Mian, and reached Xiakou.'],
  },
};
