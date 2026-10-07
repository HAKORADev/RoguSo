// meat bun meat buns: DW's healing drop, in story and free mode — and the roguelike's COINS (core/economy.js): the
// wallet falls where enemies die (the director decides when; luck raises the odds), picked up by walking over it like
// a bun but with no wound requirement (a coin is always taken). Coin pickups add to the wallet through the
// 'pickup:coin' event (main.js grants economy.addCoins — the sim stays save-file-free).
// Sim (game.pickups = createPickups(game), reset() per battle, step() after the actors): a bun drops where every enemy
// officer falls (ko.officer), where a beaten hero-model foe falls or breaks off (actor:down / actor:retreat beaten), and at
// every PICKUP.every-th grunt KO; at most PICKUP.max on the field (a new one pushes out the oldest). It lies PICKUP.life
// frames; the hero takes it by walking over it (within PICKUP.r, on the ground, alive) — only while he is hurt, so a bun
// waits for when he needs it — and heals officer ? PICKUP.big : PICKUP.small of his max HP × game.diff.heal. Driven by
// sim events only (no rng): deterministic. Emits pickup {x, z, heal}.
// View (createPickupsView(scene, game), render-only): a voxel bun on a leaf plate, bobbing and turning over a gold ground
// ring, blinking through its last PICKUP.blink frames; instanced (the meshes stay in the scene: warm-up compiles them).
// A coin is a small gold pillar, spinning, over a tighter ring.
import * as THREE from 'three';
import { on, emit } from '../core/events.js';
import { rng } from '../core/rng.js';
import { boxesGeometry } from '../core/voxel.js';
import { ground } from '../world/map.js';

export const PICKUP = { every: 40, max: 12, life: 1800, blink: 180, r: 1.1, small: 0.15, big: 0.3, coinMax: 40, coinLife: 2400 };

export function createPickups(game) {
  const P = { list: [] };                                    // { x, z, big, t, kind: 'bun' | 'coin' }
  let grunts = 0;
  const drop = (x, z, big) => {
    if (P.list.length >= PICKUP.max) P.list.shift();
    P.list.push({ x, z, big, t: 0, kind: 'bun' });
  };
  /** The roguelike's wallet drops: n coins scattered round (x, z), worth 1 each (rare by design: the director asks). */
  P.dropCoins = (x, z, n = 1) => {
    for (let k = 0; k < n; k++) {
      if (P.list.filter((q) => q.kind === 'coin').length >= PICKUP.coinMax) break;
      const a = rng.next() * Math.PI * 2, d = 0.4 + rng.next() * 1.8;
      P.list.push({ x: x + Math.sin(a) * d, z: z + Math.cos(a) * d, big: false, t: 0, kind: 'coin' });
    }
  };
  on('ko', (e) => { if (e.officer || ++grunts % PICKUP.every === 0) drop(e.x, e.z, e.officer); });   // (sim-side: fired inside step())
  on('actor:down', (e) => drop(e.x, e.z, true));
  on('actor:retreat', (e) => { if (e.beaten) drop(e.x, e.z, true); });
  P.reset = () => { P.list.length = 0; grunts = 0; };
  P.step = () => {
    const h = game.hero;
    for (let i = P.list.length - 1; i >= 0; i--) {
      const b = P.list[i];
      if (++b.t > (b.kind === 'coin' ? PICKUP.coinLife : PICKUP.life)) { P.list.splice(i, 1); continue; }
      if (h.dead || h.y > 1 || (h.x - b.x) ** 2 + (h.z - b.z) ** 2 > PICKUP.r * PICKUP.r) continue;
      if (b.kind === 'coin') {                               // a coin is always taken (no wound requirement)
        P.list.splice(i, 1);
        emit('pickup:coin', { x: b.x, z: b.z, n: 1 });
        continue;
      }
      if (h.hp >= h.hpMax) continue;
      const heal = Math.round((b.big ? PICKUP.big : PICKUP.small) * game.diff.heal * h.hpMax);
      h.hp = Math.min(h.hpMax, h.hp + heal);
      P.list.splice(i, 1);
      emit('pickup', { x: b.x, z: b.z, heal });
    }
  };
  return P;
}

