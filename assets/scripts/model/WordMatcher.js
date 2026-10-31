/**
 * WordMatcher — finds, for each pinned word on the board, the chain of 4-adjacent cells starting
 * at its pin that spells it (technical-design §5.1, spec Rules 4).
 * Engine-free; reads Board and Piece, mutates nothing.
 *
 * A chain step goes right, down, left or up; a cell is used once; frozen cells and other words'
 * pins never count. When no complete chain exists the longest prefix is reported for highlighting.
 */
'use strict';

const Board = require('Board');

/**
 * @param {Board} board
 * @param {{ words: string[] }} level
 * @param {Piece[]} pieces pieces currently on the board
 * @returns {{ wordIndex: number, cells: number[][], pieceIds: string[], complete: boolean }[]}
 *   one result per pinned piece still on the board, in word order
 */
function find(board, level, pieces) {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  return pieces
    .filter((p) => p.isPinned && board.pieceAt(p.at[0], p.at[1]) === p.id)
    .sort((a, b) => a.pin - b.pin)
    .map((pin) => {
      const word = level.words[pin.pin];
      const start = [pin.at[0], pin.at[1]];
      const cells = _longestChain(board, byId, pin.pin, word, start, 0, new Set([Board.key(start[0], start[1])]));
      const pieceIds = [];
      cells.forEach(([r, c]) => {
        const id = board.pieceAt(r, c);
        if (!pieceIds.includes(id)) {
          pieceIds.push(id);
        }
      });
      return { wordIndex: pin.pin, cells, pieceIds, complete: cells.length === word.length };
    });
}

/** Depth-first: returns the first complete chain in scan order, else the longest prefix. */
function _longestChain(board, byId, wordIndex, word, cell, index, visited) {
  if (index === word.length - 1) {
    return [cell];
  }
  let best = [];
  for (const [dr, dc] of Board.STEPS) {
    const r = cell[0] + dr;
    const c = cell[1] + dc;
    const k = Board.key(r, c);
    const id = board.pieceAt(r, c);
    if (id === null || visited.has(k)) {
      continue;
    }
    const piece = byId.get(id);
    if (!piece || piece.isFrozen || (piece.isPinned && piece.pin !== wordIndex)) {
      continue;
    }
    if (piece.letterAt(r, c) !== word[index + 1]) {
      continue;
    }
    visited.add(k);
    const sub = _longestChain(board, byId, wordIndex, word, [r, c], index + 1, visited);
    visited.delete(k);
    if (index + 1 + sub.length === word.length) {
      return [cell].concat(sub);
    }
    if (sub.length > best.length) {
      best = sub;
    }
  }
  return [cell].concat(best);
}

module.exports = { find };
