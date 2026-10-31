'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const EventBus = require('EventBus');
const GameSession = require('GameSession');
const { EVENTS, SESSION_STATE, REJECT, COINS_PER_WORD } = require('Constants');

const levelsDir = path.join(__dirname, '..', '..', 'assets', 'resources', 'levels');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(levelsDir, name), 'utf8'));
}

/** Starts a session on a shipped level and records every emitted event. */
function start(name) {
  const bus = new EventBus();
  const events = [];
  Object.values(EVENTS).forEach((e) => bus.on(e, (payload) => events.push({ e, payload })));
  const session = new GameSession(bus);
  session.load(load(name));
  return { session, events };
}

/** Drags the piece at (fromR, fromC) along the shortest free path to (toR, toC), releases, finishes animations. */
function slide(session, fromR, fromC, toR, toC) {
  const id = session.board.pieceAt(fromR, fromC);
  assert.ok(id, `no piece at [${fromR},${fromC}]`);
  assert.deepEqual(session.beginDrag(id), { ok: true }, `beginDrag ${id}`);
  const steps = session.findPath(id, toR, toC);
  assert.ok(steps, `no path for ${id} to [${toR},${toC}]`);
  steps.forEach(([r, c]) => assert.equal(session.dragStep(id, r, c).ok, true));
  const result = session.endDrag(id);
  session.animationsDone();
  return result;
}

function found(session) {
  return [...session.foundWords].map((i) => session.level.words[i]);
}

function assertNoOverlap(session) {
  const seen = new Map();
  session.pieces.forEach((p) => p.cells().forEach(([r, c]) => {
    const k = r + ',' + c;
    assert.ok(!seen.has(k), `${p.id} overlaps ${seen.get(k)} at ${k}`);
    seen.set(k, p.id);
    assert.equal(session.board.pieceAt(r, c), p.id);
  }));
}

test('load builds the board and enters IDLE', () => {
  const { session, events } = start('level_001.json');
  assert.equal(session.state, SESSION_STATE.IDLE);
  assert.equal(session.pieces.length, 6);
  assert.equal(events[0].e, EVENTS.LEVEL_LOADED);
  assertNoOverlap(session);
});

test('load rejects invalid level data', () => {
  const level = load('level_001.json');
  level.pieces[2].at = [9, 9];
  assert.throws(() => new GameSession(new EventBus()).load(level), /invalid/);
});

test('level 1: N dragged up from [2,1] passes through [1,1] in two steps and ONE clears', () => {
  const { session, events } = start('level_001.json');
  const n = session.board.pieceAt(2, 1);
  session.beginDrag(n);
  assert.deepEqual(session.findPath(n, 0, 1), [[1, 1], [0, 1]]);
  assert.equal(session.dragStep(n, 1, 1).ok, true);
  assertNoOverlap(session);
  assert.equal(session.dragStep(n, 0, 1).ok, true);
  const moves = events.filter((x) => x.e === EVENTS.PIECE_MOVED).map((x) => x.payload.to);
  assert.deepEqual(moves, [[1, 1], [0, 1]]);
  assert.deepEqual(session.endDrag(n), { ok: true, cleared: 1 });
  const cleared = events.find((x) => x.e === EVENTS.WORD_CLEARED).payload;
  assert.equal(cleared.word, 'ONE');
  assert.deepEqual(cleared.cells, [[0, 0], [0, 1], [0, 2]]);
  assert.ok([[0, 0], [0, 1], [0, 2]].every(([r, c]) => session.board.isFree(r, c)), 'cells are free');
  assert.equal(session.state, SESSION_STATE.RESOLVING);
  assert.equal(session.beginDrag(session.board.pieceAt(1, 2)).reason, REJECT.BUSY, 'input locked while resolving');
  session.animationsDone();
  assert.equal(session.state, SESSION_STATE.IDLE);
});

