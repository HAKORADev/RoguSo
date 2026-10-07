# RoguSo

A roguelike musou battlefield brawler. Pick a field, fight endless waves, kill the boss when he comes
back bigger, bank coins and XP, upgrade your officer, repeat. Runs in any WebGL2 browser and as one
small Windows `.exe` (double-click and play).

- **Battle** — four fields, each with its own exclusive enemy and a boss cycle that scales up every time.
  The Challenge card rolls a random field with 1–5 targets for a bigger purse.
- **Fighters** — seven officers; buy them with coins, upgrade power / speed / musou / luck / health /
  defense / allies / combos, train crits, guard and counters with XP.
- **Train** — deadly officer duels and ally wars; XP banks even when you lose.
- **Arena** — the wallets and the Bio-Lab (body mods with the ZXCVB battle row).

## Run it

**Windows:** grab the `RoguSo-windows-x64` artifact, put `RoguSo.exe` anywhere, double-click.

**Any browser:**

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Data

`Documents/RoguSo/` in the shell, `localStorage` in a plain browser:

- `rogu.json` — coins, XP, ownership, upgrades, the Bio-Lab
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
| Bio-Lab row | `Z` `X` `C` `V` `B` (hold `X` for a mine) |
| Pause | `Esc` |
| Fullscreen | `F11` |

A gamepad works too (standard mapping). Every binding is editable in Settings → Controls.

## Build it yourself

Actions → native → Run workflow (builds the exe + the web zip, artifacts only). Locally on Windows
with MSVC:

```bat
python tools\embed.py
cd shell
rc /fo roguaso.res roguaso.rc
cl /nologo /std:c++20 /O2 /MT /EHsc /DUNICODE /D_UNICODE roguaso.cpp ..\build\embed_data.cpp roguaso.res ^
  /I. /Iwv2\build\native\include /Fe:..\build\RoguSo.exe ^
  /link wv2\build\native\x64\WebView2LoaderStatic.lib user32.lib gdi32.lib shell32.lib shlwapi.lib ^
  advapi32.lib ole32.lib oleaut32.lib uuid.lib /SUBSYSTEM:WINDOWS
```

fork of [mike007jd/voxel-musou](https://github.com/mike007jd/voxel-musou)

## License

MIT — see [LICENSE](LICENSE).
