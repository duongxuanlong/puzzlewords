'use strict';
// Every shipped level must be solvable under the sliding rule, and the solver's solution must
// also complete the level when replayed through the real GameSession (solver and game agree).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const EventBus = require('EventBus');
const GameSession = require('GameSession');
const { prove } = require('Solver');

const levelsDir = path.join(__dirname, '..', '..', 'assets', 'resources', 'levels');
const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json')).sort();

/** Plays one solver move as a real drag: beginDrag, single-cell dragSteps along findPath, endDrag. */
function play(session, move) {
  const id = session.board.pieceAt(move.from[0], move.from[1]);
  assert.equal(session.piece(id).letters, move.letters, `expected ${move.letters} at [${move.from}]`);
  assert.equal(session.beginDrag(id).ok, true);
  const steps = session.findPath(id, move.to[0], move.to[1]);
  assert.equal(steps.length, move.slides, 'solver distance equals the game path length');
  steps.forEach(([r, c]) => assert.equal(session.dragStep(id, r, c).ok, true));
  const { cleared } = session.endDrag(id);
  assert.equal(cleared, move.cleared.length, `move ${move.letters} → [${move.to}] clears ${move.cleared}`);
  session.animationsDone();
}

for (const file of files) {
  test(`${file} is solvable and its solution replays in GameSession`, () => {
    const level = JSON.parse(fs.readFileSync(path.join(levelsDir, file), 'utf8'));
    const proof = prove(level);
    assert.equal(proof.solvable, true, `${file} has no solution under the sliding rule`);
    const session = new GameSession(new EventBus());
    session.load(level);
    proof.solution.forEach((move) => play(session, move));
    assert.equal(session.isComplete(), true);
  });
}
