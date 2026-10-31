#!/usr/bin/env node
// Validates every level JSON in a folder (schema, then solvable under the sliding rule).
// Usage: node tools/validate-levels.js assets/resources/levels
'use strict';
require('./module-paths');
const fs = require('fs');
const path = require('path');
const { validateLevel } = require('LevelSchema');
const { prove } = require('Solver');

const dir = process.argv[2] || path.join(__dirname, '..', 'assets', 'resources', 'levels');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
let failed = 0;
const ids = new Set();
for (const file of files) {
  let level;
  try {
    level = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch (e) {
    console.error(`${file}: invalid JSON (${e.message})`);
    failed++;
    continue;
  }
  const errors = validateLevel(level);
  if (ids.has(level.id)) {
    errors.push(`duplicate id ${level.id}`);
  }
  ids.add(level.id);
  let solution = '';
  if (!errors.length) {
    const proof = prove(level);
    if (proof.solvable === true) {
      solution = `, solvable in ≤ ${proof.moves} moves`;
    } else {
      errors.push(proof.solvable === false
        ? 'unsolvable under the sliding rule (run tools/solve-level.js)'
        : 'solver budget exhausted, solvability unknown (run tools/solve-level.js)');
    }
  }
  if (errors.length) {
    failed++;
    console.error(`${file}:`);
    errors.forEach((e) => console.error('  - ' + e));
  } else {
    console.log(`${file}: ok (${level.topic}: ${level.words.join(', ')}${solution})`);
  }
}
console.log(`${files.length - failed}/${files.length} levels valid`);
process.exit(failed ? 1 : 0);
