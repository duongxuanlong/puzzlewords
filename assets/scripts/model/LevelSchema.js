/**
 * LevelSchema — validates a level definition and derives its cell set.
 * Engine-free: used by the game at load time (debug), by tools/validate-levels.js
 * and by the Node test-suite.
 *
 * Level format (JSON):
 * {
 *   "id": 1, "topic": "NUMBER", "words": ["ONE", "TWO"],
 *   "shape": ["###", "###", "###"],          // '#' playable cell, '.' hole; rows top→bottom
 *   "pieces": [
 *     { "letters": "O", "at": [0, 0], "pin": 0 },              // pinned first letter of words[0]
 *     { "letters": "OW", "at": [2, 5], "cells": [[0,0],[1,0]] }, // linked block: offsets per letter
 *     { "letters": "IN", "at": [2, 4], "cells": [[0,0],[1,0]], "frozen": 2 }
 *   ]
 * }
 * "at" is [row, col] of the anchor cell (first letter). "cells" are [dRow, dCol] offsets
 * per letter, first must be [0,0]; omitted means a single cell. "frozen" is the counter.
 */
'use strict';

const MAX_BLOCK_SIZE = 3;
const WORD_RE = /^[A-Z]{2,}$/;

function isInt(v) {
  return Number.isInteger(v);
}

function isCellPair(v) {
  return Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]);
}

/** @returns {Set<string>} keys "r,c" of playable cells */
function cellsOfShape(shape) {
  const cells = new Set();
  shape.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') {
        cells.add(r + ',' + c);
      }
    }
  });
  return cells;
}

function pieceCells(piece) {
  const offsets = piece.cells || [[0, 0]];
  return offsets.map((o) => [piece.at[0] + o[0], piece.at[1] + o[1]]);
}

function isConnected(offsets) {
  if (offsets.length <= 1) {
    return true;
  }
  const key = (o) => o[0] + ',' + o[1];
  const all = new Set(offsets.map(key));
  const seen = new Set([key(offsets[0])]);
  const stack = [offsets[0]];
  while (stack.length) {
    const [r, c] = stack.pop();
    [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].forEach((n) => {
      const k = key(n);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(n);
      }
    });
  }
  return seen.size === all.size;
}

/**
 * @param {object} level
 * @returns {string[]} list of problems; empty when the level is valid
 */
function validateLevel(level) {
  const errors = [];
  if (!level || typeof level !== 'object') {
    return ['level must be an object'];
  }
  if (!isInt(level.id) || level.id < 1) {
    errors.push('id must be a positive integer');
  }
  if (typeof level.topic !== 'string' || !level.topic.trim()) {
    errors.push('topic must be a non-empty string');
  }

  const words = Array.isArray(level.words) ? level.words : [];
  if (!words.length) {
    errors.push('words must be a non-empty array');
  }
  words.forEach((w, i) => {
    if (typeof w !== 'string' || !WORD_RE.test(w)) {
      errors.push(`words[${i}] must be an uppercase A-Z string of 2+ letters`);
    }
  });
  if (new Set(words).size !== words.length) {
    errors.push('words must be unique');
  }

  const shape = Array.isArray(level.shape) ? level.shape : [];
  if (!shape.length) {
    errors.push('shape must be a non-empty array of strings');
  }
  const width = shape.length ? shape[0].length : 0;
  shape.forEach((row, r) => {
    if (typeof row !== 'string' || row.length !== width || !/^[#.]+$/.test(row)) {
      errors.push(`shape[${r}] must be a string of '#' and '.' with width ${width}`);
    }
  });
  const cells = cellsOfShape(shape.filter((r) => typeof r === 'string'));
  if (shape.length && cells.size === 0) {
    errors.push('shape has no playable cells');
  }

  const pieces = Array.isArray(level.pieces) ? level.pieces : [];
  if (!pieces.length) {
    errors.push('pieces must be a non-empty array');
  }
  const occupied = new Map();
  const pinsSeen = new Map();
  const letterCount = {};
  pieces.forEach((p, i) => {
    const tag = `pieces[${i}]`;
    if (typeof p.letters !== 'string' || !/^[A-Z]+$/.test(p.letters)) {
      errors.push(`${tag}.letters must be an uppercase A-Z string`);
      return;
    }
    if (p.letters.length > MAX_BLOCK_SIZE) {
      errors.push(`${tag}.letters longer than ${MAX_BLOCK_SIZE}`);
    }
    if (!isCellPair(p.at)) {
      errors.push(`${tag}.at must be [row, col]`);
      return;
    }
    const offsets = p.cells === undefined ? [[0, 0]] : p.cells;
    if (!Array.isArray(offsets) || offsets.length !== p.letters.length || !offsets.every(isCellPair)) {
      errors.push(`${tag}.cells must list one [dRow, dCol] per letter`);
      return;
    }
    if (offsets[0][0] !== 0 || offsets[0][1] !== 0) {
      errors.push(`${tag}.cells[0] must be [0, 0]`);
    }
    if (!isConnected(offsets)) {
      errors.push(`${tag}.cells must be 4-connected`);
    }
    if (p.frozen !== undefined && (!isInt(p.frozen) || p.frozen < 1)) {
      errors.push(`${tag}.frozen must be an integer >= 1`);
    }
    if (p.pin !== undefined) {
      if (!isInt(p.pin) || p.pin < 0 || p.pin >= words.length) {
        errors.push(`${tag}.pin must index into words`);
      } else {
        if (p.letters.length !== 1) {
          errors.push(`${tag} pinned pieces must be a single letter`);
        }
        if (words[p.pin][0] !== p.letters[0]) {
          errors.push(`${tag} pinned letter must be the first letter of "${words[p.pin]}"`);
        }
        if (p.frozen !== undefined) {
          errors.push(`${tag} pinned pieces cannot be frozen`);
        }
        if (pinsSeen.has(p.pin)) {
          errors.push(`${tag} duplicates the pin for words[${p.pin}]`);
        }
        pinsSeen.set(p.pin, i);
      }
    }
    pieceCells({ at: p.at, cells: offsets }).forEach((cell, k) => {
      const key = cell[0] + ',' + cell[1];
      if (!cells.has(key)) {
        errors.push(`${tag} cell ${k} at [${cell}] is outside the board`);
      }
      if (occupied.has(key)) {
        errors.push(`${tag} overlaps pieces[${occupied.get(key)}] at [${cell}]`);
      }
      occupied.set(key, i);
    });
    for (const ch of p.letters) {
      letterCount[ch] = (letterCount[ch] || 0) + 1;
    }
  });

  words.forEach((w, i) => {
    if (typeof w === 'string' && !pinsSeen.has(i)) {
      errors.push(`words[${i}] "${w}" has no pinned piece`);
    }
  });

  const needed = {};
  words.forEach((w) => {
    for (const ch of String(w)) {
      needed[ch] = (needed[ch] || 0) + 1;
    }
  });
  const letters = new Set([...Object.keys(needed), ...Object.keys(letterCount)]);
  letters.forEach((ch) => {
    if ((needed[ch] || 0) !== (letterCount[ch] || 0)) {
      errors.push(`letter "${ch}": words need ${needed[ch] || 0}, pieces provide ${letterCount[ch] || 0}`);
    }
  });

  return errors;
}

module.exports = { validateLevel, cellsOfShape, pieceCells, isConnected, MAX_BLOCK_SIZE };
