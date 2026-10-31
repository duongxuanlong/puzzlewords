'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Piece = require('Piece');
const { solve, analyze, prove, stateKey, decodeKey } = require('Solver');

const levelsDir = path.join(__dirname, '..', '..', 'assets', 'resources', 'levels');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(levelsDir, name), 'utf8'));
}

function inline(level) {
  return { id: 99, topic: 'T', ...level };
}

test('exact search finds the proven minimum for level 1', () => {
  const r = solve(load('level_001.json'), { metric: 'moves' });
  assert.equal(r.solved, true);
  assert.equal(r.optimal, true);
  assert.equal(r.moves, 2);
  assert.deepEqual(r.solution.map((m) => m.cleared), [['ONE'], ['TWO']]);
});

test("slides metric minimises cells slid, not drags", () => {
  const level = load('level_002.json');
  const byMoves = solve(level, { metric: 'moves', maxStates: 50000 });
  const bySlides = solve(level, { metric: 'slides', maxStates: 50000 });
  assert.equal(byMoves.moves, 4);
  assert.equal(bySlides.slides, 7);
  assert.ok(bySlides.slides <= byMoves.slides);
});

test('a boxed-in piece makes a level unsolvable (space exhausted, not truncated)', () => {
  const r = solve(inline({
    words: ['AB'], shape: ['#.#'],
    pieces: [{ letters: 'A', at: [0, 0], pin: 0 }, { letters: 'B', at: [0, 2] }],
  }));
  assert.equal(r.solved, false);
  assert.equal(r.truncated, false);
});

test('a freeze counter larger than the other words is unsolvable', () => {
  const level = inline({
    words: ['AB', 'CD'], shape: ['##.', '###'],
    pieces: [
      { letters: 'A', at: [0, 0], pin: 0 },
      { letters: 'B', at: [0, 1], frozen: 2 },
      { letters: 'C', at: [1, 0], pin: 1 },
      { letters: 'D', at: [1, 2] },
    ],
  });
  assert.equal(solve(level).solved, false);
  assert.equal(prove(level).solvable, false);
  level.pieces[1].frozen = 1;
  assert.equal(solve(level).solved, true, 'counter 1 thaws after CD');
});

test('a state budget that runs out reports truncated, and prove() still finds a solution', () => {
  const level = load('level_004.json');
  const capped = solve(level, { weight: 0, maxStates: 50 });
  assert.equal(capped.truncated, true);
  assert.equal(capped.solved, false);
  const r = prove(level);
  assert.equal(r.solvable, true);
  assert.equal(r.optimal, false);
});

test('analyze reports exact results when they fit the budget', () => {
  const r = analyze(load('level_003.json'), { metric: 'slides' });
  assert.deepEqual([r.solvable, r.optimal, r.slides], [true, true, 6]);
});

test('identical free letters share a state; stateKey round-trips through decodeKey', () => {
  const a = [new Piece({ id: 'x', letters: 'E', at: [0, 0] }), new Piece({ id: 'y', letters: 'E', at: [0, 1] })];
  const b = [new Piece({ id: 'y', letters: 'E', at: [0, 1] }), new Piece({ id: 'x', letters: 'E', at: [0, 0] })];
  assert.equal(stateKey(a), stateKey(b));
  const block = [
    new Piece({ id: 'p', letters: 'P', at: [0, 2], pin: 1 }),
    new Piece({ id: 'b', letters: 'IN', offsets: [[0, 0], [1, 0]], at: [2, 4], frozen: 2 }),
  ];
  assert.equal(stateKey(decodeKey(stateKey(block))), stateKey(block));
  const back = decodeKey(stateKey(block)).find((p) => p.letters === 'IN');
  assert.deepEqual([back.cells(), back.frozen, back.pin], [[[2, 4], [3, 4]], 2, null]);
});
