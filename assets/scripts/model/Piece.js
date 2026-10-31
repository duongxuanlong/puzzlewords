/**
 * Piece — one letter tile or a linked block of up to three letters.
 * Engine-free. Position (`at`) and the freeze counter are mutable; letters and offsets are not.
 * Created from a level's `pieces[]` entry by `Piece.fromLevel` (see LevelSchema for the format).
 */
'use strict';

class Piece {
  /**
   * @param {object} def
   * @param {string} def.id
   * @param {string} def.letters one char per cell
   * @param {number[][]} [def.offsets] [dRow, dCol] per letter, first is [0, 0]
   * @param {number[]} def.at anchor [row, col]
   * @param {number|null} [def.pin] word index when this is a pinned first letter
   * @param {number} [def.frozen] remaining freeze counter, 0 = thawed
   */
  constructor({ id, letters, offsets, at, pin, frozen }) {
    const cellOffsets = offsets || [[0, 0]];
    if (cellOffsets.length !== letters.length) {
      throw new Error(`Piece ${id}: ${letters.length} letters but ${cellOffsets.length} offsets`);
    }
    this.id = id;
    this.letters = letters;
    this.offsets = Object.freeze(cellOffsets.map((o) => Object.freeze([o[0], o[1]])));
    this.at = [at[0], at[1]];
    this.pin = pin === undefined ? null : pin;
    this.frozen = frozen || 0;
    Object.defineProperty(this, 'letters', { writable: false });
    Object.defineProperty(this, 'offsets', { writable: false });
  }

  /** @returns {Piece} piece for `level.pieces[index]`, id "p<index>" */
  static fromLevel(def, index) {
    return new Piece({
      id: 'p' + index,
      letters: def.letters,
      offsets: def.cells,
      at: def.at,
      pin: def.pin,
      frozen: def.frozen,
    });
  }

  get isPinned() {
    return this.pin !== null;
  }

  get isFrozen() {
    return this.frozen > 0;
  }

  /** Pinned letters never move; frozen pieces move once thawed. */
  get canMove() {
    return !this.isPinned && !this.isFrozen;
  }

  /** @returns {number[][]} absolute [row, col] per letter, anchored at `at` or at (row, col) if given */
  cells(row, col) {
    const r0 = row === undefined ? this.at[0] : row;
    const c0 = col === undefined ? this.at[1] : col;
    return this.offsets.map((o) => [r0 + o[0], c0 + o[1]]);
  }

  /** @returns {string|null} letter on board cell (row, col), null if the piece does not cover it */
  letterAt(row, col) {
    const i = this.offsets.findIndex((o) => this.at[0] + o[0] === row && this.at[1] + o[1] === col);
    return i < 0 ? null : this.letters[i];
  }

  /**
   * Shape signature used by PieceNode to pick the block texture, e.g. "0,0|1,0" for a vertical pair.
   * Normalised so the top-most (then left-most) cell is 0,0, independent of letter order.
   */
  shapeKey() {
    const sorted = this.offsets.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [r0, c0] = sorted[0];
    return sorted.map((o) => `${o[0] - r0},${o[1] - c0}`).join('|');
  }
}

module.exports = Piece;
