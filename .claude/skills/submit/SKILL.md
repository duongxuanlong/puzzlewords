---
name: submit
description: Load when packaging the Athena Studio test submission — checks, README.txt, the zip command with exclusions, verification in a fresh Creator 2.4.15 open, and upload.
---

# Submit the Athena test

The brief asks for the complete project as a zip on a cloud link, with a `README.txt` explaining
how to build, run and test. The release-engineer role runs this. It never commits; the user
commits before packaging so the zip matches a known sha.

## 1. Green gate

```bash
npm run check
```

Lint, unit tests and level validation must pass. If anything fails, stop and report.

## 2. Regenerate editor files

Open the project once in Cocos Creator 2.4.15 (see `run-and-build`), wait for the asset database
to finish importing, confirm the Console has no errors, press Play once to confirm the preview
runs, then close the editor. This regenerates `.meta` files and `library/`. Tell the user: "metas
regenerated — please commit before I zip."

## 3. README.txt

Generate `README.txt` from `README.md` (`cp README.md README.txt`, or a trimmed copy; the
reviewers asked for `.txt`). It must contain:

- **Requirements:** Cocos Creator 2.4.15 (Dashboard dmg), Node 20+ for tests, a browser.
- **Open & run:** Dashboard → Open Other → this folder → Play (browser preview at
  `http://localhost:7456`). Or headless: `npm run build:web` then
  `npm run serve:web` and open `http://localhost:8080`.
- **Test:** `npm install` once, then `npm test` (model unit tests), `npm run validate:levels`,
  `npm run lint`, or all three with `npm run check`.
- **Levels:** where they live (`assets/resources/levels/`), the schema in one paragraph, and which
  level demonstrates Basic (1–2), Challenge 1 (3) and Challenge 2 (4).
- **Architecture:** three sentences on the engine-free model, view/UI components, and the tooling
  (hooks, validator). Mention Unity-style separation if the reviewer may come from Unity.
- **Design notes:** the spec interpretations from `docs/specs/word-puzzle-core.md` and ADR 0002 —
  free placement, right/down matching from the pin, frozen hides the letter and thaws at zero,
  frozen excluded from matching, counters decrement once per cleared word.
- **Known limitations / not done**, honestly listed.

Plain text, no markdown tables; keep lines under 100 chars.

## 4. Zip

Run from the parent folder so the archive has a single top-level directory:

```bash
cd /Users/macmini/Documents/projects && \
zip -r puzzlewords-athena-test.zip puzzlewords \
  -x "puzzlewords/library/*" "puzzlewords/temp/*" "puzzlewords/local/*" "puzzlewords/build/*" \
     "puzzlewords/node_modules/*" "puzzlewords/.git/*" "puzzlewords/.DS_Store" "*/.DS_Store"
```

Keep `.meta` files, `assets/`, `settings/`, `project.json`, `package.json`, `package-lock.json`,
`tests/`, `tools/`, `docs/`, `.claude/`, `README.txt`. Check size with `ls -lh`; it should be a few
MB (textures dominate). If it is hundreds of MB, a generated folder slipped in.

## 5. Verify in a fresh folder

```bash
mkdir -p /tmp/athena-verify && cd /tmp/athena-verify && unzip -q ~/Documents/projects/puzzlewords-athena-test.zip
```

Open `/tmp/athena-verify/puzzlewords` in Creator 2.4.15: no version prompt, no missing-script
warnings, preview plays level 1. Then `npm install && npm run check` in that folder. Delete the
temp folder afterwards. If anything differs from the repo, fix in the repo, ask the user to commit,
and re-zip.

## 6. Upload and share

Upload the zip to Google Drive or Dropbox, set link access to "anyone with the link can view", and
paste the link plus the zip's sha (`shasum -a 256 puzzlewords-athena-test.zip`) in the report so
the user can put both in their reply to Athena.

## Report format

```
Gate: PASS (npm run check)
Editor open: ok, metas regenerated, committed as <sha>
README.txt: updated (sections: ...)
Zip: puzzlewords-athena-test.zip, <size>, sha256 <...>
Fresh-folder verify: ok
Upload: <link> (user to confirm sharing)
```