test('level 1: full playthrough completes with coins', () => {
  const { session, events } = start('level_001.json');
  slide(session, 2, 1, 0, 1); // N → ONE
  slide(session, 1, 2, 2, 1); // W next to T, O already after it → TWO
  assert.deepEqual(found(session), ['ONE', 'TWO']);
  assert.equal(session.isComplete(), true);
  assert.equal(session.coins, 2 * COINS_PER_WORD);
  const done = events.find((x) => x.e === EVENTS.LEVEL_COMPLETE).payload;
  assert.equal(done.levelId, 1);
  assert.equal(session.beginDrag('p0').ok, false, 'no input after completion');
});

test('a step onto an occupied cell is refused and the board is unchanged', () => {
  const { session, events } = start('level_001.json');
  const n = session.board.pieceAt(2, 1);
  session.beginDrag(n);
  assert.deepEqual(session.dragStep(n, 2, 2), { ok: false, reason: REJECT.BLOCKED });
  assert.deepEqual(session.piece(n).at, [2, 1]);
  assert.equal(session.board.pieceAt(2, 2), 'p5');
  assert.equal(events.at(-1).e, EVENTS.PIECE_REJECTED);
  assert.equal(session.state, SESSION_STATE.DRAGGING, 'the drag continues');
});

test('a two-cell jump and a step off the board are refused', () => {
  const { session } = start('level_001.json');
  const n = session.board.pieceAt(2, 1);
  session.beginDrag(n);
  assert.equal(session.dragStep(n, 0, 1).reason, REJECT.NOT_ADJACENT);
  assert.equal(session.dragStep(n, 3, 1).reason, REJECT.BLOCKED);
  assert.deepEqual(session.piece(n).at, [2, 1]);
});

test('pinned and frozen pieces cannot be dragged; steps need an active drag', () => {
  const { session } = start('level_003.json');
  assert.equal(session.beginDrag(session.board.pieceAt(0, 2)).reason, REJECT.PINNED);
  assert.equal(session.beginDrag(session.board.pieceAt(2, 1)).reason, REJECT.FROZEN);
  assert.equal(session.beginDrag('nope').reason, REJECT.UNKNOWN_PIECE);
  assert.equal(session.dragStep('p4', 0, 1).reason, REJECT.NOT_DRAGGING);
  session.beginDrag('p4');
  assert.equal(session.dragStep('p3', 1, 3).reason, REJECT.NOT_DRAGGING, 'only the dragged piece may step');
  assert.equal(session.endDrag('p3').ok, false);
});

test('releasing on the origin cell re-runs matching without changes', () => {
  const { session, events } = start('level_001.json');
  const e = session.board.pieceAt(0, 2);
  session.beginDrag(e);
  assert.deepEqual(session.endDrag(e), { ok: true, cleared: 0 });
  assert.equal(session.state, SESSION_STATE.IDLE);
  assert.equal(events.at(-1).e, EVENTS.WORD_PROGRESS);
});

test('level 3: E left of P alone is a prefix, not a clear', () => {
  const { session, events } = start('level_003.json');
  slide(session, 1, 1, 0, 1);
  const progress = events.filter((x) => x.e === EVENTS.WORD_PROGRESS).at(-1).payload.prefixes;
  const pea = progress.find((p) => p.wordIndex === 0);
  assert.deepEqual(pea.cells, [[0, 2], [0, 1]]);
  assert.equal(session.foundWords.size, 0);
});

test('level 3: L-shaped PEA clears, I thaws 1→0, LILY completes the level', () => {
  const { session, events } = start('level_003.json');
  const i = session.board.pieceAt(2, 1);
  slide(session, 1, 1, 0, 1); // E left of P
  slide(session, 0, 3, 1, 1); // A below E → PEA
  assert.deepEqual(found(session), ['PEA']);
  assert.deepEqual(events.find((x) => x.e === EVENTS.FREEZE_TICK).payload, { pieceId: i, remaining: 0 });
  assert.deepEqual(events.find((x) => x.e === EVENTS.FREEZE_THAWED).payload, { pieceId: i });
  assert.equal(session.beginDrag(i).ok, true, 'thawed piece can be dragged');
  session.endDrag(i);
  slide(session, 2, 1, 1, 1); // I right of pinned L
  slide(session, 2, 2, 1, 2); // L
  slide(session, 0, 0, 0, 2); // Y above L → LILY
  assert.deepEqual(found(session), ['PEA', 'LILY']);
  assert.equal(session.isComplete(), true);
});

