---
name: architecture
description: Module boundaries, layers, events and file placement for the puzzlewords codebase. Load before designing or implementing any feature, or when deciding where code belongs.
---

# Architecture

Three layers, one direction of dependency: **ui/view → systems → model**. Nothing below `view` knows about `cc`.

```
assets/scripts/
  data/      Palette.js, Constants.js, Timing.js     constants only, engine-free
  model/     Board.js, Piece.js, WordMatcher.js,      pure rules, engine-free, Node-tested
             FreezeSystem.js, Level.js, LevelSchema.js
  systems/   EventBus.js, GameSession.js,             orchestration + services, engine-free
             SaveStore.js (behind StorageAdapter)
  view/      BoardView.js, PieceNode.js,              cc components: render model, forward input
             DragController.js, BoardTiles.js
  ui/        Game.js (root), Hud.js, FoundWordsPanel.js, cc components: HUD, popups, flow
             LevelCompletePopup.js, ScreenFlow.js
```

## Model (engine-free)
- `Board` — immutable cell set from `shape` + mutable occupancy `Map<"r,c", pieceId>`. API: `has(r,c)`, `isFree(r,c)`, `pieceAt(r,c)`, `place(piece, r, c)`, `remove(pieceId)`, `canPlace(piece, r, c, ignoringSelf)`.
- `Piece` — `{ id, letters, offsets, at:[r,c], pin: wordIndex|null, frozen: n|0 }`, `cells()` returns absolute cells, `isPinned`, `isFrozen`.
- `WordMatcher` — `find(board, level, pieces)` → one result per word `{ wordIndex, cells, pieceIds, complete }`: depth-first search from the pin over 4-adjacent occupied, non-frozen cells spelling the word in order (any direction per step, no reuse, other pins excluded). `complete` results are matches; incomplete ones are the longest prefix, used for highlighting.
- `FreezeSystem` — `onWordCleared(pieces)` decrements every frozen counter by 1; returns thawed pieces.
- `Level` — parsed level: words, shape, pieces (validated by `LevelSchema`).
- `GameSession` (systems) — the state machine for one level: `IDLE → DRAGGING → RESOLVING → COMPLETE`. Owns Board, pieces, matcher, freeze; exposes `beginDrag(pieceId)`, `dragStep(pieceId, r, c)` (one 4-adjacent cell, committed immediately so pieces never overlap or pass through each other), `endDrag(pieceId)` (runs resolve) and `findPath(pieceId, r, c)` (BFS over free footprints), and emits events.

## Events (systems/EventBus.js)
Plain emitter. Names are constants in `data/Constants.js`:
`drag:started`, `drag:ended`, `piece:moved`, `piece:rejected`, `word:progress {prefixes}`, `word:cleared {wordIndex, cells, pieceIds}`, `freeze:tick {pieceId, remaining}`, `freeze:thawed {pieceId}`, `level:complete {levelId, coins}`, `level:loaded`.
View and UI subscribe; the model never subscribes to the view.

## View
- `BoardView` owns the grid geometry: `cellToLocal(r,c)`, `localToCell(pos)` (rounds to nearest cell, returns null off-board), builds `BoardTiles` from the shape, creates a `PieceNode` per piece.
- `PieceNode` renders one piece: block sprite chosen by `offsets` signature (1 cell, 2H, 2V, four L shapes), letter labels, pin badge with word length, ice overlay + counter when frozen, tint from `Palette`.
- `DragController` is on `BoardView`: on TOUCH_START calls `session.beginDrag` and lifts the node; on TOUCH_MOVE converts the finger to a target cell, asks `session.findPath` for a route through free cells and feeds it to `session.dragStep` one cell at a time, tweening each step (the piece stays on cell centres and never floats under the finger); on END/CANCEL waits for the queue to drain, then `session.endDrag`. A blocked step plays a bump and the piece stays.
- No rules in view code: it never checks letters or words.

## UI
- `Game` (on Canvas) is the composition root: loads level JSON, creates `GameSession`, builds `BoardView`, `Hud`, popups, subscribes to events, handles restart/continue.
- `Hud`, `FoundWordsPanel`, `LevelCompletePopup` are dumb: methods like `setTopic`, `addWord(word, colorIndex)`, `show(coins)`.
- `ScreenFlow` orders transitions (level complete → popup → next level).

## Placement rules of thumb
- Needs `cc`? → `view/` or `ui/`. Else → `model/` (rules), `systems/` (orchestration, persistence), `data/` (constants).
- A new mechanic = model class + unit tests + an event + a view hook. Start with the test.
- One component per file, filename == class/module name, unique across the project.
- Dependencies via `require` by bare name at file top; no circular requires between layers.

## Adding a mechanic (checklist)
1. Spec in `docs/specs/` (producer/tech-lead). 2. `LevelSchema` fields + validator test. 3. Model class + tests.
4. `GameSession` wiring + event. 5. `PieceNode`/`BoardView` rendering. 6. Level that uses it (level-designer). 7. QA checklist entry. 8. ADR if a boundary changed.
