---
name: release
description: Load for any version bump, changelog entry, release checklist, hotfix, store packaging (Android/iOS) or web deploy of this Cocos Creator 2.4.15 game.
---

# Release

The release-engineer role owns this. It edits `package.json` (version), `CHANGELOG.md`,
`README.md`, `tools/build.sh` and `.github/`. It never edits gameplay code, levels, scenes or `.meta`
files, and it **never runs `git commit`, `git push` or `git tag`** — the user commits manually.
Every release ends with a drafted commit message and tag name handed to the user.

## Versioning

Semantic versioning in `package.json`:

- `MAJOR` — save-data format breaks or the level schema changes incompatibly.
- `MINOR` — new mechanic, new level batch, new screen.
- `PATCH` — fixes, balance tweaks, asset swaps.

Pre-release builds use `-rc.N`. The Athena test submission ships as `0.1.0`; the first store build
is `1.0.0`. Native builds also carry a build number (Android `versionCode`, iOS `CFBundleVersion`)
set in the Creator build panel; increase it on every store upload even for the same version.

## CHANGELOG.md (Keep a Changelog)

```markdown
# Changelog
All notable changes to this project are documented here. Format: Keep a Changelog; versions follow SemVer.

## [Unreleased]
### Added
### Changed
### Fixed

## [0.1.0] - 2026-11-02
### Added
- Core word puzzle: drag letters, pinned starts, chain matching with prefix highlighting, found-words panel.
- Challenge 1: dynamic board shapes and Freeze counters.
- Challenge 2: linked 2–3 cell blocks, optionally frozen.
```

Move `[Unreleased]` entries into a dated version block at release time. Dates are absolute.

## Release checklist

1. `npm run check` green (lint, unit tests, level validation). Stop and report if not.
2. Builds for every target platform via `tools/build.sh <platform>` (see `run-and-build`), smoke
   test each, record size (`du -sh build/web-mobile`) and the sha (`git rev-parse --short HEAD`).
3. `CHANGELOG.md` updated; `package.json` version bumped.
4. `README.md` build/run/test instructions still true on a clean clone.
5. Hand the user:

```
Suggested commit: "release: v0.2.0 — freeze mechanic, 8 new levels"
Suggested tag:    v0.2.0  (git tag -a v0.2.0 -m "v0.2.0")
```

The pre-commit gate (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`)
reruns `npm run check` when they commit.

## Hotfix flow

Branch `hotfix/<issue>` from the released tag, fix with a test, bump `PATCH`, add a `### Fixed`
entry, build, smoke test, hand over the commit and tag text, and ask the user to merge the branch
back into `main`. Never rebase or force-push for them.

## Android

- Build panel → Android: package name must be reverse-DNS, letters/digits/underscore only, no `-`,
  not starting with a digit (the builder enforces this).
- Keystore: the panel's Keystore section; use the debug keystore only for internal builds. Release
  keystores are the user's secret — never read, copy or print them.
- Output `build/jsb-link/` (shared engine) or `build/jsb-default/`; the Gradle project is under
  `build/jsb-*/frameworks/runtime-src/proj.android-studio`. Needs Android SDK/NDK paths set in
  Creator Preferences and Python 2.7 (2.4 requirement).
- Test an `arm64-v8a` release APK on a low-end device before upload; Google Play requires an AAB
  (tick "Generate App Bundle").

## iOS

- Build panel → iOS; the Xcode project is `build/jsb-*/frameworks/runtime-src/proj.ios_mac/*.xcodeproj`.
- Signing, provisioning and TestFlight upload happen in Xcode and are the user's task; prepare the
  build and the notes only.
- Bundle identifier must match the one in App Store Connect.

## Web deploy

`build/web-mobile/` is static: upload the folder to any static host (S3/CloudFront, Netlify,
GitHub Pages, itch.io). Enable MD5 cache in the build panel for cache busting on updates. Serve
over HTTPS; verify on an actual phone browser, not only desktop.

Unity analogy: the build panel plus `tools/build.sh` is Build Settings plus `-batchmode`; the
Keystore section is Player Settings → Publishing.
