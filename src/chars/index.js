// Character registry: metadata for the title / select / HUD / story screens, plus each character's kit (what the generic
// hero, combat, musou, vfx and audio code reads from game.hero.kit instead of importing a character's modules).
//
// char = {
//   id
//   name {zh, en}, courtesy {zh, en}, seal (red HUD seal: 2 glyphs), title {zh, en} (epithet), motto (HUD intro subline)
//   weapon {zh, en}, bio {zh: [2 lines], en: [2 lines]}, stats {atk, def, speed, range} 1-5, musou {zh, en} (Musou name)
//   accent             CSS colour of the character (select screen / HUD highlights)
//   side?              {zh, en} faction on the select screen (default Shu Shu Han)
//   lines              voice lines the HUD / story show: intro (battle start), musouEnd (shout after the Musou) {zh, en};
//                      copy: [2 short lines] of vertical calligraphy shown while the Musou plays
//   portrait {face, pal} 20×20 pixel portrait: rows of palette keys ('.' = clear), shared by the HUD badge, dialogue and
//                      select screen (paintPortrait below)
//   kit                see below
// }
//
// kit = {
//   moves              move table (format: src/hero/moves.js header), prepared with prepMoves (src/hero/moveset.js); every
//                      kit has n1 c1 dash jatk jc (combo.js starts these from neutral); an `aim` move = aim mode (hud.js)
//   airChainMax        air-string length per jump
//   clips              clip registry sampled by heroPose (attack + locomotion + musou clips; ids = move ids / states:
//                      idle run dodge air airFall land hurt + whatever the musou sets in h.musouClip); a clip id that
//                      is a move id is an attack clip (short 5-frame blend in)
//   feet               { moveId: (u, pose) => void } baked feet applied over a borrowed clip (moves.js `anim`)
//   runPose(phase, k, out, lean), rollPose(u, out)   procedural run / dive roll poses
//   dashPlant          dash move frame where the lunge lands (footstep dust), or -1
//   model(rig) → { material, meshes }            voxel model on the shared rig (src/hero/rig.js)
//   secondary(scene, rig, material, hero?) → { update(dt), reset() }   cloth / hair chains (hero: the battle view's)
//   trail              weapon ribbon {base, baseHeavy, tip} (m along the rig's weapon, vfx.js spearWorld) or a bow limb
//                      {axis: 'y', …} (never null)
//   fx?                vfx.js palette (complete: spread vfx.js ZY_FX; musou 'dragon' | 'own', ghost, mu — vfx.js header)
//   scale?, reach?     body scale (default rig.js HERO_SCALE), weapon ground contact {tip, butt} (rig.js spearElev)
//   weight?            camera kick × (camera.js)            voice?  {pitch, fk, growl, gain} his kiai (audio/bank.js)
//   view?(model, hero, dt, rig)   per-frame render hook after IK (hero.js createHeroView)
//   createMusou(game) → musou sim (interface: src/musou/musou.js createMusou — active, t, reset, start(inp),
//                      stepHero(inp), shot(), ready(), step(), optional aimShot() (camera.js aim shot), wave(hit, moveId)
//                      (moves.js `proj` windows: src/musou/scripted.js); emits musou:* events; hits via
//                      game.combat.strike(..., 'musou'))
//   createMusouView(scene, game, camera) → { update(dt), dispose() }   render-only
// }
// Officers written as data (a model def + a moveset) get their kit from src/chars/defkit.js (its header: the def contract).
import { ZHAOYUN_KIT } from './zhaoyun/kit.js';
import { HUANGZHONG_KIT } from './huangzhong/kit.js';
import { ZHANGFEI_KIT } from './zhangfei/kit.js';
import { FACE as ZF_FACE, PAL as ZF_PAL } from './zhangfei/model.js';
import { GUANYU_KIT } from './guanyu/kit.js';
import { FACE as GY_FACE, PAL as GY_PAL } from './guanyu/model.js';
import { LIUBEI_KIT } from './liubei/kit.js';
import { FACE as LB_FACE, PAL as LB_PAL } from './liubei/model.js';
import { ZHUGELIANG_KIT } from './zhugeliang/kit.js';
import { FACE as ZG_FACE, PAL as ZG_PAL } from './zhugeliang/model.js';
import { LUBU_KIT } from './lubu/kit.js';
import { FACE as LU_FACE, PAL as LU_PAL } from './lubu/model.js';

