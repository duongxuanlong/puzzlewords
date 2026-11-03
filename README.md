# Puzzle Words

A grid-based word puzzle built with **Cocos Creator 2.4.15** and JavaScript. Portrait 1080x1920, touch-driven.

Source: https://github.com/duongxuanlong/puzzlewords

## Requirements
- Cocos Creator 2.4.15 (install via the Cocos Dashboard) to open, preview or build the project.
- Node.js 20+ to serve the prebuilt web build locally.
- A modern browser (Chrome, Safari or Firefox).

## Play without Cocos Creator
A ready-made web build is included in `build/web-mobile`. Serve it with Node and open it in a browser:

```bash
npm run serve:web
```

Then open http://localhost:8080. On a desktop browser the game shows as a centred phone column; on a phone it fills the screen.

## Open and play in Cocos Creator
1. Open the Cocos Dashboard → **Project** → **Open Other** → select this folder.
2. Wait for the first import to finish (it generates `library/` and any missing `.meta` files).
3. The scene `assets/scenes/Main.fire` is the game. With it open, press **Play** at the top of the editor. The browser preview opens at http://localhost:7456.

Only `Main.fire` is ticked in **Project → Build → Scenes**. `Editor.fire` is a development-only level editor and never ships.

## Build
From the editor: **Project → Build**, platform **Web Mobile**, then **Build**. Output goes to `build/web-mobile`.

Headless from the command line (uses the installed editor):

```bash
npm run build:web
```

Set `COCOS_CREATOR` to the editor binary if it is installed somewhere other than `/Applications/Cocos/Creator/2.4.15`. Android and iOS targets are available the same way with `npm run build:android` and `npm run build:ios`.

## How to play
- Drag a letter piece with your finger. It slides one cell at a time through free cells and never passes through other pieces. Multi-cell blocks move as one unit.
- Each word starts at a pinned letter that never moves and shows the word's length and colour. Build the word as a chain of neighbouring cells from the pin; the longest correct prefix is tinted in the word's colour after every drop (a linked block is tinted only when all of its letters are on that prefix).
- A complete word clears and flies to the found-words panel. Frozen pieces hide their letter under ice with a counter; every cleared word lowers all counters, and at zero the ice melts.
- Clear every word to finish the level and move to the next one.

## Levels
Levels are JSON files in `assets/resources/levels/` and are discovered by folder, so adding a file adds a level. Levels 1–2 cover basic gameplay, level 3 introduces frozen pieces (Challenge 1), and level 4 introduces multi-cell blocks (Challenge 2).

## Level editor
The project ships with a visual level editor that runs as a second scene inside Cocos Creator. It is a development tool and is excluded from builds.

1. Start the save server in a terminal (it writes level files for the editor, on port 7457):
   ```bash
   npm run editor:server
   ```
2. In Creator, open `assets/scenes/Editor.fire` and press **Play**.
3. In the browser preview: paint the board shape, place letters, pin the first letter of each word, set freeze counters, link cells into multi-cell blocks, and enter the topic and words. The board is drawn with the same components as the game, so it looks exactly as it will in play.
4. Validation and a difficulty estimate from the solver update live after every edit. Undo is available.
5. **Test play** loads the draft into the game scene; the settings button returns you to the editor.
6. **Save** writes `assets/resources/levels/level_NNN.json` through the server. The game lists levels by folder, so the new level is playable on the next start. If the server is not running, **Download** or **Copy JSON** gives you the JSON to drop into the folder by hand.

The draft autosaves in the browser, so a reload keeps your work in progress.

## Project layout
Game rules live in `assets/scripts/model/` and `assets/scripts/systems/` and are engine-free (no `cc` references), the way a Unity project keeps its logic out of MonoBehaviours. Cocos components live in `assets/scripts/view/` (board and pieces) and `assets/scripts/ui/` (HUD, popups, screen flow). See `CLAUDE.md` for the full layout and conventions.

## Design notes
Spec interpretations are recorded in `docs/adr/0002-spec-interpretations.md` and the gameplay spec in `docs/specs/word-puzzle-core.md`.
