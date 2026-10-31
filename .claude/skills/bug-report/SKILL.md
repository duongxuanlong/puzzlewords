---
name: bug-report
description: Load when writing up a defect found in testing or review, or when triaging one. Gives the report template saved under docs/qa/ and the severity scale this project uses.
---

# Bug reports

Reports live in `docs/qa/BUG-<id>.md`, `<id>` is a zero-padded sequence (`BUG-001`). The qa-engineer writes them; the gameplay-engineer or ui-engineer fixes and adds a "Fixed in" line; the code-reviewer confirms the regression test exists. Never fix and report in the same session: the report is the handoff.

## Severity

| Level | Meaning | Examples |
|---|---|---|
| blocker | Cannot progress, data loss, crash | level cannot be completed; save wiped; exception in console on load |
| major | Rule or flow wrong, workaround exists | word clears when it should not; freeze counter skips a step; restart keeps found words |
| minor | Wrong but cosmetic impact on play | piece snaps 2 px off center; coin animation overlaps text |
| cosmetic | Polish only | easing feels abrupt; label color off from reference |

Blockers and majors go to the backlog top; the producer schedules minors and cosmetics per milestone.

## Template

```markdown
# BUG-<id>: <one-line title, what is wrong, not where>

- Severity: blocker | major | minor | cosmetic
- Build: <git short hash or build folder name and date>  Platform: <browser preview / web-mobile build / Android / iOS>, <device or viewport>
- Level: <level id or n/a>
- Area (suspected): model | view | ui | level data | systems | build
- Frequency: always | often (>50%) | sometimes | once
- Reporter: <role>  Date: <YYYY-MM-DD>

## Steps
1. ...
2. ...

## Expected
<what the spec (docs/specs/word-puzzle-core.md) or reference video says should happen>

## Actual
<what happens, including console errors verbatim in a code block>

## Evidence
- Screenshot / recording: docs/qa/evidence/BUG-<id>-1.png
- Console: <paste or path>

## Notes
<anything that narrows it down: works at 9:16 but not 19.5:9; only for 2-cell blocks; etc.>

## Resolution (filled by the fixer)
- Root cause:
- Fixed in: <files>  Test: <tests/... name>
- Verified by: <role, date, build>
```

Rules: one defect per report; steps start from a fresh page load or a named level; expected quotes the spec line or names the video and timestamp; never write "it is broken" without the actual observed behaviour.

## Example

```markdown
# BUG-001: 2-cell vertical block snaps one row too high when dropped near the bottom edge

- Severity: major
- Build: working tree 2026-11-02, browser preview (Chrome 130), viewport 1080x1920
- Level: 4 (COLORS)
- Area (suspected): view (drop snapping for multi-cell pieces)
- Frequency: always
- Reporter: qa-engineer  Date: 2026-11-02

## Steps
1. Load level_004.
2. Drag the OW block from [2,5] so that O is over cell [3,3] and W is over [4,3]; release with the finger about 10 px below the center of [3,3].
3. Observe where the block lands.

## Expected
Block occupies [3,3] and [4,3] (anchor cell is the one under the anchor letter at release). Spec: "multi-cell blocks move as one unit; the drop is valid if every cell is inside the board and empty".

## Actual
Block lands at [2,3] and [3,3]. Occupancy follows the rendered position (a later drop onto [2,3] is refused), so model and view agree but the snap target is wrong. No console error.

## Evidence
- docs/qa/evidence/BUG-001-1.png (before release), BUG-001-2.png (after)

## Notes
Single letters snap correctly at the same spot. Horizontal 2-cell block is unaffected. Suspect the world→grid conversion uses the node's center rather than the anchor cell's center for vertical blocks (node anchor at 0.5 of a 2-cell-tall node is on the boundary between rows).

## Resolution
- Root cause:
- Fixed in:
- Verified by:
```
