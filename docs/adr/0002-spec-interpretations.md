# ADR-0002: Interpretation of the Athena word-puzzle spec

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** tech-lead, with the demo videos as reference

## Context
The test PDF leaves several rules open. The demo videos (BasicGameplay, Challenge1, Challenge2) show the intended behaviour.

## Decision
1. **Sliding movement, no passing through pieces.** A dragged piece slides one cell at a time through free cells, following the finger; it never overlaps another piece and cannot pass through one. The brief says letters are dragged "horizontally or vertically" and "cannot overlap"; at 10–12 fps the videos show E stepping [1,2] → [1,1] → [0,1] while lagging behind the cursor, and N caught mid-tween between two cells. A piece is therefore always on a valid cell, and release simply ends the drag.
2. **Matching is a chain from the pin, not a straight line.** A word clears when there is a path of 4-adjacent cells (up, down, left or right at every step, no cell reused) starting at the pinned letter whose letters spell the word. Challenge1 clears PEA with P at [0,2], E to its left at [0,1] and A below E at [1,1]; Challenge2 clears BROWN with B-R-O-W stacked vertically and N to the right of W. Diagonal steps never count. Pinned letters of other words are never part of a chain.
3. **Prefix feedback.** After every drop, clear or thaw, the longest valid prefix chain from each pin is tinted in the word's colour (Challenge1: E turns orange the moment it is dropped next to P; Challenge2: B-L-U is blue before E arrives). Letters that stop being part of a prefix revert to white. The older BasicGameplay build does not show this; the Challenge builds are taken as the current behaviour.
4. **Frozen pieces hide their letters** and show the counter. Every cleared word decrements all counters by one. At zero the ice is removed and the piece becomes a normal movable piece (Challenge1: the "1" tile reveals I after PEA clears). "Removed from the board" in the PDF is read as "ice removed".
5. **Frozen cells do not count** toward a match or a prefix until thawed.
6. **Linked blocks** (2–3 letters) move as one unit, may be frozen as a whole, and are matched letter by letter like singles.
7. **Pinned letters never move**, are never frozen, and display the word length and the word's color.

## Consequences
- Level data needs `pin`, `frozen`, `cells` fields (see `LevelSchema`).
- Levels must be solvable under sliding: a solver (`tools/solve-level.js`) is required before levels ship, and free cells become a design resource.
- These interpretations are stated in the README's design notes for the reviewer.

## Alternatives considered
- Straight-line matching (right or down from the pin): simpler, but contradicts the PEA and BROWN clears in the Challenge videos.
- Free placement (drop anywhere free, piece floats under the finger): simpler input code, but contradicts the frame-by-frame evidence and removes the puzzle element of blocked paths.
- Frozen letter removed entirely at zero: contradicts the Challenge1 video.
- Frozen letters counting toward matches: makes hidden letters matter, which the player cannot reason about.
