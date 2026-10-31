# Feature: Word puzzle core (Basic gameplay + Challenge 1 + Challenge 2)

- **Status:** Approved
- **Owner:** producer · **Tech review:** tech-lead · **Date:** 2026-10-31
- Source: Athena Studio test PDF + demo videos; interpretations recorded in ADR-0002.

## Summary
Each level shows a topic and a board of letter pieces. The player drags pieces onto free cells to line up hidden words starting at pinned letters. Clearing all words completes the level.

## Player experience
1. Level opens: topic label, empty found-words panel, board with pieces. Pinned letters show a small number (word length) and their word's color.
2. Player drags a free piece; it lifts above the board and follows the finger.
3. On release over valid free cells it snaps in; otherwise it returns to where it came from. Letters that now continue a word from its pin take the word's colour; letters that no longer do revert to white.
4. When a word is formed from its pin, the letters flash in the word color and fly into the found-words panel; the cells become free.
5. Frozen pieces show ice with a counter; after each cleared word the counter drops; at zero the ice shatters and the letter appears.
6. After the last word, a "Level completed" popup shows a coin reward; Continue loads the next level. Restart reloads the current level.

## Rules
1. Board cells come from `shape`; pieces occupy one to three 4-connected cells.
2. A move is legal when every target cell is inside the board and free (cells the piece itself occupies count as free).
3. Pinned pieces and frozen pieces cannot be dragged.
4. After every legal move, matching runs: for each pinned piece and its word, search for a chain of 4-adjacent occupied, non-frozen cells starting at the pin whose letters spell the word in order. Each step may go up, down, left or right; no cell is reused; pins of other words are not usable. The longest valid prefix chain is reported for highlighting even when the word is incomplete.
5. Matched pieces are removed; cells are freed; the word is added to the found list; coins += 10 per word (placeholder economy).
6. After each cleared word, every frozen piece's counter decreases by 1; at zero the piece thaws.
7. Level completes when all words are found.

## Edge cases
- A block drop where some cells are on holes → rejected.
- Dropping a piece back onto its own cells → accepted, no-op.
- Two words share a pin row (e.g. RED then PINK crossing) → cleared one at a time; matching re-runs after a clear.
- Two different chains spell the same word from one pin → the first found (scan order right, down, left, up) clears; the other letters stay.
- A chain that would need to pass through another word's pin → not a match; the pin is reserved for its own word.
- A single move completing two words → both clear; counters decrement twice.
- Dragging while a clear animation runs → input locked until RESOLVING finishes.
- Finger leaves the canvas (TOUCH_CANCEL) → treated as a drop at the last position.
- Frozen piece positioned in a word line → not a match until thawed; thawing re-runs matching.

## Acceptance criteria
- Given level 1, when N and E are placed right of the pinned O, then "ONE" is added to the panel and the three cells are free.
- Given level 3, when E is dropped left of the pinned P and A below E, then "PEA" clears (L-shaped chain).
- Given level 3, when E is dropped left of the pinned P alone, then E is tinted orange and nothing clears.
- Given level 3, when PEA clears, then the frozen counter goes 1→0, the ice disappears and I can be dragged.
- Given level 4, when RED and BLUE are cleared, then the IN block thaws (2→0) and can be dragged as a unit.
- Given any level, when a piece is dropped with any cell outside the board or on an occupied cell, then it returns to its origin.
- Given the last word clears, then the popup shows and Continue loads the next level id; after the last level it loops to level 1.
- Layout: the board is fully visible and centered at 9:16, 19.5:9 and 4:3.

## Level-data changes
`LevelSchema` fields: `shape`, `pieces[].at`, `cells`, `pin`, `frozen` (implemented).

## UI changes
HUD (topic, level, coins, settings, restart), found-words panel, level-complete popup, drag lift/drop tweens, clear fly animation, ice shatter.

## Open questions
- Coin economy values (placeholder 10 per word).
- Settings popup content (sound toggle only for now).
