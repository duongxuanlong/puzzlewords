'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Piece = require('Piece');
const FreezeSystem = require('FreezeSystem');

function pieces() {
  return [
    new Piece({ id: 'a', letters: 'A', at: [0, 0], frozen: 2 }),
    new Piece({ id: 'b', letters: 'B', at: [0, 1], frozen: 1 }),
    new Piece({ id: 'c', letters: 'C', at: [0, 2] }),
  ];
}

test('each tick decrements every frozen counter by 1', () => {
  const ps = pieces();
  const { ticked } = FreezeSystem.tick(ps);
  assert.deepEqual(ticked, [{ pieceId: 'a', remaining: 1 }, { pieceId: 'b', remaining: 0 }]);
  assert.deepEqual(ps.map((p) => p.frozen), [1, 0, 0]);
});

test('a piece thaws exactly once, at zero', () => {
  const ps = pieces();
  assert.deepEqual(FreezeSystem.tick(ps).thawed, ['b']);
  assert.equal(ps[1].canMove, true);
  assert.deepEqual(FreezeSystem.tick(ps).thawed, ['a']);
  assert.deepEqual(FreezeSystem.tick(ps), { ticked: [], thawed: [] });
});

test('counters never go negative', () => {
  const ps = pieces();
  for (let i = 0; i < 5; i++) {
    FreezeSystem.tick(ps);
  }
  assert.ok(ps.every((p) => p.frozen === 0));
});
