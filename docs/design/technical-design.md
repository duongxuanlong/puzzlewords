# Technical design — Puzzle Words core (Milestone 1)

- **Status:** Proposed (awaiting user review) · **Author:** tech-lead · **Date:** 2026-10-31
- Inputs: `docs/specs/word-puzzle-core.md`, ADR-0001..0003, Athena test PDF and demo videos.
- Scope: Basic gameplay + Challenge 1 (dynamic grids, Freeze) + Challenge 2 (linked blocks). Save/progression is minimal.

## 1. Goals and constraints
- Cocos Creator 2.4.15, JavaScript (CommonJS), portrait 1080x1920 fit-width.
- Rules are engine-free and unit-tested in Node (ADR-0001). Only `view/` and `ui/` import `cc`.
- One scene; everything else is built from code (ADR-0003). Level content is JSON (`LevelSchema`).
- Must stay readable to a reviewer in a short interview: small modules, one responsibility each, named after the domain.

## 2. Layers

```
┌──────────────────────── ui/ ────────────────────────┐   cc components, composition root, HUD, popups
│ Game  Hud  FoundWordsPanel  LevelCompletePopup      │
└───────────────▲───────────────────▲─────────────────┘
                │ events            │ calls
┌───────────────┴──────── view/ ────┴─────────────────┐   cc components, render model, forward input
│ BoardView  BoardTiles  PieceNode  DragController     │
└───────────────▲───────────────────▲─────────────────┘
                │ events            │ beginDrag / dragStep / endDrag
┌───────────────┴────── systems/ ───┴─────────────────┐   engine-free orchestration
│ GameSession (state machine)   EventBus   SaveStore   │
└───────────────▲─────────────────────────────────────┘
                │ uses
┌───────────────┴─────── model/ ──────────────────────┐   engine-free rules, pure data
│ Level  Board  Piece  WordMatcher  FreezeSystem       │
│ LevelSchema                                          │
└───────────────▲─────────────────────────────────────┘
                │ constants
┌───────────────┴──────── data/ ──────────────────────┐
│ Constants  Palette  Timing  Layout  LevelIndex       │
└──────────────────────────────────────────────────────┘
```
Dependency rule: arrows only point downward. The model never knows a view exists; it emits plain events through the session.

Unity reader's map: `ui/`+`view/` ≈ MonoBehaviours, `systems/`+`model/` ≈ a plain C# assembly with no UnityEngine reference, `data/` ≈ ScriptableObject constants, `GameSession` ≈ the game-mode controller.

## 3. Data model

### 3.1 Level JSON → runtime objects
```
level_004.json ──LevelSchema.validate──▶ Level { id, topic, words[], shape[], pieces[] }
                                             │
                                             ├─▶ Board  (cell set from shape; occupancy map)
                                             └─▶ Piece[] (one per pieces[] entry, ids "p0".."pN")
```

### 3.2 Piece
```js
{
  id: 'p9',
  letters: 'IN',                 // one char per cell
  offsets: [[0,0],[1,0]],        // relative to anchor, first is [0,0]
  at: [2, 4],                    // anchor [row, col]
  pin: null | wordIndex,         // pinned pieces are 1 letter, immovable
  frozen: 0 | n,                 // remaining counter; 0 = thawed
}
cells()      → [[2,4],[3,4]]
letterAt(r,c)→ 'N'
shapeKey()   → '0,0|1,0'         // used by PieceNode to pick the block texture
```

### 3.3 Board
- `cells: Set<"r,c">` from shape; `rows`, `cols`.
- `occupancy: Map<"r,c", pieceId>`.
- `canPlace(piece, r, c)` — every target cell is in `cells` and either free or occupied by `piece.id`.
- `place(piece, r, c)` — removes old cells, writes new, updates `piece.at`.
- `remove(pieceId)`, `pieceAt(r, c)`, `isFree(r, c)`, `freeCells()`.

