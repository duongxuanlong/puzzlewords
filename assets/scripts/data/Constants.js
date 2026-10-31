/**
 * Constants — event names, session states, rejection reasons and economy values.
 * Engine-free; shared by systems/, view/ and ui/. See docs/design/technical-design.md §4 and §8.
 */
'use strict';

const EVENTS = Object.freeze({
  LEVEL_LOADED: 'level:loaded',
  DRAG_STARTED: 'drag:started',
  DRAG_ENDED: 'drag:ended',
  PIECE_MOVED: 'piece:moved',
  PIECE_REJECTED: 'piece:rejected',
  WORD_PROGRESS: 'word:progress',
  WORD_CLEARED: 'word:cleared',
  FREEZE_TICK: 'freeze:tick',
  FREEZE_THAWED: 'freeze:thawed',
  LEVEL_COMPLETE: 'level:complete',
});

const SESSION_STATE = Object.freeze({
  LOADED: 'LOADED',
  IDLE: 'IDLE',
  DRAGGING: 'DRAGGING',
  RESOLVING: 'RESOLVING',
  COMPLETE: 'COMPLETE',
});

const REJECT = Object.freeze({
  BUSY: 'busy',
  UNKNOWN_PIECE: 'unknown-piece',
  PINNED: 'pinned',
  FROZEN: 'frozen',
  NOT_DRAGGING: 'not-dragging',
  NOT_ADJACENT: 'not-adjacent',
  BLOCKED: 'blocked',
});

// Placeholder economy (spec open question): coins per cleared word and the flat level reward.
const COINS_PER_WORD = 10;
const LEVEL_REWARD = 10;

module.exports = { EVENTS, SESSION_STATE, REJECT, COINS_PER_WORD, LEVEL_REWARD };
