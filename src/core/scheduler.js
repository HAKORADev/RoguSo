// Frame scheduler (src/core/scheduler.js): decides when the game renders and presents, from the Display settings.
//   hz      'auto' = the display's real rate (measured from rAF), else a number: the target present rate ("hz-simulated",
//           the original dev's simulated refresh: we render at the chosen rate, the sim stays its fixed 60 Hz inside)
//   fps     cap on rendered frames per second (0 = off); the sim accumulator in main.js catches up over the next frames
//   vsync   on: present on the rAF/refresh phase. off: pump the loop through MessageChannel so renders are not gated to
//           the display cadence (as uncapped as a browser lets a canvas be)
//   pacer   frame pacing: watches the rendered frame times and eases the effective target toward the most stable step
//           (jitter high -> the nearest lower stable rate; stable again -> back up). A stable 57 often feels better
//           than a flapping 60/75
//   framegen FSR frame generation (experimental): after each real frame, synth presents blend the two last real frames
//           (x2: one 50% blend, x3/x4: evenly spaced crossfades). No reprojection yet — camera pans smooth, fast object
//           motion can ghost; the sim never steps on synth frames
// Hooks: real(dtWall) = one real frame (sim + render + present, main.js owns the sim law), synth(alpha) = a frame-gen
// blend present, onRate(fps, target) = a 1/s HUD/debug tick. Own loop: rAF keeps running (browser animations, Hz
// measurement) but rendering decisions live here; with any feature active the pump is MessageChannel-driven.
import { values, on, measureHz, detectedHz } from './settings.js';

const STEPS = [240, 165, 144, 120, 90, 72, 60, 45, 30];

export function createScheduler(hooks) {
  const S = values();
  let running = false, rafId = 0, pumpOn = false, chan = null;
  let lastReal = 0, nextPresent = 0, phase = 0, fi = 0;
  let targetHz = 60, cap = 0, gen = 0, vsync = true, pacer = false;
  let effTarget = 60, times = [], pacerUp = 0, lastRateEmit = 0;
  let hzMeasured = false;

  function readSettings() {
    const d = S.display;
    vsync = d.vsync !== false;
    cap = d.fps | 0;
    pacer = !!d.pacer;
    gen = d.res === undefined ? 0 : ({ '2': 2, '3': 3, '4': 4 }[S.graphics.fsrFramegen] || 0);
    const hz = d.hz;
    targetHz = hz === 'auto' || !hz ? (detectedHz() || 60) : (hz | 0);
    if (!pacer) effTarget = targetHz;
  }
  readSettings();
  on('display.*', readSettings);
  on('graphics.fsrFramegen', readSettings);

  function measure() {
    if (hzMeasured) return;
    hzMeasured = true;
    measureHz().then(() => { readSettings(); effTarget = targetHz; });
  }

  // ---- frame pacer: eases effTarget toward the most stable step
  function pace(dtMs) {
    if (!pacer) return;
    times.push(dtMs);
    if (times.length > 40) times.shift();
    if (times.length < 12) return;
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const varr = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
    const jit = Math.sqrt(varr) / mean;
    if (jit > 0.24) {
      const lower = [...STEPS].reverse().find((s) => s < effTarget);
      if (lower && lower >= 30) { effTarget = lower; times.length = 0; pacerUp = 0; }
    } else if (jit < 0.11) {
      if (++pacerUp > 240) {
        const higher = STEPS.find((s) => s > effTarget && s <= targetHz && (!cap || s <= cap));
        if (higher) effTarget = higher;
        pacerUp = 0;
      }
    }
  }

  // ---- the real decision: should this instant produce a real frame?
  function due(now) {
    const interval = 1000 / Math.max(10, effTarget);
    if (cap && now - lastReal < 1000 / cap - 0.75) return 0;
    if (vsync) {
      if (now < nextPresent - interval * 0.35) return 0;
      nextPresent = Math.max(nextPresent + interval, now - interval * 0.5);
    } else if (now - lastReal < interval * 0.5) return 0;
    return Math.min(0.1, lastReal ? (now - lastReal) / 1000 : 1 / 60);
  }

  function pump() {
    if (!running) return;
    if (pumpOn) chan.port2.postMessage(0);
    const now = performance.now();
    const dt = due(now);
    if (dt) {
      lastReal = now;
      hooks.real(dt);
      pace(dt * 1000);
      if (gen > 1) {
        for (let i = 1; i < gen; i++) hooks.synth(i / gen);
      }
      if (now - lastRateEmit > 1000) { lastRateEmit = now; hooks.onRate?.(rate(), effTarget); }
    }
  }

  // present rate actually achieved (for the onRate hook): EMA of real-frame interval
  let ema = 16.7, lastT = 0;
  function rate() {
    const now = performance.now();
    if (lastT) ema += (now - lastT - ema) * 0.2;
    lastT = now;
    return Math.round(1000 / Math.max(1, ema));
  }

  function loopRaf(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loopRaf);
    if (!pumpOn) {              // pure vsync path: render straight on rAF
      measure();
      const dt = due(now);
      if (dt) {
        lastReal = now;
        hooks.real(dt);
        if (gen > 1) for (let i = 1; i < gen; i++) hooks.synth(i / gen);
        if (now - lastRateEmit > 1000) { lastRateEmit = now; hooks.onRate?.(rate(), effTarget); }
      }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      measure();
      chan = new MessageChannel();
      chan.port1.onmessage = () => pump();
      readSettings();
      // framegen or any pacing feature wants presents between rAF ticks: run the MessageChannel pump
      pumpOn = gen > 1 || !vsync || cap > 0 || pacer || S.display.hz !== 'auto';
      rafId = requestAnimationFrame(loopRaf);
      if (pumpOn) chan.port2.postMessage(0);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    /** The HUD can show the effective rate; the pacer's target too. */
    info: () => ({ fps: rate(), target: effTarget, hz: targetHz, gen }),
  };
}
