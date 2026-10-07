// The roguelike's COINS (core/economy.js): the wallet falls where enemies die (the director decides when; luck
// raises the odds), picked up by walking over it. Coin pickups add to the wallet through the 'pickup:coin' event
// (main.js grants economy.addCoins — the sim stays save-file-free). There is NO healing drop anywhere: the owner's
// law — no HP regeneration, ever; the only thing on the ground is money.
// Sim (game.pickups = createPickups(game), reset() per battle, step() after the actors): the director calls
// dropCoins(x, z, n); at most PICKUP.coinMax lie on the field. A coin lies PICKUP.coinLife frames, blinking through
// its last PICKUP.blink; the hero takes it by walking over it (within PICKUP.r, on the ground, alive) — always, no
// wound requirement. Emits pickup:coin {x, z, n}.
// View (createPickupsView(scene, game), render-only): a chunky gold pillar, spinning over a gold ground ring,
// bobbing; instanced (the meshes stay in the scene: warm-up compiles them).
import * as THREE from 'three';
import { emit } from '../core/events.js';
import { boxesGeometry } from '../core/voxel.js';
import { ground } from '../world/map.js';

export const PICKUP = { life: 1800, blink: 180, r: 1.1, coinMax: 40, coinLife: 2400 };

export function createPickups(game) {
  const P = { list: [] };                                    // { x, z, t, kind: 'coin' }
  P.dropCoins = (x, z, n = 1) => {
    for (let k = 0; k < n; k++) {
      if (P.list.length >= PICKUP.coinMax) P.list.shift();
      const a = (k * 2.399963) % (Math.PI * 2), d = 0.4 + (k % 5) * 0.42;   // golden-angle scatter, deterministic
      P.list.push({ x: x + Math.sin(a) * d, z: z + Math.cos(a) * d, t: 0, kind: 'coin' });
    }
  };
  P.reset = () => { P.list.length = 0; };
  P.step = () => {
    const h = game.hero;
    for (let i = P.list.length - 1; i >= 0; i--) {
      const b = P.list[i];
      if (++b.t > PICKUP.coinLife) { P.list.splice(i, 1); continue; }
      if (h.dead || h.y > 1 || (h.x - b.x) ** 2 + (h.z - b.z) ** 2 > PICKUP.r * PICKUP.r) continue;
      P.list.splice(i, 1);
      emit('pickup:coin', { x: b.x, z: b.z, n: 1 });
    }
  };
  return P;
}

export function createPickupsView(scene, game) {
  const coin = boxesGeometry([
    { s: [0.34, 0.3, 0.1], p: [0, 0.15, 0], c: 0xf2c14e }, { s: [0.1, 0.3, 0.34], p: [0, 0.15, 0], c: 0xffe08a },
    { s: [0.3, 0.28, 0.06], p: [0, 0.16, 0], c: 0xffefc2 },
  ]);
  const coinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.65, flatShading: true, emissive: 0xd9a53a, emissiveIntensity: 0.55 });
  const coinsMesh = new THREE.InstancedMesh(coin, coinMat, PICKUP.coinMax);
  const coinRings = new THREE.InstancedMesh(new THREE.RingGeometry(0.34, 0.52, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.15, 0.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), PICKUP.coinMax);
  const root = new THREE.Group();
  scene.add(root);
  for (const m of [coinsMesh, coinRings]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  return {
    root,
    update() {
      let m = 0;
      const f = game.frame;
      for (const b of game.pickups.list) {
        const gy = ground(b.x, b.z);
        const left2 = PICKUP.coinLife - b.t;
        if (left2 < PICKUP.blink && (f >> 3) % 2) continue;   // blink out
        _q.setFromAxisAngle(UP, f * 0.09 + b.z);              // coins spin fast
        coinsMesh.setMatrixAt(m, _m.compose(_p.set(b.x, gy + 0.2 + 0.09 * Math.sin(f * 0.1 + b.x), b.z), _q, _s.setScalar(1)));
        coinRings.setMatrixAt(m, _m.compose(_p.set(b.x, gy + 0.05, b.z), _q.identity(), _s.setScalar(1 + 0.1 * Math.sin(f * 0.13))));
        m++;
      }
      coinsMesh.count = coinRings.count = m;
      coinsMesh.instanceMatrix.needsUpdate = coinRings.instanceMatrix.needsUpdate = true;
    },
  };
}
