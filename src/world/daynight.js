// Day/night cycle: 24 minutes total — 12 of day, 12 of night (owner's spec). One shared clock drives everything
// render-side: the shared SUN_DIR vector sweeps the sun's arc by day and the MOON's arc by night (the sky disc, the
// fog's warm lobe, the god rays and the shadow light all read that one vector, so at night the moon genuinely steers
// the light), the sky material's uNight crossfades the whole palette into moonlit blue with a cratered moon disc,
// a star field fades in, the fog palettes (C + ATMO uniforms) lerp to their night variants, and world.js dims the
// sun / lifts the firelights by nightFactor(). phase 0 = dawn, 0.5 = dusk, 0.75 = midnight. Purely visual: the sim
// never reads any of this.
import * as THREE from 'three';
import { SUN_DIR, SUN_AZ, HAZE, SKY_UP, PALETTE, skyDef } from './sky.js';

export const DAY_LEN = 1440;                 // seconds: 12 min day + 12 min night
const EDGE = 22 / DAY_LEN;                   // dusk / dawn ramp (±22 s around the transitions)
let clock = 1.2;                             // start just after dawn: every battle opens in the morning light
let night = 0;
export const nightFactor = () => night;
export const phase = () => (clock % DAY_LEN) / DAY_LEN;

// night variants of the fog/sky palette (linear-space targets the day palette lerps toward)
const NIGHT = {
  haze: new THREE.Color(0x101728), hazeWarm: new THREE.Color(0x1c2a4a), glow: new THREE.Color(0x2c4068),
  apCool: new THREE.Color(0x0e1526), dustLit: new THREE.Color(0x25324e), dustShade: new THREE.Color(0x080d18),
  skyMid: new THREE.Color(0x0d1526), skyTop: new THREE.Color(0x04070f), hznSun: new THREE.Color(0x24324e),
  hznAway: new THREE.Color(0x141d33), cloudRose: new THREE.Color(0x1b2438), cloudShade: new THREE.Color(0x0a0f1c),
  cloudLit: new THREE.Color(0x2a3a58),
};
const DAY = {};                              // snapshot of the loaded map's day palette (setAtmo writes it)
for (const k in NIGHT) DAY[k] = new THREE.Color();

const stars = (() => {
  const n = 1500, pos = new Float32Array(n * 3), mag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.96);   // upper hemisphere-ish
    const r = 830;
    pos[i * 3] = Math.sin(e) * Math.cos(a) * r;
    pos[i * 3 + 1] = Math.cos(e) * r + 30;
    pos[i * 3 + 2] = Math.sin(e) * Math.sin(a) * r;
    mag[i] = 0.35 + Math.random() * Math.random() * 1.4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aMag; varying float vA;
      uniform float uNight, uTime;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.72 + 0.28 * sin(uTime * (0.6 + aMag * 1.7) + position.x);
        vA = aMag * uNight * tw;
        gl_PointSize = (1.1 + aMag * 2.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.12, length(d)) * vA;
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * a, a);
      }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 0;
  return p;
})();

let starsRef = null;

/** Advance the clock and apply the whole cycle to the shared state. dt wall seconds; call once per rendered frame.
 *  The night factor and the light arc are CONTINUOUS over the whole cycle (the old ramp snapped at dusk and the
 *  sun/moon direction popped at each transition — the owner's 'weird state change'): dusk eases across ±EDGE s
 *  around phase 0.5, dawn across the phase 0/1 wrap, and the shared light rides one unbroken wheel (sun up, moon
 *  takes the same wheel at dusk, nothing jumps, shadows swing slowly all night). */
export function updateDayNight(dt, scene, camera) {
  clock += dt;
  const ph = phase();
  const half = EDGE;                                           // the dusk / dawn ramps: ±22 s around each transition
  if (ph < half) night = 0.5 - ph / (2 * half);                // dawn tail: the night lets go through the wrap
  else if (ph < 0.5 - half) night = 0;                         // full day
  else if (ph < 0.5 + half) night = (ph - (0.5 - half)) / (2 * half);   // dusk: the day lets go, eased through
  else if (ph < 1 - half) night = 1;                           // full night
  else night = 1 - (ph - (1 - half)) / (2 * half);             // pre-dawn: easing toward the wrap (0.5 at it)
  night = Math.min(1, Math.max(0, night));
  night = night * night * (3 - 2 * night);                       // smoothstep the ramps

  // one continuous wheel: the light climbs from the dawn horizon to the noon peak, sinks to the dusk horizon, and
  // the moon takes the very same wheel through the night — the direction never jumps, the palettes carry day / night
  const def = skyDef();
  const az0 = def.sunAz ?? 0.31;
  const elev = 0.03 + Math.sin(Math.PI * ph) * 0.55;
  const az = az0 + ph * Math.PI * 2;
  SUN_DIR.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));

  // palette: reset to the map's day colours (from the def, every frame — no stale snapshots across map loads), lerp
  // toward the night targets (in place: the CPU twin in sky.js and the shared fog uniforms read the same objects)
  for (const k in NIGHT) DAY[k].set(def[k] ?? 0x000000);
  for (const k in NIGHT) PALETTE[k].copy(DAY[k]).lerp(NIGHT[k], night);
  HAZE.copy(PALETTE.haze);
  SKY_UP.copy(PALETTE.skyMid).lerp(PALETTE.skyTop, 0.3);

  // the sky dome's uniforms (a new one per map load)
  const sky = scene.getObjectByName('skydome');
  if (sky) {
    const u = sky.material.uniforms;
    u.uNight.value = night;
    u.uSunDir.value = SUN_DIR;
    stars.material.uniforms.uNight.value = Math.max(0, night - 0.25) / 0.75;
    stars.material.uniforms.uTime.value = clock;
    if (!stars.parent) sky.parent?.add(stars);
    stars.position.copy(camera.position);
  }
}
