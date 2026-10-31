---
name: coding-standards
description: JavaScript style, naming, documentation and error-handling rules for this Cocos Creator 2.4 project. Load before writing or reviewing code.
---

# Coding standards

Enforced by `eslint.config.js` (`npm run lint`) and the pre-commit gate; the rest is convention.

## Language level
- CommonJS modules (`require` / `module.exports`). No `import`/`export`, no TypeScript, no bundler.
- ES2018 syntax in `assets/scripts/` (Creator transpiles with Babel): `const`/`let`, classes, arrow functions, template literals, destructuring, spread. No optional chaining or nullish coalescing in `assets/` (keep the preview build happy); fine in `tools/` and `tests/`.
- `'use strict';` at the top of engine-free modules.

## Naming
- Files: `PascalCase.js` for classes/components (`BoardView.js`), unique across the project. Levels `level_001.json`.
- Classes and components PascalCase; functions and variables camelCase; constants `UPPER_SNAKE` in `data/`.
- Booleans read as predicates: `isFrozen`, `canPlace`, `hasPin`. Event names `noun:verb` lower-case (`word:cleared`).
- Grid coordinates are always `(row, col)` in that order, zero-based, row 0 at the top. Never `(x, y)` for cells.

## Structure
- One class or component per file. Export at the bottom: `module.exports = Board;`.
- Public API first, helpers below, private helpers prefixed `_`.
- Functions under ~40 lines; components under ~250 lines; split otherwise.
- No magic numbers in components: sizes, durations, easings, colors come from `assets/scripts/data/`.

## Documentation
- A header comment per module: what it is, what it depends on, what it emits.
- JSDoc on public functions with non-obvious params: `@param {number} row`, `@returns {boolean}`.
- Comments explain *why*, not *what*. Link spec sections (`docs/specs/word-puzzle-core.md#freeze`) where a rule is implemented.

## Errors and logging
- Model functions validate inputs and `throw new Error('Board.place: cell out of bounds (r,c)')`; callers (GameSession) decide how to surface.
- Never swallow errors silently; `catch` must log via `cc.warn`/`cc.error` in engine code or rethrow.
- Logging: `cc.log` for debug (strip or guard with `CC_DEBUG`), `cc.warn` for recoverable, `cc.error` for bugs. No `console.*` in `assets/`.

## Testing expectations
- Every model/system module has `tests/<layer>/<Name>.test.js` using `node:test`. Tests describe behaviour (`'rejects a drop that overlaps another piece'`).
- Pure functions preferred; pass dependencies in (e.g. a storage adapter) instead of reaching for globals.

## Git hygiene (the user commits)
- Leave the tree in a state where `npm run check` passes.
- Suggested commit message format: `type(scope): summary` with types `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `level`, `art`. Body explains why. Never commit yourself.
