// The RoguSo cursor: a tailless 3D voxel arrowhead (drawn once to a canvas at boot — isometric cubes, three shaded
// faces a piece, golden-fire palette) that STEERS: it leans into its motion like a little hovering craft, its soft
// shadow lags opposite the motion and tightens when it lands, and holding a button grays it out (bright at rest →
// dark grey pressed). The system cursor is banned absolutely while this one is on (`* { cursor: none !important }` —
// hover states, scrollable panes, text, everything; the scrollbars are hidden too, the wheel still scrolls) so no
// corner of the game can summon the OS arrow. Display → Custom cursor turns the whole thing off for a plain system
// arrow. Hidden while the battle holds the pointer lock (the browser hides the OS cursor there as well).
// The element pivots around its TIP (transform-origin at the crown cube): the steering swings the body about the
// point that actually clicks, so precision never drifts with the animation.
import { values, set, on } from '../core/settings.js';

// ---- palette (golden fire)
const PAL = { top: '#ffd966', topHot: '#fff3c4', left: '#e8960c', right: '#b45309', edge: '#2a1503' };
// tailless arrowhead on an 8x7 grid (1 = cube, H = hot ember cube on the crown): points up at rotation 0
const SHAPE = [
  '...H....',
  '..111...',
  '.11111..',
  '1111111.',
  '.11111..',
  '..111...',
  '...1....',
];
const CELL = 4;                                   // device px per cube edge in the sprite (canvas is ×3 for crisp rims)

function cube(g, x0, y0, s, hot) {
  const t = hot ? PAL.topHot : PAL.top, h = s / 2;
  g.fillStyle = t;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + s, y0 + h); g.lineTo(x0, y0 + s); g.lineTo(x0 - s, y0 + h); g.closePath(); g.fill();
  g.fillStyle = PAL.left;
  g.beginPath(); g.moveTo(x0 - s, y0 + h); g.lineTo(x0, y0 + s); g.lineTo(x0, y0 + s + s); g.lineTo(x0 - s, y0 + h + s); g.closePath(); g.fill();
  g.fillStyle = PAL.right;
  g.beginPath(); g.moveTo(x0 + s, y0 + h); g.lineTo(x0, y0 + s); g.lineTo(x0, y0 + s + s); g.lineTo(x0 + s, y0 + h + s); g.closePath(); g.fill();
  g.strokeStyle = PAL.edge; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + s, y0 + h); g.lineTo(x0 + s, y0 + h + s); g.lineTo(x0, y0 + s + s); g.lineTo(x0 - s, y0 + h + s); g.lineTo(x0 - s, y0 + h); g.closePath();
  g.moveTo(x0 - s, y0 + h); g.lineTo(x0, y0 + s); g.lineTo(x0 + s, y0 + h); g.stroke();
}

function drawSprite() {
  const cols = SHAPE[0].length, rows = SHAPE.length;
  const s = CELL, W = (cols + 1) * s, H = (rows + 1) * s * 2;
  const cv = document.createElement('canvas');
  cv.width = W * 3; cv.height = H * 3;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = SHAPE[r][c];
    if (ch === '.') continue;
    cube(g, (c + 0.5) * s + s, (r + 0.5) * s + s, s, ch === 'H');
  }
  return cv.toDataURL('image/png');
}

let root = null, arrow = null, shadow = null, raf = 0;
let px = -100, py = -100, ax = -100, ay = -100, vx = 0, vy = 0, down = false, lastT = 0, seen = false;

