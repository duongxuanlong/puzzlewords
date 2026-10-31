---
name: adr
description: Load when recording or reviewing an architecture decision in docs/adr — template, numbering, when an ADR is required, and the backlog of decisions already taken but not yet written.
---

# Architecture Decision Records

ADRs live in `docs/adr/NNNN-short-title.md`, four-digit zero-padded, sequential, never reused.
The tech-lead role writes them (it may edit only `docs/` and `CLAUDE.md`). A decision that changes
a hard rule in `CLAUDE.md` updates both in the same change. The user commits.

## When an ADR is required

- Module boundaries: what lives in `model/`, `systems/`, `view/`, `ui/`, `data/`; a new folder.
- Data formats: the level schema (`assets/scripts/model/LevelSchema.js`), save data, analytics
  events.
- Spec interpretations: anywhere the Athena brief or a design doc is ambiguous and we picked one
  reading.
- Third-party or build dependencies (anything added to `package.json`, editor extensions in
  `packages/`, native SDKs).
- Anything a reviewer would otherwise re-litigate.

Not required for: naming, formatting, a single bug fix, a level.

## Template

```markdown
# NNNN. <Title in the imperative, e.g. "Keep the model layer engine-free">

- Status: Proposed | Accepted | Superseded by NNNN | Deprecated
- Date: YYYY-MM-DD

## Context
What forces are at play: the requirement, the constraint, the thing that went wrong. Two to five
sentences. Link the spec or issue.

## Decision
What we do, stated as a rule someone can check code against. Name the files or folders affected.

## Consequences
What becomes easier, what becomes harder, what must be done as a result (tests, tooling, docs).

## Alternatives considered
One line each: the alternative and why it lost.
```

Keep an ADR under a page. If it needs diagrams, put the picture in `docs/adr/images/`.

## Index

`docs/adr/README.md` lists every ADR as `- [NNNN](NNNN-title.md) — one-line summary — Status`.
Update it in the same change.

## Decisions already taken, to be written first

1. **0001 — Keep the model layer engine-free and test it in Node.** `assets/scripts/model/`,
   `data/`, `systems/` never reference `cc`; eslint's `no-restricted-globals` enforces it;
   `npm test` runs `node:test` with `NODE_PATH` so modules resolve by bare name exactly as Creator
   resolves them. Alternative rejected: engine-dependent tests through the Creator test runner (slow,
   editor-bound).
2. **0002 — Spec interpretations for the Athena brief.** Sliding movement: a piece slides one cell at a
   time through free cells and never passes through another piece. Matching is a chain of 4-adjacent
   cells from the pin (any direction per step), with the longest prefix tinted in the word colour. Frozen pieces hide their letter, show the counter, cannot be
   dragged, are excluded from matching, and at zero the ice is removed while the letter stays
   (matching the Challenge 1 video, where the brief's "removed from the board" is ambiguous).
   Counters decrement once per cleared word.
3. **0003 — Build the UI from code on a single scene.** `assets/scenes/Main.fire` holds only
   Canvas and Camera; HUD, board and popups are created by components at runtime. Reviewable as
   text in git, no merge conflicts in scene JSON, prefabs added later only for art-heavy pieces.
   Alternative rejected: editor-authored scene hierarchy (conventional in Cocos, opaque in diffs).

Unity analogy: the same practice as an `Docs/ADR` folder next to `Assets/`; nothing here is read
by the engine.
