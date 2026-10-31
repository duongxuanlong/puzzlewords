/**
 * GameSession — state machine for one level: LOADED → IDLE ⇄ DRAGGING → RESOLVING → IDLE | COMPLETE.
 * Engine-free. Owns the Board and Pieces, runs WordMatcher and FreezeSystem, emits EVENTS on the bus.
 * See docs/design/technical-design.md §4.
 *
 * Input contract (DragController): beginDrag(id), then dragStep(id, r, c) once per 4-adjacent
 * cell (each step is committed to the board immediately), then endDrag(id), which runs matching.
 * When a word clears the session stays RESOLVING until the view calls animationsDone().
 */
'use strict';

const Board = require('Board');
const Piece = require('Piece');
const WordMatcher = require('WordMatcher');
const FreezeSystem = require('FreezeSystem');
const { validateLevel } = require('LevelSchema');
const { EVENTS, SESSION_STATE, REJECT, COINS_PER_WORD, LEVEL_REWARD } = require('Constants');

function cellsCopy(cells) {
  return cells.map((c) => [c[0], c[1]]);
}

class GameSession {
  /** @param {EventBus} bus */
  constructor(bus) {
    this.bus = bus;
    this.state = SESSION_STATE.LOADED;
    this.level = null;
    this.board = null;
    this.pieces = [];
    this.foundWords = new Set();
    this.coins = 0;
    this._dragId = null;
  }

  /** Builds board and pieces from a level definition (also used for Restart). Throws on invalid data. */
  load(levelDef) {
    const errors = validateLevel(levelDef);
    if (errors.length) {
      throw new Error(`GameSession.load: level ${levelDef && levelDef.id} invalid: ${errors[0]}`);
    }
    this.level = levelDef;
    this.board = new Board(levelDef.shape);
    this.pieces = levelDef.pieces.map((def, i) => Piece.fromLevel(def, i));
    this.pieces.forEach((p) => this.board.place(p, p.at[0], p.at[1]));
    this.foundWords = new Set();
    this.coins = 0;
    this._dragId = null;
    this.state = SESSION_STATE.IDLE;
    this.bus.emit(EVENTS.LEVEL_LOADED, { level: levelDef });
  }

  /** @returns {Piece|null} */
  piece(pieceId) {
    return this.pieces.find((p) => p.id === pieceId) || null;
  }

  isComplete() {
    return this.state === SESSION_STATE.COMPLETE;
  }

  /** @returns {{ ok: boolean, reason?: string }} */
  beginDrag(pieceId) {
    if (this.state !== SESSION_STATE.IDLE) {
      return { ok: false, reason: REJECT.BUSY };
    }
    const piece = this.piece(pieceId);
    if (!piece) {
      return { ok: false, reason: REJECT.UNKNOWN_PIECE };
    }
    if (piece.isPinned) {
      return { ok: false, reason: REJECT.PINNED };
    }
    if (piece.isFrozen) {
      return { ok: false, reason: REJECT.FROZEN };
    }
    this._dragId = pieceId;
    this.state = SESSION_STATE.DRAGGING;
    this.bus.emit(EVENTS.DRAG_STARTED, { pieceId });
    return { ok: true };
  }

  /** Moves the dragged piece's anchor one cell (up/down/left/right) to (row, col). */
  dragStep(pieceId, row, col) {
    if (this.state !== SESSION_STATE.DRAGGING || pieceId !== this._dragId) {
      return this._reject(pieceId, REJECT.NOT_DRAGGING);
    }
    const piece = this.piece(pieceId);
    const from = [piece.at[0], piece.at[1]];
    if (Math.abs(row - from[0]) + Math.abs(col - from[1]) !== 1) {
      return this._reject(pieceId, REJECT.NOT_ADJACENT);
    }
    if (!this.board.canPlace(piece, row, col)) {
      return this._reject(pieceId, REJECT.BLOCKED);
    }
    this.board.place(piece, row, col);
    this.bus.emit(EVENTS.PIECE_MOVED, { pieceId, from, to: [row, col] });
    return { ok: true };
  }

  /** Releases the dragged piece where it is and runs matching. */
  endDrag(pieceId) {
    if (this.state !== SESSION_STATE.DRAGGING || pieceId !== this._dragId) {
      return { ok: false, reason: REJECT.NOT_DRAGGING };
    }
    this._dragId = null;
    this.state = SESSION_STATE.RESOLVING;
    this.bus.emit(EVENTS.DRAG_ENDED, { pieceId });
    const cleared = this._resolve();
    if (this.foundWords.size === this.level.words.length) {
      this.state = SESSION_STATE.COMPLETE;
      this.bus.emit(EVENTS.LEVEL_COMPLETE, { levelId: this.level.id, coins: this.coins, reward: LEVEL_REWARD });
    } else if (!cleared) {
      this.state = SESSION_STATE.IDLE;
    }
    return { ok: true, cleared };
  }

  /** The view finished clear/thaw animations; input is accepted again. */
  animationsDone() {
    if (this.state === SESSION_STATE.RESOLVING) {
      this.state = SESSION_STATE.IDLE;
    }
  }

  /** @returns {number[][]|null} single-cell steps from the piece's anchor to (row, col), see Board.findPath */
  findPath(pieceId, row, col) {
    const piece = this.piece(pieceId);
    return piece ? this.board.findPath(piece, row, col) : null;
  }

  /** Clears every complete word, ticks freeze per clear, repeats until stable. @returns {number} words cleared */
  _resolve() {
    let cleared = 0;
    for (;;) {
      const results = WordMatcher.find(this.board, this.level, this.pieces);
      const matches = results.filter((m) => m.complete);
      if (!matches.length) {
        this.bus.emit(EVENTS.WORD_PROGRESS, {
          prefixes: results.map((m) => ({ wordIndex: m.wordIndex, cells: cellsCopy(m.cells), pieceIds: m.pieceIds.slice() })),
        });
        return cleared;
      }
      matches.forEach((m) => {
        // Two matches may share a free letter; the first in word order wins, the next loop re-checks the other.
        if (!m.pieceIds.every((id) => this.piece(id))) {
          return;
        }
        this._clear(m);
        cleared += 1;
      });
    }
  }

  _clear(match) {
    match.pieceIds.forEach((id) => this.board.remove(id));
    this.pieces = this.pieces.filter((p) => !match.pieceIds.includes(p.id));
    this.foundWords.add(match.wordIndex);
    this.coins += COINS_PER_WORD;
    this.bus.emit(EVENTS.WORD_CLEARED, {
      wordIndex: match.wordIndex,
      word: this.level.words[match.wordIndex],
      cells: cellsCopy(match.cells),
      pieceIds: match.pieceIds.slice(),
    });
    const { ticked, thawed } = FreezeSystem.tick(this.pieces);
    ticked.forEach((t) => this.bus.emit(EVENTS.FREEZE_TICK, t));
    thawed.forEach((pieceId) => this.bus.emit(EVENTS.FREEZE_THAWED, { pieceId }));
  }

  _reject(pieceId, reason) {
    this.bus.emit(EVENTS.PIECE_REJECTED, { pieceId, reason });
    return { ok: false, reason };
  }
}

module.exports = GameSession;
