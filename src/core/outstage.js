// Shared audio out stage: every AudioContext in the game (menu sfx in menu.js, battle mix in audio.js) routes its
// master through one of these. It carries the Sound settings: the SFX / Music gains live in their owners' buses (the
// menu only has sfx; the battle mix has sfx/voice/bed buses), while the output mode is here:
//   spatial  stereo with a built-in virtual surround: mid/side widening (the sides get a 12-16 ms comb of the opposite
//            channel, band-limited so voices stay centred) + a short bright room tail — cheap HRTF-flavoured stereo
//   mono     both channels summed (the classic single-speaker fold-down, phase-safe)
// A mode switch rebuilds the chain after `input`, so live changes never click: input gain holds, the old chain fades
// out over 60 ms, the new one fades in.
import { values, on } from './settings.js';

export function createOut(ctx) {
  const input = ctx.createGain();
  let tail = null, mode = null;

  function disconnectTail() {
    if (!tail) return;
    try { tail.gain.gain.cancelScheduledValues(ctx.currentTime); tail.gain.gain.setValueAtTime(tail.gain.gain.value, ctx.currentTime); tail.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06); } catch { }
    const old = tail;
    setTimeout(() => { try { old.nodes.forEach((n) => n.disconnect()); } catch { } }, 120);
    tail = null;
  }

  function build(m) {
    disconnectTail();
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);
    const nodes = [g];
    if (m === 'mono') {
      const merge = ctx.createChannelMerger(2);
      const sum = ctx.createGain(); sum.gain.value = 0.72;
      input.disconnect(); input.connect(sum);
      sum.connect(merge, 0, 0); sum.connect(merge, 0, 1);
      merge.connect(g);
      nodes.push(merge, sum);
    } else if (m === 'spatial') {
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      const xL = ctx.createDelay(0.03), xR = ctx.createDelay(0.03);
      xL.delayTime.value = 0.014; xR.delayTime.value = 0.014;
      const xLG = ctx.createGain(), xRG = ctx.createGain();
      xLG.gain.value = 0.28; xRG.gain.value = 0.28;
      const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 3200; air.gain.value = 1.5;
      input.disconnect(); input.connect(split);
      split.connect(merge, 0, 0); split.connect(merge, 1, 1);
      split.connect(xL, 1); xL.connect(xLG); xLG.connect(merge, 0, 0);   // right leaks into left, delayed: the surround comb
      split.connect(xR, 0); xR.connect(xRG); xRG.connect(merge, 0, 1);   // left leaks into right, mirrored
      merge.connect(air); air.connect(g);
      nodes.push(split, merge, xL, xR, xLG, xRG, air);
    } else {
      input.disconnect(); input.connect(g);
    }
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.06);
    tail = { gain: g, nodes };
    mode = m;
  }

  const want = values().sound.out || 'spatial';
  build(want);
  on('sound.out', (m) => { if (m !== mode) build(m); });

  return input;
}

/** The Sound tab's gains for a battle-mix owner: sfx/voice ride the SFX slider, the music beds the Music slider. */
export function watchGains(apply) {
  const S = values();
  const push = () => apply({ sfx: S.sound.sfx, music: S.sound.music });
  on('sound.sfx', push);
  on('sound.music', push);
  push();
}
