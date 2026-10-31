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
                │ events            │ tryMove(pieceId,r,c)
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
          load(level)              touch on movable piece
 ┌──────┐ ─────────▶ ┌──────┐ ──────────────────────────▶ ┌──────────┐
 │LOADED│            │ IDLE │ ◀────────────────────────── │ DRAGGING │
 └──────┘            └──┬───┘   drop rejected / no match  └────┬─────┘
                        ▲                                      │ drop accepted → tryMove
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
- `tryMove(pieceId, row, col)` → `{ ok, reason }`. Rejects when state ≠ IDLE/DRAGGING, piece pinned/frozen, or `!board.canPlace`.
- On accepted move: emit `piece:moved`, enter RESOLVING, run `resolve()`.
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
`setModel(piece)` re-renders from the piece; `setHighlight(wordIndex|null)` tints a free letter that continues a word from its pin; `playThaw()`, `playClear(targetWorldPos)`, `snapTo(localPos)`, `returnTo(localPos)`.

### 6.4 DragController (component on the board node)
```
TOUCH_START  pick topmost PieceNode under finger (hit test on node bbox); reject if pinned/frozen or session not IDLE
             remember origin cell; lift (scale 1.08, zIndex 100); offset = finger - node position
TOUCH_MOVE   node.position = boardLocal(finger) - offset        (piece may visually leave the board)
TOUCH_END /  anchorLocal = node.position + anchorOffset          (anchor sub-cell centre)
TOUCH_CANCEL cell = localToCell(anchorLocal)
             ok = cell && session.tryMove(id, cell.r, cell.c).ok
             ok ? snapTo(cellToLocal(cell)) : returnTo(cellToLocal(origin)); unlift
```
Single active touch id; a second finger is ignored. All tweens through `cc.tween`, durations in `data/Timing.js`.

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
| `piece:moved` | `{ pieceId, from, to }` | BoardView (snap) |
| `piece:rejected` | `{ pieceId, reason }` | BoardView (return), Hud (optional shake) |
| `word:progress` | `{ prefixes: [{ wordIndex, pieceIds }] }` | BoardView tints prefix letters in the word colour, resets the rest |
| `word:cleared` | `{ wordIndex, word, cells, pieceIds }` | BoardView (clear anim), FoundWordsPanel, Hud (coins) |
| `freeze:tick` | `{ pieceId, remaining }` | PieceNode counter |
| `freeze:thawed` | `{ pieceId }` | PieceNode thaw anim |
| `level:complete` | `{ levelId, coins, reward }` | Game → popup |

## 9. Animation specs (data/Timing.js)
| moment | effect | duration / easing |
|---|---|---|
| lift | scale 1→1.08, zIndex 100 | 0.08 s quadOut |
| snap | position to cell, scale →1 | 0.12 s quadOut |
| return | position to origin, scale →1 | 0.2 s quadInOut |
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
- `tests/systems/GameSession.test.js` — full playthrough of levels 1, 3 and 4 by scripted moves; rejections; counters; completion event; coins.
- `tests/systems/SaveStore.test.js` — round trip with in-memory adapter.
- `tools/solve-level.js` (BFS over piece placements, bounded) — proves every shipped level solvable; wired as a test.
- Manual checklist in the `testing` skill for the preview build.

## 12. Implementation order
1. `data/` constants, `model/Piece`, `model/Board` + tests.
2. `model/WordMatcher`, `model/FreezeSystem` + tests.
3. `systems/EventBus`, `systems/GameSession` + scripted playthrough tests (levels 1, 3, 4 green here = rules done).
4. `view/BoardTiles`, `view/BoardView`, `view/PieceNode` (static render of level 4 in the preview).
5. `view/DragController` + snap/return tweens.
6. Clear/thaw animations; `ui/FoundWordsPanel`, `ui/Hud`.
7. `ui/Game` flow, `LevelCompletePopup`, `SaveStore`, restart/continue.
8. Solver tool, QA pass, README polish, packaging.

## 13. Risks and mitigations
- **L-shape texture ↔ offsets mismatch** → verify by rendering all six block textures in a debug level before wiring drag.
- **Touch coordinates after fit-width scaling** → always convert via `convertToNodeSpaceAR` on the board node; test on a 19.5:9 preview size.
- **Matching twice on shared pieces** → resolve loop skips matches whose pieces are gone; covered by a unit test.
- **Chain search blow-up** → words are short and branching is at most three per step; a depth cap equal to the word length keeps it bounded, and the test suite includes a dense 6x6 board.
- **Lost TOUCH_CANCEL** → treat as END; add a safety: if a piece is lifted and no touch for 2 s, return it.
- **Module resolution** → bare-name `require` with unique filenames; `npm test` mirrors it via NODE_PATH.

## 14. Open questions for review
1. Should a frozen piece adjacent to a prefix chain show a hint (e.g. the ice pulses)? Default: silent.
4. When two chains spell the same word from one pin, which clears? Default: first found in scan order right, down, left, up.
2. Coins per word = 10 and a flat +10 level reward; fine for M1?
3. Settings button in M1: sound toggle only, or hide the button until audio exists? Default: show, opens a stub popup.
