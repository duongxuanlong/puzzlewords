'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Board = require('Board');
const Piece = require('Piece');

function single(id, letter, at) {
  return new Piece({ id, letters: letter, at });
}

function vertical(id, at) {
  return new Piece({ id, letters: 'OW', offsets: [[0, 0], [1, 0]], at });
}

test('cells come from the shape, holes excluded', () => {
  const board = new Board(['#.#', '###']);
  assert.equal(board.rows, 2);
  assert.equal(board.cols, 3);
  assert.equal(board.has(0, 1), false);
  assert.equal(board.has(1, 1), true);
  assert.equal(board.has(5, 5), false);
  assert.equal(board.freeCells().length, 5);
});

test('place / remove update occupancy', () => {
  const board = new Board(['###']);
  const a = single('a', 'A', [0, 0]);
  board.place(a, 0, 0);
  assert.equal(board.pieceAt(0, 0), 'a');
  assert.equal(board.isFree(0, 0), false);
  board.place(a, 0, 2);
  assert.deepEqual(a.at, [0, 2]);
  assert.equal(board.pieceAt(0, 0), null);
  assert.equal(board.pieceAt(0, 2), 'a');
  board.remove('a');
  assert.equal(board.freeCells().length, 3);
  board.remove('missing');
});

test('rejects out-of-board, hole and overlapping placements', () => {
  const board = new Board(['#.#', '###']);
  const a = single('a', 'A', [0, 0]);
  const b = single('b', 'B', [1, 0]);
  board.place(a, 0, 0);
  board.place(b, 1, 0);
  assert.equal(board.canPlace(b, 0, 1), false, 'hole');
  assert.equal(board.canPlace(b, 2, 0), false, 'off board');
  assert.equal(board.canPlace(b, 0, 0), false, 'occupied');
  assert.throws(() => board.place(b, 0, 0), /does not fit/);
  assert.equal(board.pieceAt(1, 0), 'b', 'failed place leaves the board unchanged');
});

test('a block may shift over its own footprint but not off the board', () => {
  const board = new Board(['#', '#', '#']);
  const ow = vertical('ow', [0, 0]);
  board.place(ow, 0, 0);
  assert.equal(board.canPlace(ow, 1, 0), true);
  board.place(ow, 1, 0);
  assert.deepEqual([board.pieceAt(0, 0), board.pieceAt(1, 0), board.pieceAt(2, 0)], [null, 'ow', 'ow']);
  assert.equal(board.canPlace(ow, 2, 0), false);
});

test('findPath follows a straight corridor', () => {
  const board = new Board(['####']);
  const a = single('a', 'A', [0, 0]);
  board.place(a, 0, 0);
  assert.deepEqual(board.findPath(a, 0, 3), [[0, 1], [0, 2], [0, 3]]);
  assert.deepEqual(board.findPath(a, 0, 0), []);
});

test('findPath detours around another piece', () => {
  const board = new Board(['###', '###']);
  const a = single('a', 'A', [0, 0]);
  const b = single('b', 'B', [0, 1]);
  board.place(a, 0, 0);
  board.place(b, 0, 1);
  assert.deepEqual(board.findPath(a, 0, 2), [[1, 0], [1, 1], [1, 2], [0, 2]]);
});

test('findPath: a block does not fit through a one-cell gap, a single letter does', () => {
  // Row 1 has a single opening at column 1; below it is open space.
  const board = new Board(['###', '#.#', '###', '###']);
  const ow = new Piece({ id: 'ow', letters: 'OW', offsets: [[0, 0], [0, 1]], at: [0, 0] });
  board.place(ow, 0, 0);
  const wall = single('w', 'X', [1, 0]);
  board.place(wall, 1, 0);
  assert.equal(board.findPath(ow, 2, 0), null);
  const a = single('a', 'A', [0, 2]);
  board.remove('ow');
  board.place(a, 0, 2);
  assert.deepEqual(board.findPath(a, 2, 2), [[1, 2], [2, 2]]);
});

test('reachable lists every free anchor with its minimal distance', () => {
  const board = new Board(['###', '#.#']);
  const a = single('a', 'A', [0, 0]);
  const b = single('b', 'B', [0, 2]);
  board.place(a, 0, 0);
  board.place(b, 0, 2);
  const seen = board.reachable(a).map((x) => `${x.at}:${x.distance}`);
  assert.deepEqual(seen, ['0,0:0', '0,1:1', '1,0:1']);
  assert.equal(board.reachable(b).some((x) => x.at[0] === 1 && x.at[1] === 2), true);
});

test('clone has independent occupancy', () => {
  const board = new Board(['##']);
  const a = single('a', 'A', [0, 0]);
  board.place(a, 0, 0);
  const copy = board.clone();
  copy.place(a.clone(), 0, 1);
  assert.equal(board.pieceAt(0, 0), 'a');
  assert.equal(copy.pieceAt(0, 0), null);
  assert.equal(copy.pieceAt(0, 1), 'a');
});

test('findPath returns null for an unreachable or occupied target', () => {
  const board = new Board(['###']);
  const a = single('a', 'A', [0, 0]);
  const b = single('b', 'B', [0, 1]);
  board.place(a, 0, 0);
  board.place(b, 0, 1);
  assert.equal(board.findPath(a, 0, 2), null);
  assert.equal(board.findPath(a, 0, 1), null);
  assert.equal(board.findPath(a, 4, 4), null);
});
