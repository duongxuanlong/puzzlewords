/**
 * Board — playable cell set from a level's `shape` plus the occupancy map (cell → piece id).
 * Engine-free. Knows footprints, not letters or words. Every placement goes through `place`,
 * so two pieces can never share a cell (docs/specs/word-puzzle-core.md, Rules 2).
 */
'use strict';

const { cellsOfShape } = require('LevelSchema');

const STEPS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // right, down, left, up

function key(row, col) {
  return row + ',' + col;
}

class Board {
  /** @param {string[]} shape rows of '#' (cell) and '.' (hole), top to bottom */
  constructor(shape) {
    this.rows = shape.length;
    this.cols = shape.length ? shape[0].length : 0;
    this.cells = cellsOfShape(shape);
    this._occupancy = new Map(); // "r,c" → pieceId
    this._footprints = new Map(); // pieceId → ["r,c", ...]
  }

  has(row, col) {
    return this.cells.has(key(row, col));
  }

  isFree(row, col) {
    return this.has(row, col) && !this._occupancy.has(key(row, col));
  }

  /** @returns {string|null} id of the piece covering (row, col) */
  pieceAt(row, col) {
    const id = this._occupancy.get(key(row, col));
    return id === undefined ? null : id;
  }

  /** @returns {number[][]} free cells in row-major order */
  freeCells() {
    const free = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.isFree(r, c)) {
          free.push([r, c]);
        }
      }
    }
    return free;
  }

  /**
   * Can `piece` be anchored at (row, col)? Cells the piece already covers count as free,
   * so a block may shift by one cell over its own footprint (technical-design §5.3).
   */
  canPlace(piece, row, col) {
    return piece.cells(row, col).every(([r, c]) => {
      const owner = this.pieceAt(r, c);
      return this.has(r, c) && (owner === null || owner === piece.id);
    });
  }

  /** Moves (or first places) `piece` so its anchor is (row, col) and updates `piece.at`. */
  place(piece, row, col) {
    if (!this.canPlace(piece, row, col)) {
      throw new Error(`Board.place: ${piece.id} does not fit at (${row},${col})`);
    }
    this._release(piece.id);
    const keys = piece.cells(row, col).map(([r, c]) => key(r, c));
    keys.forEach((k) => this._occupancy.set(k, piece.id));
    this._footprints.set(piece.id, keys);
    piece.at = [row, col];
  }

  /** Frees every cell of the piece. No-op if it is not on the board. */
  remove(pieceId) {
    this._release(pieceId);
  }

  /**
   * Shortest route of single-cell anchor steps from the piece's anchor to (row, col), moving the
   * whole footprint through free cells (breadth-first). Excludes the start cell.
   * @returns {number[][]|null} [[r, c], ...]; [] when already there; null when unreachable
   */
  findPath(piece, row, col) {
    const start = key(piece.at[0], piece.at[1]);
    const goal = key(row, col);
    if (start === goal) {
      return [];
    }
    if (!this.canPlace(piece, row, col)) {
      return null;
    }
    const cameFrom = new Map([[start, null]]);
    const queue = [piece.at];
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [dr, dc] of STEPS) {
        const nr = r + dr;
        const nc = c + dc;
        const k = key(nr, nc);
        if (cameFrom.has(k) || !this.canPlace(piece, nr, nc)) {
          continue;
        }
        cameFrom.set(k, [r, c]);
        if (k === goal) {
          return this._unwind(cameFrom, [nr, nc]);
        }
        queue.push([nr, nc]);
      }
    }
    return null;
  }

  _release(pieceId) {
    const keys = this._footprints.get(pieceId);
    if (keys) {
      keys.forEach((k) => this._occupancy.delete(k));
      this._footprints.delete(pieceId);
    }
  }

  _unwind(cameFrom, end) {
    const path = [];
    let cell = end;
    while (cameFrom.get(key(cell[0], cell[1])) !== null) {
      path.unshift(cell);
      cell = cameFrom.get(key(cell[0], cell[1]));
    }
    return path;
  }
}

Board.key = key;
Board.STEPS = STEPS;

module.exports = Board;
