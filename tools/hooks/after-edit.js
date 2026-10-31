#!/usr/bin/env node
// Claude Code PostToolUse hook: fast feedback after an edit.
//  - scripts/tests/tools  → eslint on the file + model unit tests
//  - level JSON           → level validator
// Exit 2 so failures are shown back to the agent; success is silent.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
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
  const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: false });
  const problems = [];

  if (/^assets\/resources\/levels\/.*\.json$/.test(rel)) {
    const r = run('node', ['tools/validate-levels.js', 'assets/resources/levels']);
    if (r.status !== 0) {
      problems.push(r.stdout + r.stderr);
    }
  }
  if (/^(assets\/scripts|tests|tools)\/.*\.js$/.test(rel)) {
    if (fs.existsSync('node_modules/.bin/eslint')) {
      const lint = run('node_modules/.bin/eslint', [rel]);
      if (lint.status !== 0) {
        problems.push(lint.stdout + lint.stderr);
      }
    }
    const tests = run('npm', ['test', '--silent']);
    if (tests.status !== 0) {
      problems.push(tests.stdout + tests.stderr);
    }
  }
  if (problems.length) {
    process.stderr.write(problems.join('\n').slice(-6000));
    process.exit(2);
  }
  process.exit(0);
});
