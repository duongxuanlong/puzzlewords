# ADR-0006: Screen layout as referenced slot nodes in the scene

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** tech-lead

## Context
ADR-0003 builds the whole UI from code, so moving the found-words panel or giving the board more room meant editing numbers in `data/Layout.js` across several files and reloading. ADR-0005 made a few of those numbers editor properties on `GameConfig`, but a list of coordinates in a Properties panel is still not a layout tool: nothing shows where the panel will land. The user, coming from Unity, expects to drag anchored rectangles in the editor and have code fill them.

A first version kept the slots in a generated `Screen.prefab` under `resources/` and looked them up by node name. It was dropped the same day: the prefab and its scene instance drifted (overrides, Apply/Revert), name lookups broke silently on a rename, empty nodes were invisible in the Scene view, and a generator script had to match what the editor later edited.

## Decision
The screen geometry lives in `Main.fire` as empty slot nodes under a `Screen` node on the Canvas, referenced from `ui/ScreenLayout.js`: a component on `Screen` with four `cc.Node` properties, `board`, `panel`, `hud` and `popup`, assigned in the Properties panel. A slot is a size, a position and, where wanted, a `cc.Widget`. `ui/ScreenSlots.resolve(canvas)` returns the scene's `ScreenLayout` when every slot is assigned, else builds the same tree from `Layout` with `createDefault()` so the game runs with an empty scene. `Game` attaches one component per slot: `BoardView` fits its cells into `board` (capped by `GameConfig.boardMaxCell`), `FoundWordsPanel` fills `panel`, `Hud` fills `hud`, `Popup` fills `popup`. Draw order is the slot order under `Screen`.

`ScreenLayout` runs in edit mode and draws a labelled outline per slot with `cc.Graphics`, on nodes flagged `DontSave | HideInHierarchy`, so the layout is visible in the Scene view without selecting anything and nothing of it reaches the scene file or the build. `showOutlines` turns it off.

`GameConfig` (ADR-0005) keeps only values that are not geometry: the cell cap and the opacity of the empty-cell squares. The empty-cell squares seen in the demo are drawn by `BoardTiles` as a faint `Block_back` sprite per cell, fitted like a piece's block, under the pieces.

## Consequences
- Moving or resizing any screen area is an editor edit of a slot node; no code change, no constant. References survive renames, and an unassigned slot shows as None in the inspector and as a console warning at runtime.
- The scene now carries layout structure, which the editor owns (rule 4). The code fallback keeps headless builds and tests independent of it, so the "scene is optional" rule of ADR-0003 still holds.
- The `board` slot keeps its size; the board draws centred in it and the whole slot is the touch area. `localToCell` already rejects off-board points.
- Slots without a Widget keep their offset from the canvas centre on taller phones, as before. Adding a Widget to a slot in the editor needs no code.
- `Layout` keeps the geometry constants as defaults for the fallback; they are no longer read at runtime when the scene has a complete `ScreenLayout`.

## Alternatives considered
- A slot prefab under `resources/` found by node name: tried first, see Context.
- More numeric properties on `GameConfig`: numbers do not show a layout.
- One prefab per component with its visuals inside: tempting, but the components build their children from the textures loaded at runtime; slots give the editor the geometry and leave the look to code until a later ADR moves it.