test('level 4: RED and BLUE thaw the IN block, which then moves as a unit; level completes', () => {
  const { session, events } = start('level_004.json');
  const inBlock = session.board.pieceAt(2, 4);
  // Clear room in the bottom arm, then route E and D next to R.
  slide(session, 3, 2, 5, 2); // N
  slide(session, 3, 1, 4, 2); // R (free)
  slide(session, 3, 3, 5, 3); // E
  slide(session, 2, 1, 4, 3); // K
  slide(session, 2, 2, 3, 1); // L
  slide(session, 1, 2, 2, 1); // E
  slide(session, 1, 3, 2, 2); // D → RED
  assert.deepEqual(found(session), ['RED']);
  assert.equal(session.piece(inBlock).frozen, 1);
  slide(session, 2, 3, 2, 1); // U
  slide(session, 4, 3, 1, 3); // K out of the way
  slide(session, 5, 3, 2, 2); // E → BLUE
  assert.deepEqual(found(session), ['RED', 'BLUE']);
  assert.deepEqual(events.filter((x) => x.e === EVENTS.FREEZE_TICK).map((x) => x.payload.remaining), [1, 0]);
  assert.equal(session.piece(inBlock).isFrozen, false);
  slide(session, 2, 4, 1, 2); // IN block, anchor I → [1,2], N → [2,2]
  assert.deepEqual(session.piece(inBlock).cells(), [[1, 2], [2, 2]]);
  assertNoOverlap(session);
  slide(session, 1, 3, 2, 3); // K → PINK
  assert.deepEqual(found(session), ['RED', 'BLUE', 'PINK']);
  slide(session, 4, 2, 1, 3); // R under B
  slide(session, 2, 5, 2, 3); // OW block
  slide(session, 5, 2, 4, 3); // N under W → BROWN
  assert.deepEqual(found(session), ['RED', 'BLUE', 'PINK', 'BROWN']);
  assert.equal(session.isComplete(), true);
  assert.equal(session.coins, 4 * COINS_PER_WORD);
});

function startInline(level) {
  const bus = new EventBus();
  const events = [];
  Object.values(EVENTS).forEach((e) => bus.on(e, (payload) => events.push({ e, payload })));
  const session = new GameSession(bus);
  session.load({ id: 99, topic: 'T', ...level });
  return { session, events };
}

test('a thaw re-runs matching: one move can clear two words in sequence', () => {
  const { session, events } = startInline({
    words: ['AB', 'CD'],
    shape: ['###', '###'],
    pieces: [
      { letters: 'A', at: [0, 0], pin: 0 },
      { letters: 'C', at: [1, 0], pin: 1 },
      { letters: 'D', at: [1, 1], frozen: 1 },
      { letters: 'B', at: [0, 2] },
    ],
  });
  const result = slide(session, 0, 2, 0, 1);
  assert.equal(result.cleared, 2);
  assert.deepEqual(events.filter((x) => x.e === EVENTS.WORD_CLEARED).map((x) => x.payload.word), ['AB', 'CD']);
  assert.equal(session.isComplete(), true);
});

test('two words completed through one shared block: the first in word order clears', () => {
  const { session } = startInline({
    words: ['AB', 'CD'],
    shape: ['####', '####'],
    pieces: [
      { letters: 'A', at: [0, 0], pin: 0 },
      { letters: 'C', at: [0, 3], pin: 1 },
      { letters: 'BD', at: [1, 1], cells: [[0, 0], [0, 1]] },
    ],
  });
  assert.equal(slide(session, 1, 1, 0, 1).cleared, 1);
  assert.deepEqual(found(session), ['AB']);
  assert.equal(session.state, SESSION_STATE.IDLE);
});
