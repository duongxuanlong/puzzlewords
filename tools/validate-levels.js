#!/usr/bin/env node
// Validates every level JSON in a folder. Usage: node tools/validate-levels.js assets/resources/levels
'use strict';
const fs = require('fs');
const path = require('path');
const { validateLevel } = require('../assets/scripts/model/LevelSchema');

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
  if (errors.length) {
    failed++;
    console.error(`${file}:`);
    errors.forEach((e) => console.error('  - ' + e));
  } else {
    console.log(`${file}: ok (${level.topic}: ${level.words.join(', ')})`);
  }
}
console.log(`${files.length - failed}/${files.length} levels valid`);
process.exit(failed ? 1 : 0);
