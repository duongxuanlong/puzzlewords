/**
 * Solver — proves a level solvable under the sliding rule and finds a short solution
 * (technical-design §11, level-balancing "min moves" / "min slides").
 * Engine-free; uses the same Board, Piece and Resolver as the game, so it cannot drift from the rules.
 *
 * A move is one drag: a movable piece slides through free cells to any reachable anchor, then the
 * Resolver clears words and ticks freeze. Best-first search over board states, f = g + weight * h:
 *   g      'moves'  → number of drags; 'slides' → number of single-cell steps
 *   h      letters still missing from the words' chains (not admissible: a block places several)
 *   weight 0 → uniform-cost search, the result is a proven minimum;
 *          > 0 → guided search, much faster on tight boards, the result is an upper bound
 * States are keyed by letters + position, so identical free letters are interchangeable.
 * Exhausting the state space without reaching the goal proves the level unsolvable in either mode.
 */
'use strict';

const Board = require('Board');
const Piece = require('Piece');
const Resolver = require('Resolver');
const WordMatcher = require('WordMatcher');

const DEFAULT_MAX_STATES = 100000;
const GUIDED_WEIGHTS = [1, 2, 4];
const KEY_RE = /^([A-Z]+)\/([^@]+)@(-?\d+),(-?\d+)~(\d+)~(\d*)$/;

/**
 * @param {object} level a valid level definition (LevelSchema)
 * @param {{ metric?: 'moves'|'slides', weight?: number, maxStates?: number }} [options]
 * @returns {{
 *   solved: boolean, optimal: boolean, truncated: boolean, explored: number,
 *   moves?: number, slides?: number,
 *   solution?: { letters: string, from: number[], to: number[], slides: number, cleared: string[] }[]
 * }} truncated = the state budget ran out first; optimal = solved with weight 0
 */
function solve(level, options) {
  const opts = options || {};
  const metric = opts.metric || 'moves';
  const weight = opts.weight || 0;
  const maxStates = opts.maxStates || DEFAULT_MAX_STATES;
  const start = level.pieces.map((def, i) => Piece.fromLevel(def, i));
  const startKey = stateKey(start);
  const nodes = new Map([[startKey, { g: 0, parent: null, move: null, closed: false }]]);
  const open = new MinHeap();
  open.push([weight * _missing(level, WordMatcher.find(_boardOf(level, start), level, start)), 0, startKey]);
  let explored = 0;

  while (open.size) {
    const [, g, key] = open.pop();
    const node = nodes.get(key);
    if (node.closed || node.g !== g) {
      continue; // superseded by a cheaper path
    }
    node.closed = true;
    explored += 1;
    const pieces = decodeKey(key);
    if (!pieces.some((p) => p.isPinned)) {
      return _result(node, explored, weight === 0);
    }
    if (explored >= maxStates) {
      return { solved: false, optimal: false, truncated: true, explored };
    }
    _successors(level, pieces).forEach((next) => {
      const ng = g + (metric === 'moves' ? 1 : next.move.slides);
      const k = stateKey(next.pieces);
      const known = nodes.get(k);
      if (known && known.g <= ng) {
        return;
      }
      nodes.set(k, { g: ng, parent: node, move: next.move, closed: false });
      open.push([ng + weight * next.missing, ng, k]);
    });
  }
  return { solved: false, optimal: false, truncated: false, explored };
}

/**
 * Difficulty numbers for one metric: exact uniform-cost search within `exactBudget` states, else the
 * best of the guided runs (an upper bound). `solvable` is null when every run hit its budget.
 * @returns {{ solvable: boolean|null, optimal: boolean, moves?: number, slides?: number, solution?: object[] }}
 */
function analyze(level, options) {
  const opts = options || {};
  const metric = opts.metric || 'moves';
  const exact = solve(level, { metric, weight: 0, maxStates: opts.exactBudget || 20000 });
  if (exact.solved || !exact.truncated) {
    return { solvable: exact.solved, optimal: exact.solved, moves: exact.moves, slides: exact.slides, solution: exact.solution };
  }
  return prove(level, { metric, maxStates: opts.guidedBudget });
}

