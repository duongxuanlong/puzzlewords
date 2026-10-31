#!/usr/bin/env node
// Prints difficulty metrics and a walkthrough for one or more levels (level-balancing skill).
// Usage: node tools/solve-level.js assets/resources/levels/level_004.json [...more]
// "min" values are proven minimums when exact search fits its budget, otherwise "≤" upper bounds.
'use strict';
require('./module-paths');
const fs = require('fs');
const path = require('path');
const { validateLevel, cellsOfShape } = require('LevelSchema');
const { analyze } = require('Solver');

function bound(r, metric) {
  if (r.solvable !== true) {
    return r.solvable === false ? 'unsolvable' : 'unknown (budget exhausted)';
  }
  return (r.optimal ? '' : '≤ ') + r[metric];
}

function report(file) {
  const level = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validateLevel(level);
  if (errors.length) {
    console.log(`${path.basename(file)}: invalid level, run npm run validate:levels`);
    return false;
  }
  const cells = cellsOfShape(level.shape).size;
  const letters = level.words.join('').length;
  const frozen = level.pieces.filter((p) => p.frozen).map((p) => `${p.letters}(${p.frozen})`);
  const blocks = level.pieces.filter((p) => p.letters.length > 1).map((p) => p.letters);
  const byMoves = analyze(level, { metric: 'moves' });
  const bySlides = analyze(level, { metric: 'slides' });

  console.log(`${path.basename(file)} — ${level.topic}: ${level.words.join(', ')}`);
  console.log(`  words ${level.words.length} · letters ${letters} · cells ${cells} · free ratio ${((cells - letters) / cells).toFixed(2)}`);
  console.log(`  frozen ${frozen.join(' ') || '-'} · blocks ${blocks.join(' ') || '-'}`);
  console.log(`  min moves  ${bound(byMoves, 'moves')}`);
  console.log(`  min slides ${bound(bySlides, 'slides')}`);
  if (byMoves.solution) {
    console.log('  walkthrough (fewest moves found):');
    byMoves.solution.forEach((m, i) => {
      const cleared = m.cleared.length ? `  → ${m.cleared.join(', ')}` : '';
      console.log(`    ${String(i + 1).padStart(2)}. ${m.letters} [${m.from}] → [${m.to}] (${m.slides} cell${m.slides === 1 ? '' : 's'})${cleared}`);
    });
  }
  return byMoves.solvable === true;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node tools/solve-level.js <level.json> [...]');
  process.exit(2);
}
const ok = files.map(report).every(Boolean);
process.exit(ok ? 0 : 1);
