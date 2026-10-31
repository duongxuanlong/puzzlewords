---
name: testing
description: Load before writing or running tests, when deciding what a change must cover, or when running the manual playtest checklist in the browser preview. Covers node:test unit tests for the model, solvability tests, and the QA checklist for the shipped levels.
---

# Testing

Two layers: automated Node tests for everything engine-free (`model/`, `data/`, `systems/`), and a manual playtest checklist for the engine side. Unity analog: Node tests are EditMode tests; the checklist replaces PlayMode tests because Cocos 2.4 has no headless runtime.

## Unit tests (`npm test`)

Runner: Node's built-in `node:test`, assertions from `node:assert/strict`. Files live in `tests/<layer>/<Module>.test.js` and match `tests/**/*.test.js`. `npm test` sets `NODE_PATH=assets/scripts/model:assets/scripts/data:assets/scripts/systems`, so tests require modules **by bare name**, the same way Creator resolves them:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLevel } = require('LevelSchema');   // not '../../assets/...'

test('rejects a piece outside the board', () => {
  const level = { id: 1, topic: 'T', words: ['AB'], shape: ['##'],
    pieces: [{ letters: 'A', at: [0, 0], pin: 0 }, { letters: 'B', at: [0, 5] }] };
  assert.ok(validateLevel(level).some((e) => e.includes('outside the board')));
});
```

Run one file: `NODE_PATH=assets/scripts/model node --test tests/model/LevelSchema.test.js`. Watch mode: add `--watch`.

If a module under test needs `cc`, the module is in the wrong layer; move the logic, do not mock the engine.

### Required coverage per module

| Module | Must have tests for |
|---|---|
| `LevelSchema` | every shipped level valid; outside-board, overlap, missing pin, letter mismatch, frozen pin, block > 3, disconnected block (exists: `tests/model/LevelSchema.test.js`) |
| `Board` | cells from shape (holes excluded); `isFree(cells)`; place / remove / move updates occupancy; `pieceAt(r,c)`; rejects out-of-board and overlapping placements, including a block moving onto cells it currently occupies (must be allowed) |
| `Piece` | single and multi-cell `cells()` from anchor + offsets; `canMove` false when pinned or frozen; letters immutable |
| `WordMatcher` | finds a chain of 4-adjacent cells from the pin spelling the word (straight, L-shaped like the demo's PEA, leftward and upward steps); ignores diagonals; never reuses a cell; trailing letters beyond the word are ignored; frozen cells do not count; another word's pin is never part of a chain; reports the longest prefix when incomplete; first complete chain in scan order right, down, left, up wins when two exist |
| `FreezeSystem` | every clear decrements all frozen counters by 1; thaw at 0 emits once; a piece thawed mid-sequence is matchable on the next check; counters never go negative |
| `LevelState` / `Game` model | full playthrough of level_001 and level_004 by scripted moves ends with `isComplete()` true; an invalid move leaves state unchanged |
| `SaveStore`, `Progression`, `Wallet` | defaults, round-trip through an in-memory adapter, corrupt JSON fallback, each migration from a fixture |

Use the shipped level JSON as fixtures (`fs.readFileSync` from `assets/resources/levels`) rather than retyping shapes.

## Solvability tests

`tests/levels/solvable.test.js` runs `Solver.prove` on every shipped level, asserts a solution exists, then replays that solution through `GameSession` (beginDrag / dragStep along `findPath` / endDrag) and asserts the level completes, so the solver and the game cannot disagree about the rules. This also guards the `level-balancing` freeze rule: a counter greater than the number of other words shows up as unsolvable. `npm run validate:levels` runs the same check. Solver unit tests (exact minimum, unsolvable boxes and counters, budgets) are in `tests/model/Solver.test.js`; for timings use `npm run solver:report`.

## Lint and gates

`npm run check` = lint + tests + level validation; it is the git pre-commit gate and the hook `tools/hooks/after-edit.js` runs tests after every script edit. A red test blocks the commit; do not skip tests with `.skip` to get past it, fix or delete the test with a note.

## Manual playtest checklist (browser preview)

Launch via the `run-and-build` skill (Creator → Play, or `npm run build:web` and serve `build/web-mobile`). Use Chrome device toolbar for aspect ratios. Record the result as pass/fail per line in `docs/qa/playtest-<date>.md`; file a `bug-report` for each fail.

**Core drag and drop**
- [ ] Drag a free letter two cells away along a free corridor: it slides cell by cell (visible intermediate step), ends on the cell centre, no jitter.
- [ ] Move the finger across another piece: the dragged piece stops at the last free cell and never overlaps; releasing leaves it there.
- [ ] Move the finger outside the board: the piece stays on its last in-board cell.
- [ ] Finger far ahead with a detour available: the piece routes around the obstacle on its own.
- [ ] Release on the origin cell: no error, no state change.
- [ ] Drag a pinned letter: nothing moves (no lift animation either).
- [ ] Drag a frozen piece: nothing moves; counter still visible.
- [ ] Drag a 2-cell block (level_004 OW) toward the board edge: it stops when either cell would leave the board.
- [ ] Drag a block through a one-cell gap: it does not fit and waits; a single letter does.
- [ ] Slide a block by one cell over its own footprint (vertical block down one): accepted.
- [ ] Two fingers: second touch during a drag is ignored.
- [ ] Dragged piece renders above every other piece and the HUD panel.

**Matching and clearing**
- [ ] level_001 NUMBER: place N,E right of O → ONE clears, letters fly to the found-words panel in pink; place W,O right of T → TWO clears in green; level completes.
- [ ] A word formed downward from its pin clears (use level_004 PINK or BROWN).
- [ ] Letters placed in the right order but not adjacent to the pin do not clear.
- [ ] Letters placed to the left of or above the pin do not clear.
- [ ] A correct word with an extra letter after it still clears the word only.
- [ ] level_002 FARM: COW then PIG, 4x4 board centered.

**Freeze (level_003 PLANT)**
- [ ] Frozen I shows the ice overlay and counter 1, letter hidden.
- [ ] Clearing PEA sets the counter to 0: ice breaks with animation, letter I visible and draggable.
- [ ] Form LILY after thaw; level completes.

**Linked blocks and freeze together (level_004 COLORS)**
- [ ] Plus-shaped board renders with correct edge and corner tiles; no gaps or overlaps.
- [ ] IN block shows counter 2; after RED it shows 1; after BLUE it thaws.
- [ ] Follow the walkthrough in `level-balancing`; all four words clear; level completes.
- [ ] Restart button resets pieces, counters and the found-words panel.

**HUD and flow**
- [ ] Topic label and found-words panel update; the panel keeps all cleared words readable with 4 words.
- [ ] Level label shows the current level id; coin counter increments by the reward on Continue.
- [ ] Level-complete popup appears after the last clear animation finishes, not before.
- [ ] Continue loads the next level; after the last shipped level the flow does not crash (wraps or shows an end screen as specified).
- [ ] Reload the page: progress and coins persist.

**Layout**
- [ ] 9:16 (1080x1920): matches the reference frames.
- [ ] 19.5:9 (1080x2340): HUD stays at top with safe-area margin; board remains centered; nothing clipped.
- [ ] 4:3 (1536x2048): board fits within width; popup fully visible; no overlap between panel and board.
- [ ] Landscape is not supported: confirm orientation lock in the build template, or that the layout degrades without overlap.

**Performance smoke** (see `cocos2x-performance`)
- [ ] With stats on, draw calls while dragging in level_004 under 20; no frame-time spikes after the first second.
