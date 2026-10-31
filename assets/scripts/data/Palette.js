/**
 * Palette — every colour used by view/ and ui/, as [r, g, b] triples (engine-free).
 * Word colours are indexed by the word's position in level.words; UI colours by name.
 * Components convert with cc.color(r, g, b); nothing else hard-codes a colour.
 */
'use strict';

// Word colours in the order words appear in a level (demo: green, pink, blue, orange, purple, teal).
const WORD_COLORS = Object.freeze([
  Object.freeze([98, 204, 68]),
  Object.freeze([232, 64, 160]),
  Object.freeze([58, 120, 236]),
  Object.freeze([244, 148, 36]),
  Object.freeze([150, 86, 230]),
  Object.freeze([34, 190, 190]),
]);

const UI = Object.freeze({
  WHITE: Object.freeze([255, 255, 255]),
  LETTER: Object.freeze([58, 60, 96]), // dark letter on a white block
  LETTER_ON_COLOR: Object.freeze([255, 255, 255]), // letter on a tinted block
  ICE_COUNTER: Object.freeze([255, 255, 255]),
  TOPIC: Object.freeze([58, 120, 236]),
  HUD_TEXT: Object.freeze([255, 255, 255]),
  HUD_CHIP: Object.freeze([98, 84, 210]), // level and coin badges, lighter than the night background
  COIN: Object.freeze([255, 204, 60]),
  PANEL: Object.freeze([245, 248, 255]),
  PANEL_TEXT: Object.freeze([58, 60, 96]),
  OVERLAY: Object.freeze([10, 12, 40]),
  POPUP: Object.freeze([245, 248, 255]),
  BUTTON: Object.freeze([58, 120, 236]),
  BUTTON_TEXT: Object.freeze([255, 255, 255]),
});

/** @returns {number[]} colour for a word index, cycling when a level has more words than colours */
function wordColor(wordIndex) {
  return WORD_COLORS[wordIndex % WORD_COLORS.length];
}

module.exports = { WORD_COLORS, UI, wordColor };
