---
name: review-checklist
description: Load before reviewing any diff or file set in this project. Ordered checks, blockers, game-specific correctness and the verdict format for the code-reviewer role.
---

# Review checklist

Review the working tree (`git diff`, `git status`) or the files named in the request. Read `CLAUDE.md`
first; its hard rules are the blockers below. You never edit files and never commit. The user commits
manually after reading your verdict.

## 0. Run the gate

```bash
npm run check
```

That is `npm run lint && npm test && npm run validate:levels`, the same command the git pre-commit
hook in `.githooks/pre-commit` runs (enabled per clone with `git config core.hooksPath .githooks`).
Paste the result in the review. A red gate is a blocker regardless of anything else.

## 1. Blockers (any one → "request changes")

- Any `cc`, `window` or `document` reference under `assets/scripts/model/`, `assets/scripts/data/`
  or `assets/scripts/systems/`. Grep for it; eslint's `no-restricted-globals` should also catch it.
- Rules logic in a view or UI component (`assets/scripts/view/`, `assets/scripts/ui/`): word
  matching, freeze counters, drop legality or level progression decided inside a `cc.Class`.
  Components translate input to model calls and model state to nodes, nothing more.
- Edits to `.meta` files, `.fire` scenes, or anything under `library/`, `temp/`, `local/`, `build/`.
  These are Creator-owned or generated (`tools/hooks/guard-paths.js` blocks them for agents; a human
  may have bypassed it).
- `require('./Foo')` or `require('../model/Foo')` instead of a bare unique filename
  `require('Foo')`. Creator 2.4 resolves modules by script name; relative paths are not guaranteed
  to work in builds, and `npm test` relies on `NODE_PATH` for the same bare names.
- Two scripts under `assets/scripts/` sharing a filename.
- Level JSON under `assets/resources/levels/` failing `npm run validate:levels`.
- New runtime dependency added to `package.json` (nothing in `node_modules` ships into a Creator build).

## 2. Game-specific correctness

Confirm each by reading the code path, not by pattern matching.

- **Coordinate conversion.** Touch `event.getLocation()` is world space. It must go through
  `boardNode.convertToNodeSpaceAR(...)` before dividing by cell size, and the grid origin / anchor
  offset must be applied once. Rows increase downward in level data while Cocos y increases upward:
  check the sign flip happens in exactly one place.
- **Single-cell steps only.** `dragStep` must refuse any target that is not 4-adjacent to the anchor and must commit the board on success; a view that moves a node without a successful step, or a session that accepts a jump, lets pieces pass through each other.
- **Multi-cell step validation.** For a linked block every offset cell must be inside the shape and empty at the new position, ignoring cells the block itself currently occupies. Validating the anchor only is a bug.
- **Path routing stays in the view/helper.** `findPath` is pure BFS over free footprints; the view never moves a piece along a path the session has not stepped.
- **Frozen pieces** cannot be dragged, hide their letters, and are excluded from word matching until
  thawed. A match that reads through a frozen cell is a bug.
- **Counters** decrement exactly once per cleared word, for every frozen piece on the board, and the
  thaw happens at zero (not below, not on the next clear). Clearing two words in one drop (possible
  when a block completes two lines) must decrement twice.
- **Pins** are immovable, keep their word colour and show the word length. A pinned piece must never
  be a drag target and must never be part of a linked block.
- **Matching** is a chain search from the pin over 4-adjacent cells, any direction per step, no cell reused, other pins excluded, exact letters; incomplete chains only drive highlighting.
- **Level completion** fires once, after the last word's clear animation, not on every clear.
- **Level load** goes through `LevelSchema.validateLevel` in debug (`CC_DEBUG`) and fails loudly.

## 3. Performance (mobile, Cocos 2.4)

- No allocations in `update(dt)` or in touch-move handlers (`cc.v2`/`cc.v3` creation per frame,
  array spreads, closures). Reuse scratch vectors.
- Labels: `label.string` set only when the value changed. A coin counter rewritten every frame
  rebuilds its texture every frame.
- Repeated nodes (letters, found-word tiles) come from a pool; nothing is `instantiate`d per move.
- Sprites share the atlas; no `cc.Texture2D` created at runtime from paths in a hot path.
- Tweens are stopped on node destroy (`cc.Tween.stopAllByTarget(node)`) to avoid callbacks on
  destroyed nodes.

## 4. Tests

- Every new or changed model function has a `node:test` case under `tests/`, including the
  negative path (illegal drop, frozen cell in a line, duplicate pin).
- Tests require modules by bare name, same as the game.
- Level changes come with the validator output and, when a solver exists, a solvability check.

## 5. Style

`coding-standards`: `const`/`let`, strict equality, braces always, JSDoc on public model functions,
no commented-out code, constants in `assets/scripts/data/`. Flag, do not block, unless it hides a bug.

## Verdict format

```
Gate: npm run check → PASS | FAIL (paste tail)
Blockers:  none | list (file:line — what — why — fix)
Correctness: list
Performance: list
Tests: list
Style/nits: list
Verdict: APPROVE | APPROVE WITH NITS | REQUEST CHANGES
```

Unity analogy for the reader: the model folder is the pure C# assembly with no `UnityEngine` using;
if a MonoBehaviour-equivalent (`cc.Class`) contains rules, that is the finding.
