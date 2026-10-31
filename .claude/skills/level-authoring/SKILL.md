---
name: level-authoring
description: How to write, validate and document a level JSON for the word puzzle (shape grammar, pieces, pins, freeze, linked blocks). Load before creating or editing anything under assets/resources/levels.
---

# Level authoring

Levels are JSON files in `assets/resources/levels/level_NNN.json`, loaded at runtime with
`cc.resources.load('levels/level_NNN', cc.JsonAsset)`. The schema is implemented and documented in
`assets/scripts/model/LevelSchema.js`; validate with `npm run validate:levels` (runs `tools/validate-levels.js`).

## Format
```json
{
  "id": 4,
  "topic": "COLORS",
  "words": ["RED", "BLUE", "PINK", "BROWN"],
  "shape": ["..##..", "..##..", "######", "######", "..##..", "..##.."],
  "pieces": [
    { "letters": "R",  "at": [2, 0], "pin": 0 },
    { "letters": "IN", "at": [2, 4], "cells": [[0, 0], [1, 0]], "frozen": 2 },
    { "letters": "OW", "at": [2, 5], "cells": [[0, 0], [1, 0]] },
    { "letters": "E",  "at": [1, 2] }
  ]
}
```
- `id` — positive integer, unique, matches the filename number.
- `topic` — shown in the HUD. `words` — uppercase A–Z, 2+ letters, unique.
- `shape` — rows top→bottom, equal width; `#` playable cell, `.` hole. Any outline works (the board tiles pick corner/edge/center art per cell).
- `pieces[].letters` — 1 to 3 uppercase letters. `at` — `[row, col]` of the anchor (first letter).
- `cells` — one `[dRow, dCol]` offset per letter, first is `[0, 0]`, 4-connected. Omit for single letters.
  Supported block shapes have art under `assets/resources/textures/challenge2/`: 2 horizontal `[[0,0],[0,1]]`, 2 vertical `[[0,0],[1,0]]`,
  and four 3-cell L shapes. With the anchor as the first listed cell the four L footprints are
  `[[0,0],[1,0],[1,1]]`, `[[0,0],[1,0],[1,-1]]`, `[[0,0],[0,1],[1,0]]`, `[[0,0],[0,1],[1,1]]` (negative offsets are fine).
  Which texture (`LShape`, `LShapeReversed`, `LShapeUp`, `LShapeUpReversed`) matches which footprint is decided in `PieceNode`; view the PNGs before assuming.
- `pin` — index into `words`. Pinned pieces are single letters, equal to the word's first letter, never frozen, never move, show the word length.
- `frozen` — counter ≥ 1. The piece is locked and its letters hidden until `frozen` words have been cleared.
- `colors` (optional, level-wide) — one palette index per word (`data/Palette.js` WORD_COLORS: 0 pink, 1 green, 2 blue, 3 orange, 4 purple, 5 teal). Omitted: word i uses colour i. Use it to match a word to its meaning (level 4: BLUE blue, PINK pink).

## Invariants the validator enforces
Every word has exactly one pin; letters on the board equal the multiset of letters in `words`; pieces inside the shape; no overlaps; blocks connected and ≤ 3 letters.

## Design rules (not enforced by code — your responsibility)
1. **A chain from each pin.** A word is matched as a path of 4-adjacent cells starting at its pin; each step may go up, down, left or right and no cell is reused (the demo clears PEA as P, E to its left, A below E). Make sure at least one such path of `word.length` cells exists from the pin that does not pass through another word's pin.
2. **Solvable under sliding.** Pieces slide one cell at a time through free cells and never pass through other pieces, so every piece you need must have a free route to its target at that moment, possibly after moving other pieces out of the way. Later words free up cells as they clear. Write the intended order as a list of slides and check each one has a corridor. Free cells are the puzzle budget: ≥ 2 empty cells on small boards, ≥ 4 on 16+ letter boards, and never box a needed piece in on all four sides (level_004 as first drafted boxed K in).
   Run `node tools/solve-level.js assets/resources/levels/level_NNN.json`; it is mandatory before a level ships, and `npm run validate:levels` fails any level the solver cannot solve. Compare its walkthrough with yours: a shorter one means the level is easier than you intended.
3. **Freeze counters match the order.** A piece needed for the k-th word should have `frozen` ≤ k−1 so it thaws just in time; a counter that can never reach zero before the piece is needed makes the level unsolvable.
4. **Blocks need their footprint free along the whole route.** A vertical `OW` block for BROWN needs two stacked free cells at every step of its slide, not only at the target; a one-cell gap stops it.
5. **Distinct colors.** Up to 6 words per level (palette size); keep ≤ 4 for mobile readability.
6. Difficulty progression: see `level-balancing`.

## Workflow
1. Copy the nearest existing level, bump `id`, rename the file.
2. Sketch the grid in your report with pins marked, e.g.
   ```
   . . P B . .
   . . E D . .
   R K L U I O     (I/N frozen 2, O/W vertical block)
   B R N E N W
   . . _ _ . .
   . . _ _ . .
   ```
3. Write the step-by-step solution (which piece to which cell, which word clears, counters after each clear).
4. `npm run validate:levels` → must print `ok` for the file. Fix every error line.
5. Run `tools/solve-level.js` and record min moves / min slides in `docs/levels/level_NNN.md` (a "≤" value is an upper bound, not a proven minimum).
6. Play it in the preview (see `run-and-build`) and confirm the walkthrough.

## Shipped levels
| id | topic | words | features |
|---|---|---|---|
| 1 | NUMBER | ONE, TWO | 3x3, tutorial |
| 2 | FARM | COW, PIG | 4x4, more empty space |
| 3 | PLANT | PEA, LILY | irregular shape, frozen I (1) |
| 4 | COLORS | RED, BLUE, PINK, BROWN | plus shape, frozen block IN (2), block OW |
