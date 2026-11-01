# Backlog

Updated 2026-10-31. Owner: producer. Status legend: ☐ todo · ◐ in progress · ☑ done.

## Milestone 1 — Athena test submission
- ☑ Project scaffold (Creator 2.4.15, tooling, roles, skills, hooks)
- ☑ Level schema + validator + 4 levels (level_004 is solvable under the sliding rule: K is freed by first moving N and R into the bottom arm; scripted in `tests/systems/GameSession.test.js`. The solver should still confirm it and report the minimum number of slides.)
- ☑ Model: Board (+findPath), Piece, WordMatcher (chain DFS), FreezeSystem; systems: EventBus, GameSession (beginDrag/dragStep/endDrag/animationsDone); `data/Constants` (+ tests, scripted playthroughs of levels 1, 3, 4)
- ☑ Level solver (`model/Solver.js`, `tools/solve-level.js`), solvability gate in `validate:levels`, replay test through GameSession. Exact minimums for levels 1–3; level 4 is ≤ 9 moves / ≤ 23 slides (upper bounds; exact search does not fit its budget on that board).
- ☐ Level-design pass with the solver (level-designer): solutions are shorter than the intended walkthroughs. Level 3 clears PEA as P↓E→A instead of the demo's L; level 4 clears BLUE on move 4 with the E already in row 3. Decide whether to tighten them.
- ☑ View: BoardTiles, BoardView, PieceNode, DragController (grid-constrained sliding via `Board.findPath`, blocked bump, prefix tint, clear fly, ice tick/thaw). Textures moved to `assets/resources/textures` so code can load them; `ui/Boot.js` attached `Game` to the Canvas at launch (removed 2026-11-01: `Game` is now attached in the editor, ADR-0003 amendment). Verified in the web build on level 1 (ONE, TWO clear; level completes).
- ☑ UI: `Game` root (frames, level loading, fit policy, flow: restart / level complete → popup → next level), `Hud` (settings + restart buttons, level badge, coin counter), `FoundWordsPanel` (topic + tinted letter chips, fly target for clears), `Popup` (modal on the generated dark Panel texture, used for level complete and the settings stub), `UiKit` helpers. Screen flow lives in `Game`; no separate ScreenFlow module.
- ☑ Animations: lift/drop, slide, blocked bump, prefix tint, word clear fly, chip pop, ice tick/thaw, popup (in PieceNode / FoundWordsPanel / Popup; `data/Timing.js`)
- ☑ QA pass on all levels and aspect ratios: `docs/qa/playtest-2026-10-31.md` (all functional checks pass; persistence is M2). Polish from the pass: per-level `colors`, palette order matching the demo, HUD badge contrast, BITMAP labels (draw calls 26 → 2).
- ☐ README.md + README.txt, packaging (see `submit` skill)

## Milestone 2 — Production hardening
- ☐ Save/progression (`SaveStore` + adapter), settings, audio hooks
- ☐ 30-level curve (see `level-balancing`)
- ☐ Performance pass (atlas, pooling, stats)
- ☐ CI workflow (`ci` skill)
- ☐ Android / iOS builds
