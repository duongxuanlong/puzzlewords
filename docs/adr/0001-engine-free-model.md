# ADR-0001: Game rules live in an engine-free model layer

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** tech-lead

## Context
Cocos Creator 2.4 code can only run inside the editor, the browser preview or a build, which makes rules hard to test and slow to iterate. The Athena test explicitly asks for data-structure skill and a way to test the solution.

## Decision
All rules (board occupancy, piece movement, word matching, freeze counters, level validation) are plain CommonJS modules under `assets/scripts/model/` and `assets/scripts/systems/` that never reference `cc`, `window` or `document`. They are unit-tested with Node's built-in `node:test` (`npm test`). Only `assets/scripts/view/` and `assets/scripts/ui/` touch the engine. eslint enforces the boundary with `no-restricted-globals`.

## Consequences
- Fast tests without the editor; CI can run them on any machine.
- Creator still imports model files as script assets (they are just modules); filenames must be unique and required by bare name.
- Persistence needs an adapter (`StorageAdapter`) so `systems/` stays engine-free.

## Alternatives considered
- Rules inside components: simplest, but untestable outside the editor and prone to tangling input with logic.
- Separate npm package for the model: cleaner isolation, but adds a build step Creator 2.4 cannot consume directly.
