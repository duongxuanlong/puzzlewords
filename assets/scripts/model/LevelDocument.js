/**
 * LevelDocument — an editable level draft (ADR-0008). Engine-free; driven by ui/LevelEditor and
 * by the Node tests. Every mutator keeps the draft free of overlaps and off-board pieces, so the
 * schema validator (`validate()`) only ever reports authoring gaps: missing pins, letter balance,
 * empty words. Mutators return true when they changed something and push an undo snapshot first.
 * `toLevel()` is the exact JSON written to assets/resources/levels.
 */
'use strict';

const { validateLevel, cellsOfShape, pieceCells, MAX_BLOCK_SIZE } = require('LevelSchema');

const MIN_SIZE = 1;
const MAX_SIZE = 12;
const MAX_FREEZE = 9;
const HISTORY_LIMIT = 100;
const WORD_RE = /^[A-Z]{2,}$/;
const LETTER_RE = /^[A-Z]$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function key(r, c) {
  return r + ',' + c;
}

function adjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

class LevelDocument {
  /** @param {object} [level] a level definition to edit (deep-copied); a blank 5x5 when omitted */
  constructor(level) {
    this._history = [];
    this._set(level ? clone(level) : LevelDocument.blankLevel(1, 5, 5));
  }

  /** @returns {object} a valid-shaped empty level: all cells playable, no words, no pieces */
  static blankLevel(id, rows, cols) {
    return { id, topic: '', words: [], shape: Array.from({ length: rows }, () => '#'.repeat(cols)), pieces: [] };
  }

  // ---- reading ----------------------------------------------------------------------------------

  get id() {
    return this._level.id;
  }

  get topic() {
    return this._level.topic;
  }

  get words() {
    return this._level.words.slice();
  }

  get shape() {
    return this._level.shape.slice();
  }

  get rows() {
    return this._level.shape.length;
  }

  get cols() {
    return this._level.shape.length ? this._level.shape[0].length : 0;
  }

  /** @returns {object[]} deep copy of the piece definitions */
  get pieces() {
    return clone(this._level.pieces);
  }

  isCell(r, c) {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols && this._level.shape[r][c] === '#';
  }

  /** @returns {number} index into pieces of the piece covering (r, c), or -1 */
  pieceIndexAt(r, c) {
    const k = key(r, c);
    return this._level.pieces.findIndex((p) => pieceCells(p).some((cell) => key(cell[0], cell[1]) === k));
  }

  /** @returns {object|null} deep copy of the piece covering (r, c) */
  pieceAt(r, c) {
    const i = this.pieceIndexAt(r, c);
    return i < 0 ? null : clone(this._level.pieces[i]);
  }

  /** @returns {object} the level JSON (deep copy) */
  toLevel() {
    return clone(this._level);
  }

  /** @returns {string[]} schema problems; empty when the level can be played */
  validate() {
    return validateLevel(this._level);
  }

  /**
   * Letters the words need against letters the pieces provide, for the editor's hint line.
   * @returns {{ letter: string, needed: number, provided: number }[]} only letters that differ
   */
  letterBalance() {
    const needed = {};
    const provided = {};
    this._level.words.forEach((w) => {
      for (const ch of w) {
        needed[ch] = (needed[ch] || 0) + 1;
      }
    });
    this._level.pieces.forEach((p) => {
      for (const ch of p.letters) {
        provided[ch] = (provided[ch] || 0) + 1;
      }
    });
    return Array.from(new Set([...Object.keys(needed), ...Object.keys(provided)]))
      .sort()
      .map((letter) => ({ letter, needed: needed[letter] || 0, provided: provided[letter] || 0 }))
      .filter((b) => b.needed !== b.provided);
  }

  get canUndo() {
    return this._history.length > 0;
  }

  undo() {
    if (!this._history.length) {
      return false;
    }
    this._level = this._history.pop();
    return true;
  }

  // ---- header -----------------------------------------------------------------------------------

