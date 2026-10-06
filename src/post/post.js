// Renderer + post chain — the concept.png look: backlit golden hour, warm bloom, strong DoF, subtle retro texture.
//   scene  → sceneRT  render-size, HDR, MSAA (Graphics AA level), depth texture (crisp voxel edges)
//   hist   → histRT   temporal accumulate target (FSR Native AA: jittered frames blend in here; else passthrough)
//   atmos  → atmosRT  render-size: aerial perspective (mauve haze away from the sun, peach toward it) + backlit dust
//                     in-scatter + ambient occlusion multiplied into the pre-fog scene colour; alpha = view distance
//   dof    → dofRT    half res: single-pass gather bokeh; alpha = how much a blurred foreground covers this pixel
//   bloom             UnrealBloom on dofRT, source-hued, HDR threshold: only sun / fire / spear arc bloom (Bloom level)
//   rays   → raysRT   half res: god rays, radial blur of the sky round the sun (skipped while the sun is off screen)
//   final  → backRT   sharp/blurred mix per pixel (CoC from full-res depth), bloom, horizontal highlight streaks,
//                     chromatic fringe, split-tone grade (scene-linear), hue-preserving S-curve + per-channel soft
//                     shoulder (fire stays orange/yellow, white armour keeps its shading), bottom darkening,
//                     vignette, grain, 2 px ordered dither + palette quantisation (retro)
//   present→ screen   back/front ping-pong: camera motion blur (weight from the camera's speed) and FSR frame
//                     generation (synth presents crossfade the last two real frames) both live here
// Quality (core/settings.js, applied live): AA (sceneRT samples), Supersampling (render scale > 1), FSR upscaler
// (render scale < 1 + RCAS-style sharpen), AO, Bloom, Camera / Object motion blur, internal resolution (Display).
// The sim is never touched: render-only, reads camera/focus.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { SUN_DIR } from '../world/sky.js';
import { values, on, internalRes } from '../core/settings.js';

// Tunables. Every key k is uniform u<K> in all passes.
// Tuned on overview / crowd-fight / musou captures toward the concept stats (luma mean ≈ 0.36, p5 ≤ 0.08, p95 ≥ 0.78,
// saturation ≈ 0.33, bottom third darker): r2 medians mean 0.34-0.39, p5 0.05-0.06, p95 0.63-0.76, sat 0.32-0.33,
// hero armour never at white (it was 3-7 % of the hero box). The scene itself is low-contrast (scene-luminance p50 ≈ 0.11,
// p95 ≈ 0.22), hence the steep curve.
const P = {
  // tone curve (Lottes): scene luminance tmMidIn → display tmMidOut, tmContrast = mid slope, tmShoulder < 1 = roll-off
  // reaching 1.0 at tmMax; knee = start of the per-channel shoulder; hotDesat = how fast overflow bleaches to white
  exposure: 1.3, tmContrast: 3.3, tmShoulder: 0.97, tmMidIn: 0.11, tmMidOut: 0.1, tmMax: 5, knee: 0.75, hotDesat: 0.6,
  sat: 1.32, lift: 0.002,
  shadowTint: [0.72, 0.9, 1.3], highTint: [1.14, 1.0, 0.76], tintLo: 0.03, tintHi: 0.4,   // split tone: teal-blue shade, gold light (DW golden hour, not sepia)
  hazeCool: [0.09, 0.11, 0.19], hazeWarm: [0.36, 0.21, 0.12], sunGlow: [0.9, 0.6, 0.35], sunGlowGeo: 0.8, inscatter: [0.02, 0.011, 0.005], sunBurst: [0.1, 0.06, 0.025], inscatterDist: 60,
  hazeStart: 9, hazeDensity: 0.006, hazeMax: 0.06, skyHaze: 0.3, skyGain: 0.5, farGain: 0.45,   // light enough that the wall keeps its bricks
  nearBlur: 26, farBlur: 0.6, bandNear: 1.4, bandFar: 5,          // DoF: CoC in half-res px, bands in metres
  bloom: 0.75, bloomRadius: 0.1, bloomThreshold: 1.5, bloomKnee: 0.5, bloomCool: 1.5, hdrClamp: 2.5,
  rays: 0.9, rayTint: [1.0, 0.7, 0.4], rayDecay: 0.965, rayReach: 0.85,   // god rays: gain, colour, falloff per tap, reach (fraction of the way to the sun)
  sharpen: 0.35, streak: 0.05, rowNoise: 0.01, ca: 1.3, grain: 0.025, levels: 72, dither: 0.6, vignette: 0.3, bottom: 0.25,
};
const uName = (k) => 'u' + k[0].toUpperCase() + k.slice(1);
const pUniforms = () => Object.fromEntries(Object.entries(P).map(([k, v]) => [uName(k), { value: Array.isArray(v) ? new THREE.Vector3(...v) : v }]));

const quadVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// circle of confusion (half-res px) from view distance: sharp band around the focus plane (hero + the ring around him),
// strong near-field blur, soft far field
const COC = /* glsl */`
  uniform float uFocus, uNearBlur, uNearScale, uFarBlur, uFarScale, uBandN, uBandF;
  float coc(float d) {
    float fn = max(uFocus - uBandN, 0.4), ff = uFocus + uBandF;
    return max(clamp((fn / d - 1.0) * uNearBlur * uNearScale, 0.0, 12.0), clamp((1.0 - ff / d) * uFarBlur * uFarScale, 0.0, 12.0));
  }`;

// screen-space ambient occlusion from the scene depth: 8-angle horizon samples in two rings, view-space, the AO
// multiplies the pre-fog scene colour in the atmos pass (never the sky: depth ≥ 1 returns 1)
const AoShader = /* glsl */`
  uniform sampler2D tDepth; uniform mat4 uProjInv; uniform vec2 uTexel; uniform float uAoStrength, uAoRadius;
  varying vec2 vUv;
  vec3 viewPos(vec2 uv) {
    float z = texture2D(tDepth, uv).x;
    vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); v.xyz /= v.w;
    return v.xyz;
  }
  void main() {
    float z = texture2D(tDepth, vUv).x;
    if (z >= 0.99999) { gl_FragColor = vec4(1.0); return; }
    vec3 p = viewPos(vUv);
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));
    float occ = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854 + fract(sin(float(i) * 12.9) * 43758.5) * 3.14;
      vec2 o = vec2(cos(a), sin(a)) * uTexel * (1.0 + 1.6 * mod(float(i), 2.0));
      vec3 s = viewPos(vUv + o);
      vec3 d = s - p; float l = max(length(d), 1e-4);
      occ += max(0.0, dot(n, d) / l - 0.06) * (1.0 / (1.0 + l * l * 0.03)) * step(l, uAoRadius);
    }
    float ao = clamp(1.0 - occ / 8.0 * uAoStrength, 0.0, 1.0);
    gl_FragColor = vec4(ao, ao, ao, 1.0);
  }`;

const AtmosShader = /* glsl */`
  uniform sampler2D tColor, tDepth; uniform mat4 uProjInv, uCamWorld; uniform vec3 uSunDir, uCamPos;
  uniform vec3 uHazeCool, uHazeWarm, uSunGlow, uInscatter, uSunBurst; uniform float uSunGlowGeo, uSkyGain, uFarGain, uHazeStart, uHazeDensity, uHazeMax, uSkyHaze, uHdrClamp, uInscatterDist;
  uniform sampler2D tAO; uniform float uAoOn;
  varying vec2 vUv;
  void main() {
    float z = texture2D(tDepth, vUv).x;
    vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); v.xyz /= v.w;
    vec3 dir = normalize(mat3(uCamWorld) * v.xyz);
    bool sky = z >= 0.99999;
    float dist = sky ? 5000.0 : length(v.xyz);
    // graduated exposure: fully fogged distance and sky sit a stop lower, so close-ups against the horizon read as a
    // sunset gradient instead of a white-out
    vec3 c = texture2D(tColor, vUv).rgb * (sky ? uSkyGain : mix(1.0, uFarGain, smoothstep(60.0, 250.0, dist)));
    c *= mix(vec3(1.0), texture2D(tAO, vUv).rgb, uAoOn);       // AO darkens the scene, never the haze it sits in
    float mu = dot(dir, uSunDir);
    vec3 hz = mix(uHazeCool, uHazeWarm, smoothstep(-0.4, 0.95, mu)) + uSunGlow * pow(max(mu, 0.0), 10.0) * (sky ? 1.0 : uSunGlowGeo);  // backlit walls stay silhouettes
    float wy = uCamPos.y + dir.y * min(dist, 400.0);                      // height of the hit point: dust hugs the ground
    float a = (1.0 - exp(-max(dist - uHazeStart, 0.0) * uHazeDensity)) * mix(0.6, 1.0, exp(-max(wy, 0.0) / 14.0));
    if (sky) a = uSkyHaze * (1.0 - smoothstep(0.0, 0.4, dir.y));
    c = mix(c, hz, a * uHazeMax * (1.0 - smoothstep(0.9, 2.0, max(c.r, max(c.g, c.b)))));   // fires stay fire through the haze
    // backlit dust: sunlight scattered forward by the air between the camera and the hit point (lifts the sun side
    // of the frame; additive and growing with distance, so near silhouettes stay readable)
    // (broad lift, plus a tight golden burst around the sun that only builds up over long distances: the concept's
    // glowing sky behind the castle, while the backlit wall itself stays a legible silhouette)
    float dd = min(dist, 400.0);
    c += uInscatter * pow(max(mu, 0.0), 4.0) * (1.0 - exp(-dd / uInscatterDist)) + uSunBurst * pow(max(mu, 0.0), 16.0) * (1.0 - exp(-dd / (3.0 * uInscatterDist)));
    // tame stacked additive fire before bloom; hue-preserving (scale, not per-channel clip) so flames stay orange
    float cm = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * min(1.0, uHdrClamp / max(cm, 1e-4)), dist);
  }`;

