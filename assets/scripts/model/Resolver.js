/**
 * Resolver — what happens after a piece is released (technical-design §4 resolve loop):
 * clear every complete word, tick freeze once per clear, repeat until nothing more clears.
 * Engine-free. Shared by GameSession (which turns the result into events) and Solver.
 */
'use strict';

const WordMatcher = require('WordMatcher');
const FreezeSystem = require('FreezeSystem');

/**
 * Mutates `board` (removes cleared pieces) and the freeze counters of the remaining pieces.
 * @param {Board} board
 * @param {{ words: string[] }} level
 * @param {Piece[]} pieces pieces on the board
 * @returns {{
 *   pieces: Piece[],
 *   clears: { match: object, ticked: { pieceId: string, remaining: number }[], thawed: string[] }[],
 *   progress: object[]
 * }} remaining pieces, clears in order, and the final WordMatcher results (prefixes) once stable
 */
function resolve(board, level, pieces) {
  let remaining = pieces;
  const clears = [];
  for (;;) {
    const results = WordMatcher.find(board, level, remaining);
    const matches = results.filter((m) => m.complete);
    if (!matches.length) {
      return { pieces: remaining, clears, progress: results };
    }
    matches.forEach((m) => {
      // Two matches may share a block; the first in word order wins, the next loop re-checks the other.
      if (!m.pieceIds.every((id) => remaining.some((p) => p.id === id))) {
        return;
      }
      m.pieceIds.forEach((id) => board.remove(id));
      remaining = remaining.filter((p) => !m.pieceIds.includes(p.id));
      const { ticked, thawed } = FreezeSystem.tick(remaining);
      clears.push({ match: m, ticked, thawed });
    });
  }
}

module.exports = { resolve };
