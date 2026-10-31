---
name: feature-spec
description: Load when turning a feature idea or mechanic into a spec under docs/specs — the template with QA-testable acceptance criteria, level-data impact, and a filled example for the Freeze mechanic.
---

# Feature spec

Specs live in `docs/specs/<feature-kebab>.md`. The producer role writes them, the tech-lead turns
them into a plan, the gameplay-engineer implements against the acceptance criteria, QA tests the
criteria verbatim. `docs/specs/word-puzzle-core.md` is the core rules spec that everything else
extends. The user commits.

## Template

```markdown
# <Feature name>

- Status: Draft | Approved | Implemented | Dropped
- Owner: producer   Tech review: tech-lead   Date: YYYY-MM-DD

## Summary
One paragraph: what the player gets and why we build it.

## Player experience
What the player sees, touches and hears, in order. Reference demo video timestamps or mockups.

## Rules
Numbered, unambiguous statements a programmer can implement and a tester can check.

## Edge cases
Each as "When X, then Y." Cover: level load, mid-drag, simultaneous clears, restart, level
complete, invalid data.

## Acceptance criteria
Given / When / Then, each independently testable by QA in the browser preview or a build.

## Level-data changes
New or changed fields in LevelSchema (assets/scripts/model/LevelSchema.js), validation rules,
migration for existing levels under assets/resources/levels.

## UI changes
HUD, popups, textures needed (and whether they exist in assets/textures), animation notes.

## Analytics events (optional)
event name — when fired — properties.

## Open questions
For the tech-lead or the user, each with a proposed default.
```

Keep rules and acceptance criteria in sync: every rule has at least one criterion.

## Filled example: Freeze mechanic

```markdown
# Freeze mechanic

- Status: Approved
- Owner: producer   Tech review: tech-lead   Date: 2026-10-31

## Summary
Some letters start encased in ice with a counter. Each word the player clears chips one point off
every counter; at zero the ice shatters and the letter becomes a normal draggable letter. It forces
a clear order and gives mid-level reveals (Challenge 1 of the Athena brief).

## Player experience
Frozen tile shows the ice texture (textures/challenge1/Block_1Cell_Frozen.png, block variants in
textures/challenge2) with the counter centred; the letter is hidden. Dragging it does nothing (a
small shake). After a word clears, counters tick down with a short scale pulse; at zero the ice
plays a shatter and the letter fades in. See Challenge1.mov 0:08–0:13.

## Rules
1. `frozen: N` (integer ≥ 1) on a piece makes it frozen with counter N.
2. Frozen pieces cannot be dragged and are not drop targets.
3. Frozen cells are excluded from word matching.
4. When a word clears, every frozen piece's counter decreases by 1, once per cleared word.
5. At 0 the piece becomes a normal piece (letter visible, draggable, matchable) in place.
6. Pinned pieces cannot be frozen. Linked blocks may be frozen as a whole; one counter per block.

## Edge cases
- When two words clear from one drop, then counters decrease by 2.
- When a level restarts, then counters reset to their level-data values.
- When the ice shatters and the revealed letter already completes a word in place, then that word
  clears after the thaw animation, and counters decrease again.
- When a frozen block occupies a cell a word needs, then the word cannot be formed until the thaw.

## Acceptance criteria
- Given level 3 (PLANT), When the level loads, Then the tile at row 2 col 1 shows "1" and no letter.
- Given level 3, When I drag the frozen tile, Then it does not move.
- Given level 3, When I clear PEA, Then the tile shows the letter I and can be dragged.
- Given level 4 (COLORS), When I clear RED, Then the IN block shows "1"; When I clear BLUE, Then it
  thaws.
- Given any level, When I press Restart, Then every counter returns to its initial value.

## Level-data changes
`frozen` already exists in LevelSchema (integer ≥ 1; rejected on pinned pieces). No migration.

## UI changes
Counter label on the ice; pulse tween on decrement; shatter on thaw (particle optional). Needs no
new textures.

## Analytics events (optional)
`freeze_thawed` — on thaw — { level_id, piece_letters, clears_taken }.

## Open questions
- Should the counter be visible on linked frozen blocks per cell or once per block? Default: once,
  centred on the block.
```
