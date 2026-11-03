'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const LevelDocument = require('LevelDocument');

const level1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/resources/levels/level_001.json'), 'utf8'));

/** A doc with ONE / TWO authored through the API (same board as level_001). */
function authored() {
  const doc = new LevelDocument();
  doc.resize(3, 3);
  doc.setTopic('number');
  doc.addWord('one');
  doc.addWord('two');
  [['O', 0, 0], ['T', 2, 0], ['E', 0, 2], ['W', 1, 2], ['N', 2, 1], ['O', 2, 2]].forEach(([l, r, c]) => doc.setLetter(r, c, l));
  doc.togglePin(0, 0, 0);
  doc.togglePin(2, 0, 1);
  return doc;
}

test('a blank document is a 5x5 of playable cells with nothing on it', () => {
  const doc = new LevelDocument();
  assert.equal(doc.rows, 5);
  assert.equal(doc.cols, 5);
  assert.deepEqual(doc.words, []);
  assert.deepEqual(doc.pieces, []);
  assert.ok(doc.validate().length > 0);
});

test('a level authored through the API validates and matches level_001', () => {
  const doc = authored();
  assert.deepEqual(doc.validate(), []);
  const out = doc.toLevel();
  assert.deepEqual(out.shape, level1.shape);
  assert.deepEqual(out.words, level1.words);
  assert.equal(out.topic, 'NUMBER');
  assert.deepEqual(out.pieces, level1.pieces);
});

test('editing an existing level round-trips without touching the source object', () => {
  const doc = new LevelDocument(level1);
  assert.deepEqual(doc.toLevel(), level1);
  doc.setTopic('changed');
  assert.equal(level1.topic, 'NUMBER');
  assert.deepEqual(doc.validate(), []);
});

test('toggling a cell to a hole removes the piece on it; resize drops pieces outside', () => {
  const doc = authored();
  assert.ok(doc.toggleCell(1, 2));
  assert.equal(doc.isCell(1, 2), false);
  assert.equal(doc.pieceAt(1, 2), null);
  assert.ok(doc.validate().some((e) => /letter "W"/.test(e)));
  assert.ok(doc.toggleCell(1, 2));
  assert.equal(doc.isCell(1, 2), true);
  assert.ok(doc.resize(2, 3));
  assert.equal(doc.pieces.length, 2, 'O and E in the top two rows; W was removed with its hole');
  assert.equal(doc.resize(2, 3), false);
  assert.equal(doc.resize(0, 99), true);
  assert.equal(doc.rows, LevelDocument.MIN_SIZE);
  assert.equal(doc.cols, LevelDocument.MAX_SIZE);
});

test('setLetter places on empty cells, replaces on occupied ones, and refuses holes and junk', () => {
  const doc = new LevelDocument();
  assert.ok(doc.setLetter(0, 0, 'a'));
  assert.deepEqual(doc.pieceAt(0, 0), { letters: 'A', at: [0, 0] });
  assert.ok(doc.setLetter(0, 0, 'B'));
  assert.equal(doc.pieces.length, 1);
  assert.equal(doc.pieceAt(0, 0).letters, 'B');
  assert.equal(doc.setLetter(0, 0, '1'), false);
  assert.equal(doc.setLetter(0, 0, 'AB'), false);
  doc.toggleCell(1, 1);
  assert.equal(doc.setLetter(1, 1, 'C'), false);
  assert.ok(doc.erase(0, 0));
  assert.equal(doc.erase(0, 0), false);
});

test('pins are exclusive per word, single-letter only, and clear a freeze counter', () => {
  const doc = new LevelDocument();
  doc.addWord('AB');
  doc.setLetter(0, 0, 'A');
  doc.setLetter(0, 1, 'A');
  doc.setFrozen(0, 1, 2);
  assert.ok(doc.togglePin(0, 0, 0));
  assert.equal(doc.pieceAt(0, 0).pin, 0);
  assert.ok(doc.togglePin(0, 1, 0));
  assert.equal(doc.pieceAt(0, 0).pin, undefined);
  assert.equal(doc.pieceAt(0, 1).pin, 0);
  assert.equal(doc.pieceAt(0, 1).frozen, undefined);
  assert.ok(doc.togglePin(0, 1, 0));
  assert.equal(doc.pieceAt(0, 1).pin, undefined);
  assert.equal(doc.togglePin(0, 0, 1), false, 'no such word');
  assert.equal(doc.togglePin(2, 2, 0), false, 'no piece');
  doc.setLetter(1, 0, 'C');
  doc.link(0, 0, 1, 0);
  assert.equal(doc.togglePin(0, 0, 0), false, 'blocks cannot be pinned');
});

