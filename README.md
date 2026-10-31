# Puzzle Words

A grid-based word puzzle prototype built with **Cocos Creator 2.4.15** and JavaScript, for the Athena Studio Mobile Game Programmer Test.

## Requirements
- Cocos Creator 2.4.15 (macOS/Windows). Node.js 20+ for tests and tooling.

## Run
1. Open Cocos Creator 2.4.15 → *Open Other* → select this folder. The first open generates `library/` and `.meta` files.
2. Open `assets/scenes/Main.fire` and press **Play** for the browser preview (portrait, 1080x1920).

## Build
```bash
npm run build:web
```
Output in `build/web-mobile`. Serve it locally with `npm run serve:web`.
Set `COCOS_CREATOR` if the editor is installed elsewhere.

## Test
```bash
npm install
npm test                 # engine-free model tests (node:test)
npm run validate:levels  # level data validation
npm run lint
```

## Project layout
See `CLAUDE.md` for the full layout and rules. Game rules live in `assets/scripts/model/` (engine-free, unit-tested); Cocos components live in `assets/scripts/view/` and `assets/scripts/ui/`; levels are JSON under `assets/resources/levels/`.

## Design notes
Spec interpretations are recorded in `docs/adr/0002-spec-interpretations.md` and the gameplay spec in `docs/specs/word-puzzle-core.md`.
