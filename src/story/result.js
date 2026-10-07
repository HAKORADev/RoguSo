// Battle result (#result), DW8 style: the battlefield stays frozen behind an ink wash; the hero's portrait and a big
// brush victory / defeat, then the tallies count up one by one (KOs, max chain, time, damage taken), the rank stamps in (win:
// S/A/B/C, rules in index.js rank()), and the chapter's epilogue (its EPILOGUE, chapters.js) closes it.
// Win → Continue (title, opened on the chapter panel at the next chapter; a trial: on the trial panel at that trial). Defeat → Retry (the loading card, then straight
// back into the battle, no prologue) or back (title). The defeat line is the fail reason when a `fail` beat lost it.
// Every exit is an ink wipe (ui lane menu.js). ctx.art (the officer's key-art still, main.js snapArt) fills the right side.
// Keys (menu.js createNav, + gamepad): Enter / Space press the focused button (← → move between them), Esc → title.
// The battle's difficulty rides beside VICTORY / DEFEAT. Records (ctx.rec, core/progress.js record(), wins only): a
// tally that beat the officer's best on this chapter / trial and tier is marked new record over the old value, a better rank
// improved; under the tallies, one compact block shows what the win opened — the next chapter on a first clear, and each
// UNLOCKS entry. Three notices fit above the epilogue and bottom prompts at 720p (16:9 and 4:3).
// ctx in: { win, stats: { kos, time, hpMax, maxChain, dmg, rank? }, reason?: {zh, en}, mode ('story' | 'trial'), ch,
// char, art?, diff (core/difficulty.js tier), rec?: { first, prev, fresh, unlocks } }.
import { CHARS, paintPortrait } from '../chars/index.js';
import { CHAPTERS, chapter } from './chapters.js';
import { inkWipe, afterWipe, createNav } from '../ui/menu.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const ROGUE = new Set(['rogue', 'challenge', 'trainchar', 'trainally']);

