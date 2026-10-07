# Changelog

## v0.7.0 - the roguelike

The redesign. No story, no trials on the menu — the game is a loop now: **Battle, Fighters, Train**,
with **Records** (per-character status) and **Arena** (the wallets + the Bio-Lab) beside them.

- **The test-report batch first**: `text is not a function` (hud.js say() shadowed its own helper —
  every dialogue threw), `fmt is not a function` (result tallies destructured wrong — every result
  froze at 0), `c.bio.map is not a function` (Lü Bu's bio was a broken object). The result screen never
  coming up for some wins: `story:end` called `inkWipe` directly and `inkWipe` drops calls made while
  another wipe is in flight — every transition now chains through `afterWipe`, pause-quit included.
- **HP lag law**: the white damage chunk starts at the hp the hit found — 40 → 30 animates 40 → 30, not
  100 → 30. Player bar, officer tags and the boss bar all hold prevHp now.
- **The officer target bar** showed `undefined` (it destructured `{zh,en}` from a plain string name).
  The HUD intro card and the loading tips print the user's LIVE bindings — no hardcoded keys anywhere.
- **Settings** always opens on Sound now (it used to reopen on Controls with stale dialogs); dead panes
  stop repainting removed widgets; new Graphics toggles: **Visual effects** master switch, **Cinematic
  lens** (the blue-red fringe + grain + vignette), **God rays**, **Atmospheric fog**.
- **The cursor** is a runtime-drawn 3D voxel arrowhead that steers into its motion, carries a lagging
  shadow, grays out while held, pivots on its tip, and bans the system cursor absolutely (hover states,
  scrollbars — everything). Display → Custom cursor turns it off.
- **MMB = Musou** (LMB light, RMB heavy, MMB was empty). Existing controls.json files migrate safely.
- **Camera**: full vertical axis (pitch −58°..+62°), stronger mouse pitch.
- **Text**: fitText has no floor anymore — text shrinks programmatically until it truly fits its box.
  The vertical calligraphy reads horizontally now (prologue columns, the select quote, the title name
  tags, the musou copy); the 2-glyph red seals stay seals. LOCK reads "Locked".
- **Crash law**: the sim and the render are fault-guarded — a throwing module skips its frame, logs and
  toasts on screen instead of silently freezing the field while the menus stay alive.
- **The harness** (`tools/harness.mjs`): the game drives itself headless (real browser, real input
  events) and collects every page error — the sandbox tests the build so the owner does not have to.

The roguelike itself, field by field:

- **Battle**: Hulao (the dead rise, fire bosses), Changban (the host drops from the sky, wind bosses),
  Red Cliffs (ninja fog, water bosses), Dingjun (stone bosses). Reinforcements thicken every cycle; the
  boss comes back bigger each time (up to 2.6× body) with a telegraphed elemental spell. **Challenge**:
  a random field, 1–5 non-conflicting targets (slay / loot / musou / endure / fell a giant), a fatter purse.
- **Fighters**: prices per officer (Zhao Yun free), the upgrade table (power / speed / muso / luck /
  health / defense / allies / combos for coins; crit / guard / counter for XP; ally count / power /
  vigor for ally XP). Upgrades bite for real: HP pool, damage, damage taken, run speed, musou gain.
- **Train**: officer (a deadly elimination vs three rivals, XP banks even in defeat) and allies (wave
  war beside your men, `O` sends them forward / calls them back, their kills bank ally XP).
- **Economy** (`rogu.json`): coins are rare (one drop per ~20 kills, luck raises the odds), a boss
  bursts with a purse, nothing is lost on death — the result screen shows the take and banks it.
  Dynamic difficulty: the field scales with your total upgrade level.
- **The Bio-Lab**: clothes off part by part, free, always (parts under cloth have no effect); body mods
  for bodycoins — penis XOR eunuchs, breasts, butt, vagina, each with its own upgrades. The ZXCVB battle
  row: milk (their wind-ups drag), the fart ring / a held mine, the life-stealing strike, the burning
  splash, the freeze squirt. Voxel-styled, +16, no scenes.

## v0.6.0 - the settings, the cursor, the night

The owner's test-report round: the infinite load killed for good, the data folder rebuilt the right way
(the app lives in the exe, in RAM), and the full four-tab settings system — plus the golden-fire cursor,
F11 fullscreen and a 24-minute day/night cycle.

- **Infinite load, dead**: the loading flow can no longer hang — every await in the deploy path races a
  wall-clock fallback, shader compilation fails open after 20 s, the ink-wipe wait is capped, and any
  thrown step reports on screen (the shell has no devtools) and carries on to the battle.
- **The shell, rebuilt** (`shell/roguaso.cpp`): the web build is now served straight from RAM inside the
  exe (WebView2 `WebResourceRequested` -> memory streams). Nothing is unpacked to disk anymore, so
  `Documents/RoguSo/` holds only what the game needs: `save.json`, `settings.json`, `controls.json`.
  The WebView2 runtime profile moved to `%LOCALAPPDATA%/RoguSo/runtime`. The bridge protocol between the
  game and the shell was also fixed — v0.5.0's reads and writes never actually reached the files.
- **Anti-throttle**: the shell disables Chromium's occluded-window / background-timer throttling, so
  renders and timers keep running even when another window covers the game.
- **Settings** (the title menu's Controls button is now Settings; four tabs):
  - **Sound**: SFX volume, Music volume, and Spatial / Mono output (spatial = stereo with a built-in
    virtual surround; mono sums everything to one channel).
  - **Display**: refresh rate (Auto or up to the detected Hz, simulated), FPS cap (Off / 30-120),
    internal resolution (Native by default, up to 8K, aspect ratio shown next to each; the window keeps
    its own size), V-Sync (Off pumps an uncapped MessageChannel loop), and the frame pacer — it eases the
    target toward the most stable frame time, stepping down on jitter and back up when settled. The sim
    always advances at its fixed 60 Hz regardless of all this.
  - **Graphics**: Shadow detail (Off-Ultra), Reflections, LOD distance, MSAA (Off-16x), Supersampling,
    Ambient occlusion, Bloom, Global illumination (sky-bounce levels), Camera and Object motion blur
    (each Off/Low/Medium/High), and the FSR set: upscaler (Ultra Performance 2.0x - Ultra Quality 1.2x,
    an RCAS-style sharpen reconstructs the low-res render), frame generation (x2-x4, experimental —
    synth presents crossfade the last two real frames) and FSR Native AA (jittered temporal accumulation,
    the DLAA-grade mode).
  - **Controls**: the mapping list with primary + secondary slots per action, a Modify arm, live capture
    (keyboard, mouse buttons, gamepad buttons — Xbox or PlayStation labels depending on the pad), the
    duplicates dialog (Overwrite / Change / Cancel), mouse and analog sensitivity sliders, and Restore
    defaults. Bindings live in `controls.json`. No touch input exists anywhere in the game.
- **The cursor**: a voxel golden-fire arrow (generated by `tools/cursor_gen.mjs`), grey while a button is
  held, hidden by the browser while the pointer is locked in battle.
- **F11** toggles fullscreen / windowed — borderless natively in the shell, the Fullscreen API in a
  plain browser.
- **The bug fixes**: button hitboxes are now exactly the drawn button (the decorative swash no longer
  captures clicks half a screen away), every character name / epithet / chapter title auto-shrinks to fit
  its box instead of walking out of it, and Deploy is now **GO**.
- **Day/night cycle**: 24 minutes total — 12 of day, 12 of night. The shared sun vector sweeps the sky by
  day and the moon's arc by night: moonlit palette, craters on the moon disc, a 1500-star field, cool fog,
  dimmed sun, blazing firelights, moon god-rays. Every battle opens just after dawn.

## v0.5.0 - the ground

The first working RoguSo. The whole game rebuilt as an English-only standalone, carried by its own
Windows shell, with the data folder where it belongs.

- **The port**: every screen, line and comment turned English-only — the title, the menus, the HUD,
  the prologue cards, the story dialogue, the officer files, the banners and seals. No dual language
  left anywhere.
- **RoguSo identity**: RS seal + the ROGUSO wordmark on the title, and the voxel blue sword as the
  icon — coded in three.js, captured headless, sized into the exe icon and the favicon.
- **The Windows shell** (`shell/roguaso.cpp`): a small C++ exe that opens one internal WebView2 (Edge)
  tab — no bundled browser, no Electron, no console. The whole web build is embedded inside the exe.
- **The data folder**: `Documents/RoguSo/` holds `save.json` (records), `settings.json` (difficulty)
  and `controls.json` (key bindings), bridged between the game and disk by the shell; in a plain
  browser the same files mirror to localStorage instead.
- **Reset Progress** on the title menu: asks once, then wipes the three files and reloads clean.
- **Upstream fix**: the audio engine pinned to 48 kHz — the noise bank crashed the boot on machines
  whose output device runs at 44.1 kHz.
- **Story chapters and trials intact**: Hulao Gate, Changban, Red Cliffs, Mount Dingjun, the trials,
  seven officers, four difficulty tiers, the records wall and the unlock chain all carry over.
- Tooling: `tools/embed.py` packs the web build into the shell, `tools/icon.py` cuts the icon, and the
  `native` workflow builds the exe and the plain web zip as artifacts (no releases yet — the game is
  not done).
