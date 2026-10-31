# Backlog

Updated 2026-10-31. Owner: producer. Status legend: ☐ todo · ◐ in progress · ☑ done.

## Milestone 1 — Athena test submission
- ☑ Project scaffold (Creator 2.4.15, tooling, roles, skills, hooks)
- ☑ Level schema + validator + 4 levels
- ☐ Model: Board, Piece, WordMatcher, FreezeSystem, GameSession (+ tests)
- ☐ View: BoardTiles, BoardView, PieceNode, DragController
- ☐ UI: Game root, Hud, FoundWordsPanel, LevelCompletePopup, ScreenFlow
- ☐ Animations: lift/drop, word clear fly, ice shatter
- ☐ Level solver tool (`tools/solve-level.js`) and solvability tests
- ☐ QA pass on all levels and aspect ratios
- ☐ README.md + README.txt, packaging (see `submit` skill)

## Milestone 2 — Production hardening
- ☐ Save/progression (`SaveStore` + adapter), settings, audio hooks
- ☐ 30-level curve (see `level-balancing`)
- ☐ Performance pass (atlas, pooling, stats)
- ☐ CI workflow (`ci` skill)
- ☐ Android / iOS builds