export function createResult(el, flow) {
  let ctx = {}, raf = 0, gone = false, next = null;          // next: the chapter Continue opens the title on
  // one exit per visit; pressed while this screen is still being uncovered it is queued (afterWipe), not dropped
  const leave = (mid) => { if (!gone) { gone = true; afterWipe(() => inkWipe(mid)); } };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'retry') leave(() => flow.go('loading', { mode: ctx.mode, ch: ctx.ch, char: ctx.char, art: ctx.art, retry: true }));
    else if (b.dataset.act === 'again') leave(() => flow.go('loading', { mode: ctx.mode, loc: ctx.loc, ch: ctx.ch, char: ctx.char, art: ctx.art, retry: true }));
    else if (b.dataset.act === 'next') leave(() => flow.go('title', { mode: ctx.mode, ch: next }));
    else leave(() => flow.go('title'));
  });
  const nav = createNav({
    move: (d) => { const bs = [...el.querySelectorAll('button')], i = bs.indexOf(document.activeElement); bs[(i + d + bs.length) % bs.length]?.focus(); },
    ok: () => (el.querySelector('button:focus') || el.querySelector('button'))?.click(),
    back: () => leave(() => flow.go('title')),
  });

  return {
    enter(c) {
      ctx = c; gone = false;
      const { win, stats: s } = c, ch = CHARS[c.char] || CHARS.zhaoyun;
      if (ROGUE.has(c.mode)) return rogueEnter(c, s, ch, win);   // the roguelike result: earnings, no chapters
      const C = chapter(c.ch), { CH } = C;
      const epi = C.EPILOGUE[ch.id] || Object.values(C.EPILOGUE)[0], k = CHAPTERS.indexOf(C), after = k >= 0 ? CHAPTERS[k + 1] : null;   // a trial: no next
      const R = c.rec, was = R?.prev;                        // records: what this win beat (was: the cell before it)
      const notices = [R?.first && after ? `<p class="rs-unlock">${after.CH.num} · ${after.CH.title} unlocked</p>` : '',
        ...(R?.unlocks || []).map((u) => `<p class="rs-unlock">${u.text} unlocked</p>`)].join('');
      next = after ? after.CH.id : CH.id;
      const why = c.reason || { en: `${ch.name} falls at last, and the assault falters...` };
      // [label, value, format, the record it beat (fresh) → its old value]
      const rows = [
        ['K.O. COUNT', s.kos, (v) => v, R?.fresh.kos && was.kos],
        ['MAX CHAIN', s.maxChain, (v) => v],
        ['TIME', s.time, mmss, R?.fresh.time && mmss(was.time)],
        ['DAMAGE TAKEN', Math.round(s.dmg || 0), (v) => v],
      ];
      el.className = `scr ${win ? 'win' : 'lose'}${c.art ? ' art' : ''}`;
      el.style.setProperty('--art', c.art ? `url("${c.art}")` : 'none');
      el.innerHTML = `<div class="rs">
        <div class="rs-head"><div class="rs-badge"><canvas width="20" height="20"></canvas></div>
          <div><small>${CH.num} · ${CH.title.toUpperCase()}</small><h2>${win ? 'VICTORY' : 'DEFEAT'}</h2><em>${win ? 'The field is ours' : 'The field is lost'}</em>${c.diff ? `<span class="rs-dif">${c.diff.text}</span>` : ''}</div></div>
        <div class="rs-body">
          <table class="rs-stats">${rows.map(([label, , , old], i) => `<tr style="--i:${i}"><th>${label}</th><td>0</td><td class="rs-new">${
            old ? `<b>NEW RECORD</b><small>${old}</small>` : ''}</td></tr>`).join('')}</table>
          ${win && s.rank ? `<div class="rs-rank r${s.rank}"><span>RANK</span><b>${s.rank}</b>${R?.fresh.rank ? `<em>${was.rank} → ${s.rank} · improved</em>` : ''}</div>` : ''}
        </div>
        ${notices ? `<div class="rs-unlocks">${notices}</div>` : ''}
        <div class="rs-epi">${win
          ? epi.en.map((z) => `<p>${z}</p>`).join('')
          : `<p>${why.en}</p>`}</div>
        <div class="rs-btns">${win
          ? '<button data-act="next">Continue</button>'
          : '<button data-act="retry">Retry</button><button data-act="title" class="sub">Title</button>'}</div>
      </div>
      <footer class="ui-foot">${win ? '' : '<span><kbd>←</kbd><kbd>→</kbd>Select</span>'}
        <span><kbd>Enter</kbd>Confirm</span><span><kbd>Esc</kbd>Title</span></footer>`;
      paintPortrait(el.querySelector('canvas'), ch);
      // tallies count up in turn (0.7 s each, 0.35 s apart, after the title lands)
      const tds = [...el.querySelectorAll('.rs-stats td:not(.rs-new)')], t0 = performance.now() + 700;
      const tick = (now) => {
        let busy = false;
        rows.forEach(([, v, fmt], i) => {
          const u = Math.max(0, Math.min(1, (now - t0 - i * 350) / 700));
          if (u < 1) busy = true;
          tds[i].textContent = fmt(Math.round(v * (1 - (1 - u) ** 3)));
        });
        if (busy) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setTimeout(() => { if (!el.hidden) el.querySelector('button')?.focus({ preventScroll: true }); }, 50);
      nav.start();
    },
    exit() { cancelAnimationFrame(raf); nav.stop(); },
  };

  /** The roguelike result: what the run earned (coins / XP / ally XP bank whatever the outcome was — the owner's
   *  law) and the tallies; Continue → title, Again → straight back into the same run. */
  function rogueEnter(c, s, ch, win) {
    next = null;
    const why = c.reason || { en: `${ch.name} falls — but everything gained is kept.` };
    const rows = [
      ['K.O. COUNT', s.kos, (v) => v],
      ['MAX CHAIN', s.maxChain, (v) => v],
      ['TIME', s.time, mmss],
      ['COINS EARNED', s.coins | 0, (v) => v],
      ...(s.xp ? [['XP EARNED', s.xp, (v) => v]] : []),
      ...(s.allyXp ? [['ALLY XP', s.allyXp, (v) => v]] : []),
    ];
    const tline = (s.targets || []).length
      ? s.targets.map((q) => `<span class="${q.progress >= q.n ? 'ok' : ''}">${q.label} ${q.progress | 0}/${q.n}</span>`).join('')
      : '';
    el.className = `scr ${win ? 'win' : 'lose'}${c.art ? ' art' : ''}`;
    el.style.setProperty('--art', c.art ? `url("${c.art}")` : 'none');
    el.innerHTML = `<div class="rs">
      <div class="rs-head"><div class="rs-badge"><canvas width="20" height="20"></canvas></div>
        <div><small>${{ rogue: 'BATTLE', challenge: 'CHALLENGE', trainchar: 'TRAIN · OFFICER', trainally: 'TRAIN · ALLIES' }[c.mode] || 'RUN'}</small>
        <h2>${win ? 'VICTORY' : 'THE RUN ENDS'}</h2><em>${win ? 'Everything gained is kept' : 'Everything gained is kept'}</em>${c.diff ? `<span class="rs-dif">${c.diff.text}</span>` : ''}</div></div>
      <div class="rs-body">
        <table class="rs-stats">${rows.map(([label], i) => `<tr style="--i:${i}"><th>${label}</th><td>0</td></tr>`).join('')}</table>
        ${tline ? `<div class="rs-tgts">${tline}</div>` : ''}
      </div>
      <div class="rs-epi"><p>${win ? 'The field is yours. Spend it well.' : why.en}</p></div>
      <div class="rs-btns"><button data-act="again">Again</button><button data-act="title" class="sub">Title</button></div>
    </div>
    <footer class="ui-foot"><span><kbd>Enter</kbd>Confirm</span><span><kbd>Esc</kbd>Title</span></footer>`;
    paintPortrait(el.querySelector('canvas'), ch);
    const tds = [...el.querySelectorAll('.rs-stats td')], t0 = performance.now() + 700;
    const tick = (now) => {
      let busy = false;
      rows.forEach(([, v, fmt], i) => {
        const u = Math.max(0, Math.min(1, (now - t0 - i * 280) / 700));
        if (u < 1) busy = true;
        tds[i].textContent = fmt(Math.round(v * (1 - (1 - u) ** 3)));
      });
      if (busy) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setTimeout(() => { if (!el.hidden) el.querySelector('button')?.focus({ preventScroll: true }); }, 50);
    nav.start();
  }
}
