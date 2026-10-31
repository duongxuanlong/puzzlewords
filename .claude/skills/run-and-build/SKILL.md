---
name: run-and-build
description: Load when you need to open the project in Cocos Creator 2.4.15, preview it in a browser or simulator, build headlessly with tools/build.sh, serve the web build, or smoke-test a build.
---

# Run and build

Project root: `/Users/macmini/Documents/projects/puzzlewords` (the Cocos project root is the repo
root; `project.json` plus `assets/` is what makes it a project).

## Open in the editor

Either of:

```bash
open -a "/Applications/Cocos/Creator/2.4.15/CocosCreator.app" --args --path /Users/macmini/Documents/projects/puzzlewords
```

or launch Cocos Dashboard (`/Applications/CocosDashboard.app`), Projects → Open Other → pick the
folder. The editor version must be 2.4.15; if the Dashboard offers to "upgrade" the project to
another version, decline.

**First open** generates `library/`, `temp/`, `local/` (gitignored) and a `.meta` next to every file
in `assets/`. Those `.meta` files are part of the project and must be committed. Agents do not
commit: tell the user the metas were generated and need to go into their next commit. Unity analogy:
same as `.meta` GUIDs in `Assets/`, with `library/` playing the role of `Library/`.

## Preview

- **Browser:** Play button (top centre) or `Cmd+P`. Opens `http://localhost:7456`. The preview is
  the project compiled on the fly; script changes hot-reload when "Auto-refresh Preview" is on in
  Preferences. The same URL on the machine's LAN address (shown in the toolbar) runs on a phone.
- **Simulator:** change the dropdown next to Play from Browser to Simulator. Resolution comes from
  `settings/project.json` (`simulator-resolution` 1080x1920, portrait).
- **Device aspect ratios:** in the browser preview use the device dropdown in the preview toolbar or
  the browser devtools device mode; check 9:16, 19.5:9 and 4:3 for UI work.

Console errors appear in the editor Console panel and the browser devtools console.

## Headless build

```bash
npm run build:web        # web-mobile, release
sh tools/build.sh web-mobile true   # debug build
sh tools/build.sh android
sh tools/build.sh ios
```

`tools/build.sh <platform> [debug]` runs

```
/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/MacOS/CocosCreator \
  --path <root> --build "platform=web-mobile;debug=false;buildPath=<root>/build"
```

Override the editor location with `COCOS_CREATOR=/path/to/CocosCreator`. The build takes one to
three minutes and the editor window may flash open; that is normal. Run it in the background when a
turn would otherwise wait on it.

Output: `build/web-mobile/` (also `build/web-desktop/`, `build/jsb-link/` or `build/jsb-default/`
for native). `build/` is gitignored.

## Serve the web build

```bash
npm run serve:web
```

or `npx http-server build/web-mobile -p 8080`. Open `http://localhost:8080`. Opening `index.html`
from the file system does not work (XHR for assets is blocked).

## Smoke test after a build

1. Page loads with no console errors; the splash disappears.
2. Level 1 (NUMBER) appears: 3x3 board, pinned O and T showing "3", four free letters.
3. Drag N and E beside O → ONE clears and flies to the found panel.
4. Complete TWO → level complete popup → Continue loads level 2.
5. Level 3 (PLANT): frozen tile shows "1", cannot be dragged, thaws after PEA.
6. Level 4 (COLORS): the OW block moves as one unit; the IN block thaws after two clears.
7. Restart button resets the current level. Rotate/resize: HUD stays anchored.

Record build id (`package.json` version + short git sha from `git rev-parse --short HEAD`) in any
report.

## Common failures

- **Version prompt on open** — `project.json` `version` differs from the editor. Keep `2.4.15`;
  never accept an upgrade to 2.4.x other than 15 or to 3.x.
- **Missing script / "component not found" in the scene** — the script's `.meta` was deleted or
  renamed; let the editor regenerate by reopening, then re-attach the component.
- **Build path with spaces or non-ASCII** — the builder refuses it; keep the repo path plain.
- **Native builds need Python 2.7** in 2.4 (the builder shows a link to the manual). Web builds do
  not.
- **Textures look blurry or wrong size** — check the texture `.meta` (`packable`, `filterMode`) in
  the editor Inspector, not by hand.
- **`cc.resources.load` returns null** — the JSON is outside `assets/resources/` or the path
  includes the extension. Use `levels/level_001` with `cc.JsonAsset`.
- **Changes not visible in preview** — the preview caches; hard-refresh the browser or toggle
  Auto-refresh.
