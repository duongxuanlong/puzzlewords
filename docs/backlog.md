# Backlog

Updated 2026-10-31. Owner: producer. Status legend: ☐ todo · ◐ in progress · ☑ done.

## Milestone 1 — Athena test submission
- ☑ Project scaffold (Creator 2.4.15, tooling, roles, skills, hooks)
- ☑ Level schema + validator + 4 levels (level_004 is solvable under the sliding rule: K is freed by first moving N and R into the bottom arm; scripted in `tests/systems/GameSession.test.js`. The solver should still confirm it and report the minimum number of slides.)
- ☑ Model: Board (+findPath), Piece, WordMatcher (chain DFS), FreezeSystem; systems: EventBus, GameSession (beginDrag/dragStep/endDrag/animationsDone); `data/Constants` (+ tests, scripted playthroughs of levels 1, 3, 4)
- ☐ Level solver tool (`tools/solve-level.js`) and solvability tests — before view work
- ☐ View: BoardTiles, BoardView, PieceNode, DragController (grid-constrained sliding)
- ☐ UI: Game root, Hud, FoundWordsPanel, LevelCompletePopup, ScreenFlow
- ☐ Animations: lift/drop, word clear fly, ice shatter
- ☐ QA pass on all levels and aspect ratios
- ☐ README.md + README.txt, packaging (see `submit` skill)

## Milestone 2 — Production hardening
- ☐ Save/progression (`SaveStore` + adapter), settings, audio hooks
- ☐ 30-level curve (see `level-balancing`)
- ☐ Performance pass (atlas, pooling, stats)
- ☐ CI workflow (`ci` skill)
- ☐ Android / iOS builds
