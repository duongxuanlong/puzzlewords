# ADR-0007: Scene-authored UI parts with a code fallback

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** tech-lead

## Context
ADR-0006 put the screen geometry into the scene as slot nodes, but each slot was still empty in the editor: the HUD buttons, chips, panel, popup and background were built from code at runtime. Laying out the screen meant imagining what would land in each rectangle. The user wants the background, the buttons and the rest visible and editable in `Main.fire`, and the popup as a prefab, since it is shown on demand rather than placed once.

## Decision
The UI components become scene-authored with a code fallback, one pattern for all of them:

- Every part a component drives is a referenced property (`cc.Node` or `cc.Label`): on `Hud` the two buttons, the chips and their labels; on `FoundWordsPanel` the background, topic label and rows container; on `Popup` the overlay, panel, labels and button; on `Game` the background node.
- Each component runs in edit mode and has `populate(frames)`: it creates every unassigned part at the `data/Layout` defaults as an ordinary saved node and assigns the reference. Adding the component in Creator is therefore the setup step; afterwards the scene owns positions, sizes and text styles.
- Textures are `cc.SpriteFrame` properties (`buttonFrame`, `chipFrame`, `panelFrame`, `overlayFrame`, `backgroundFrame`), assigned by hand in the Properties panel by dragging the sprite frame from `resources/textures/common`; a `notify` re-applies them live. Left empty, the runtime fills them from the frames `Game` loads with `loadDir`, so an unassigned scene still renders. (An editor-side auto-fill through a generated uuid table was tried and removed the same day: a table of ids nobody can read or edit is worse than five drags done once.)
- `ScreenLayout` finishes the job in the editor: after creating the slots it puts `Hud` and `FoundWordsPanel` on theirs. Adding that one component, or reopening a scene that has it, creates the whole screen; the texture fields are then filled by hand. The popup slot stays empty until play.
- 9-slice insets are set on the shared frame in place (`UiKit.slice`), no longer on a runtime copy, so scene-referenced frames and loaded frames are the same asset. SIMPLE sprites ignore insets, so the pieces are unaffected.
- `Game` adopts a component already on a slot and adds one only when missing, for `BoardView`, `DragController`, `Hud` and `FoundWordsPanel`.
- Popups are instantiated at runtime, one prefab and one component per kind: `PopupLevelComplete` and `PopupSettings` extend `Popup` (overlay, panel, title, body, button; `show(opts)` maps the kind's options, `hide()` destroys the node). `Game` preloads `resources/prefabs/<Kind>.prefab` at start and, when a popup is needed, instantiates it into the `popup` slot, so nothing modal lives in the scene and each appearance is a fresh instance; a missing prefab falls back to a code-built popup of that kind. The prefabs are generated once by `tools/gen-popup-prefab.js` with their art and texts wired (sprite-frame uuids from the texture `.meta` files, component uuids from the script `.meta` files, properties declared with `notify` stored under `_N$<name>`) and then edited in Creator; a new kind is one subclass, one entry in the generator and one name in `Game`'s list.

## Consequences
- Open `Main.fire` and the real screen is there: background, buttons, chips, panel, with the slot outlines of ADR-0006 around them. Edits are editor edits.
- The runtime path with an empty scene is unchanged in behaviour: `populate(frames)` builds exactly what the old `init(frames)` built.
- Text content set in the editor (placeholder labels) is overwritten at runtime by `setLevel`, `setCoins`, `setTopic` and `show`; only style is authored.
- Word chips in the panel and board pieces stay runtime-only: they depend on the level.
- A prefab generator exists again, for the popups only, and only for structure; ADR-0006 dropped the slot prefab because it duplicated the scene, which does not apply to on-demand dialogs.

## Alternatives considered
- Prefabs for every part: the user asked for the screen in the scene; prefabs add an Apply/Revert layer for parts that exist exactly once.
- Keeping code-built UI and drawing editor previews with `cc.Graphics`: shows boxes, not art, and duplicates every layout number.
- Setting 9-slice borders in the texture import settings: the right long-term place, but `.meta` files are editor-owned; `UiKit.slice` keeps working either way.
