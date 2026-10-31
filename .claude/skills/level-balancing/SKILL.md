---
name: level-balancing
description: Load when tuning difficulty, reviewing a batch of levels, planning the level curve, or deciding where freeze counters and linked blocks belong. Complements level-authoring (which covers the format and validator).
---

# Level balancing

Difficulty in this game comes from four sources: how many letters the player must reason about, how little free space there is to shuffle them, how the clear order is constrained (freeze counters), and how awkward the pieces are to place (linked blocks). The format and validator are in the `level-authoring` skill; this skill is about tuning numbers.

## Metrics per level

Compute these for every level in a batch (by hand today; `tools/solve-level.js` will print them once the solver exists):

| Metric | Definition | Source |
|---|---|---|
| words | `words.length` | JSON |
| letters | total letters across words | JSON |
| cells | playable `#` cells in `shape` | `cellsOfShape` in LevelSchema |
| free ratio | `(cells - letters) / cells` | derived |
| min moves | fewest piece moves to clear all words | solver |
| forced order | number of word pairs where A must clear before B (cell conflicts or a frozen letter B needs) | designer walkthrough |
| frozen pieces | count and counters | JSON |
| blocks | pieces with 2–3 cells | JSON |
| chain options | for each word, how many 4-connected paths of its length start at its pin (bent paths count) | shape + pins |
| min slides | minimum single-cell slides to clear the level (solver); the main difficulty number under the sliding rule | `tools/solve-level.js` |
| free-cell ratio | empty cells ÷ total cells at start; below 0.15 the board plays like a sliding-block puzzle | shape + pieces |

Red flags: free ratio under 0.15 (feels like a sliding puzzle, frustrating); a frozen counter larger than the number of other words (can never thaw: the validator does not catch this yet, you must); a block whose shape fits in only one place (becomes a lock, not a puzzle); a word with zero line options (unsolvable).

## Target curve, levels 1–30

| Levels | Words | Letters | Free ratio | Frozen | Blocks | Shape |
|---|---|---|---|---|---|---|
| 1–3 | 2 | 6–7 | 0.30–0.45 | none | none | full rectangle 3x3 / 4x4 |
| 4–6 | 2–3 | 7–10 | 0.30–0.40 | none | none | rectangle, first non-square (4x3) |
| 7–9 | 2–3 | 8–11 | 0.25–0.35 | 1 piece, counter 1 | none | first irregular shape (notch or tail) |
| 10–12 | 3 | 10–13 | 0.25–0.35 | 1–2 pieces, counter 1–2 | none | irregular |
| 13–15 | 3 | 11–14 | 0.20–0.30 | 1–2 | first 2-cell block, unfrozen | irregular |
| 16–18 | 3–4 | 13–16 | 0.20–0.30 | 1–2 | 1–2 two-cell blocks | plus / T shapes |
| 19–21 | 4 | 15–17 | 0.20–0.25 | 2, counters up to 3 | first 3-cell L block | irregular |
| 22–24 | 4 | 16–18 | 0.18–0.25 | 2 | 2 blocks, one frozen | irregular |
| 25–27 | 4–5 | 18–21 | 0.15–0.22 | 2–3 | 2–3 blocks incl. L | large irregular |
| 28–30 | 5 | 20–24 | 0.15–0.20 | 3 | 3 blocks, one frozen L | large irregular |

The shipped levels map onto it like this: level_001 (NUMBER, 3x3, 6 letters, ratio 0.33) and level_002 (FARM, 4x4, 6 letters, ratio 0.63 — too easy for anything past tutorial, fine as level 2) sit at 1–3; level_003 (PLANT, one frozen counter 1, ratio 0.30) is a 7–9 level; level_004 (COLORS, 4 words, 16 letters, 20 cells, ratio 0.20, frozen 2-cell block with counter 2, one 2-cell block) is a 16–18 level. When the set grows, renumber so the curve holds; ids are data, not order.

## Freeze counter rules

- A counter of N must be reachable: at least N other words must be clearable without that letter. Walk it through.
- The best counters thaw **exactly when** the letter is needed (level_004: IN thaws after RED and BLUE, right before PINK needs it). A counter that thaws two words early is just a locked tile; a counter that thaws too late forces a stall and feels broken.
- Never freeze a pinned letter (validator rejects it) and never freeze the last word's only remaining letters with a counter greater than words left.

## Linked block rules

- A block should have at least two valid final placements mid-game, or the player feels it is a jigsaw piece. Check its target line and at least one parking spot.
- L-blocks (3 cells) need an irregular board with room; on a rectangle they dominate. Introduce them after level 18.
- A frozen block blocks three cells of parking space while frozen: lower the letters count by one when adding one so the free ratio stays in band.

## Reviewing a batch

1. Run `npm run validate:levels`; nothing proceeds with errors.
2. Fill the metrics table for each level; flag anything outside the band for its slot.
3. Read each designer walkthrough (format below) and confirm it actually works on paper: track occupancy after each move.
4. Check variety: no two consecutive levels with the same shape or the same topic; a topic's words must be guessable from the topic alone (NUMBER → ONE/TWO is fine; COLORS → BROWN is fine; avoid obscure words).
5. Playtest the top and bottom level of the batch in the browser preview and time it; a level should take 20–90 s for someone who knows the rules.
6. Write the result into `docs/levels/review-<date>.md`: table, flags, accepted/rejected per level.

## Walkthrough format (required from the designer)

```
level_004 COLORS — target slot 16–18
State: rows top→bottom, '.' hole, '_' empty cell, lowercase = frozen
..PB..
..ED..
RKLUiO
BRNEnW
..__..
..__..
1. K[2,1]→[4,2]; L[2,2]→[4,3]; E[1,2]→[2,1]; D[1,3]→[2,2]  → RED clears (IN counter 2→1)
2. R[3,1]→[2,0]; N[3,2]→[2,1]; L[4,3]→[3,1]; U[2,3]→[3,2]  → BLUE clears (IN 1→0, thaws)
3. IN block [2,4]→[1,2]; K[4,2]→[3,2]                      → PINK clears
4. R[2,0]→[1,3]; OW block [2,5]→[2,3]; N[2,1]→[4,3]         → BROWN clears, level complete
Moves: 13. Forced order: RED and BLUE before PINK (freeze), BLUE before BROWN (cell [3,3]).
```
Every move names piece, from, to; every clear names the counter effect. QA reproduces this verbatim.
