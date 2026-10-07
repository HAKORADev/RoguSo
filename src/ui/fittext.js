// Smart text fit: every labelled element shrinks to stay inside its box instead of walking out of it. fit() measures
// the element's real overflow against its constrained width and re-scales the font in a convergence loop (width is
// not linear in font-size once ellipsis/wrapping kick in), starting from the authored size — there is NO floor: text
// gets programmatically smaller until it fits, period. fitAll() sweeps the known selectors after any content swap, on
// resize and once the webfonts land.
const SELECTORS = [
  '.s-card b', '.s-card small', '.s-name h1', '.s-epi b', '.s-wpn b', '.s-musou b', '.s-rec b', '.s-fac i',
  '.t-chs b', '.t-chs small', '.t-dif b', '.t-dcard b', '.t-dcard small', '.t-ccard b', '.t-ccard small',
  '.l-name h1', '.l-en', '.l-ch b', '.l-tip b', '.s-court', '.s-line p', '.s-en', '.rs-unlock',
  '.rg-loc b', '.rg-loc small', '.rg-loc em', '.rg-char b', '.rg-char small', '.rg-char em',
  '.rg-urow b', '.rg-urow small', '.rg-urow em', '.rg-uhead b', '.rg-uhead small', '.rg-go b', '.rg-go small',
  '.rg-chal h4', '.rg-chal p', '.rg-chalgo b', '.rg-chalgo small', '.rg-note', '.rg-wallet span',
  '.rg-ulab b', '.rg-ulab small', '.rg-ulab em',
];

function fit(el) {
  if (!el.isConnected) return;
  if (el.dataset.fsz === undefined) el.dataset.fsz = getComputedStyle(el).fontSize;
  const base = parseFloat(el.dataset.fsz);
  const maxW = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
  if (!maxW) return;
  el.style.fontSize = base + 'px';
  // the box the text must stay inside: its own constrained width, else the parent's
  const box = el.clientWidth > 0 ? el.clientWidth : maxW;
  if (el.scrollWidth <= box + 0.5) return;
  // convergence loop: shrink proportionally to the measured overflow, re-measure, repeat (ellipsis and kerning make
  // width non-linear; 8 iterations always settle at 720p-8K sizes)
  let size = base;
  for (let i = 0; i < 8; i++) {
    const over = el.scrollWidth / Math.max(1, box);
    size = Math.max(1, Math.floor((size / over) * 20) / 20);
    el.style.fontSize = size + 'px';
    if (el.scrollWidth <= box + 0.5) break;
  }
}

export function fitText(root = document) {
  for (const sel of SELECTORS) for (const el of root.querySelectorAll(sel)) fit(el);
}
let t = 0;
export function fitSoon() { clearTimeout(t); t = setTimeout(() => fitText(), 60); }
addEventListener('resize', fitSoon);
document.fonts?.ready.then(() => fitText()).catch(() => {});