const ZY_FACE = [
  '....................',
  '.......KKKKK........',
  '.....KKKKKKKKK......',
  '....KKKKKKKKKKKK....',
  '...KKKkkKKKKKKKKK...',
  '...KKKKKKKKKKKKKKKK.',
  '...KTTTTTTTTTTTTKKTt',
  '...KKKKKKKKKKKKKKKtT',
  '...KKKSKKKKKSKKKKKKt',
  '...KKSSSSSSSSSSKKKKK',
  '...KKEESSSSSSEEKKKK.',
  '...KKSwESSSSwESKKKK.',
  '...KKSSSSSsSSSSKKK..',
  '....KSSSSSsSSSSKKK..',
  '....KsSSSSSSSSsKK...',
  '.....sSSSMMSSSsKK...',
  '......ssSSSSssKK....',
  '...WWTtssssssTtWW...',
  '.WWWWWWTWWWWTWWWWW..',
  'WWwwWWWWTWWTWWWWwwW.',
];
// Huang Zhong: grey topknot, red headband, heavy brows, white moustache and long beard, gold lamellar collar
const HZ_FACE = [
  '....................',
  '.......GGGGG........',
  '.....GGGGGGGGG......',
  '....GGGGGGGGGGGG....',
  '...GGGggGGGGGGGGG...',
  '...GGGGGGGGGGGGGGG..',
  '...GRRRRRRRRRRRRGGRr',
  '...GGGGGGGGGGGGGGGrR',
  '...GGSSSSSSSSSSGGGGr',
  '...GGSkkSSSSkkSGGGG.',
  '...GGEESSSSSSEEGGGG.',
  '...GGSwESSSSwESGGG..',
  '...GGSSSSSsSSSSGGG..',
  '....GSSggGGggSSGG...',
  '....GSGGGMMGGGSG....',
  '.....GGGGGGGGGGG....',
  '......GgGGGGGgG.....',
  '...YYyGGGGGGGyYY....',
  '.YYYYYYyGgGyYYYYY...',
  'YYyyYYYYyGyYYYYyyY..',
];
const PAL = { K: '#1d1514', k: '#4a3834', S: '#efc3a0', s: '#c38a6c', E: '#140c0c', M: '#7e3a2e', T: '#3fb8b0', t: '#1f5f5c',
  W: '#efe8de', w: '#ffffff', G: '#dcd6cc', g: '#9a948a', R: '#b3261e', r: '#6e1712', Y: '#d9a53a', y: '#8a5a1a' };

