/**
 * FreezeSystem — the ice counter rule (spec Rules 6): each cleared word decrements every frozen
 * piece's counter by 1; at 0 the piece thaws and becomes a normal, draggable, matchable piece.
 * Engine-free; mutates `piece.frozen` only.
 */
'use strict';

/**
 * Applies one tick (call once per cleared word, after that word's pieces are removed).
 * @param {Piece[]} pieces pieces still on the board
 * @returns {{ ticked: { pieceId: string, remaining: number }[], thawed: string[] }}
 */
function tick(pieces) {
  const ticked = [];
  const thawed = [];
  pieces.forEach((p) => {
    if (p.frozen > 0) {
      p.frozen -= 1;
      ticked.push({ pieceId: p.id, remaining: p.frozen });
      if (p.frozen === 0) {
        thawed.push(p.id);
      }
    }
  });
  return { ticked, thawed };
}

module.exports = { tick };