  setId(id) {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1 || n === this._level.id) {
      return false;
    }
    this._commit();
    this._level.id = n;
    return true;
  }

  setTopic(topic) {
    const t = String(topic || '').trim().toUpperCase();
    if (t === this._level.topic) {
      return false;
    }
    this._commit();
    this._level.topic = t;
    return true;
  }

  /** @returns {{ ok: boolean, error?: string }} */
  addWord(word) {
    const w = String(word || '').trim().toUpperCase();
    if (!WORD_RE.test(w)) {
      return { ok: false, error: 'a word is 2+ letters A-Z' };
    }
    if (this._level.words.includes(w)) {
      return { ok: false, error: w + ' is already in the list' };
    }
    this._commit();
    this._level.words.push(w);
    return { ok: true };
  }

  /** Removes a word; its pin is cleared and higher pins shift down. */
  removeWord(index) {
    if (index < 0 || index >= this._level.words.length) {
      return false;
    }
    this._commit();
    this._level.words.splice(index, 1);
    this._level.pieces.forEach((p) => {
      if (p.pin === index) {
        delete p.pin;
      } else if (p.pin > index) {
        p.pin -= 1;
      }
    });
    if (this._level.colors) {
      this._level.colors.splice(index, 1);
    }
    return true;
  }

  // ---- shape ------------------------------------------------------------------------------------

  /** Flips (r, c) between playable and hole; a piece covering a new hole is removed. */
  toggleCell(r, c) {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) {
      return false;
    }
    this._commit();
    const row = this._level.shape[r];
    const hole = row[c] === '#';
    this._level.shape[r] = row.slice(0, c) + (hole ? '.' : '#') + row.slice(c + 1);
    if (hole) {
      const i = this.pieceIndexAt(r, c);
      if (i >= 0) {
        this._level.pieces.splice(i, 1);
      }
    }
    return true;
  }

  /** Changes the grid size (MIN_SIZE..MAX_SIZE); new cells are playable, pieces left outside are removed. */
  resize(rows, cols) {
    const nr = Math.max(MIN_SIZE, Math.min(MAX_SIZE, rows | 0));
    const nc = Math.max(MIN_SIZE, Math.min(MAX_SIZE, cols | 0));
    if (nr === this.rows && nc === this.cols) {
      return false;
    }
    this._commit();
    const shape = [];
    for (let r = 0; r < nr; r++) {
      const old = this._level.shape[r] || '';
      shape.push((old + '#'.repeat(nc)).slice(0, nc));
    }
    this._level.shape = shape;
    const cells = cellsOfShape(shape);
    this._level.pieces = this._level.pieces.filter((p) => pieceCells(p).every((cell) => cells.has(key(cell[0], cell[1]))));
    return true;
  }

  // ---- pieces -----------------------------------------------------------------------------------

  /** Places a single-letter piece on an empty cell, or replaces the letter of the piece cell there. */
  setLetter(r, c, letter) {
    const ch = String(letter || '').toUpperCase();
    if (!LETTER_RE.test(ch) || !this.isCell(r, c)) {
      return false;
    }
    const i = this.pieceIndexAt(r, c);
    this._commit();
    if (i < 0) {
      this._level.pieces.push({ letters: ch, at: [r, c] });
      return true;
    }
    const p = this._level.pieces[i];
    const k = pieceCells(p).findIndex((cell) => cell[0] === r && cell[1] === c);
    p.letters = p.letters.slice(0, k) + ch + p.letters.slice(k + 1);
    return true;
  }

  /** Removes the piece covering (r, c). */
  erase(r, c) {
    const i = this.pieceIndexAt(r, c);
    if (i < 0) {
      return false;
    }
    this._commit();
    this._level.pieces.splice(i, 1);
    return true;
  }

  /**
   * Pins the single-letter piece at (r, c) to words[wordIndex] (taking the pin from any other piece),
   * or unpins it when it already holds that pin. Pinned pieces cannot be frozen, so the counter is cleared.
   */
  togglePin(r, c, wordIndex) {
    const i = this.pieceIndexAt(r, c);
    if (i < 0 || wordIndex < 0 || wordIndex >= this._level.words.length) {
      return false;
    }
    const p = this._level.pieces[i];
    if (p.letters.length !== 1) {
      return false;
    }
    this._commit();
    if (p.pin === wordIndex) {
      delete p.pin;
      return true;
    }
    this._level.pieces.forEach((other) => {
      if (other.pin === wordIndex) {
        delete other.pin;
      }
    });
    p.pin = wordIndex;
    delete p.frozen;
    return true;
  }

  /** Sets the freeze counter of the piece at (r, c); 0 thaws. Pinned pieces cannot be frozen. */
  setFrozen(r, c, count) {
    const i = this.pieceIndexAt(r, c);
    if (i < 0) {
      return false;
    }
    const p = this._level.pieces[i];
    const n = Math.max(0, Math.min(MAX_FREEZE, count | 0));
    if (p.pin !== undefined || (p.frozen || 0) === n) {
      return false;
    }
    this._commit();
    if (n === 0) {
      delete p.frozen;
    } else {
      p.frozen = n;
    }
    return true;
  }

  /** One tap of the freeze tool: 0 → 1 → 2 → 3 → 0. */
  cycleFrozen(r, c) {
    const p = this.pieceAt(r, c);
    if (!p) {
      return false;
    }
    return this.setFrozen(r, c, ((p.frozen || 0) + 1) % 4);
  }

  /**
   * Merges the pieces covering two adjacent cells into one linked block (letters of the first, then
   * the second; anchor stays the first's). Refused when either is pinned, the cells belong to the
   * same piece, or the block would exceed MAX_BLOCK_SIZE letters.
   */
  link(r1, c1, r2, c2) {
    const a = this.pieceIndexAt(r1, c1);
    const b = this.pieceIndexAt(r2, c2);
    if (a < 0 || b < 0 || a === b || !adjacent(r1, c1, r2, c2)) {
      return false;
    }
    const pa = this._level.pieces[a];
    const pb = this._level.pieces[b];
    if (pa.pin !== undefined || pb.pin !== undefined || pa.letters.length + pb.letters.length > MAX_BLOCK_SIZE) {
      return false;
    }
    this._commit();
    const cells = pieceCells(pa).concat(pieceCells(pb));
    const merged = {
      letters: pa.letters + pb.letters,
      at: [pa.at[0], pa.at[1]],
      cells: cells.map((cell) => [cell[0] - pa.at[0], cell[1] - pa.at[1]]),
    };
    const frozen = Math.max(pa.frozen || 0, pb.frozen || 0);
    if (frozen) {
      merged.frozen = frozen;
    }
    this._level.pieces.splice(Math.max(a, b), 1);
    this._level.pieces.splice(Math.min(a, b), 1, merged);
    return true;
  }

  /** Splits the block covering (r, c) back into single-letter pieces (the counter is kept on each). */
  unlink(r, c) {
    const i = this.pieceIndexAt(r, c);
    if (i < 0 || this._level.pieces[i].letters.length === 1) {
      return false;
    }
    this._commit();
    const p = this._level.pieces[i];
    const singles = pieceCells(p).map((cell, k) => {
      const single = { letters: p.letters[k], at: [cell[0], cell[1]] };
      if (p.frozen) {
        single.frozen = p.frozen;
      }
      return single;
    });
    this._level.pieces.splice(i, 1, ...singles);
    return true;
  }

  // ---- internals --------------------------------------------------------------------------------

  _set(level) {
    this._level = level;
  }

  _commit() {
    this._history.push(clone(this._level));
    if (this._history.length > HISTORY_LIMIT) {
      this._history.shift();
    }
  }
}

LevelDocument.MIN_SIZE = MIN_SIZE;
LevelDocument.MAX_SIZE = MAX_SIZE;
LevelDocument.MAX_FREEZE = MAX_FREEZE;

module.exports = LevelDocument;