// Gather DoF (after Gustafsson's single-pass bokeh): golden-angle spiral stretched to a square, so blurred voxels read
// as soft blocks as in the concept. Every tap spreads by its own CoC; taps behind the centre are clamped to the centre's
// CoC so a sharp hero never smears onto the blurred background.
const DofShader = /* glsl */`
  uniform sampler2D tAtmos; uniform vec2 uTexel;
  varying vec2 vUv;
  ${COC}
  #define RAD_SCALE 0.85
  void main() {
    vec4 c0 = texture2D(tAtmos, vUv);
    float cSize = coc(c0.a);
    vec3 col = c0.rgb; float tot = 1.0, fg = 0.0, radius = RAD_SCALE;
    for (float ang = 0.0; radius < 12.0; ang += 2.39996323) {
      vec2 dv = vec2(cos(ang), sin(ang)); dv /= max(abs(dv.x), abs(dv.y));   // square bokeh: soft voxel blocks
      vec4 s = texture2D(tAtmos, vUv + dv * uTexel * radius);
      float sSize = coc(s.a);
      if (s.a > c0.a) sSize = clamp(sSize, 0.0, cSize * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, sSize);
      col += mix(col / tot, s.rgb, m); tot += 1.0;
      fg += s.a < c0.a - 0.5 ? m : 0.0;                                    // blurred foreground spilling over us
      radius += RAD_SCALE / radius;
    }
    gl_FragColor = vec4(col / tot, clamp(fg / tot * 4.0, 0.0, 1.0));
  }`;

// God rays (half res): radial blur of the sunlit sky toward the sun's screen position. Only sky pixels near the sun
// feed it, so every silhouette in front of the low sun (towers, walls, ridges, soldiers) cuts a dark shaft into the
// light. Skipped entirely while the sun is off screen.
const RaysShader = /* glsl */`
  uniform sampler2D tAtmos; uniform vec2 uSunUv, uAspect; uniform float uRayDecay, uRayReach, uTime;
  varying vec2 vUv;
  float src(vec2 uv) {
    vec4 s = texture2D(tAtmos, uv);
    if (s.a < 4000.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
    float r = length((uv - uSunUv) * uAspect);
    return (0.35 + dot(s.rgb, vec3(0.3, 0.5, 0.2))) * exp(-r * 4.0);
  }
  void main() {
    vec2 d = (uSunUv - vUv) * (uRayReach / 36.0);
    float j = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
    vec2 uv = vUv + d * j;
    float acc = 0.0, w = 1.0;
    for (int i = 0; i < 36; i++) { acc += src(uv) * w; w *= uRayDecay; uv += d; }
    gl_FragColor = vec4(vec3(acc / 36.0), 1.0);
  }`;

