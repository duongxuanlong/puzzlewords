#!/usr/bin/env node
// Claude Code PreToolUse hook: refuse edits to generated or editor-owned files.
// Reads the tool call JSON on stdin; exit code 2 blocks the call and shows the message.
'use strict';
let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let file = '';
  try {
    const input = JSON.parse(raw);
    file = (input.tool_input && (input.tool_input.file_path || input.tool_input.path)) || '';
  } catch (_e) {
    process.exit(0);
  }
  const rel = file.replace(process.cwd() + '/', '');
  const blocked = [
    [/\.meta$/, 'Creator owns .meta files; change the asset or its import settings in the editor instead.'],
    [/^(library|temp|local|build)\//, 'Generated folder; it is rebuilt by Creator and ignored by git.'],
    [/^assets\/.*\.fire$/, 'Scene files are edited in Creator. If a code-built scene truly needs a change, ask the tech-lead role.'],
  ];
  for (const [re, why] of blocked) {
    if (re.test(rel)) {
      process.stderr.write(`Blocked edit to ${rel}: ${why}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
