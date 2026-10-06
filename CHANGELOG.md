# Changelog

## v0.5.0 - the ground

The first working RoguSo. The whole game rebuilt as an English-only standalone, carried by its own
Windows shell, with the data folder where it belongs.

- **The port**: every screen, line and comment turned English-only — the title, the menus, the HUD,
  the prologue cards, the story dialogue, the officer files, the banners and seals. No dual language
  left anywhere.
- **RoguSo identity**: RS seal + the ROGUSO wordmark on the title, and the voxel blue sword as the
  icon — coded in three.js, captured headless, sized into the exe icon and the favicon.
- **The Windows shell** (`shell/roguaso.cpp`): a small C++ exe that opens one internal WebView2 (Edge)
  tab — no bundled browser, no Electron, no console. The whole web build is embedded inside the exe
  and unpacked to `Documents/RoguSo/app` on first run; a new exe refreshes it by version.
- **The data folder**: `Documents/RoguSo/` holds `save.json` (records), `settings.json` (difficulty)
  and `controls.json` (key bindings — edit and restart, delete for defaults), bridged between the
  game and disk by the shell; in a plain browser the same files mirror to localStorage instead.
- **Reset Progress** on the title menu: asks once, then wipes the three files and reloads clean.
- **Upstream fix**: the audio engine pinned to 48 kHz — the noise bank crashed the boot on machines
  whose output device runs at 44.1 kHz.
- **Story chapters and trials intact**: Hulao Gate, Changban, Red Cliffs, Mount Dingjun, the trials,
  seven officers, four difficulty tiers, the records wall and the unlock chain all carry over.
- Tooling: `tools/embed.py` packs the web build into the shell, `tools/icon.py` cuts the icon, and the
  `native` workflow builds the exe and the plain web zip as artifacts (no releases yet — the game is
  not done).
