---
name: game-systems
description: Load before adding or changing anything in assets/scripts/systems (save data, progression, coins, settings, audio hooks, localization, the event bus) so new features plug into the existing engine-free seams instead of reaching for cc directly.
---

# Game systems layer (`assets/scripts/systems/`)

`systems/` is engine-free like `model/` (eslint forbids `cc`, `window`, `document` there; `npm test` runs it in Node). Anything that must touch the engine or the platform does so through a tiny adapter object injected at boot from `assets/scripts/ui/Game.js`, the composition root on the Canvas (the only place that knows both worlds). Unity analog: `systems/` is your plain C# services assembly; the adapters are the `MonoBehaviour` bridges.

Modules are required by bare name (`require('EventBus')`), filenames unique project-wide.

## Event bus

One process-wide bus, created in `Game.onLoad`, passed to everything else. Keep it tiny and dependency-free:

```js
// systems/EventBus.js
class EventBus {
  constructor() { this._handlers = new Map(); }
  on(event, fn, ctx) { (this._handlers.get(event) || this._handlers.set(event, []).get(event)).push({ fn, ctx }); return () => this.off(event, fn, ctx); }
  off(event, fn, ctx) { const list = this._handlers.get(event); if (list) { this._handlers.set(event, list.filter((h) => h.fn !== fn || h.ctx !== ctx)); } }
  emit(event, payload) { (this._handlers.get(event) || []).slice().forEach((h) => h.fn.call(h.ctx, payload)); }
}
module.exports = EventBus;
```

Event names are constants in `data/Events.js`, past tense, noun first: `piece:moved`, `word:cleared`, `freeze:thawed`, `level:completed`, `coins:changed`, `settings:changed`. Payloads are plain objects, never model instances the view could mutate.

View and UI components subscribe in `onEnable` and call the returned unsubscribe in `onDisable`; forgetting this is the classic leak when a node is pooled.

## Save data and progression

`systems/SaveStore.js` owns one JSON document under a single key. It takes a storage adapter with `getItem(key)` / `setItem(key, value)` / `removeItem(key)`; `Game` passes `cc.sys.localStorage` (same shape on web and native). Tests pass an in-memory object.

```js
const SCHEMA_VERSION = 2;
const DEFAULT = { version: SCHEMA_VERSION, currentLevel: 1, coins: 0, completed: [], settings: { sfx: true, music: true, lang: 'en' } };
```

Rules:
- Read once at boot, keep in memory, write on every change (`save()` is cheap at this size). Writes are wrapped in try/catch: Safari private mode throws on `setItem`.
- `currentLevel` is the id of the next level to play; `completed` is a sorted array of ids. Coins are integers, never floats.
- Corrupt or unparsable data → log via the adapter, fall back to `DEFAULT`, do not throw.
- `systems/Progression.js` answers `nextLevelId()`, `isCompleted(id)`, `complete(id, reward)`. It knows the level index from `data/LevelIndex.js` (ordered list of ids/paths) so the loop wraps or ends cleanly after the last level.

### Migrations

Bump `SCHEMA_VERSION` whenever a field changes meaning. Add a step in `systems/SaveMigrations.js`:

```js
module.exports = {
  1: (d) => ({ ...d, settings: { sfx: true, music: true, lang: 'en' }, version: 2 }), // v1→v2
};
```
`SaveStore.load()` applies steps in order from the stored version to `SCHEMA_VERSION`. Every migration gets a unit test with a fixture of the old shape. Never delete a migration; shipped players may be several versions behind.

## Coin economy

All numbers live in `data/Economy.js`, never inline: `LEVEL_REWARD = 10`, `FIRST_CLEAR_BONUS = 0`, `HINT_COST = 50` (hints are a future feature; keep the constant so the UI can show a disabled button). `systems/Wallet.js` exposes `add(n, reason)`, `spend(n, reason)` returning false if insufficient, and emits `coins:changed` with `{ balance, delta, reason }`. Reasons are strings from `data/Economy.js` for later analytics.

## Settings

`systems/Settings.js` wraps the `settings` object of the save document: `get(key)`, `set(key, value)` emitting `settings:changed`. UI toggles only call `set`; the audio adapter listens to the event. Keep settings keys flat.

## Audio hooks

Systems and model never play sounds. They emit events; `ui/AudioController.js` (engine side) maps events to clips: `word:cleared` → clear.mp3, `freeze:thawed` → ice_break.mp3, `piece:moved` → place.mp3 (only when `valid`), `level:completed` → win.mp3. Uses `cc.audioEngine.playEffect(clip, false)` and `playMusic` / `pauseMusic`, with volumes from Settings. Tests of the systems layer therefore need no audio stubs.

## Localization

All player-facing strings are keys in `data/Strings.js` keyed by language: `{ en: { LEVEL: 'LEVEL {n}', LEVEL_COMPLETED: 'LEVEL COMPLETED', YOU_EARNED: 'YOU EARNED', CONTINUE: 'CONTINUE' } }`. `systems/I18n.js` does `t(key, params)` with `{n}` substitution and falls back to `en`. Level topics are content, not UI: a level's `topic` stays in the JSON as the display string for now; if topics need translation later, add `topicKey` to the schema (and an ADR).

Letters on tiles are data; never run them through `t()`.

## Boot order (engine side, for reference)

1. `Game.onLoad`: create `EventBus`, `SaveStore(cc.sys.localStorage)`, `Settings`, `Wallet`, `Progression`; expose them on one `Game` service object passed to views via a property or `require('Game').instance`.
2. Preload `resources/levels` with `cc.resources.loadDir`.
3. Build HUD, then load `Progression.nextLevelId()`.

Adding a new system: write the module and its Node test first, then the adapter if it needs the platform, then wire it in `Game`. Record anything persistent (new save fields, new economy constants) in an ADR.
