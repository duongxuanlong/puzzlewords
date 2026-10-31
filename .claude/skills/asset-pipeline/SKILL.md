---
name: asset-pipeline
description: Load when adding, replacing or configuring textures, fonts, atlases or audio under assets/, when choosing 9-slice or atlas settings, or when a sprite looks wrong (blurry, seams, wrong size). Covers Cocos Creator 2.4 import settings and this project's naming and layout.
---

# Asset pipeline (Cocos Creator 2.4.15)

Unity analog: a `.meta` file next to each asset holds its import settings, exactly like Unity's `.meta`; the Creator **Properties** panel is the Inspector where you change them. The hard rule from `CLAUDE.md` applies: **never hand-edit `.meta` files**; select the asset in the editor and change settings there. A hook blocks edits anyway.

## Folders

```
assets/resources/textures/common/      Background.png 1080x1920, Block.png 167x184, Block_back.png 165x178, Button.png 181x182
assets/resources/textures/challenge1/  BG_Center / BG_Edge_{Top,Bot,Left,Right} / BG_Corner_{TopLeft,TopRight,BotLeft,BotRight}  (all 215x215)
                             Block_1Cell_Frozen.png 179x191
assets/resources/textures/challenge2/  Block_2Cell_{Horizontal,Vertical}_{white,Frozen}.png
                             Block_3Cell_{LShape,LShapeReversed,LShapeUp,LShapeUpReversed}_{white,Frozen}.png
assets/fonts/                bitmap fonts (.fnt + .png) once added
assets/audio/                sfx/ and music/ (mp3 for web, keep under 200 KB each)
assets/resources/            only things loaded by path at runtime (levels JSON). Everything referenced from code by path must be here.
```

Keep the provided names. New art follows the same pattern: `Block_<cells>Cell_<Shape>_<variant>.png`, `BG_<Part>.png`, `Icon_<Name>.png`, `Btn_<Name>_<state>.png`. PascalCase words, underscores between parts, no spaces.

## Texture import settings (Properties panel → texture)

| Setting | Default to use | When to change |
|---|---|---|
| Type | `sprite` | never for 2D UI |
| Wrap mode | `clamp` | tiling backgrounds only |
| Filter mode | `bilinear` | `point` only for pixel art |
| Premultiply alpha | off | on if you see dark fringes on semi-transparent edges (the ice overlays may need it); then the Sprite's blend stays default |
| Generate mipmaps | off | never for UI (blurs and costs 33% memory) |
| Packable | on | **off for Background.png** so the dynamic atlas never copies it |

These land in the `.meta` as `premultiplyAlpha`, `filterMode`, `packable`, `genMipmaps`. Each texture also has a `sprite-frame` sub-asset (`subMetas`) carrying trim and 9-slice borders.

## Trim

Creator trims transparent pixels by default (`trimType: auto`). For block art the shadow at the bottom is part of the design, so trimming changes the visual center. Set the Sprite component's `trim` off (`sizeMode: RAW`) **or** turn trim off on the sprite frame so a 167x184 block stays 167x184 in the node. Use RAW size mode for all block, ice and tile sprites; use CUSTOM only for stretched panels.

## 9-slice

Use 9-slice (Sprite `type: SLICED`) for anything stretched: panels (found-words box, popup background), buttons (`Button.png`), the 2-cell and 3-cell block bodies if we ever need non-square cells. Set borders in the **Sprite Editor** (select the sprite frame → Edit) which writes `borderTop/Bottom/Left/Right` into the sub-meta.

Do **not** 9-slice:
- `Block.png` and the ice overlays: they are drawn at native size, one per cell.
- The nine board tiles: they are placed per cell, not stretched.

## Board background tiles

Each playable cell in the level `shape` gets exactly one 215x215 tile chosen by which 4-neighbours are also cells. Scale the node to the cell size (cell size in design pixels is `boardWidth / cols`, with 215 px as the 1:1 reference).

| Neighbours present (up, right, down, left) | Tile |
|---|---|
| all four | `BG_Center` |
| missing up only | `BG_Edge_Top` |
| missing down only | `BG_Edge_Bot` |
| missing left only | `BG_Edge_Left` |
| missing right only | `BG_Edge_Right` |
| missing up and left | `BG_Corner_TopLeft` |
| missing up and right | `BG_Corner_TopRight` |
| missing down and left | `BG_Corner_BotLeft` |
| missing down and right | `BG_Corner_BotRight` |
| three or more missing, or opposite pair missing | nearest corner or edge by priority up, left, down, right; there is no art for a 1-wide strip, so avoid 1-cell tails in level shapes |

Concave corners (the inside of the plus in level_004) have no dedicated art; two adjacent edge tiles meet with a sharp inner corner. That is the accepted look. If art adds `BG_Inner_*` pieces later, extend the table.

## Auto atlas

Create one auto atlas per folder that is always used together:
- `assets/resources/textures/blocks.pac` covering `common/Block*.png`, `challenge1/Block_1Cell_Frozen.png`, `challenge2/*.png` and the nine `challenge1/BG_*.png`. Max size 2048, padding 2, allow rotation off (rotated frames make 9-slice borders confusing), power-of-two on.
- `assets/resources/textures/ui.pac` for buttons, icons and panel pieces.
- `Background.png` stays loose.

Create via Assets panel → Create → Auto Atlas, then drag textures under that folder; the atlas is built only at **build** time, preview uses loose textures plus the dynamic atlas. Verify batching on a real build, not in preview (see `cocos2x-performance`).

## Resolution and scale

Design resolution is 1080x1920, fit width (`settings/project.json`, Canvas in `Main.fire`). Art is authored at 1x for 1080 px width. On a 1440 px wide phone the engine upscales by 1.33, which bilinear filtering handles for this art style. Do not add @2x variants until a visual QA pass asks for them.

Safe area: on notched phones use `cc.sys.getSafeAreaRect()` and push the top HUD down by its offset. Never place interactive UI in the top 90 px or bottom 60 px of the design canvas.

## Fonts

System fonts differ per device (and the Android default lacks the weight the mockups show). Ship a bitmap font for the letter tiles (uppercase A–Z, digits 0–9, 64 px) and one for HUD numbers. Generate with a BMFont tool into `assets/fonts/`, texture inside `ui.pac`. Label `cacheMode` is irrelevant for bitmap fonts; they batch natively.

## Audio

Web builds need mp3 (Safari) — keep ogg out. Effects under 1 s, 44.1 kHz mono. Load via `cc.resources.load('audio/sfx/clear', cc.AudioClip, cb)` only if placed under `assets/resources/audio`; otherwise reference from a component property.

## Checklist when adding an asset

1. Drop the file in the right folder with the naming pattern; let Creator generate the `.meta`.
2. Set type, trim, packable and premultiply in Properties; set 9-slice borders if stretched.
3. Add to the matching `.pac` folder.
4. Preview once; check for seams between board tiles at non-integer scale (add `padding 2` in the atlas or round the cell size to an integer).
5. Note the asset in the PR description with its purpose; `git add` is the user's, not yours.
