'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateLevel, cellsOfShape, isConnected } = require('LevelSchema');

const levelsDir = path.join(__dirname, '..', '..', 'assets', 'resources', 'levels');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(levelsDir, name), 'utf8'));
}

test('every shipped level is valid', () => {
  const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'no levels found');
  for (const f of files) {
    assert.deepEqual(validateLevel(load(f)), [], `${f} should be valid`);
  }
});

test('cellsOfShape ignores holes', () => {
  const cells = cellsOfShape(['#.#', '###']);
  assert.equal(cells.size, 5);
  assert.ok(!cells.has('0,1'));
});

test('isConnected rejects diagonal-only blocks', () => {
  assert.equal(isConnected([[0, 0], [1, 1]]), false);
  assert.equal(isConnected([[0, 0], [1, 0], [1, 1]]), true);
});

test('rejects a piece outside the board', () => {
  const level = load('level_001.json');
  level.pieces[2].at = [0, 5];
  assert.ok(validateLevel(level).some((e) => e.includes('outside the board')));
});

test('rejects overlapping pieces', () => {
  const level = load('level_001.json');
  level.pieces[3].at = [0, 2];
  assert.ok(validateLevel(level).some((e) => e.includes('overlaps')));
});

test('rejects a word without a pin and letter mismatches', () => {
  const level = load('level_001.json');
  delete level.pieces[1].pin;
  const errors = validateLevel(level);
  assert.ok(errors.some((e) => e.includes('has no pinned piece')));
});

test('rejects pieces whose letters do not match the words', () => {
  const level = load('level_001.json');
  level.pieces[2].letters = 'X';
  const errors = validateLevel(level);
  assert.ok(errors.some((e) => e.startsWith('letter "X"')));
  assert.ok(errors.some((e) => e.startsWith('letter "E"')));
});

test('rejects frozen pins and oversized blocks', () => {
  const level = load('level_004.json');
  level.pieces[0].frozen = 1;
  level.pieces[9].letters = 'INKS';
  level.pieces[9].cells = [[0, 0], [1, 0], [2, 0], [3, 0]];
  const errors = validateLevel(level);
  assert.ok(errors.some((e) => e.includes('cannot be frozen')));
  assert.ok(errors.some((e) => e.includes('longer than 3')));
});
