/**
 * PieceStyle — the piece's text templates, authored in resources/prefabs/PieceStyle.prefab.
 * Unity analogy: a prefab whose child objects are copied into every instance. The prefab root
 * carries this component; its children `letter`, `badge` and `counter` are plain Label nodes whose
 * font size, colour, position and alignment are set in Creator's Properties panel at the reference
 * cell size (LAYOUT.MAX_CELL). PieceNode clones a template per use and scales font size and
 * position by cellSize / MAX_CELL, so what you see in the prefab is what a full-size cell shows.
 * The prefab's `block` child is a reference only: the Block sprite at the size the game draws it
 * (LAYOUT.BLOCK_FILL of the cell, shadow included), so label positions can be judged against the
 * visible block rather than the 180 px cell box. PieceNode never reads it.
 *
 * Game instantiates the prefab once and keeps the instance off-stage. If the prefab is missing,
 * `PieceStyle.createDefault()` builds the same tree from the constants in data/Layout and
 * data/Palette, so the game runs without it.
 */
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');

function color(triple) {
  return cc.color(triple[0], triple[1], triple[2]);
}

function defaultLabel(name, text, sizeFraction, rgb, x, y) {
  const node = new cc.Node(name);
  const label = node.addComponent(cc.Label);
  label.string = text;
  label.fontSize = Math.round(LAYOUT.MAX_CELL * sizeFraction);
  label.lineHeight = label.fontSize;
  label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
  label.verticalAlign = cc.Label.VerticalAlign.CENTER;
  label.cacheMode = cc.Label.CacheMode.BITMAP;
  node.color = color(rgb);
  node.setPosition(x, y);
  return node;
}

const PieceStyle = cc.Class({
  extends: cc.Component,

  properties: {
    letter: {
      default: null,
      type: cc.Node,
      tooltip: 'Label template for the letter on every cell (position relative to the cell centre)',
    },
    badge: {
      default: null,
      type: cc.Node,
      tooltip: 'Label template for the word-length number on a pinned letter (position relative to the cell centre)',
    },
    counter: {
      default: null,
      type: cc.Node,
      tooltip: 'Label template for the freeze counter (position relative to the piece centre)',
    },
    letterColorOnTint: {
      default: color(UI.LETTER_ON_COLOR),
      tooltip: 'Letter colour once the block is tinted in a word colour (matched prefix or pinned); the letter template colour is used on a white block',
    },
    outlineColor: {
      default: color(UI.HIGHLIGHT),
      tooltip: 'Tint of the outline ring shown around a piece while it is lifted (the ring textures are white; see tools/gen-outline-textures.js)',
    },
  },

  /** @returns {boolean} true when every template is assigned */
  isComplete() {
    return !!(this.letter && this.badge && this.counter);
  },

  statics: {
    /** Builds a style with code-made templates mirroring data/Layout and data/Palette. */
    createDefault() {
      const root = new cc.Node('pieceStyle');
      const style = root.addComponent(PieceStyle);
      const corner = LAYOUT.MAX_CELL * LAYOUT.BADGE_OFFSET;
      style.letter = defaultLabel('letter', 'A', LAYOUT.LETTER_SIZE, UI.LETTER, 0, 0);
      style.badge = defaultLabel('badge', '3', LAYOUT.BADGE_SIZE, UI.BADGE, corner, -corner);
      style.counter = defaultLabel('counter', '2', LAYOUT.COUNTER_SIZE, UI.ICE_COUNTER, 0, 0);
      [style.letter, style.badge, style.counter].forEach((n) => root.addChild(n));
      return style;
    },
  },
});

module.exports = PieceStyle;
