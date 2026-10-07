# RoguSo

A roguelike musou battlefield brawler. Pick a field, fight endless waves, kill the boss when he comes
back bigger, bank coins, upgrade your officer, repeat. Runs in any WebGL2 browser and as one
small Windows `.exe` (double-click and play).

- **Battle** — four fields, each with its own exclusive enemy and a boss cycle that scales up every
  time. The Challenge card rolls a random field with 1–5 targets for a bigger purse.
- **Fighters** — seven officers; Zhao Yun is free, the rest cost coins (the priciest hits the
  hardest). Every officer carries his own upgrade table: power / speed / musou / luck / health /
  defense / allies / combos for coins, crits / guard / counters for banked XP, ally count / power /
  vigor for ally XP.
- **Train** — deadly officer duels and ally wars; XP and ally XP bank even when you lose. No HP
  regeneration anywhere, ever — the only thing on the ground is money.
- **Records** — per-officer lifetime kills, runs, best KOs and the coin purse, over the rank wall.

## Run it

**Windows:** grab the latest `RoguSo-windows` zip from
[Releases](https://github.com/HAKORADev/RoguSo/releases), put `RoguSo.exe` anywhere, double-click.
The zip carries the browser build too (`roguaso-web/` — open its `index.html` over any static
server).

**Any browser:**

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Data

`Documents/RoguSo/` in the shell, `localStorage` in a plain browser:

- `rogu.json` — coins, XP, ownership, upgrades
- `save.json` — battle records
- `settings.json` — the settings tabs
- `controls.json` — the key bindings

**Reset Progress** sits on the title menu.

## Controls

| | |
|---|---|
| Move | `W` `A` `S` `D` / arrows |
| Attack | `J` / left click — tap for the full combo |
| Charge | `K` / right click — mid-combo for charge attacks |
| Jump | `Space` |
| Dodge | `L` / `Shift` |
| Musou | `I` / middle click — when the gold gauge is full |
| Camera | mouse (click the field to lock) / `Q` `E` |
| Recenter | `R` |
| Ally orders | `O` (Train: allies) |
| Pause | `Esc` |
| Fullscreen | `F11` |

A gamepad works too (standard mapping). Every binding is editable in Settings → Controls, and every
menu answers both the mouse and the keyboard.

## Build it yourself

Actions → native → Run workflow (one zip per build, artifacts only). Locally on Windows with MSVC:

```bat
python tools\embed.py
cd shell
rc /fo roguaso.res roguaso.rc
cl /nologo /std:c++20 /O2 /MT /EHsc /DUNICODE /D_UNICODE roguaso.cpp ..\build\embed_data.cpp roguaso.res ^
  /I. /Iwv2\build\native\include /Fe:..\build\RoguSo.exe ^
  /link wv2\build\native\x64\WebView2LoaderStatic.lib user32.lib gdi32.lib shell32.lib shlwapi.lib ^
  advapi32.lib ole32.lib oleaut32.lib uuid.lib /SUBSYSTEM:WINDOWS
```

[Original project: mike007jd/voxel-musou](https://github.com/mike007jd/voxel-musou)

## License

MIT — see [LICENSE](LICENSE).
