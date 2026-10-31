# ADR-0002: Interpretation of the Athena word-puzzle spec

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** tech-lead, with the demo videos as reference

## Context
The test PDF leaves several rules open. The demo videos (BasicGameplay, Challenge1, Challenge2) show the intended behaviour.

## Decision
1. **Free placement.** A piece can be dropped on any set of free cells inside the board, not only adjacent ones (BasicGameplay: N jumps from the bottom row next to the pinned O).
2. **Matching from the pin, right or down.** A word clears when the pinned letter followed by `length-1` occupied cells in a straight line to the right or downward spell the word. Reading left or up never matches.
3. **Frozen pieces hide their letters** and show the counter. Every cleared word decrements all counters by one. At zero the ice is removed and the piece becomes a normal movable piece (Challenge1: the "1" tile reveals I after PEA clears). "Removed from the board" in the PDF is read as "ice removed".
4. **Frozen cells do not count** toward a match until thawed.
5. **Linked blocks** (2–3 letters) move as one unit, may be frozen as a whole, and are matched letter by letter like singles.
6. **Pinned letters never move**, are never frozen, and display the word length and the word's color.

## Consequences
- Level data needs `pin`, `frozen`, `cells` fields (see `LevelSchema`).
- These interpretations are stated in the README's design notes for the reviewer.

## Alternatives considered
- Frozen letter removed entirely at zero: contradicts the Challenge1 video.
- Frozen letters counting toward matches: makes hidden letters matter, which the player cannot reason about.