const FinalShader = /* glsl */`
  uniform sampler2D tSharp, tDof, tBloom, tRays; uniform vec2 uRes; uniform float uTime, uFlash, uRayGain;
  uniform vec3 uRayTint;
  uniform float uExposure, uTmContrast, uTmShoulder, uTmB, uTmC, uKnee, uHotDesat, uSat, uLift, uTintLo, uTintHi, uSharpen, uStreak, uRowNoise, uCa, uGrain, uLevels, uDither, uVignette, uBottom;
  uniform vec3 uShadowTint, uHighTint;
  varying vec2 vUv;
  ${COC}
  float bayer4(vec2 p) {
    int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return (float(m[i]) + 0.5) / 16.0 - 0.5;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // scene colour at uv: full-res sharp where in focus (lightly unsharp-masked: crisp voxel edges), half-res bokeh where
  // the pixel's own depth is out of focus or a blurred foreground covers it; + bloom
  vec3 scene(vec2 uv) {
    vec2 t = 1.0 / uRes;
    vec4 s = texture2D(tSharp, uv);
    vec3 nb = texture2D(tSharp, uv + vec2(t.x, 0.0)).rgb + texture2D(tSharp, uv - vec2(t.x, 0.0)).rgb
            + texture2D(tSharp, uv + vec2(0.0, t.y)).rgb + texture2D(tSharp, uv - vec2(0.0, t.y)).rgb;
    vec3 sharp = max(s.rgb + (s.rgb - nb * 0.25) * uSharpen, 0.0);
    vec4 b = texture2D(tDof, uv);
    float k = max(smoothstep(0.3, 1.3, coc(s.a)), b.a);
    return mix(sharp, b.rgb, k) + texture2D(tBloom, uv).rgb;
  }
  void main() {
    vec2 d = vUv - 0.5;
    // light lateral chromatic fringe toward the edges: the composite once, R/B shifted by the sharp buffer's difference
    // (3 taps, not three full scene() composites)
    vec2 ca = vec2(uCa * dot(d, d) * 4.0 / uRes.x, 0.0);
    vec3 c = scene(vUv), s0 = texture2D(tSharp, vUv).rgb;
    c.r += texture2D(tSharp, vUv + ca).r - s0.r; c.b += texture2D(tSharp, vUv - ca).b - s0.b;
    c = max(c, 0.0);
    // faint horizontal streaks: highlights smear sideways (tape / anamorphic feel), plus low row-to-row jitter
    vec3 st = vec3(0.0);
    for (int i = 1; i <= 6; i++) {
      float o = (float(i * i) + 1.0) * 2.0 / uRes.x, w = 1.0 / float(i);
      st += (max(texture2D(tDof, vUv + vec2(o, 0.0)).rgb - 1.0, 0.0) + max(texture2D(tDof, vUv - vec2(o, 0.0)).rgb - 1.0, 0.0)) * w;
    }
    c += st * uStreak * vec3(1.0, 0.86, 0.7);
    c += texture2D(tRays, vUv).rgb * uRayTint * uRayGain;
    c *= 1.0 + (hash(vec2(floor(gl_FragCoord.y * 0.5), floor(uTime * 12.0))) - 0.5) * uRowNoise;
    // golden-hour grade in scene-linear (before the curve, so its shoulder also rolls off the tinted highlights):
    // split tone — cool mauve-blue shade, peach-gold light; blue-dominant pixels (spear arc, tassel, teal trim) keep
    // their cool, the arc is the one cool light in the frame — then saturation
    c *= uExposure;
    float L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
    float cool = smoothstep(0.0, 0.25, (c.b - c.r) / max(c.b, 1e-4));
    // (emissive-hot light — musou burst, flashes — fades back to neutral so it still burns to white, not cream)
    c *= mix(mix(uShadowTint, mix(uHighTint, vec3(0.97, 1.0, 1.06), cool), smoothstep(uTintLo, uTintHi, L)), vec3(1.0), smoothstep(1.2, 3.0, L));
    L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
    c = max(mix(vec3(L), c, uSat), 0.0);
    // film response: a Lottes S-curve on luminance (steep mids = the concept's contrast, long shoulder) scales the
    // colour, so hue survives the top end; then a per-channel soft shoulder takes the overflow, so saturated light walks
    // orange → yellow → white like real fire (not peach-white) and white armour rolls off with its shading
    c *= pow(L, uTmContrast) / (pow(L, uTmContrast * uTmShoulder) * uTmB + uTmC) / L;
    float Lh = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = min(c, uKnee) + (1.0 - uKnee) * (1.0 - exp(-max(c - uKnee, 0.0) / (1.0 - uKnee)));
    float pk2 = max(c.r, max(c.g, c.b));
    // only light that is bright as a whole bleaches (by luminance, not by one channel's overflow): a saturated orange
    // flame keeps its orange → yellow body instead of washing out to peach, the white-hot core still burns to white
    c = mix(c, vec3(pk2), 1.0 - 1.0 / (uHotDesat * max(Lh - 0.8, 0.0) + 1.0));
    c = uLift * vec3(1.0, 0.8, 0.75) + min(c, 1.0) * (1.0 - uLift);
    c = sRGBTransferOETF(vec4(max(c, 0.0), 1.0)).rgb;
    // lens: soft vignette + darker foreground band (concept: bottom third darker than the top)
    c *= (1.0 - uVignette * smoothstep(0.35, 0.95, length(d * vec2(1.6, 1.0)))) * (1.0 - uBottom * (1.0 - smoothstep(0.0, 0.42, vUv.y)));
    c = mix(c, vec3(1.0, 0.97, 0.9), uFlash);
    // grain on the screen grid (fine); dither + quantise on a 2 px grid (retro)
    c += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 97.0) - 0.5) * uGrain;
    c += bayer4(floor(gl_FragCoord.xy * 0.5)) * uDither / uLevels;
    c = floor(c * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

// present pass: back/front ping-pong. uMix 0 = the latest real frame, 1 = the one before it; camera motion blur and
// FSR frame generation both live in this mix (framegen: synth presents crossfade the two real frames)
const PresentShader = /* glsl */`
  uniform sampler2D tA, tB; uniform float uMix;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(tA, vUv) * (1.0 - uMix) + texture2D(tB, vUv) * uMix; }`;

const mat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: quadVS, fragmentShader, uniforms: { ...pUniforms(), ...uniforms }, depthTest: false, depthWrite: false, toneMapped: false });
const v3 = (a) => new THREE.Vector3(...a);

export function createPost({ canvas, width, height }) {
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const mkRT = (w, h, o) => new THREE.WebGLRenderTarget(w, h, o);
  const sceneRT = mkRT(4, 4, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(4, 4) });
  const histRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  // nearest: the half-res DoF must not average a hero-plane distance with the background behind it
  const atmosRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const aoRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const dofRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const raysRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  let backRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  let frontRT = mkRT(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const bloom = new UnrealBloomPass(new THREE.Vector2(320, 180), P.bloom, P.bloomRadius, P.bloomThreshold);
  bloom.blendMaterial.visible = false;          // don't add onto dofRT: the final pass adds the bloom to both branches
  // prefilter: soft knee instead of a hard cut (no popping), and blue-dominant light (the spear arc, the one cool
  // light in a warm frame) passes at a lower threshold so the arc glows like the concept's without blooming the sand
  const hp = bloom.materialHighPassFilter;
  hp.uniforms.smoothWidth.value = P.bloomKnee;
  hp.uniforms.uCool = { value: P.bloomCool };
  hp.fragmentShader = /* glsl */`
    uniform sampler2D tDiffuse; uniform float luminosityThreshold, smoothWidth, uCool;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float cool = clamp((c.b - c.r) / max(c.b, 1e-3), 0.0, 1.0);
      float v = luminance(c) * (1.0 + uCool * cool);
      gl_FragColor = vec4(min(c, vec3(1.6)) * smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v), 1.0);   // capped: stacked trails glow, never flare over the hero
    }`;
  // bloom keeps its source's hue (orange fire → orange halo, blue arc → blue halo); the wide mips lean only a little
  // warm, the grade already carries the golden hour. The two widest mips are faint: at full weight a large bright mass
  // (the Musou payoff's dragon + light shards) spread into a screen-wide pale-blue veil; light stays a local glow.
  bloom.bloomTintColors = [v3([0.95, 1, 1.08]), v3([1, 0.97, 0.93]), v3([0.45, 0.42, 0.39]), v3([0.12, 0.11, 0.1]), v3([0.03, 0.026, 0.023])];
  const dofU = { uFocus: { value: 7 }, uNearScale: { value: 1 }, uFarScale: { value: 1 }, uBandN: { value: 3 }, uBandF: { value: 5 } };   // shared by dof + final
  const ao = new FullScreenQuad(mat(AoShader, {
    tDepth: { value: sceneRT.depthTexture }, uProjInv: { value: new THREE.Matrix4() },
    uTexel: { value: new THREE.Vector2() }, uAoStrength: { value: 0.9 }, uAoRadius: { value: 1.3 },
  }));
  const atmos = new FullScreenQuad(mat(AtmosShader, {
    tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture }, tAO: { value: aoRT.texture }, uAoOn: { value: 0 },
    uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uSunDir: { value: SUN_DIR }, uCamPos: { value: new THREE.Vector3() },
  }));
  const dof = new FullScreenQuad(mat(DofShader, { tAtmos: { value: atmosRT.texture }, uTexel: { value: new THREE.Vector2() }, ...dofU }));
  const rays = new FullScreenQuad(mat(RaysShader, { tAtmos: { value: atmosRT.texture }, uSunUv: { value: new THREE.Vector2() }, uAspect: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } }));
  const sunNdc = new THREE.Vector3(), camFwd = new THREE.Vector3();
  const fin = new FullScreenQuad(mat(FinalShader, {
    tSharp: { value: atmosRT.texture }, tDof: { value: dofRT.texture }, tBloom: { value: bloom.renderTargetsHorizontal[0].texture }, tRays: { value: raysRT.texture }, uRayGain: { value: 0 },
    uRes: { value: new THREE.Vector2(1280, 720) }, uTime: { value: 0 }, uFlash: { value: 0 }, uTmB: { value: 0 }, uTmC: { value: 0 }, ...dofU,
  }));
  const present = new FullScreenQuad(new THREE.ShaderMaterial({
    vertexShader: quadVS, fragmentShader: PresentShader,
    uniforms: { tA: { value: backRT.texture }, tB: { value: frontRT.texture }, uMix: { value: 0 } },
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  // the current look: P with the map's overrides (setLook); every key is uniform u<K> in each pass
  let L = P;
  function setLook(o = {}) {
    L = { ...P, ...o };
    for (const k in L) for (const q of [atmos, dof, rays, fin]) { const u = q.material.uniforms[uName(k)]; if (u) Array.isArray(L[k]) ? u.value.set(...L[k]) : (u.value = L[k]); }
    bloom.strength = L.bloom; bloom.radius = L.bloomRadius; bloom.threshold = L.bloomThreshold;
    hp.uniforms.smoothWidth.value = L.bloomKnee; hp.uniforms.uCool.value = L.bloomCool;
    // Lottes curve constants: tmMidIn → tmMidOut and tmMax → 1
    const ta = L.tmContrast, ad = ta * L.tmShoulder, mi = L.tmMidIn, mo = L.tmMidOut, hm = L.tmMax, den = (hm ** ad - mi ** ad) * mo, g = fin.material.uniforms;
    g.uTmB.value = (hm ** ta * mo - mi ** ta) / den; g.uTmC.value = (hm ** ad * mi ** ta - hm ** ta * mi ** ad * mo) / den;
  }
  setLook();

  // ---- quality state (Graphics + Display settings)
  const Q = {
    msaa: 4, ssaa: 1, fsr: 1, fsrName: 'off', ao: 0, mbCam: 0, bloomQ: 'med', na: false,
    w: width, h: height, iw: width, ih: height,
  };
  const FSRC = { off: 1, ultra: 2.0, perf: 1.7, bal: 1.5, qual: 1.3, uqual: 1.2 };
  const AOC = { off: [0, 0, 0], low: [0.55, 0.9, 1], med: [0.85, 1.3, 1], high: [1.15, 1.8, 1] };
  const MBC = { off: 0, low: 0.3, med: 0.5, high: 0.72 };
  const BLOOMQ = { off: 0, low: 0.55, med: 1, high: 1.4 };
  function applyGraphics() {
    const g = values().graphics;
    const d = values().display;
    Q.msaa = [0, 2, 4, 8, 16][['0', '2', '4', '8', '16'].indexOf(String(g.aa))] ?? 4;
    Q.ssaa = { off: 1, '2': 1.414, '4': 2, '8': 2.828 }[String(g.ssaa)] || 1;
    Q.fsr = FSRC[g.fsrUpscale] || 1;
    Q.fsrName = g.fsrUpscale;
    Q.na = !!g.fsrNa;
    Q.mbCam = MBC[g.mbCam] ?? 0;
    const a = AOC[g.ao] || AOC.off;
    ao.material.uniforms.uAoStrength.value = a[0];
    ao.material.uniforms.uAoRadius.value = a[1];
    atmos.material.uniforms.uAoOn.value = a[2];
    const bq = BLOOMQ[g.bloom] ?? 1;
    bloom.strength = L.bloom * bq;
    bloom.enabled = g.bloom !== 'off';
    const ir = internalRes();
    Q.iw = ir ? ir[0] : Q.w;
    Q.ih = ir ? ir[1] : Q.h;
    resizeTargets();
  }
  function resizeTargets() {
    const s = Q.ssaa / Q.fsr;                                     // supersampling multiplies, FSR divides
    const w = Math.max(64, Math.min(8192, Math.round(Q.iw * s))), h = Math.max(64, Math.min(8192, Math.round(Q.ih * s)));
    renderer.setSize(Q.w, Q.h, false);
    const hw = Math.round(w / 2), hh = Math.round(h / 2);
    sceneRT.samples = Q.msaa;
    sceneRT.setSize(w, h); histRT.setSize(w, h); atmosRT.setSize(w, h);
    dofRT.setSize(hw, hh); raysRT.setSize(hw, hh); aoRT.setSize(hw, hh);
    backRT.setSize(Q.w, Q.h); frontRT.setSize(Q.w, Q.h);
    sceneRT.depthTexture.image.width = w; sceneRT.depthTexture.image.height = h;
    sceneRT.depthTexture.dispose();
    rays.material.uniforms.uAspect.value.set(Q.w / Q.h, 1);
    bloom.setSize(hw, hh);
    fin.material.uniforms.uRes.value.set(Q.w, Q.h);
    dof.material.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    ao.material.uniforms.uTexel.value.set(1.6 / w, 1.6 / h);
    histRTClear = true;
  }
  let histRTClear = true;
  on('graphics.*', applyGraphics);
  on('display.*', applyGraphics);
  applyGraphics();

  function setSize(w, h) {
    Q.w = w; Q.h = h;
    applyGraphics();
  }

  // quality tier: sustained frames over budget (EMA > 20 ms for 2 s) step the scene MSAA 4× → 2× → off (?hq pins it).
  // Never steps back up (no oscillation).
  const autoQ = !new URLSearchParams(location.search).has('hq');
  let lastT = 0, ema = 16.7, slow = 0;
  function tier(now) {
    const dt = lastT ? now - lastT : 16.7; lastT = now;
    if (!autoQ || dt > 250 || sceneRT.samples === 0) return;              // a long stall (tab hidden, compile) isn't load
    ema += (dt - ema) * 0.05;
    slow = ema > 20 ? slow + 1 : 0;
    if (slow > 120) { sceneRT.samples = sceneRT.samples > 2 ? 2 : 0; sceneRT.dispose(); slow = 0; ema = 16.7; }
  }

  // camera speed (for the motion-blur weight): position + rotation delta per frame, eased
  const lastPos = new THREE.Vector3(), lastQuat = new THREE.Quaternion();
  let camSpeed = 0, haveCam = false, mbWeight = 0, naAcc = null;
  const jitter = new THREE.Vector2();
  let naBlend = 0.88;

  return {
    /** Warm-up (main.js, behind the loading card / ink wipe): compile the scene's programs for the pass that draws them,
     *  into sceneRT (linear working space). Compiled with the canvas bound they came out as the sRGB-output variant, which
     *  the scene never uses: every real program then compiled on its first drawn frame (a crowd pool first shown a
     *  second into the battle stalled it there). Fails open: a compile that never lands cannot hold the game hostage. */
    compile(scene, camera) {
      renderer.setRenderTarget(sceneRT);
      const p = renderer.compileAsync(scene, camera).catch((e) => console.warn('compile', e));
      renderer.setRenderTarget(null);
      return p;
    },
    setSize, setLook,
    /** One real frame: the whole chain into backRT. The screen is not touched until present(). */
    render(scene, camera, time, focus, flash) {
      tier(performance.now());
      const g = fin.material.uniforms;
      // FSR Native AA: jitter the projection and accumulate into histRT (the atmos pass reads the history, not the raw frame)
      const na = Q.na && Q.fsr === 1;
      if (na) {
        jitter.set((Math.random() - 0.5) * 0.0012, (Math.random() - 0.5) * 0.0012);
        const camSpeedNow = haveCam ? camera.position.distanceTo(lastPos) + camera.quaternion.angleTo(lastQuat) * 4 : 1;
        naBlend = camSpeedNow > 0.08 ? 0.55 : 0.88;
        camera.projectionMatrix.elements[8] += jitter.x * 2; camera.projectionMatrix.elements[9] += jitter.y * 2;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      if (na) {
        camera.projectionMatrix.elements[8] -= jitter.x * 2; camera.projectionMatrix.elements[9] -= jitter.y * 2;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        // hist = mix(hist, scene, 1-blend) — first frame after a resize starts from the raw frame
        const acc = naAcc || (naAcc = new FullScreenQuad(new THREE.ShaderMaterial({
          vertexShader: quadVS, fragmentShader: `uniform sampler2D tCur, tPrev; uniform float uA; varying vec2 vUv;
            void main() { gl_FragColor = mix(texture2D(tCur, vUv), texture2D(tPrev, vUv), uA); }`,
          uniforms: { tCur: { value: sceneRT.texture }, tPrev: { value: histRT.texture }, uA: { value: 0.9 } },
          depthTest: false, depthWrite: false, toneMapped: false,
        })));
        acc.material.uniforms.uA.value = histRTClear ? 0 : naBlend;
        renderer.setRenderTarget(histRT); acc.render(renderer);
        atmos.material.uniforms.tColor.value = histRT.texture;
        histRTClear = false;
      } else if (naAcc) {
        atmos.material.uniforms.tColor.value = sceneRT.texture;
        histRTClear = true;
      }

      const a = atmos.material.uniforms;
      a.uProjInv.value.copy(camera.projectionMatrixInverse);
      a.uCamWorld.value.copy(camera.matrixWorld);
      a.uCamPos.value.copy(camera.position);
      if (a.uAoOn.value > 0) {
        ao.material.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
        renderer.setRenderTarget(aoRT); ao.render(renderer);
      }
      renderer.setRenderTarget(atmosRT); atmos.render(renderer);

      const f = camera.position.distanceTo(focus);
      const u = dof.material.uniforms;
      u.uFarScale.value = THREE.MathUtils.clamp(7 / f, 1, 3);   // close-ups: stronger background bokeh
      u.uNearScale.value = THREE.MathUtils.clamp(8 / f, 0.25, 1);   // wide/high shots: no tilt-shift miniature at the bottom
      u.uFocus.value = f; u.uBandN.value = Math.max(L.bandNear, f * 0.22); u.uBandF.value = Math.max(L.bandFar, f * 0.6);
      renderer.setRenderTarget(dofRT); dof.render(renderer);

      if (bloom.enabled) bloom.render(renderer, null, dofRT, 1 / 60, false);
      else { renderer.setRenderTarget(bloom.renderTargetsHorizontal[0]); renderer.clear(); }

      // god rays: sun's screen position; fade out as it leaves the frame or goes behind the camera
      sunNdc.copy(SUN_DIR).multiplyScalar(800).add(camera.position).project(camera);
      const facing = camera.getWorldDirection(camFwd).dot(SUN_DIR);
      const off = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y));
      const rg = facing > 0 ? L.rays * THREE.MathUtils.smoothstep(facing, 0.2, 0.6) * (1 - THREE.MathUtils.smoothstep(off, 1.0, 1.8)) : 0;
      g.uRayGain.value = rg;
      if (rg > 0) {
        const ru = rays.material.uniforms;
        ru.uSunUv.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5); ru.uTime.value = time;
        renderer.setRenderTarget(raysRT); rays.render(renderer);
      }

      g.uTime.value = time; g.uFlash.value = flash;
      // FSR upscaler: the low-res render lands here; the final pass's unsharp mask becomes the RCAS-style reconstruct
      g.uSharpen.value = L.sharpen + (Q.fsr > 1 ? 0.28 + 0.1 * Q.fsr : 0);
      renderer.setRenderTarget(backRT); fin.render(renderer);

      // camera motion-blur weight + the ping-pong swap (present() shows the mix)
      const sp = haveCam ? camera.position.distanceTo(lastPos) + camera.quaternion.angleTo(lastQuat) * 6 : 0;
      camSpeed = camSpeed * 0.6 + sp * 0.4;
      lastPos.copy(camera.position); lastQuat.copy(camera.quaternion); haveCam = true;
      mbWeight = Q.mbCam ? Math.min(Q.mbCam, camSpeed * Q.mbCam * 6) : 0;
    },
    /** Show a frame: w 0 = the latest real frame, 0..1 crossfades toward the one before it (frame-gen synth frames). */
    present(w = 0) {
      present.material.uniforms.tA.value = backRT.texture;
      present.material.uniforms.tB.value = frontRT.texture;
      present.material.uniforms.uMix.value = w < 0.003 ? 0 : Math.min(1, w);
      renderer.setRenderTarget(null);
      present.render(renderer);
      if (w < 0.003) {
        const t = backRT;
        backRT = frontRT; frontRT = t;          // ping-pong: the next real frame renders into the old front
      }
    },
    /** The camera motion-blur weight the last real frame produced (the scheduler adds it to the frame-gen mix). */
    mbWeight: () => mbWeight,
  };
}
