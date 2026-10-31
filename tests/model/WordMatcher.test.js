'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Board = require('Board');
const Piece = require('Piece');
const WordMatcher = require('WordMatcher');

/** Builds a board from a letter picture: '.' hole, '_' empty cell, 'a'..'z' pin of words[n], A-Z free letter, '*' prefix marks frozen. */
function setup(rows, words, frozen) {
  const shape = rows.map((row) => row.replace(/[^.]/g, '#'));
  const board = new Board(shape);
  const pieces = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.' || ch === '_') {
        return;
      }
      const isPin = ch >= 'a' && ch <= 'z';
      const pin = isPin ? words.findIndex((w, i) => w[0] === ch.toUpperCase() && !pieces.some((p) => p.pin === i)) : null;
      const id = `r${r}c${c}`;
      const p = new Piece({ id, letters: ch.toUpperCase(), at: [r, c], pin, frozen: (frozen || []).includes(id) ? 1 : 0 });
      board.place(p, r, c);
      pieces.push(p);
    });
  });
  return { board, pieces, level: { words } };
}

function only(results, wordIndex) {
  return results.find((m) => m.wordIndex === wordIndex);
}

test('finds a straight chain from the pin', () => {
  const { board, pieces, level } = setup(['oNE', '___'], ['ONE']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, true);
  assert.deepEqual(m.cells, [[0, 0], [0, 1], [0, 2]]);
  assert.deepEqual(m.pieceIds, ['r0c0', 'r0c1', 'r0c2']);
});

test('finds the demo L-shaped PEA chain (leftward then down)', () => {
  const { board, pieces, level } = setup(['_Ep_', '_A__'], ['PEA']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, true);
  assert.deepEqual(m.cells, [[0, 2], [0, 1], [1, 1]]);
});

test('finds chains that step upward', () => {
  const { board, pieces, level } = setup(['E', 'N', 'o'], ['ONE']);
  assert.deepEqual(only(WordMatcher.find(board, level, pieces), 0).cells, [[2, 0], [1, 0], [0, 0]]);
  const s = setup(['_E', 'oN'], ['ONE']);
  assert.deepEqual(only(WordMatcher.find(s.board, s.level, s.pieces), 0).cells, [[1, 0], [1, 1], [0, 1]]);
});

test('ignores diagonal neighbours', () => {
  const { board, pieces, level } = setup(['o_', '_N'], ['ON']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, false);
  assert.deepEqual(m.cells, [[0, 0]]);
});

test('never reuses a cell', () => {
  // "ABA" would need to return to the pin cell.
  const { board, pieces, level } = setup(['aB'], ['ABA']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, false);
  assert.deepEqual(m.cells, [[0, 0], [0, 1]]);
});

test('trailing letters beyond the word are ignored', () => {
  const { board, pieces, level } = setup(['oNEX'], ['ONE']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, true);
  assert.deepEqual(m.pieceIds, ['r0c0', 'r0c1', 'r0c2']);
});

test('frozen cells do not count', () => {
  const { board, pieces, level } = setup(['oNE'], ['ONE'], ['r0c1']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, false);
  assert.deepEqual(m.cells, [[0, 0]]);
});

test("another word's pin is never part of a chain", () => {
  // TO from t; the O to its right is the pin of ON, so it cannot be used.
  const { board, pieces, level } = setup(['toN'], ['TO', 'ON']);
  const results = WordMatcher.find(board, level, pieces);
  assert.equal(only(results, 0).complete, false);
  assert.equal(only(results, 1).complete, true);
});

test('reports the longest prefix when incomplete', () => {
  const { board, pieces, level } = setup(['bR_', '__O', 'N__'], ['BROWN']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, false);
  assert.deepEqual(m.cells, [[0, 0], [0, 1]], 'O is diagonal to R');
  const s = setup(['bRO', '__W', '___'], ['BROWN']);
  assert.deepEqual(only(WordMatcher.find(s.board, s.level, s.pieces), 0).cells, [[0, 0], [0, 1], [0, 2], [1, 2]]);
});

test('first complete chain in scan order right, down, left, up wins', () => {
  // Both O-N-E rightward and O-N-E downward exist; right is scanned first.
  const { board, pieces, level } = setup(['oNE', 'N__', 'E__'], ['ONE']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.deepEqual(m.cells, [[0, 0], [0, 1], [0, 2]]);
});

test('a dead-end branch does not hide a complete chain', () => {
  // Right of the pin is N with no E after it; the downward N-E completes.
  const { board, pieces, level } = setup(['oN_', 'NE_'], ['ONE']);
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, true);
});

test('reads letters of linked blocks per cell', () => {
  const board = new Board(['###', '###']);
  const pin = new Piece({ id: 'p', letters: 'P', at: [0, 0], pin: 0 });
  const block = new Piece({ id: 'in', letters: 'IN', offsets: [[0, 0], [1, 0]], at: [0, 1] });
  const k = new Piece({ id: 'k', letters: 'K', at: [1, 2] });
  [pin, block, k].forEach((p) => board.place(p, p.at[0], p.at[1]));
  const m = WordMatcher.find(board, { words: ['PINK'] }, [pin, block, k])[0];
  assert.equal(m.complete, true);
  assert.deepEqual(m.pieceIds, ['p', 'in', 'k']);
});

test('a dense 6x6 board resolves quickly', () => {
  const rows = ['bRRRRR', 'RRRRRR', 'RRRRRR', 'RRRRRR', 'RRRRRR', 'RRRRRR'];
  const { board, pieces, level } = setup(rows, ['BRRRRRRX']);
  const t0 = process.hrtime.bigint();
  const m = only(WordMatcher.find(board, level, pieces), 0);
  assert.equal(m.complete, false);
  assert.equal(m.cells.length, 7);
  assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 < 200, 'search took too long');
});
