// Persistent data for RoguSo: three JSON files next to the game — save.json (records), settings.json (the difficulty
// pick and later options), controls.json (the key bindings, written once as a template). In the Windows shell the C++
// host bridges these to Documents/RoguSo (window.chrome.webview message channel); in a plain browser they mirror to
// localStorage under the roguaso. prefix. The game reads a synchronous in-memory mirror; writes go through to both.
const BRIDGE = typeof window !== 'undefined' && window.chrome?.webview;
const PFX = 'roguaso.';
export const FILES = ['save.json', 'settings.json', 'controls.json'];

const mem = {};   // name -> parsed object | null (absent = not loaded)

/** Load everything before the game boots: localStorage first, then the shell's documents folder (when bridged).
 *  Resolves fast in a plain browser; the shell answers readAll on its own channel. */
export function init() {
  for (const name of FILES) {
    try { const s = localStorage.getItem(PFX + name); if (s != null) mem[name] = JSON.parse(s); } catch { /* bad json: fresh */ }
  }
  if (!BRIDGE) return Promise.resolve();
  return new Promise((res) => {
    let done = false;
    const finish = () => { if (!done) { done = true; res(); } };
    const h = (e) => {
      const d = e.data;
      if (d?.op === 'readAll') {
        BRIDGE.removeEventListener('message', h);
        for (const [n, s] of Object.entries(d.files || {})) {
          if (s == null) continue;
          try { mem[n] = JSON.parse(s); } catch { /* bad json: fresh */ }
        }
        finish();
      }
    };
    BRIDGE.addEventListener('message', h);
    BRIDGE.postMessage(JSON.stringify({ op: 'readAll' }));
    setTimeout(finish, 500);
  });
}

/** A stored object (parsed), or null. */
export const read = (name) => (name in mem ? mem[name] : null);

/** Store an object under its file name (memory + localStorage mirror + the shell's file). */
export function write(name, obj) {
  mem[name] = obj;
  const s = JSON.stringify(obj);
  try { localStorage.setItem(PFX + name, s); } catch { /* storage full/blocked: the session still plays */ }
  if (BRIDGE) BRIDGE.postMessage(JSON.stringify({ op: 'write', name, data: s }));
}

/** Drop a stored file entirely. */
export function remove(name) {
  delete mem[name];
  try { localStorage.removeItem(PFX + name); } catch { /* as above */ }
  if (BRIDGE) BRIDGE.postMessage(JSON.stringify({ op: 'remove', name }));
}

/** Wipe everything the game keeps (the Reset Progress button), then reload for a clean boot. */
export function wipeAll() {
  for (const name of FILES) remove(name);
  try { localStorage.removeItem('roguaso.diff'); } catch { /* gone already */ }
  setTimeout(() => location.reload(), 60);
}
