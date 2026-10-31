# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [Unreleased]
### Added
- Cocos Creator 2.4.15 project scaffold, portrait 1080x1920 scene.
- Engine-free `LevelSchema` validator, four levels (NUMBER, FARM, PLANT, COLORS), Node test-suite.
- Engine-free rules: `Piece`, `Board` (occupancy, BFS `findPath`), `WordMatcher` (chain search from pins), `FreezeSystem`, `EventBus`, `GameSession` state machine, `Constants`; 46 new unit tests.
- Tooling: eslint, pre-commit gate, headless build script, Claude roles/skills/hooks, ADRs and specs.
