# ADR-0004: Editor-tunable style values in a data prefab

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** tech-lead

## Context
ADR-0003 builds all UI from code, with tuning numbers in `assets/scripts/data/`. Some visual values (the word-length badge size, offset and colour on pinned letters) are easier to tune with sliders and a colour picker than by editing constants and reloading. Cocos Creator 2.4 has no ScriptableObject-style data asset, but a prefab whose root node carries a data-only component behaves like one.

## Decision
`assets/scripts/view/PieceStyle.js` is a component with only `properties` (no logic). `assets/resources/prefabs/PieceStyle.prefab` holds one instance; designers open it in Creator and edit the Properties panel. `Game` loads it once after the textures (`cc.resources.load('prefabs/PieceStyle', cc.Prefab)`), reads the component straight off `prefab.data` without instantiating, and passes it to `BoardView` → `PieceNode`. Property defaults mirror `Layout`/`Palette`, and `Game` falls back to a fresh component if the prefab is missing, so the game runs without it.

The prefab was first generated as JSON (Creator's own serialized form) so no manual editor step was needed; its `.meta` came from a headless build. From now on it is edited in the editor only.

## Consequences
- Designers get Inspector editing for the values on the component; adding a value is one `properties` entry.
- Values in the prefab win over the constants in `data/`; the constants remain the defaults and the engine-free truth for tests.
- Prefab diffs are JSON and small for a data-only node. Keep logic out of `PieceStyle` so the model stays engine-free.
- More style groups (HUD, popup) can follow the same pattern, one prefab per concern.

## Alternatives considered
- Inspector properties on `Game` in `Main.fire`: would put tuning data in the scene, which is editor-owned and never hand-edited.
- A custom `cc.Asset` subclass: needs an editor extension with its own importer in 2.4; too heavy for a few numbers.
- JSON under `resources/`: already used for levels, but gives text editing, not sliders or a colour picker.