test('freeze counters cycle 0→1→2→3→0, clamp, and never apply to pins', () => {
  const doc = new LevelDocument();
  doc.addWord('AB');
  doc.setLetter(0, 0, 'A');
  assert.ok(doc.cycleFrozen(0, 0));
  assert.equal(doc.pieceAt(0, 0).frozen, 1);
  doc.cycleFrozen(0, 0);
  doc.cycleFrozen(0, 0);
  assert.equal(doc.pieceAt(0, 0).frozen, 3);
  doc.cycleFrozen(0, 0);
  assert.equal(doc.pieceAt(0, 0).frozen, undefined);
  assert.ok(doc.setFrozen(0, 0, 99));
  assert.equal(doc.pieceAt(0, 0).frozen, LevelDocument.MAX_FREEZE);
  doc.setFrozen(0, 0, 0);
  doc.togglePin(0, 0, 0);
  assert.equal(doc.setFrozen(0, 0, 1), false);
});

test('link merges adjacent pieces into a block the schema accepts; unlink splits it', () => {
  const doc = new LevelDocument();
  doc.setLetter(0, 0, 'I');
  doc.setLetter(1, 0, 'N');
  doc.setLetter(1, 1, 'K');
  doc.setFrozen(1, 1, 2);
  assert.ok(doc.link(0, 0, 1, 0));
  assert.deepEqual(doc.pieceAt(1, 0), { letters: 'IN', at: [0, 0], cells: [[0, 0], [1, 0]] });
  assert.ok(doc.link(1, 0, 1, 1));
  assert.deepEqual(doc.pieceAt(1, 1), { letters: 'INK', at: [0, 0], cells: [[0, 0], [1, 0], [1, 1]], frozen: 2 });
  assert.ok(!doc.validate().some((e) => /cells|overlap|outside/.test(e)), 'block geometry is valid');
  doc.setLetter(0, 1, 'S');
  assert.equal(doc.link(0, 1, 0, 0), false, 'four letters is too many');
  assert.equal(doc.link(0, 0, 1, 0), false, 'same piece');
  assert.equal(doc.link(0, 1, 2, 2), false, 'not adjacent');
  assert.ok(doc.unlink(1, 1));
  assert.equal(doc.pieces.length, 4);
  assert.deepEqual(doc.pieceAt(1, 1), { letters: 'K', at: [1, 1], frozen: 2 });
  assert.equal(doc.unlink(1, 1), false);
});

test('removing a word unpins its piece and shifts higher pins down', () => {
  const doc = authored();
  assert.ok(doc.removeWord(0));
  assert.deepEqual(doc.words, ['TWO']);
  assert.equal(doc.pieceAt(0, 0).pin, undefined);
  assert.equal(doc.pieceAt(2, 0).pin, 0);
  assert.equal(doc.removeWord(5), false);
});

test('addWord normalises and rejects duplicates and short input', () => {
  const doc = new LevelDocument();
  assert.deepEqual(doc.addWord(' cat '), { ok: true });
  assert.equal(doc.addWord('CAT').ok, false);
  assert.equal(doc.addWord('a').ok, false);
  assert.equal(doc.addWord('c4t').ok, false);
  assert.deepEqual(doc.words, ['CAT']);
});

test('letterBalance lists only the letters that differ', () => {
  const doc = new LevelDocument();
  doc.addWord('ABC');
  doc.setLetter(0, 0, 'A');
  doc.setLetter(0, 1, 'A');
  assert.deepEqual(doc.letterBalance(), [
    { letter: 'A', needed: 1, provided: 2 },
    { letter: 'B', needed: 1, provided: 0 },
    { letter: 'C', needed: 1, provided: 0 },
  ]);
});

test('undo steps back through every mutation; no-op calls leave no history', () => {
  const doc = new LevelDocument();
  assert.equal(doc.canUndo, false);
  assert.equal(doc.undo(), false);
  doc.setLetter(0, 0, 'A');
  doc.setTopic('x');
  doc.setTopic('X'); // same value after normalisation: no change, no snapshot
  assert.ok(doc.undo());
  assert.equal(doc.topic, '');
  assert.equal(doc.pieceAt(0, 0).letters, 'A');
  assert.ok(doc.undo());
  assert.equal(doc.pieceAt(0, 0), null);
  assert.equal(doc.canUndo, false);
});
