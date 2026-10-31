---
name: ci
description: Load when setting up or changing continuous integration for this repo — the GitHub Actions check workflow, and what can and cannot be built in CI for Cocos Creator 2.4.
---

# Continuous integration

When the user asks for CI, **create the workflow file below** at `.github/workflows/check.yml`
(the release-engineer role may edit `.github/`). Do not commit it; the user commits.

## Check workflow (runs everywhere)

Everything in `npm run check` is plain Node: eslint, `node:test` over `tests/`, and the level
validator. No Creator needed.

```yaml
name: check

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
```

`npm ci` needs `package-lock.json` committed. If the repo has none yet, tell the user to run
`npm install` once and commit the lockfile with the workflow.

This mirrors the local pre-commit gate (`.githooks/pre-commit`, enabled with
`git config core.hooksPath .githooks`), so a commit that passes locally should pass here.

## Creator builds in CI: the honest version

Cocos Creator 2.4 has no Linux headless editor. The `--build` command line still launches the
Electron editor, so it needs:

- macOS or Windows,
- Creator 2.4.15 installed at a known path,
- a logged-in GUI session the first time (the editor asks for a Cocos account; after that
  `--build` runs unattended),
- for native targets: Android SDK/NDK and Python 2.7 as well.

GitHub's hosted macOS runners do not have Creator installed, and installing the 200 MB dmg on
every run is slow and licence-sensitive. Practical choice: a **self-hosted macOS runner** (the
studio build Mac, or this machine) with the editor installed, running only on tags or manual
dispatch. Unity teams will recognise this as the usual "Unity isn't on the hosted runner" problem.

```yaml
  build-web:
    if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
    needs: check
    runs-on: [self-hosted, macOS, cocos-2.4.15]
    env:
      COCOS_CREATOR: /Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/MacOS/CocosCreator
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: sh tools/build.sh web-mobile
      - uses: actions/upload-artifact@v4
        with:
          name: web-mobile
          path: build/web-mobile
```

Add `workflow_dispatch:` under `on:` when you include this job. Label the runner `cocos-2.4.15`
so the job cannot land on a Mac without the editor.

Until a runner exists, builds are produced locally with `tools/build.sh` (see `run-and-build`) and
attached to the release by the user. Say so in the PR rather than leaving a job that can never run.

## Branch protection suggestions (user applies them)

- Require the `check` job on pull requests to `main`.
- Dismiss stale reviews on new pushes.
- No force pushes to `main`.

## Keep CI honest

- The workflow runs the same `npm run check` as the hook. Do not add CI-only steps that developers
  cannot run locally.
- When a step is skipped or allowed to fail, say why in a comment in the YAML.