export function createPickupsView(scene, game) {
  const W = 0xf4ecdc, S = 0xd9ccb4;                          // dough, its shaded pleats
  const bun = boxesGeometry([
    { s: [0.66, 0.05, 0.66], p: [0, 0.025, 0], c: 0x4f7a34 }, { s: [0.5, 0.05, 0.74], p: [0, 0.03, 0], c: 0x5e8a3c },   // leaf plate
    { s: [0.5, 0.16, 0.5], p: [0, 0.13, 0], c: W }, { s: [0.58, 0.1, 0.4], p: [0, 0.11, 0], c: S }, { s: [0.4, 0.1, 0.58], p: [0, 0.11, 0], c: S },
    { s: [0.38, 0.1, 0.38], p: [0, 0.25, 0], c: W }, { s: [0.22, 0.07, 0.22], p: [0, 0.33, 0], c: S },
    { s: [0.08, 0.03, 0.08], p: [0, 0.38, 0], c: 0xc8281c },                                                         // red dot
  ]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, emissive: 0xffe6b0, emissiveIntensity: 0.35 });
  const buns = new THREE.InstancedMesh(bun, mat, PICKUP.max);
  const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.5, 0.78, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.05, 0.35), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), PICKUP.max);
  // the coin: a chunky gold pillar (the roguelike wallet, rare by design), self-lit so it reads as treasure
  const coin = boxesGeometry([
    { s: [0.34, 0.3, 0.1], p: [0, 0.15, 0], c: 0xf2c14e }, { s: [0.1, 0.3, 0.34], p: [0, 0.15, 0], c: 0xffe08a },
    { s: [0.3, 0.28, 0.06], p: [0, 0.16, 0], c: 0xffefc2 },
  ]);
  const coinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.65, flatShading: true, emissive: 0xd9a53a, emissiveIntensity: 0.55 });
  const coinsMesh = new THREE.InstancedMesh(coin, coinMat, PICKUP.coinMax);
  const coinRings = new THREE.InstancedMesh(new THREE.RingGeometry(0.34, 0.52, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.15, 0.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), PICKUP.coinMax);
  const root = new THREE.Group();                            // main.js hides it on title / select
  scene.add(root);
  for (const m of [buns, rings]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); }
  for (const m of [coinsMesh, coinRings]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); }
  buns.castShadow = true;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  return {
    root,
    update() {
      let n = 0, m = 0;
      const f = game.frame;
      for (const b of game.pickups.list) {
        const gy = ground(b.x, b.z);
        if (b.kind === 'coin') {
          const left2 = PICKUP.coinLife - b.t;
          if (left2 < PICKUP.blink && (f >> 3) % 2) continue;   // blink out like a bun
          _q.setFromAxisAngle(UP, f * 0.09 + b.z);              // coins spin fast
          coinsMesh.setMatrixAt(m, _m.compose(_p.set(b.x, gy + 0.2 + 0.09 * Math.sin(f * 0.1 + b.x), b.z), _q, _s.setScalar(1)));
          coinRings.setMatrixAt(m, _m.compose(_p.set(b.x, gy + 0.05, b.z), _q.identity(), _s.setScalar(1 + 0.1 * Math.sin(f * 0.13))));
          m++;
          continue;
        }
        const left = PICKUP.life - b.t;
        if (left < PICKUP.blink && (f >> 3) % 2) continue;       // last 3 s: blinks
        const k = b.big ? 1.45 : 1.25;
        _q.setFromAxisAngle(UP, f * 0.03 + b.x);
        buns.setMatrixAt(n, _m.compose(_p.set(b.x, gy + 0.18 + 0.08 * Math.sin(f * 0.08 + b.z), b.z), _q, _s.setScalar(k)));
        rings.setMatrixAt(n, _m.compose(_p.set(b.x, gy + 0.05, b.z), _q.identity(), _s.setScalar(k * (1 + 0.08 * Math.sin(f * 0.12)))));
        n++;
      }
      buns.count = rings.count = n;
      coinsMesh.count = coinRings.count = m;
      buns.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;
      coinsMesh.instanceMatrix.needsUpdate = coinRings.instanceMatrix.needsUpdate = true;
    },
  };
}
