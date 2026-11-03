# ADR-0008: Level editor as a runtime scene

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** tech-lead

## Context
Levels are JSON under `assets/resources/levels`, validated by `LevelSchema` and checked by the solver. They are written by hand today. The user wants a scene in which a level is built visually: paint the board shape, place letters, pin words, set freeze counters, link blocks, see validation and difficulty live, test-play the draft, and export the JSON. The tool must not weaken the engine-free model rule (ADR-0001) nor the scene-authoring rules (ADR-0006/0007), and it must stay out of release builds.

## Decision
The editor is a second scene, `assets/scenes/Editor.fire`, that runs like the game (browser preview, device) rather than a Creator extension panel. It is split along the existing layers:

- `model/LevelDocument.js` (engine-free) holds the draft and every edit operation: toggle cell, resize, letters, pins, freeze counters, link/unlink blocks, words and topic, undo. It serialises to the exact level JSON and validates through `LevelSchema.validateLevel`; the operations keep the draft free of overlaps and off-board pieces by construction, so the validator only reports authoring gaps (missing pins, letter balance). Node-tested like the rest of the model.
- `systems/LevelDraft.js` (engine-free) is the hand-off between scenes: the editor stores the draft there before `cc.director.loadScene('Main')`; `Game` starts from the draft when one is present and routes "continue" and the settings button back to the editor. Module state survives a scene change because Creator loads scripts once per run (Unity analogy: a static field, or `DontDestroyOnLoad` without a GameObject).
- `ui/LevelEditor.js` is one component on the editor scene's Canvas. It builds its controls from code (a developer tool does not need scene-authored chrome; ADR-0007 applies to the player-facing screen) and renders the board with the existing `BoardView`, `BoardTiles` and `PieceNode`, bound to a session-shaped read model built from the document, so the editor shows exactly what the game draws. Input is editor-specific: a tap applies the active tool to the cell; the game's `DragController` is not attached.
- Difficulty comes from `Solver.analyze` with a small state budget, run on a short delay after each edit so painting stays responsive.
- Saving goes through a development-only HTTP server, `tools/level-server.js` (`npm run editor:server`, localhost:7457): the editor POSTs the JSON, the server validates it with `LevelSchema` and writes `assets/resources/levels/level_NNN.json`. The running game never writes files itself. Copy-to-clipboard and a browser download remain as fallbacks, and the draft autosaves to `localStorage` so a reload keeps it.
- Levels are discovered by folder (`GameAssets.loadLevels`: `cc.resources.loadDir('levels')`, sorted by id) in both `Game` and the editor, so a saved level needs no code change to be playable.
- In Creator the component runs in edit mode and draws the layout as outlined boxes from the same item list the runtime builds from (unsaved nodes, like the slot outlines of ADR-0006), so the Scene view is not blank.
- The scene file is generated once by `tools/gen-editor-scene.js` (Canvas + Camera + the `LevelEditor` component), mirroring the popup-prefab generator; afterwards it is edited in Creator like any scene. It is left unticked in Build → Scenes so it never ships; `Game` must keep working without it.

## Consequences
- Levels remain data; no scene or prefab becomes a level. Anything the editor can produce, the validator and solver have already accepted.
- The model gains an edit layer that the tests can drive; the engine-free rule is unchanged.
- `Game` learns one branch (draft present) and two return paths. A release build never has a draft, so player flow is unaffected.
- Saving needs the level server running beside Creator; without it, Download and a manual drop into the folder still work.
- Linked blocks and freeze are tools in the first cut, but a long-press menu may replace them if the six-wide tool bar proves cramped.

## Alternatives considered
- Creator extension panel (`packages/`): runs in the editor's Electron side with its own API and no access to the game's modules or views; every rule would be duplicated.
- Authoring levels as prefabs or scene nodes: Unity's instinct, but it moves level data out of JSON, past the validator and solver.
- An external web tool: would re-implement the board rendering; the scene reuses it for free.