const REST = 34;                                   // rest tilt (deg): the head cants up-right like a drawn blade
const TIP = { x: 0.47, y: 0.1 };                   // the crown cube inside the sprite (the click point)
const style = document.createElement('style');
style.id = 'cursor3dcss';
style.textContent = `
  html.cursor3d, html.cursor3d * { cursor: none !important; }
  html.cursor3d ::-webkit-scrollbar { width: 0; height: 0; }
  html.cursor3d { scrollbar-width: none; }
  #cur3d, #cur3dsh { position: fixed; left: 0; top: 0; pointer-events: none; will-change: transform; }
  #cur3d { width: 30px; height: 38px; image-rendering: pixelated; z-index: 2147483000;
    filter: drop-shadow(0 0 6px rgba(255,190,60,.45)); transition: filter 90ms linear;
    transform-origin: ${TIP.x * 100}% ${TIP.y * 100}%; }
  #cur3d.hold { filter: grayscale(.92) brightness(.48) drop-shadow(0 0 2px rgba(80,80,80,.2)); }
  #cur3dsh { width: 22px; height: 9px; border-radius: 50%; background: rgba(10,6,2,.42); filter: blur(2.5px); z-index: 2147482999; }
  html:not(.cursor3d) #cur3droot { display: none !important; }
`;

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (!arrow || !seen) return;
  const dt = Math.min(50, now - lastT || 16); lastT = now;
  // ease the body toward the true pointer; the smoothed velocity steers it
  const k = 1 - Math.exp(-dt / 24);
  const nx = ax + (px - ax) * k, ny = ay + (py - ay) * k;
  vx = 0.8 * vx + 0.2 * ((nx - ax) / dt * 16); vy = 0.8 * vy + 0.2 * ((ny - ay) / dt * 16);
  ax = nx; ay = ny;
  const speed = Math.hypot(vx, vy);
  // steer: at rest the head holds REST; in motion it points where it flies (sprite points up at 0)
  const want = speed > 0.35 ? Math.atan2(vx, -vy) * 180 / Math.PI : REST;
  const cur = parseFloat(arrow.dataset.r || REST);
  const next = cur + ((want - cur + 540) % 360 - 180) * (speed > 0.35 ? 0.3 : 0.1);
  arrow.dataset.r = next;
  const bank = Math.max(-38, Math.min(38, vx * 3.2));   // roll into horizontal moves (rotateY = the 3D read)
  const sc = down ? 0.88 : 1 + Math.min(0.08, speed * 0.006);
  arrow.style.transform =
    `translate(${ax - TIP.x * 30}px, ${ay - TIP.y * 38}px) rotate(${next}deg) perspective(90px) rotateY(${bank}deg) scale(${sc})`;
  arrow.classList.toggle('hold', down);
  const lift = Math.min(9, speed * 1.1);            // the shadow: thrown opposite the motion, tighter when it lands
  shadow.style.transform = `translate(${ax - 11 - vx * 0.3}px, ${ay + 20 - lift - vy * 0.22}px) scale(${1 - lift / 24})`;
  shadow.style.opacity = String(Math.max(0.15, 0.42 - lift / 30));
}

export function applyCursorMode() {
  const want = values().display.customCursor !== false;
  document.documentElement.classList.toggle('cursor3d', want);
  if (want && !root) build();
}

function build() {
  root = document.createElement('div');
  root.id = 'cur3droot';
  shadow = document.createElement('div'); shadow.id = 'cur3dsh';
  arrow = document.createElement('img'); arrow.id = 'cur3d'; arrow.src = drawSprite(); arrow.alt = ''; arrow.draggable = false;
  root.append(shadow, arrow);
  document.body.append(root);
  lastT = performance.now();
  raf = requestAnimationFrame(tick);

  addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (!seen) { ax = px; ay = py; seen = true; }
  }, { passive: true });
  addEventListener('pointerdown', () => { down = true; }, { passive: true });
  addEventListener('pointerup', () => { down = false; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { root.style.display = 'none'; });
  document.documentElement.addEventListener('mouseenter', () => { if (!document.pointerLockElement) root.style.display = ''; });
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    root.style.display = locked ? 'none' : '';
  });
}

applyCursorMode();
on('display.customCursor', applyCursorMode);
on('*', (path) => { if (path === 'display.customCursor') applyCursorMode(); });
if (values().display.customCursor === undefined) set('display.customCursor', true);   // first boot: on, persisted
