// Loading card (#loading, ui lane). deploy on the select screen ink-wipes into this card (so does Retry on the result), then
// main.js deploy() sets the battle up for the chosen officer under it — kit views built, every material compiled, a few
// frames rendered — and ink-wipes on into the prologue (story) or the battle (free / retry). So the field is never seen
// with the wrong officer and the first battle frames don't stall on shader compiles.
// Layout (DW loading card): the officer's key art full-bleed (ctx.art: the select stage's key-art still, main.js snapArt)
// with a slow push-in and rising embers, an ink band on the left with the chapter band, brush name + red seal, the intro
// line; a tip (tip) and a gold brush-stroke progress bar with the current set-up stage along the bottom. No art (dev
// entry): the plain background.
// ctx in: { mode ('story' | 'trial' | 'free'), ch, char, art? }. main.js drives progress(p, zh?, en?) and ready(); nothing here touches the sim.
import { CHARS } from '../chars/index.js';
import { replay } from './menu.js';
import { difficulty } from '../core/difficulty.js';
import { chapter } from '../story/chapters.js';
import { bindings, labelSlot } from '../core/input.js';

/** Band label for a flow ctx: the chapter (story), the trial, or the battlefield (free: the chapter ctx.ch's field). */
export function modeLabel(c) {
  const { CH } = chapter(c.ch);
  return c.mode === 'free' ? `Free battle · ${CH.title}` : `${c.mode === 'story' ? 'Story' : 'Trial'} · ${CH.num} ${CH.title}`;
}
// tip builders — every key name comes from the user's LIVE bindings (settings may have remapped anything), so the
// loading card never lies about the controls
const TIPS = [
  (k) => [`Tap ${k('attack')} for the full combo; press ${k('charge')} mid-combo for a charge attack.`],
  (k) => [`When the gold gauge is full, press ${k('musou')} to unleash your Musou.`],
  (k) => [`${k('dodge')} dodges; the roll slips through a blow.`],
  (k) => [`${k('target')} recenters the camera behind you, or onto the nearest officer.`],
  () => ['Click the field to steer the camera with the mouse; the mouse looks up and down too.'],
  (k) => [`Hold ${k('charge')} / right click to draw and aim (standing or running); a full draw pierces a line.`, 'huangzhong'],
  () => ["Aim for an officer's head: a headshot hits far harder.", 'huangzhong'],
];

export function createLoading(el) {
  el.innerHTML = `
    <div class="l-art"></div><div class="l-embers"></div><div class="l-veil"></div>
    <section class="l-main">
      <p class="l-ch"><b></b><small></small></p>
      <div class="l-name"><h1></h1><i class="l-seal"></i></div>
      <p class="l-en"></p>
      <p class="l-line"><b></b><small></small></p>
    </section>
    <footer class="l-foot">
      <p class="l-tip"><span>TIP</span><b></b><small></small></p>
      <div class="l-prog"><p class="l-state"><b></b><small></small></p><div class="l-bar"><i></i></div></div>
    </footer>`;
  const $ = (s) => el.querySelector(s), bar = $('.l-bar i');
  const state = (label) => { $('.l-state b').textContent = label; $('.l-state small').textContent = ''; };
  return {
    enter(c) {
      const ch = CHARS[c.char] || CHARS.zhaoyun, label = modeLabel(c);
      el.style.setProperty('--acc', ch.accent);
      $('.l-art').style.backgroundImage = c.art ? `url("${c.art}")` : 'none';
      el.classList.remove('ready'); replay(el, 'in');
      const d = difficulty();
      $('.l-ch b').textContent = `${label} · ${d.text}`; $('.l-ch small').textContent = '';
      $('.l-name h1').textContent = ch.name; $('.l-seal').textContent = ch.seal;
      $('.l-en').textContent = ch.title;
      $('.l-line b').textContent = ch.lines.intro; $('.l-line small').textContent = '';
      const k = (a) => bindings().actions[a].filter(Boolean).map((s) => labelSlot(s)).join(' / ');
      const tips = TIPS.map((f) => f(k)).filter((q) => !q[1] || q[1] === ch.id), t = tips[Math.floor(Math.random() * tips.length)];   // UI only, not the sim
      $('.l-tip b').textContent = t[0]; $('.l-tip small').textContent = '';
      state('Marshalling the army');           // first stage label; deploy() then climbs summon → deploy → prepare
      this.progress(0.06);
    },
    exit() {},
    /** p 0..1 plus the stage's label: real set-up stages (main.js deploy). */
    progress(p, label) { bar.style.transform = `scaleX(${p})`; if (label) state(label); },
    ready() { el.classList.add('ready'); state('To battle'); },
  };
}
