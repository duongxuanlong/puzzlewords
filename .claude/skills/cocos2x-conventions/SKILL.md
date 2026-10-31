---
name: cocos2x-conventions
description: Cocos Creator 2.4.15 API, lifecycle and project conventions for this repo. Load before writing or reviewing any code under assets/scripts/view or assets/scripts/ui, or when a Cocos API question comes up. Web docs mostly cover 3.x, which is a different API.
---

# Cocos Creator 2.4.15 conventions

Verified against the engine installed at
`/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/Resources/engine/cocos2d/`.
When unsure about an API, grep that folder (e.g. `grep -rn "convertToNodeSpaceAR" .../cocos2d/core/CCNode.js`)
before trusting memory or web results. 3.x docs (`import { Node } from 'cc'`, `@ccclass`) do **not** apply.

## Unity → Cocos 2.x mental map
| Unity | Cocos Creator 2.4 |
|---|---|
| GameObject + Transform | `cc.Node` (position, scale, angle, opacity, color, zIndex) |
| MonoBehaviour | `cc.Component` created with `cc.Class({ extends: cc.Component })` |
| `[SerializeField]` | `properties: { speed: 10, sprite: { default: null, type: cc.Sprite } }` |
| Awake / Start / Update / OnDestroy | `onLoad` / `start` / `update(dt)` / `onDestroy`; also `onEnable`/`onDisable` |
| Prefab / Instantiate | `cc.Prefab` / `cc.instantiate(prefabOrNode)` |
| Resources.Load | `cc.resources.load('levels/level_001', cc.JsonAsset, (err, asset) => asset.json)` |
| SceneManager.LoadScene | `cc.director.loadScene('Main')` |
| Canvas + RectTransform anchors | `cc.Canvas` on the root + `cc.Widget` (left/right/top/bottom, `alignMode`) |
| DOTween | `cc.tween(node).to(0.2, { position: cc.v3(x, y) }, { easing: 'quadOut' }).start()` |
| UnityEvent / C# event | `cc.EventTarget` (`on`, `off`, `emit`) or `node.on(...)` |
| Object pooling | `cc.NodePool` (`get()`, `put(node)`, `size()`) |
| Library/, Temp/ | `library/`, `temp/`, `local/` (generated, ignored) |
| .meta GUID files | `.meta` files with `uuid`; same rule: commit them, never hand-edit |

## Scripts and modules
- Every `.js` under `assets/` is a script asset. Files with `cc.Class({ extends: cc.Component })` become components.
  Plain modules export with `module.exports`. Node and Creator both use CommonJS.
- **Filenames are unique project-wide and required by bare name**: `const Board = require('Board');`.
  Creator's module system indexes scripts by filename. `npm test` sets `NODE_PATH` so the same line works in Node.
- Creator compiles scripts with Babel, so `const`, classes, arrow functions, template strings and destructuring are fine.
  Avoid `import`/`export` syntax in `.js` (keep CommonJS so Node tests need no transpile).
- Engine-free layers (`model/`, `data/`, `systems/`) must not reference `cc`, `window` or `document`. eslint enforces it.

## Component skeleton
```js
const Board = require('Board');

cc.Class({
  extends: cc.Component,

  properties: {
    cellSize: 180,                                  // number → shown in the Properties panel
    blockFrame: { default: null, type: cc.SpriteFrame },
    root: { default: null, type: cc.Node },
  },

  onLoad() {        // like Awake: wire references, register events
    this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
  },
  start() {},       // like Start: other components' onLoad have run
  update(_dt) {},   // avoid work here; event-driven code preferred
  onDestroy() {
    this.node.off(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
  },
});
```
Lifecycle order per node: `onLoad` → `onEnable` → `start` (first frame) → `update`/`lateUpdate` → `onDisable` → `onDestroy`.
`onLoad` of children can run before the parent's `start`; never rely on another component's `start` having run inside your `onLoad`.

## Nodes, coordinates and ordering
- `node.position` / `node.x`, `node.y` are relative to the parent's anchor. Anchor default is (0.5, 0.5).
- `node.setContentSize(w, h)`; `node.width`/`height`. `node.angle` in degrees (counter-clockwise), `node.scale`.
- Touch and world coordinates: `event.getLocation()` is **world space**; convert with `parentNode.convertToNodeSpaceAR(worldPoint)` to get a local position for a child, and back with `convertToWorldSpaceAR`.
- Grid mapping for this game lives in one place (`BoardView`): `cellToLocal(row, col)` and `localToCell(pos)`; everything else goes through them.
- Draw order among siblings is `node.zIndex` (higher draws later/on top); default 0. Lift a dragged piece by raising `zIndex`, restore on drop.
- `node.getBoundingBox()` is in parent space; `getBoundingBoxToWorld()` for world.

