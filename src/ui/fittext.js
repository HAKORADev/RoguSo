// Smart text fit: every labelled element shrinks to stay inside its box instead of walking out of it (the select
// roster, the info panel, the chapter / difficulty cards, the loading card). fit() measures scrollWidth against the
// element's constrained width and scales the font down from its authored size; fitAll() sweeps the known selectors
// after any content swap, on resize and once the webfonts land. Elements keep their ellipsis (index.html) for the
// pathological cases the floor cannot save.
const SELECTORS = [
  '.s-card b', '.s-card small', '.s-name h1', '.s-epi b', '.s-wpn b', '.s-musou b', '.s-rec b', '.s-fac i',
  '.t-chs b', '.t-chs small', '.t-dif b', '.t-dcard b', '.t-dcard small', '.t-ccard b', '.t-ccard small',
  '.l-name h1', '.l-en', '.l-ch b', '.l-tip b', '.s-court',
];
const MIN = 9;                                   // px floor: below this the ellipsis takes over

function fit(el) {
  if (!el.isConnected) return;
  if (el.dataset.fsz === undefined) el.dataset.fsz = getComputedStyle(el).fontSize;
  const base = parseFloat(el.dataset.fsz);
  el.style.fontSize = base + 'px';
  const maxW = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
  if (!maxW) return;
  const over = el.scrollWidth - Math.max(0, el.clientWidth || 0) || el.scrollWidth - maxW;
  const target = el.scrollWidth > el.clientWidth + 0.5 && el.clientWidth > 0 ? el.clientWidth
    : el.scrollWidth > maxW + 0.5 ? maxW : 0;
  if (!target) return;
  const next = Math.max(MIN, Math.floor(base * (target / el.scrollWidth) * 10) / 10);
  el.style.fontSize = next + 'px';
}

export function fitText(root = document) {
  for (const sel of SELECTORS) for (const el of root.querySelectorAll(sel)) fit(el);
}
let t = 0;
export function fitSoon() { clearTimeout(t); t = setTimeout(() => fitText(), 60); }
addEventListener('resize', fitSoon);
document.fonts?.ready.then(() => fitText()).catch(() => {});