### 3.4 Shape key → texture
| shapeKey | texture (white / frozen) |
|---|---|
| `0,0` | `common/Block.png` / `challenge1/Block_1Cell_Frozen.png` |
| `0,0\|0,1` | `Block_2Cell_Horizontal_*` |
| `0,0\|1,0` | `Block_2Cell_Vertical_*` |
| `0,0\|1,0\|1,1` | `Block_3Cell_LShape_*` |
| `0,0\|1,-1\|1,0` | `Block_3Cell_LShapeReversed_*` |
| `0,0\|0,1\|1,0` | `Block_3Cell_LShapeUp_*` |
| `0,0\|0,1\|1,1` | `Block_3Cell_LShapeUpReversed_*` |
The L mapping is confirmed visually when `PieceNode` is implemented (one texture per key, bounding box = cells × cellSize).

## 4. GameSession state machine (systems/GameSession.js)

```
          load(level)              beginDrag(pieceId)            dragStep(pieceId, r, c) ⟲
 ┌──────┐ ─────────▶ ┌──────┐ ──────────────────────────▶ ┌──────────┐  one cell per step,
 │LOADED│            │ IDLE │ ◀────────────────────────── │ DRAGGING │  board updated each time
 └──────┘            └──┬───┘   endDrag → no complete chain └────┬─────┘
                        ▲                                      │ endDrag → resolve()
                        │ animations done, words remain        ▼
                        │                                 ┌───────────┐
                        └──────────────────────────────── │ RESOLVING │
                                                          └────┬──────┘
                                                               │ all words found
                                                               ▼
                                                          ┌──────────┐
                                                          │ COMPLETE │
                                                          └──────────┘
```
- `beginDrag(pieceId)` → `{ ok, reason }`. Rejects when state ≠ IDLE or the piece is pinned/frozen. Enters DRAGGING, emits `drag:started`.
- `dragStep(pieceId, row, col)` → `{ ok, reason }`. Rejects unless the piece is the dragged one, the target is 4-adjacent to its anchor (`|dr| + |dc| === 1`), and `board.canPlace(piece, row, col)`. On success `board.place` runs immediately (so no other piece can ever share a cell), `piece:moved {pieceId, from, to}` is emitted and the state stays DRAGGING. Pieces never move more than one cell per call; the view decomposes longer moves into steps.
- `endDrag(pieceId)` → enters RESOLVING, emits `drag:ended`, runs `resolve()`. Movement was already committed step by step, so there is no reject path at release.
- `findPath(pieceId, row, col)` (helper, pure) → shortest list of single-cell steps from the piece's anchor to the target through cells where the whole footprint is free, breadth-first over the board; `null` if unreachable. Used by the view to route a piece toward a finger that is several cells away; also the primitive the solver uses.
- `resolve()` loop:
  1. `results = WordMatcher.find(board, level, pieces)`; `matches = results.filter(complete)`; if none, emit `word:progress` with every incomplete prefix (cells and word index) so the view can tint letters, then stop.
  2. For each match (word order), skip if any piece already removed; remove its pieces, mark word found, `coins += COINS_PER_WORD`, emit `word:cleared`.
  3. For each cleared word: `FreezeSystem.tick(pieces)` → emit `freeze:tick` per frozen piece and `freeze:thawed` for those reaching 0.
  4. Repeat from 1 (a thaw or a clear can enable another match).
- When `foundWords.size === words.length` → COMPLETE, emit `level:complete {levelId, coins}`.
- The view tells the session when its animations have finished (`session.animationsDone()`), returning to IDLE. Input is ignored while RESOLVING.

## 5. Rules algorithms (model)

### 5.1 WordMatcher.find(board, level, pieces) — chain search
A word is a path of 4-adjacent cells starting at its pin (demo: PEA = P, E to the left, A below E; BROWN = B-R-O-W down, N right of W).
```
for each piece p with p.pin !== null:
  word = level.words[p.pin]
  best = dfs(cell = p.at, index = 0, visited = {p.at})      # returns the deepest prefix path found
  dfs(cell, i, visited):
    path = [cell]
    if i === word.length - 1 → return path                   # complete
    for dir of [right, down, left, up]:
      next = cell + dir
      if next not on board, free, or in visited → continue
      q = board.pieceAt(next)
      if q.frozen > 0 → continue                             # frozen letters never count
      if q.pin !== null && q.pin !== p.pin → continue        # other words' pins are reserved
      if q.letterAt(next) !== word[i+1] → continue
      sub = dfs(next, i+1, visited ∪ {next})
      if sub is complete → return path + sub                 # first complete chain wins
      keep the longest sub seen
    return path + longest sub
  record { wordIndex: p.pin, cells: best, pieceIds: unique, complete: best.length === word.length }
return results (one entry per word; `complete` ones are matches, the rest drive prefix highlighting)
```
Bounded by word length (≤ 8) and branching ≤ 3, so at most a few hundred steps per word. A cell may appear in two words' prefixes; only complete chains remove pieces.

