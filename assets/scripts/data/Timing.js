/**
 * Timing — animation durations (seconds) and easings for view/ and ui/ (engine-free).
 * See docs/design/technical-design.md §9 for the moment each one belongs to.
 */
'use strict';

const TIMING = Object.freeze({
  LIFT: 0.08, // piece picked up: scale up, raise zIndex
  SLIDE_STEP: 0.06, // one cell of sliding
  BUMP: 0.1, // blocked step nudge and back
  SETTLE: 0.1, // drop: scale back, zIndex down
  TINT: 0.1, // prefix tint in or out
  CLEAR_HOLD: 0.25, // whole chain shown in word colour before flying
  CLEAR_FLY: 0.3, // one letter flying to the found-words panel
  CLEAR_STAGGER: 0.08, // delay between letters of one word
  ICE_TICK: 0.15, // counter punch
  THAW: 0.25, // ice fades and grows, letters fade in
  POPUP: 0.25, // overlay fade, panel scale
  CHIP_POP: 0.18, // found-word chip appearing in the panel
  COIN_PUNCH: 0.2, // coin counter scale punch
  LEVEL_ADVANCE: 0.6, // pause after the last word before the next level / popup
  DRAG_TIMEOUT: 2.0, // lifted piece with no touch events is returned after this
});

const EASING = Object.freeze({
  LIFT: 'quadOut',
  SLIDE: 'linear',
  SETTLE: 'quadOut',
  FLY: 'quadIn',
  PUNCH: 'backOut',
  POPUP: 'backOut',
});

module.exports = { TIMING, EASING };
