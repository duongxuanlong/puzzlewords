'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EventBus = require('EventBus');

test('delivers payloads to subscribers with their context', () => {
  const bus = new EventBus();
  const ctx = { got: null };
  bus.on('word:cleared', function (p) { this.got = p; }, ctx);
  bus.emit('word:cleared', { wordIndex: 1 });
  assert.deepEqual(ctx.got, { wordIndex: 1 });
});

test('unsubscribe via off or the returned function', () => {
  const bus = new EventBus();
  let count = 0;
  const fn = () => count++;
  const unsubscribe = bus.on('a', fn);
  bus.emit('a');
  unsubscribe();
  bus.emit('a');
  bus.on('b', fn);
  bus.off('b', fn);
  bus.emit('b');
  bus.emit('nobody-listens');
  assert.equal(count, 1);
});

test('a handler removing itself during emit does not skip others', () => {
  const bus = new EventBus();
  const calls = [];
  const first = () => { calls.push(1); bus.off('a', first); };
  bus.on('a', first);
  bus.on('a', () => calls.push(2));
  bus.emit('a');
  assert.deepEqual(calls, [1, 2]);
});