export const CHARS = {
  liubei: {
    id: 'liubei',
    name: 'Liu Bei', courtesy: 'Xuande', seal: 'LB',
    title: 'The Benevolent Lord', motto: 'Descendant of Prince Jing · Sworn in the peach garden · Beloved of the people',
    weapon: 'Twin Swords',
    bio: ['A man of Zhuo descended from Prince Jing of Zhongshan, his earlobes reaching his shoulders, his hands his knees.',
      'Sworn brother to Guan Yu and Zhang Fei in the peach garden, he won the people with benevolence.'],
    stats: { atk: 3, def: 3, speed: 4, range: 3 }, musou: 'Twin Dragons', accent: '#6cb24e',
    lines: {
      intro: 'I am Liu Xuande, descendant of Prince Jing of Zhongshan!',
      musouEnd: 'For the people of the realm — this battle is ours!',
      copy: ['Where virtue walks', 'The people follow'],
    },
    portrait: { face: LB_FACE, pal: LB_PAL },
    kit: LIUBEI_KIT,
  },
  zhaoyun: {
    id: 'zhaoyun',
    name: 'Zhao Yun', courtesy: 'Zilong', seal: 'ZY',
    title: 'The Dragon of Changshan', motto: 'Dragon of Changshan · Alone through the host · Courage through and through',
    weapon: 'Dragon-Heart Spear',
    bio: ['A spearman of Changshan who rode alone through Cao Cao\'s host at Changban.',
      'Liu Bei said of him: "Zilong is courage through and through."'],
    stats: { atk: 4, def: 3, speed: 5, range: 3 }, musou: 'Azure Dragon Breach', accent: '#3fb8b0',
    lines: {
      intro: 'My lord\'s son is in my care. None of you shall pass!',
      musouEnd: 'I am Zhao Zilong of Changshan!',
      copy: ['Where the spear points', 'A hundred hosts break'],
    },
    portrait: { face: ZY_FACE, pal: PAL },
    kit: ZHAOYUN_KIT,
  },
  huangzhong: {
    id: 'huangzhong',
    name: 'Huang Zhong', courtesy: 'Hansheng', seal: 'HZ',
    title: 'The Veteran Who Never Ages', motto: 'Older and stronger · A hundred paces, a hundred hits · The slayer of Dingjun',
    weapon: 'Army-Breaker Longbow',
    bio: ['A Nanyang veteran near seventy whose great bow never misses.',
      'At Mount Dingjun he cut down Xiahou Yuan and shook all Hanzhong.'],
    stats: { atk: 4, def: 3, speed: 2, range: 5 }, musou: 'Hundred-Pace Volley', accent: '#d9a53a',
    lines: {
      intro: 'Old Huang Zhong stands here! Who dares face me?',
      musouEnd: 'This old blade has not dulled!',
      copy: ['One arrow loosed', 'Ten thousand give way'],
    },
    portrait: { face: HZ_FACE, pal: PAL },
    kit: HUANGZHONG_KIT,
  },
  zhangfei: {
    id: 'zhangfei',
    name: 'Zhang Fei', courtesy: 'Yide', seal: 'ZF',
    title: 'A Match for Ten Thousand', motto: 'Zhang Yide of Yan · The roar at Changban · None may pass',
    weapon: 'Eighteen-Foot Serpent Spear',
    bio: ['A man of Zhuo with a leopard\'s head, round glaring eyes and a tiger\'s bristling beard; his voice is thunder.',
      'Alone on the bridge at Changban he levelled his spear and roared — and Cao Cao\'s host dared not come on.'],
    stats: { atk: 5, def: 4, speed: 2, range: 4 }, musou: 'Roar of the Man of Yan', accent: '#d4552a',
    lines: {
      intro: 'Zhang Yide of Yan stands here! Who dares fight me to the death?',
      musouEnd: 'You will not fight, you will not flee — what are you waiting for?!',
      copy: ['One roar', 'A thousand spears recoil'],
    },
    portrait: { face: ZF_FACE, pal: ZF_PAL },
    kit: ZHANGFEI_KIT,
  },
  guanyu: {
    id: 'guanyu', side: 'Shu Han',
    name: 'Guan Yu', courtesy: 'Yunchang', seal: 'GY',
    title: 'Lord of the Magnificent Beard', motto: 'Guan Yunchang of Hedong · The wine still warm · Loyalty beyond the clouds',
    weapon: 'Green Dragon Blade',
    bio: ['Of Hedong: a face red as a ripe jujube, phoenix eyes, silkworm brows.',
      'He slew Hua Xiong before the wine went cold and rode a thousand li alone.'],
    stats: { atk: 5, def: 4, speed: 3, range: 4 }, musou: 'Sky Cleaver', accent: '#3cae6e',
    lines: {
      intro: 'Guan Yunchang is here! Come, you who wear your heads for sale!',
      musouEnd: 'Loyalty in my heart, the Green Dragon in my hand!',
      copy: ['One sweep of the blade', 'A thousand hosts fall'],
    },
    portrait: { face: GY_FACE, pal: GY_PAL },
    kit: GUANYU_KIT,
  },
  zhugeliang: {
    id: 'zhugeliang', side: 'Shu Han',
    name: 'Zhuge Liang', courtesy: 'Kongming', seal: 'ZG',
    title: 'The Sleeping Dragon', motto: 'Feather fan and silk cap · Plans laid in the tent · Victories won afar',
    weapon: 'White Feather Fan',
    bio: ['A scholar of Langya who farmed at Nanyang and likened himself to the great ministers of old.',
      'Liu Bei called on his cottage three times; in one talk at Longzhong he laid out the realm divided in three.'],
    stats: { atk: 3, def: 2, speed: 3, range: 5 }, musou: 'East Wind · Eight Formations', accent: '#9c8cf0',
    lines: {
      intro: 'The east wind has risen. Today the enemy breaks.',
      musouEnd: 'Plans laid in the tent decide battles a thousand li away.',
      copy: ['One wave of the fan', 'The eight formations close'],
    },
    portrait: { face: ZG_FACE, pal: ZG_PAL },
    kit: ZHUGELIANG_KIT,
  },
  lubu: {
    id: 'lubu', side: 'Warlords',
    name: 'Lü Bu', courtesy: 'Fengxian', seal: 'WINGED',
    title: 'The Flying General', motto: 'Among men, Lü Bu · Among horses, Red Hare · Peerless under heaven',
    weapon: 'Sky-Piercer Halberd',
    bio: {
      en: ['A rider of Jiuyuan on the northern frontier, peerless with bow and horse — they called him the Flying General.',
      'Before Hulao Gate he held the pass alone with his halberd; it took Liu, Guan and Zhang together to hold him off.'],
      en: ['A rider of Jiuyuan on the northern frontier, peerless with bow and horse — they called him the Flying General.',
        'Before Hulao Gate he held the pass alone with his halberd; it took Liu, Guan and Zhang together to hold him off.'],
    },
    stats: { atk: 5, def: 4, speed: 4, range: 4 }, musou: 'Peerless: Dance of Gods and Demons', accent: '#d8283c',
    lines: {
      intro: 'Lü Fengxian stands here! Which of you rats dies first?',
      musouEnd: 'Peerless under heaven — there is only Lü Bu!',
      copy: ['One halberd sweep', 'Peerless under heaven'],
    },
    portrait: { face: LU_FACE, pal: LU_PAL },
    kit: LUBU_KIT,
  },
};
export const CHAR_ORDER = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong', 'lubu'].filter((id) => CHARS[id]);

/** Paint a char's 20×20 portrait into a canvas (width/height 20; scale it with CSS, image-rendering: pixelated). */
export function paintPortrait(cv, char) {
  const g = cv.getContext('2d'), { face, pal } = char.portrait;
  g.clearRect(0, 0, cv.width, cv.height);
  face.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
}