### 5.2 FreezeSystem.tick(pieces)
Decrement `frozen` of every piece with `frozen > 0`; return `{ ticked: [...], thawed: [...] }`. One tick per cleared word, applied after that word's removal.

### 5.3 Board.canPlace
Cells the piece currently occupies count as free, so dropping back onto itself or shifting a block by one cell over its own footprint is legal.

## 6. View design

### 6.1 Geometry (BoardView)
- `cellSize = min(Layout.MAX_CELL, floor(Layout.BOARD_MAX_W / cols), floor(Layout.BOARD_MAX_H / rows))`, with `MAX_CELL = 180`, `BOARD_MAX_W = 960`, `BOARD_MAX_H = 1000`.
- Board node anchored at (0.5, 0.5), centered at `Layout.BOARD_CENTER_Y` below the HUD panel.
- `cellToLocal(r, c) = ((c - (cols-1)/2) * cellSize, ((rows-1)/2 - r) * cellSize)` — row 0 is the top.
- `localToCell(pos) = (round((rows-1)/2 - pos.y/cellSize), round(pos.x/cellSize + (cols-1)/2))`, `null` if not in `board.cells`.
- Everything that maps grid↔pixels goes through these two functions. Nothing else does arithmetic on cells.

### 6.2 BoardTiles
One `cc.Sprite` per playable cell, texture chosen from the nine `challenge1/BG_*` tiles by which of the four neighbours exist:
`none missing → Center`, `one missing → Edge_<side>`, `two adjacent missing → Corner_<pos>`; other combos fall back to `Center` (acceptable for concave corners, matches the demo). Tiles are 215px; scaled to `cellSize`.

### 6.3 PieceNode
Node tree:
```
PieceNode (size = bbox of cells)         zIndex 0, raised to 100 while dragging
├── block   cc.Sprite (shape texture, tinted by Palette[wordIndex] if pinned or part of a prefix chain, white otherwise)
├── letters cc.Label × n (one per cell; hidden while frozen)
├── badge   cc.Label (word length, pinned only, bottom-right of the cell)
└── ice     cc.Sprite (frozen texture for shapeKey) + counter cc.Label; destroyed on thaw
```
`setModel(piece)` re-renders from the piece; `setHighlight(wordIndex|null)` tints a free letter that continues a word from its pin; `playThaw()`, `playClear(targetWorldPos)`, `slideTo(localPos, cb)` (one cell), `playBlocked()` (small bump).

### 6.4 DragController (component on the board node) — grid-constrained sliding
The piece never floats under the finger. It stays on cell centres and slides one cell at a time toward the finger through free cells, exactly as the demo videos show (E steps [1,2] → [1,1] → [0,1] lagging behind the cursor).
```
TOUCH_START  pick topmost PieceNode under finger; session.beginDrag(id) must return ok (else ignore)
             grabOffset = finger - anchorCellCentre; lift (scale 1.08, zIndex 100); queue = []
TOUCH_MOVE   target = localToCell(finger - grabOffset); if null or target == current anchor → return
             if queue is non-empty → replace the queue tail with a new route from the last queued cell
             path = session.findPath(id, target.r, target.c)         # BFS over free footprints
             if path is null → path = session.findPath toward the closest reachable cell to target (by Manhattan distance)
             queue = path; if not already stepping → stepNext()
stepNext()   step = queue.shift(); if !step → return
             ok = session.dragStep(id, step.r, step.c).ok            # commits the board immediately
             ok ? tween node to cellToLocal(step) over Timing.SLIDE_STEP then stepNext()
                : queue = []; play blocked bump
TOUCH_END /  endPending = true; when queue is empty and no tween is running:
TOUCH_CANCEL session.endDrag(id); unlift
```
- Single active touch id; a second finger is ignored.
- `Timing.SLIDE_STEP ≈ 0.06 s` per cell so a three-cell slide takes under 0.2 s and still reads as motion.
- Because every step commits to the board, two pieces can never overlap and no piece can pass through another, even if the finger crosses them.
- BFS is over at most 8x8 cells per TOUCH_MOVE; cache the last target to avoid recomputing on every pixel.
- A step refused by the session (race with a thaw or a resize) empties the queue and bumps the piece; it stays where it legally is.

