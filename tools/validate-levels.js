#!/usr/bin/env node
// Validates every level JSON in a folder (schema, then solvable under the sliding rule).
// Usage: node tools/validate-levels.js assets/resources/levels
'use strict';
require('./module-paths');
const fs = require('fs');
const path = require('path');
const { validateLevel } = require('LevelSchema');
const { prove } = require('Solver');

/**
 * Design rule (not in LevelSchema, so the game still loads old data): at the start no piece next to
 * a pin may carry the second letter of that pin's word. That letter beside the pin is a free first
 * step of the chain and gives the word away; the player should have to bring it in.
 * @returns {string[]} problems
 */
function pinAdjacencyErrors(level) {
  const errors = [];
  const at = new Map(); // "r,c" → { letter, index }
  level.pieces.forEach((p, i) => {
    const offsets = p.cells || [[0, 0]];
    offsets.forEach((o, k) => at.set(p.at[0] + o[0] + ',' + (p.at[1] + o[1]), { letter: p.letters[k], index: i }));
  });
  level.pieces.forEach((p, i) => {
    if (p.pin === undefined) {
      return;
    }
    const word = level.words[p.pin];
    const next = word[1];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const n = at.get(p.at[0] + dr + ',' + (p.at[1] + dc));
      if (n && n.index !== i && n.letter === next) {
        errors.push(`pieces[${i}] pin "${word}" has its next letter "${next}" beside it at [${p.at[0] + dr}, ${p.at[1] + dc}]; keep the second letter away from the pin at the start`);
      }
    });
  });
  return errors;
}

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
  if (!errors.length) {
    errors.push(...pinAdjacencyErrors(level));
  }
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
