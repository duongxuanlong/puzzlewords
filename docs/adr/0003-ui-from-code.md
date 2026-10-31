# ADR-0003: One scene, UI built from code

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** tech-lead

## Context
Cocos Creator scenes and prefabs are large JSON files that merge badly and cannot be reviewed as text. The board is fully data-driven anyway (shape and pieces come from level JSON).

## Decision
`assets/scenes/Main.fire` holds only Canvas (1080x1920, fit width) and Main Camera. A `Game` component on the Canvas builds the HUD, board and popups from code using nodes, `cc.Sprite`, `cc.Label` and `cc.Widget`. Sprite frames are assigned via component properties in the editor or loaded once from `resources`. Layout constants live in `assets/scripts/data/`.

## Consequences
- All UI is diff-able and reviewable; agents can build features without the editor.
- Designers cannot tweak layouts in the editor; a later ADR may move static HUD into a prefab once layouts stabilise.
- Scene files are never hand-edited (hook enforced); the only editor-side step is attaching `Game` once.

## Alternatives considered
- Full editor-authored scene with prefabs: conventional for Cocos teams, but heavy JSON diffs and editor dependency for every change.