## 7. UI design (ui/)

- **Game** (on Canvas): loads `LevelIndex[current]` via `cc.resources.load('levels/level_00N', cc.JsonAsset)`, validates with `LevelSchema` in debug, creates `GameSession`, `BoardView`, `Hud`, `FoundWordsPanel`, `LevelCompletePopup`; subscribes to session events and routes them to views; handles Restart (reload same level) and Continue (next level, wraps to first); persists `{ levelIndex, coins }` through `SaveStore`.
- **Hud**: topic label, level label, coin counter, Settings and Restart buttons (`common/Button.png`). Anchored with `cc.Widget` top-left/top-right.
- **FoundWordsPanel**: rounded panel under the HUD; `addWord(word, colorIndex)` lays out letter chips (small tinted `Block.png`) one row per word, animated in from the fly target.
- **LevelCompletePopup**: dimmed overlay, title, "+N" coins, Continue button; `show(coins)`, `onContinue(cb)`.
- Layout constants (`data/Layout.js`): HUD height 180, panel 1080×420 at y≈+560, board centre y≈−150, popup 900×1100.

## 8. Events (systems/EventBus.js, names in data/Constants.js)
| event | payload | consumers |
|---|---|---|
| `level:loaded` | `{ level }` | Game, Hud, BoardView |
| `piece:moved` | `{ pieceId, from, to }` | BoardView (tween one cell) |
| `drag:started` / `drag:ended` | `{ pieceId }` | BoardView (lift / unlift) |
| `piece:rejected` | `{ pieceId, reason }` | BoardView (bump feedback when a step is blocked) |
| `word:progress` | `{ prefixes: [{ wordIndex, pieceIds }] }` | BoardView tints prefix letters in the word colour, resets the rest |
| `word:cleared` | `{ wordIndex, word, cells, pieceIds }` | BoardView (clear anim), FoundWordsPanel, Hud (coins) |
| `freeze:tick` | `{ pieceId, remaining }` | PieceNode counter |
| `freeze:thawed` | `{ pieceId }` | PieceNode thaw anim |
| `level:complete` | `{ levelId, coins, reward }` | Game → popup |

## 9. Animation specs (data/Timing.js)
| moment | effect | duration / easing |
|---|---|---|
| lift | scale 1→1.08, zIndex 100 | 0.08 s quadOut |
| slide step | position to the next cell centre | 0.06 s linear per cell |
| blocked bump | 4 px nudge toward the finger and back | 0.1 s |
| settle | scale →1, zIndex 0 | 0.1 s quadOut |
| prefix tint | letter tint to word colour (or back to white) | 0.1 s |
| word clear | all chain letters tinted, hold, then fly to the panel one letter at a time in word order | 0.25 s hold + 0.3 s per letter, 0.08 s stagger |
| ice tick | counter punch scale 1.3→1 | 0.15 s backOut |
| thaw | ice scale 1→1.3, opacity →0, letters fade in | 0.25 s |
| popup | overlay fade, panel scale 0.8→1 | 0.25 s backOut |

## 10. Persistence (systems/SaveStore.js)
`SaveStore(adapter)` with `load()`/`save({ version, levelIndex, coins })`; `adapter` is `{ getItem, setItem }`. `ui/Game` injects `cc.sys.localStorage`; tests inject an in-memory map. `version` field for later migrations (`game-systems` skill).