/**
 * Fast solvability check (guided runs only, no optimality claim). Used by validate-levels.
 * @returns {{ solvable: boolean|null, optimal: false, moves?: number, slides?: number, solution?: object[] }}
 */
function prove(level, options) {
  const opts = options || {};
  const metric = opts.metric || 'moves';
  const guided = GUIDED_WEIGHTS
    .map((weight) => solve(level, { metric, weight, maxStates: opts.maxStates || DEFAULT_MAX_STATES }))
    .filter((r) => r.solved || !r.truncated);
  if (!guided.length) {
    return { solvable: null, optimal: false };
  }
  if (guided.some((r) => !r.solved)) {
    return { solvable: false, optimal: false }; // a guided run exhausted the space: proof of no solution
  }
  const best = guided.reduce((a, b) => (b[metric] < a[metric] ? b : a));
  return { solvable: true, optimal: false, moves: best.moves, slides: best.slides, solution: best.solution };
}

/** Canonical key: sorted "letters/offsets@r,c~frozen~pin" per piece. */
function stateKey(pieces) {
  return pieces
    .map((p) => `${p.letters}/${p.offsets.join(';')}@${p.at[0]},${p.at[1]}~${p.frozen}~${p.pin === null ? '' : p.pin}`)
    .sort()
    .join('|');
}

/** Inverse of stateKey (piece ids are positional, "s0".."sN"). */
function decodeKey(key) {
  if (!key) {
    return [];
  }
  return key.split('|').map((part, i) => {
    const m = KEY_RE.exec(part);
    return new Piece({
      id: 's' + i,
      letters: m[1],
      offsets: m[2].split(';').map((o) => o.split(',').map(Number)),
      at: [Number(m[3]), Number(m[4])],
      pin: m[6] === '' ? null : Number(m[6]),
      frozen: Number(m[5]),
    });
  });
}

function _boardOf(level, pieces) {
  const board = new Board(level.shape);
  pieces.forEach((p) => board.place(p, p.at[0], p.at[1]));
  return board;
}

/** Letters still missing from every remaining word's longest chain, from WordMatcher results. */
function _missing(level, results) {
  return results.reduce((sum, m) => sum + level.words[m.wordIndex].length - m.cells.length, 0);
}

/** Every state reachable with one drag, after resolving clears and freeze. */
function _successors(level, pieces) {
  const board = _boardOf(level, pieces);
  const out = [];
  pieces.forEach((piece, index) => {
    if (!piece.canMove) {
      return;
    }
    board.reachable(piece).forEach(({ at, distance }) => {
      if (distance === 0) {
        return;
      }
      const moved = pieces.map((p) => p.clone());
      const childBoard = board.clone();
      childBoard.place(moved[index], at[0], at[1]);
      const result = Resolver.resolve(childBoard, level, moved);
      out.push({
        pieces: result.pieces,
        missing: _missing(level, result.progress),
        move: {
          letters: piece.letters,
          from: [piece.at[0], piece.at[1]],
          to: [at[0], at[1]],
          slides: distance,
          cleared: result.clears.map((c) => level.words[c.match.wordIndex]),
        },
      });
    });
  });
  return out;
}

function _result(goal, explored, optimal) {
  const solution = [];
  for (let node = goal; node.parent; node = node.parent) {
    solution.unshift(node.move);
  }
  return {
    solved: true,
    optimal,
    truncated: false,
    explored,
    moves: solution.length,
    slides: solution.reduce((sum, m) => sum + m.slides, 0),
    solution,
  };
}

/** Binary min-heap of [f, g, key]; ties prefer the larger g (deeper, closer to a goal). */
class MinHeap {
  constructor() {
    this._items = [];
  }

  get size() {
    return this._items.length;
  }

  push(item) {
    const a = this._items;
    a.push(item);
    for (let i = a.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this._less(a[i], a[parent])) {
        break;
      }
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop() {
    const a = this._items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this._less(a[l], a[m])) {
          m = l;
        }
        if (r < a.length && this._less(a[r], a[m])) {
          m = r;
        }
        if (m === i) {
          break;
        }
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }

  _less(x, y) {
    return x[0] < y[0] || (x[0] === y[0] && x[1] > y[1]);
  }
}

module.exports = { solve, analyze, prove, stateKey, decodeKey, DEFAULT_MAX_STATES };
