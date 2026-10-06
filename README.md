# RoguSo

A rogue-like, musou-style battlefield brawler. One thousand soldiers on screen, your officer in the
middle of it, and a campaign that gets meaner the deeper you go. Built as a browser game and packaged
for Windows in one small `.exe` — double-click it and play, like the old bundled flash games.

This repo is a standalone work on top of [mike007jd/voxel-musou](https://github.com/mike007jd/voxel-musou)
(the voxel Three Kingdoms musou by mike007). The game below is rebuilt from that study: English-only,
restructured, rebadged, and carried by a native Windows shell instead of a hosted website.

## What is inside

- `index.html`, `src/`, `vendor/` — the game itself (three.js voxel renderer, no build step, runs in any
  WebGL2 browser)
- `shell/` — the Windows host: a small C++ Win32 exe that opens one internal WebView2 (Edge) tab, no
  bundled browser, no Electron. The whole web build is embedded in the exe and extracted on first run.
- `tools/` — the icon renderer/capturer, the embedder that packs the web build into the shell, and the
  port scripts
- `.github/workflows/native.yml` — builds the exe and the plain web zip on demand (artifacts only)

## Run it

**Windows:** grab the `RoguSo-windows-x64` artifact, put `RoguSo.exe` anywhere, double-click. The first
run unpacks the game into your Documents folder; every run after that starts straight into the title
screen.

**Any browser:** serve the folder and open it.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Where your data lives

`Documents/RoguSo/` is the data folder — not the browser's:

- `save.json` — every battle record and what it unlocks
- `settings.json` — the difficulty pick (more lands here later)
- `controls.json` — the key bindings; edit the codes and restart, delete the file for defaults
- `runtime/` — the shell's internal WebView2 storage (leave it alone)
- `app/` — the extracted game (refreshed by the exe when the version changes)

**Reset Progress** sits on the title menu and wipes the three JSON files.

## Controls

| | |
|---|---|
| Move | `W` `A` `S` `D` / arrows |
| Attack | `J` / left click |
| Charge | `K` / right click |
| Jump | `Space` |
| Dodge | `L` / `Shift` |
| Musou | `I` when the gold gauge is full |
| Camera | mouse (click the field to lock) / `Q` `E` |
| Recenter | `R` |
| Pause | `Esc` |

A gamepad works too (standard mapping).

## Build it yourself

The workflow builds everything (Actions → native → Run workflow). Locally on Windows with MSVC:

```bat
python tools\embed.py
cd shell
rc /fo roguaso.res roguaso.rc
cl /nologo /std:c++20 /O2 /MT /EHsc /DUNICODE /D_UNICODE roguaso.cpp ..\build\embed_data.cpp roguaso.res ^
  /I. /Iwv2\build\native\include /Fe:..\build\RoguSo.exe ^
  /link wv2\build\native\x64\WebView2LoaderStatic.lib user32.lib gdi32.lib shell32.lib shlwapi.lib ^
  advapi32.lib ole32.lib oleaut32.lib uuid.lib /SUBSYSTEM:WINDOWS
```

## License

MIT — see [LICENSE](LICENSE).
