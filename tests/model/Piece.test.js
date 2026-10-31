'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Piece = require('Piece');

test('a single piece covers its anchor cell', () => {
  const p = Piece.fromLevel({ letters: 'E', at: [1, 2] }, 3);
  assert.equal(p.id, 'p3');
  assert.deepEqual(p.cells(), [[1, 2]]);
  assert.equal(p.letterAt(1, 2), 'E');
  assert.equal(p.letterAt(0, 0), null);
});

test('a linked block derives its cells from anchor + offsets', () => {
  const p = Piece.fromLevel({ letters: 'IN', at: [2, 4], cells: [[0, 0], [1, 0]], frozen: 2 }, 9);
  assert.deepEqual(p.cells(), [[2, 4], [3, 4]]);
  assert.deepEqual(p.cells(0, 0), [[0, 0], [1, 0]]);
  assert.equal(p.letterAt(3, 4), 'N');
});

test('pinned and frozen pieces cannot move', () => {
  assert.equal(Piece.fromLevel({ letters: 'O', at: [0, 0], pin: 0 }, 0).canMove, false);
  const frozen = Piece.fromLevel({ letters: 'I', at: [0, 0], frozen: 1 }, 1);
  assert.equal(frozen.isFrozen, true);
  assert.equal(frozen.canMove, false);
  frozen.frozen = 0;
  assert.equal(frozen.canMove, true);
  assert.equal(Piece.fromLevel({ letters: 'A', at: [0, 0] }, 2).isPinned, false);
});

test('letters and offsets are immutable', () => {
  const p = Piece.fromLevel({ letters: 'OW', at: [0, 0], cells: [[0, 0], [1, 0]] }, 0);
  assert.throws(() => { p.letters = 'XX'; });
  assert.throws(() => { p.offsets[0][0] = 5; });
  assert.equal(p.letters, 'OW');
});

test('shapeKey matches the texture table regardless of letter order', () => {
  const key = (cells) => new Piece({ id: 'x', letters: 'ABC'.slice(0, cells.length), offsets: cells, at: [0, 0] }).shapeKey();
  assert.equal(key([[0, 0]]), '0,0');
  assert.equal(key([[0, 0], [0, 1]]), '0,0|0,1');
  assert.equal(key([[0, 0], [1, 0]]), '0,0|1,0');
  assert.equal(key([[0, 0], [-1, 0]]), '0,0|1,0');
  assert.equal(key([[0, 0], [1, 0], [1, 1]]), '0,0|1,0|1,1');
  assert.equal(key([[1, 0], [0, 0], [1, -1]]), '0,0|1,-1|1,0');
});

test('rejects letters/offsets length mismatch', () => {
  assert.throws(() => new Piece({ id: 'x', letters: 'AB', offsets: [[0, 0]], at: [0, 0] }), /2 letters/);
});