## 11. Testing plan
- `tests/model/Board.test.js` — cell set, canPlace (bounds, overlap, self-overlap), place/remove.
- `tests/model/Piece.test.js` — cells, letterAt, shapeKey, pinned/frozen predicates.
- `tests/model/WordMatcher.test.js` — straight chain, L-shaped chain (PEA layout from the demo), leftward step, no diagonal, no cell reuse, frozen excluded, other word's pin excluded, prefix length reported, first complete chain wins when two exist.
- `tests/model/FreezeSystem.test.js` — tick, thaw at zero, no negative counters.
- `tests/model/Board.test.js` also covers `findPath`: straight corridor, detour around a piece, block footprint through a one-cell gap (unreachable), unreachable target returns null.
- `tests/systems/GameSession.test.js` — full playthrough of levels 1, 3 and 4 by scripted single-cell steps; a step onto an occupied cell is refused and the board is unchanged; a two-cell jump is refused; counters; completion event; coins.
- `tests/systems/SaveStore.test.js` — round trip with in-memory adapter.
- `model/Solver.js` + `tools/solve-level.js` — best-first search over board states where a move is one drag to any anchor in `Board.reachable(piece)`, followed by `Resolver.resolve` (the same clear/freeze loop GameSession uses). Weight 0 is uniform-cost search (proven minimum moves or slides); weight > 0 adds "letters missing from chains" as a guide and returns an upper bound fast. Uniform-cost search does not fit on tight boards (level_004: 20 cells, 4 free, > 20k states without reaching the optimum), so `analyze` falls back to guided search and labels the result "≤". Wired into `npm run validate:levels` and `tests/levels/solvable.test.js`; **required before any level ships**. (level_004 turned out solvable; the earlier "K boxed in" note was wrong.)
- Manual checklist in the `testing` skill for the preview build.

## 12. Implementation order
1. `data/` constants, `model/Piece`, `model/Board` (incl. `findPath`) + tests.
2. `model/WordMatcher` (chain DFS), `model/FreezeSystem` + tests.
3. `systems/EventBus`, `systems/GameSession` (beginDrag/dragStep/endDrag/resolve) + scripted playthrough tests.
4. `tools/solve-level.js` + solvability test; level-designer fixes level_004 (and re-checks 1–3) with it. Rules are done when levels 1–4 solve.
5. `view/BoardTiles`, `view/BoardView`, `view/PieceNode` (static render of level 4 in the preview; confirm L textures).
6. `view/DragController` sliding + blocked bump.
7. Prefix tint, clear/thaw animations; `ui/FoundWordsPanel`, `ui/Hud`.
8. `ui/Game` flow, `LevelCompletePopup`, `SaveStore`, restart/continue.
9. QA pass, README polish, packaging.

## 13. Risks and mitigations
- **L-shape texture ↔ offsets mismatch** → verify by rendering all six block textures in a debug level before wiring drag.
- **Touch coordinates after fit-width scaling** → always convert via `convertToNodeSpaceAR` on the board node; test on a 19.5:9 preview size.
- **Matching twice on shared pieces** → resolve loop skips matches whose pieces are gone; covered by a unit test.
- **Sliding makes levels unsolvable by accident** → the solver runs in `npm run validate:levels`; no level ships without a solver pass.
- **Chain search blow-up** → words are short and branching is at most three per step; a depth cap equal to the word length keeps it bounded, and the test suite includes a dense 6x6 board.
- **Lost TOUCH_CANCEL** → treat as END; add a safety: if a piece is lifted and no touch for 2 s, return it.
- **Module resolution** → bare-name `require` with unique filenames; `npm test` mirrors it via NODE_PATH.

## 14. Open questions for review
1. Should a frozen piece adjacent to a prefix chain show a hint (e.g. the ice pulses)? Default: silent.
4. When two chains spell the same word from one pin, which clears? Default: first found in scan order right, down, left, up.
2. Coins per word = 10 and a flat +10 level reward; fine for M1?
3. Settings button in M1: sound toggle only, or hide the button until audio exists? Default: show, opens a stub popup.
