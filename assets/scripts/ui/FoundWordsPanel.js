/**
 * FoundWordsPanel — rounded panel under the HUD with the level topic and one row of letter
 * chips per found word, in the word's colour. Dumb component: Game calls setTopic / addWord.
 * slotWorldPos(wordIndex) gives BoardView the fly target for cleared letters.
 * Depends on UiKit, data/Layout, data/Palette, data/Timing.
 */
const UiKit = require('UiKit');
const { LAYOUT } = require('Layout');
const { UI, wordColor } = require('Palette');
const { TIMING, EASING } = require('Timing');

cc.Class({
  extends: cc.Component,

  /**
   * Builds the panel.
   * @param {object} frames sprite frames by name
   * @param {object} config GameConfig or GameConfig.defaults() (panelWidth, panelHeight, panelY)
   */
  init(frames, config) {
    this.frames = frames;
    this.node.setContentSize(config.panelWidth, config.panelHeight);
    this.node.y = config.panelY;
    UiKit.sliced(this.node, frames.Panel, config.panelWidth, config.panelHeight, null, 'bg', LAYOUT.PANEL_INSET);
    const topic = UiKit.label(this.node, '', LAYOUT.TOPIC_FONT, UI.PANEL_TITLE, 'topic');
    topic.y = LAYOUT.TOPIC_Y;
    this.topicLabel = topic.getComponent(cc.Label);
    this.rowsNode = new cc.Node('rows');
    this.node.addChild(this.rowsNode);
    this.wordCount = 0;
    this.found = 0;
  },

  /** Resets the panel for a level. @param {string} topic @param {string[]} words */
  setTopic(topic, words) {
    this.topicLabel.string = topic.toUpperCase();
    this.rowsNode.removeAllChildren();
    this.wordCount = words.length;
    this.found = 0;
  },

  /** Local y of the row the next found word goes on (rows fill top to bottom in found order). */
  _rowY(rowIndex) {
    return LAYOUT.ROWS_TOP - rowIndex * LAYOUT.ROW_HEIGHT;
  },

  /** World position where the next cleared word's letters should fly. */
  slotWorldPos() {
    return this.node.convertToWorldSpaceAR(cc.v2(0, this._rowY(this.found)));
  },

  /** Adds a word as a row of chips in palette colour `colorIndex` that pop in one after another. */
  addWord(word, colorIndex) {
    const row = new cc.Node('word-' + word);
    row.y = this._rowY(this.found);
    this.rowsNode.addChild(row);
    this.found++;
    const pitch = LAYOUT.CHIP + LAYOUT.CHIP_GAP;
    const x0 = -((word.length - 1) * pitch) / 2;
    const tint = wordColor(colorIndex);
    word.split('').forEach((letter, i) => {
      const chip = UiKit.sliced(row, this.frames.Block, LAYOUT.CHIP, LAYOUT.CHIP, tint, 'chip');
      chip.x = x0 + i * pitch;
      UiKit.label(chip, letter, LAYOUT.CHIP_FONT, UI.LETTER_ON_COLOR, 'letter');
      chip.scale = 0;
      cc.tween(chip)
        .delay(i * TIMING.CLEAR_STAGGER)
        .to(TIMING.CHIP_POP, { scale: 1 }, { easing: EASING.PUNCH })
        .start();
    });
  },
});
