# ADR-0005: Layout values in a scene config component

- **Status:** Accepted (scope narrowed by ADR-0006: geometry moved to ScreenLayout slot nodes in the scene; the component keeps non-geometric tunables)
- **Date:** 2026-11-01
- **Deciders:** tech-lead

## Context
ADR-0003 builds the UI from code and ADR-0004 moved the piece look into a prefab. The screen layout (board size limits and position, found-words panel size and position, HUD height) still lived only in `assets/scripts/data/Layout.js`: changing one value meant editing code and reloading, and there was no way to tune it in Creator. The user, coming from Unity, expects a MonoBehaviour with serialized fields or a ScriptableObject for this.

## Decision
`assets/scripts/ui/GameConfig.js` is a data-only component added to the Canvas node in `Main.fire` through the editor (Add Component → Custom Component → GameConfig). Its properties are the per-screen values a designer tunes that are not geometry (the board cell cap, the empty-cell square opacity; sizes and positions are ScreenLayout slot nodes in the scene since ADR-0006); each one defaults to the matching `Layout` constant. `Game.onLoad` calls `GameConfig.resolve(canvas)`, which returns the component when the scene carries one and a plain object with the same keys otherwise, and passes it to `BoardView`, `FoundWordsPanel` and `Hud`. No other code reaches for the component, and `view/` never requires it (BoardView falls back to `Layout` on its own), so the layering of ADR-0001 holds.

`Layout.js` remains the engine-free truth for tests and for values with no reader in the editor (animation distances, font fractions, 9-slice insets). A value moves from `Layout` into `GameConfig` only when someone needs to tune it in the editor; the constant then stays as the default.

## Consequences
- The scene still works with no `GameConfig` attached (defaults apply); `Game` itself is attached in the editor (ADR-0003 as amended).
- Values live in two places by design: the default in `Layout.js`, the override in the scene. The scene wins at runtime.
- `PieceStyle` templates are still authored at `LAYOUT.MAX_CELL` (180 px); raising `boardMaxCell` above that scales the labels up proportionally, it does not change the reference size.
- More tunables are one property each on `GameConfig`, read through the object the owner already holds.

## Alternatives considered
- Inspector properties on `Game` itself: mixes tuning data with the composition root and makes `Game` harder to replace or test.
- A config prefab under `resources/`, as ADR-0004 does for pieces: right for per-asset looks, but screen layout belongs to the scene that shows it, and a per-scene component is what Unity users look for first.
- Loading a JSON config: text editing again, no sliders or min values in the editor.