## Touch input
```js
this.node.on(cc.Node.EventType.TOUCH_START, (e) => { /* e.getLocation() world */ }, this);
this.node.on(cc.Node.EventType.TOUCH_MOVE,  (e) => { /* e.getDelta() */ }, this);
this.node.on(cc.Node.EventType.TOUCH_END,    (e) => {}, this);   // finger up inside node
this.node.on(cc.Node.EventType.TOUCH_CANCEL, (e) => {}, this);   // finger up outside / interrupted — ALWAYS handle like END
```
- Touch hit-testing uses the node's content size; a node of size 0 never receives touches.
- A node swallows touches by default; set `e.stopPropagation()` only when needed. Multi-touch: track `e.getID()` and ignore a second finger while dragging.
- Register in `onLoad`/`onEnable`, unregister in `onDisable`/`onDestroy` with the same target `this`.

## Rendering components
- `cc.Sprite`: `spriteFrame`, `type` (`cc.Sprite.Type.SIMPLE | SLICED | TILED | FILLED`), `sizeMode` (`CUSTOM` to control size from code). 9-slice borders are set on the SpriteFrame (in the editor's Sprite Editor) and used with `SLICED`.
- `cc.Label`: `string`, `fontSize`, `lineHeight`, `cacheMode` (`cc.Label.CacheMode.NONE | BITMAP | CHAR`). Labels break sprite batching; use `CHAR` for frequently changing short text, `BITMAP` for static text.
- `node.color = cc.color(r, g, b)` tints sprites and labels; `node.opacity` 0–255 (cascades to children).
- Colors per word come from `assets/scripts/data/Palette.js`; never hard-code hex in components.

## Tween and timing
```js
cc.tween(node)
  .to(0.15, { scale: 1.1 }, { easing: 'quadOut' })
  .to(0.15, { scale: 1.0 })
  .call(() => this.onSettled())
  .start();
```
- Easing names: `'linear' | 'quadIn' | 'quadOut' | 'quadInOut' | 'cubicOut' | 'backOut' | 'bounceOut' | ...` (see `engine/cocos2d/actions/tween.js`).
- Stop running tweens before starting conflicting ones: `cc.Tween.stopAllByTarget(node)`.
- `this.scheduleOnce(fn, delay)` and `this.schedule(fn, interval)` on components (unscheduled automatically on destroy).

## Assets and loading
- Only files under `assets/resources/` are loadable by path at runtime (like Unity's Resources). Path has no extension: `cc.resources.load('levels/level_001', cc.JsonAsset, cb)`.
- Load many: `cc.resources.loadDir('levels', cc.JsonAsset, (err, assets) => ...)`.
- Prefer assigning SpriteFrames through component `properties` in the editor or loading once at startup and caching in a plain object; do not load inside drag handlers.
- Creator writes `.meta` next to every asset the first time the project opens. Commit them. Never hand-edit; the `guard-paths` hook blocks it.

## Scene and startup
- One scene `assets/scenes/Main.fire` with Canvas (1080x1920, fit width) + Main Camera. The Canvas gets a `Game` component (added in the editor once) which builds the UI tree from code.
- `cc.view` / `cc.winSize` give the visible size; HUD elements use `cc.Widget` with `alignMode: cc.Widget.AlignMode.ON_WINDOW_RESIZE`.
- Platform: `cc.sys.isMobile`, `cc.sys.isNative`, `cc.sys.localStorage` (string key/value, wrap in try/catch).

## Pitfalls seen in 2.4 projects
- `this` lost in callbacks: pass `this` as the third argument to `node.on`, or use arrow functions.
- Position set before the parent is laid out → use `cc.Widget.updateAlignment()` or set positions in `start`.
- Forgetting `TOUCH_CANCEL` leaves pieces stuck mid-drag when the finger leaves the canvas.
- Mutating `node.position` in place (`node.position.x = ...`) does nothing; assign a new vector or use `node.x`.
- A label's size updates one frame later; read sizes after `label._forceUpdateRenderData()` or avoid depending on them.
- Debug stats overlay: `cc.debug.setDisplayStats(true)` (only in debug builds).
