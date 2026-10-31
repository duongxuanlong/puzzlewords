---
name: cocos2x-performance
description: Load before writing or reviewing any rendering, animation, pooling or per-frame code in assets/scripts/view or assets/scripts/ui, and when draw calls, frame time or memory on low-end Android are in question. Cocos Creator 2.4.15 specifics, verified against the installed engine.
---

# Cocos Creator 2.4 performance

Target: 60 fps on a 2018 low-end Android phone (2 GB RAM, Mali-T830 class GPU) with the full COLORS level (level_004: 20 cells, 14 pieces, HUD, found-words panel) on screen. Budget: **under 20 draw calls in play, under 60 MB texture memory.**

Unity analog in one line: Cocos batches sprites like Unity's UI Canvas batches Graphics — same texture + same material + same blend state, in hierarchy order, broken by anything in between that differs.

## 1. Draw-call batching rules

The renderer walks nodes in render order and merges consecutive quads into one call when all of these match:
- same texture (sprite frames from the same atlas texture count as the same),
- same material / effect (default `builtin-2d-sprite` for Sprite, `builtin-2d-label`... but Label uses its own texture, see below),
- same `srcBlendFactor` / `dstBlendFactor` (cc.RenderComponent).

Anything that breaks the chain starts a new call: a Label between two Sprites, a Mask, a Graphics node, a sprite from a different texture, a different blend mode.

Rules for this project:
- Put every block, ice overlay, board tile and HUD icon into **one auto atlas** (`assets/resources/textures/*.pac`, see `asset-pipeline`). Then the whole board is one call as long as no Label interleaves.
- **Group render order.** Draw all board tiles first (one child container), then all piece sprites (second container), then all letter labels (third container), then counters. A piece node that holds `Sprite + Label` as children interleaves S L S L S L and gives one call per piece. Instead keep labels in a sibling layer positioned over their pieces, or accept the cost only while a piece is being dragged (it is reparented to a top layer anyway).
- Labels: a `cc.Label` with a system/TTF font renders to its own canvas texture per label → one draw call each. Options:
  - `cacheMode = cc.Label.CacheMode.CHAR` (enum values NONE=0, BITMAP=1, CHAR=2 in `CCLabel.js`): glyphs are packed into a shared char atlas; many labels of the same font batch together. Best for letter tiles (single uppercase characters, limited set).
  - `BITMAP`: the whole label is packed into the dynamic atlas; fine for static text that rarely changes (topic, "LEVEL 4"), bad for the coin counter that changes often (each change repacks).
  - A bitmap font (`.fnt`) in the same atlas is the zero-cost option; worth it once the UI stabilizes.
- Avoid `cc.Mask` on the found-words panel; clip by sizing instead. A Mask costs 2 extra calls (stencil begin/end) and breaks batching on both sides.

## 2. Texture memory

- Textures are stored uncompressed in GPU memory on WebGL: width × height × 4 bytes. The 1080x1920 background alone is 8.3 MB. Load it once, never duplicate.
- Prefer one 2048x2048 atlas (16 MB) over many loose PNGs; the dynamic atlas (below) will otherwise copy loose textures into its own 2048 pages and double the memory.
- Release level-specific textures when switching scenes? We have one scene, so no; but call `cc.assetManager.releaseAsset` if you add per-theme backgrounds later.
- Low-end Android browsers kill the tab above roughly 150 MB total. Keep an eye on `cc.debug.setDisplayStats(true)` → the stats panel shows draw calls, frame time, and (in debug builds) texture memory.

## 3. Dynamic atlas caveats

`cc.dynamicAtlasManager` (in `core/renderer/utils/dynamic-atlas/manager.js`) packs small textures at runtime into 2048x2048 pages (defaults: `textureSize` 2048, `maxFrameSize` 512, `maxAtlasCount` 5). It is on by default in preview/web, off on native by default.
- Textures larger than `maxFrameSize` (512 px) are never packed: `Block_2Cell_Vertical_white.png` is 182x403 → packed; `Background.png` 1080x1920 → not packed, and it must not be, so do not raise `maxFrameSize`.
- It only packs textures with `packable: true` in their meta. Leave the background `packable: false` so it is not copied into a page.
- Packing happens on first render, which causes a hitch; warm up by rendering one instance of every piece type behind the level-start popup.
- It helps batching in preview, but a build with a proper auto atlas does not need it; keep behaviour identical by testing with `cc.dynamicAtlasManager.enabled = false` once before a release.

## 4. Pooling

Pieces, letter labels, found-word tiles and particle bursts are created and destroyed every level. Use `cc.NodePool` (`engine/extensions/ccpool/CCNodePool.js`):

```js
// view/PiecePool.js
const pool = new cc.NodePool('PieceView'); // component with unuse()/reuse() hooks
function obtain(prefabOrFactory) {
  return pool.size() > 0 ? pool.get() : prefabOrFactory();
}
function recycle(node) { pool.put(node); } // calls PieceView.unuse()
```
- `put` removes the node from its parent and calls `unuse` on the handler component; `get` calls `reuse`. Reset tweens (`cc.Tween.stopAllByTarget(node)`), scale, opacity, zIndex and labels inside `unuse`.
- Pre-warm with the maximum piece count across shipped levels (14 today) at game start.
- `node.destroy()` is deferred to end of frame; never read a destroyed node in the same frame.

## 5. Per-frame work

- No `update(dt)` on piece or UI components. Drag follows the touch in `TOUCH_MOVE` only; everything else is event-driven.
- Never build strings in a hot path (`'LEVEL ' + n` once per level, not per frame). Setting `label.string` to the same value is a no-op, but a different value re-renders the label canvas.
- Use `cc.tween` for all animation. Use `this.schedule(cb, interval)` / `scheduleOnce` (on cc.Component) only for timers; avoid `setTimeout`, which ignores `cc.director.pause()`.
- Stop tweens before recycling: `cc.Tween.stopAllByTarget(node)`.
- `node.getChildByName` and `getComponent` in loops: cache the references in `onLoad`.

## 6. Touch handling

- Register touch listeners on the piece node, not on every cell. The board container handles the drop (one listener). Set `node._touchListener.swallowTouches` only if you need to stop propagation; default is swallowing for registered nodes.
- One active drag at a time: ignore `TOUCH_START` while a drag is in progress (multi-touch is common on real devices).

## 7. Startup and loading

- Levels are small JSON; preload the whole `resources/levels` folder with `cc.resources.loadDir('levels', cc.JsonAsset, cb)` at boot rather than one `load` per level with a spinner.
- Put the first scene's assets in the main bundle (default). No remote bundles until there is a CDN.

## 8. Measuring

1. `cc.debug.setDisplayStats(true)` in a debug build (or Project Settings → Preview → show FPS). Watch **DrawCall** and **Frame time** while dragging a 3-cell block over the full board.
2. Chrome DevTools Performance tab on the web-mobile build with CPU 4x throttle; the long task should be the first-frame atlas pack only.
3. For Android: `chrome://inspect` on the device's Chrome, or Android Studio profiler for the native build.

Record results in `docs/qa/perf-<date>.md`: device, build, draw calls idle / dragging, frame time p95, texture memory.
