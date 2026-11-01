/**
 * Palette — every colour used by view/ and ui/, as [r, g, b] triples (engine-free).
 * Word colours are indexed by the word's position in level.words; UI colours by name.
 * Components convert with cc.color(r, g, b); nothing else hard-codes a colour.
 */
'use strict';

// Word colours by palette index: pink, green, blue, orange, purple, teal. A level may pick a
// palette index per word with `colors` (see paletteIndex); otherwise word i uses colour i, which
// matches the first demo (ONE pink, TWO green).
const WORD_COLORS = Object.freeze([
  Object.freeze([232, 64, 160]),
  Object.freeze([98, 204, 68]),
  Object.freeze([58, 120, 236]),
  Object.freeze([244, 148, 36]),
  Object.freeze([150, 86, 230]),
  Object.freeze([34, 190, 190]),
]);

const UI = Object.freeze({
  WHITE: Object.freeze([255, 255, 255]),
  LETTER: Object.freeze([58, 60, 96]), // dark letter on a white block
  LETTER_ON_COLOR: Object.freeze([255, 255, 255]), // letter on a tinted block
  BADGE: Object.freeze([255, 255, 255]), // word-length number on a pinned letter
  ICE_COUNTER: Object.freeze([255, 255, 255]),
  TOPIC: Object.freeze([58, 120, 236]),
  HUD_TEXT: Object.freeze([255, 255, 255]),
  HUD_CHIP: Object.freeze([98, 84, 210]), // level and coin badges, lighter than the night background
  COIN: Object.freeze([255, 204, 60]),
  PANEL: Object.freeze([245, 248, 255]), // tint for Block-based light panels (popup)
  PANEL_TITLE: Object.freeze([190, 205, 255]), // topic title on the dark Panel texture
  PANEL_TEXT: Object.freeze([58, 60, 96]),
  OVERLAY: Object.freeze([10, 12, 40]),
  POPUP_TEXT: Object.freeze([235, 238, 255]), // body text on the dark Panel texture
  BUTTON: Object.freeze([58, 120, 236]),
  BUTTON_TEXT: Object.freeze([255, 255, 255]),
});

/** @returns {number[]} colour for a palette index, cycling past the end */
function wordColor(colorIndex) {
  return WORD_COLORS[colorIndex % WORD_COLORS.length];
}

/**
 * Palette index for a word of a level: `level.colors[wordIndex]` when the level sets colours
 * (validated by LevelSchema), else the word index itself.
 * @param {{ colors?: number[] }} level
 * @param {number} wordIndex
 */
function paletteIndex(level, wordIndex) {
  return level && Array.isArray(level.colors) ? level.colors[wordIndex] : wordIndex;
}

module.exports = { WORD_COLORS, UI, wordColor, paletteIndex };
