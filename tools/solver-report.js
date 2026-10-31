#!/usr/bin/env node
// Runs the Solver over levels and prints timing and results. Read-only: it never writes files.
// Usage: npm run solver:report -- [level_001 ...] [--metric=moves|slides] [--weight=N] [--max-states=N] [--analyze]
// With no level names it runs every level. Default runs: exact and guided (weights 1, 2) for both metrics.
'use strict';
const fs = require('fs');
const path = require('path');
const { solve, analyze } = require('Solver');

const dir = path.join(__dirname, '..', 'assets', 'resources', 'levels');
const names = [];
const flags = {};
for (const arg of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
  if (!m) {
    names.push(arg.replace(/\.json$/, ''));
  } else if (['metric', 'weight', 'max-states', 'analyze'].includes(m[1])) {
    flags[m[1]] = m[2] === undefined ? true : m[2];
  } else {
    console.error(`unknown flag --${m[1]}`);
    process.exit(2);
  }
}
const levels = names.length
  ? names
  : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => f.replace(/\.json$/, ''));

const metrics = flags.metric ? [flags.metric] : ['moves', 'slides'];
const weights = flags.weight !== undefined ? [Number(flags.weight)] : [0, 1, 2];
const maxStates = flags['max-states'] ? Number(flags['max-states']) : 300000;

function timed(fn) {
  const t = Date.now();
  const result = fn();
  return { result, ms: Date.now() - t };
}

for (const name of levels) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  for (const metric of metrics) {
    if (flags.analyze) {
      const { result: r, ms } = timed(() => analyze(level, { metric }));
      console.log(`${name} analyze ${metric}: solvable=${r.solvable} optimal=${r.optimal} moves=${r.moves} slides=${r.slides} ${ms}ms`);
      continue;
    }
    for (const weight of weights) {
      const { result: r, ms } = timed(() => solve(level, { metric, weight, maxStates }));
      console.log(`${name} ${metric} w${weight}: solved=${r.solved} optimal=${r.optimal} truncated=${r.truncated} `
        + `moves=${r.moves} slides=${r.slides} explored=${r.explored} ${ms}ms`);
    }
  }
}
