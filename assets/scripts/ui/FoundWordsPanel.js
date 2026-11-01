/**
 * FoundWordsPanel — rounded panel under the HUD with the level topic and one row of letter
 * chips per found word, in the word's colour. Dumb component: Game calls setTopic / addWord.
 * slotWorldPos(wordIndex) gives BoardView the fly target for cleared letters. Sits on the
 * `panel` slot of the ScreenLayout (ADR-0006), which sets its size and position.
 *
 * Scene-authored (ADR-0007): the panel background, topic label and rows container are referenced
 * properties; adding the component in Creator runs `populate`, which creates the missing ones as
 * saved nodes. `panelFrame` takes Panel from resources/textures/common (drag it in); left empty,
 * the runtime uses the loaded texture. Word chips are runtime-only (they depend on the level).
 * Depends on UiKit, data/Layout, data/Palette, data/Timing.
 */
const UiKit = require('UiKit');
const { LAYOUT } = require('Layout');
const { UI, wordColor } = require('Palette');
const { TIMING, EASING } = require('Timing');

cc.Class({
  extends: cc.Component,

  editor: CC_EDITOR && { executeInEditMode: true, menu: 'Puzzle Words/FoundWordsPanel' },

  properties: {
    panelFrame: {
      default: null,
      type: cc.SpriteFrame,
      tooltip: 'Panel.png: the 9-sliced panel background',
      notify() {
        this._applyFrames(null);
      },
    },
    background: { default: null, type: cc.Node, tooltip: 'Sliced panel sprite filling the node (created by populate when empty)' },
    topicLabel: { default: null, type: cc.Label, tooltip: 'Topic title label (created by populate when empty)' },
    rows: { default: null, type: cc.Node, tooltip: 'Container the found-word rows are added to (created by populate when empty)' },
  },

  onLoad() {
    if (CC_EDITOR) {
      this.populate(null);
    }
  },

  /** Wires the panel for play. @param {object} frames sprite frames by name (fallback textures) */
  init(frames) {
    this.frames = frames;
    this.populate(frames);
    this.wordCount = 0;
    this.found = 0;
  },

  /** Creates whatever is unassigned at the data/Layout defaults and applies the texture. */
  populate(frames) {
    if (!this.background) {
      this.background = UiKit.sliced(this.node, this.panelFrame || (frames && frames.Panel), this.node.width, this.node.height, null, 'bg', LAYOUT.PANEL_INSET);
      UiKit.stretch(this.background, true, true, true, true);
    }
    if (!this.topicLabel) {
      const topic = UiKit.label(this.node, 'TOPIC', LAYOUT.TOPIC_FONT, UI.PANEL_TITLE, 'topic');
      topic.y = LAYOUT.TOPIC_Y;
      this.topicLabel = topic.getComponent(cc.Label);
    }
    if (!this.rows) {
      this.rows = new cc.Node('rows');
      this.node.addChild(this.rows);
    }
    this._applyFrames(frames);
  },

  _applyFrames(frames) {
    UiKit.setFrame(this.background, this.panelFrame || (frames && frames.Panel), LAYOUT.PANEL_INSET, !!this.panelFrame);
  },

  /** Resets the panel for a level. @param {string} topic @param {string[]} words */
  setTopic(topic, words) {
    this.topicLabel.string = topic.toUpperCase();
    this.rows.removeAllChildren();
    this.wordCount = words.length;
    this.found = 0;
  },

  /** Local y of the row the next found word goes on (rows fill top to bottom in found order). */
  _rowY(rowIndex) {
    return LAYOUT.ROWS_TOP - rowIndex * LAYOUT.ROW_HEIGHT;
  },

  /** World position where the next cleared word's letters should fly. */
  slotWorldPos() {
    return this.rows.convertToWorldSpaceAR(cc.v2(0, this._rowY(this.found)));
  },

  /** Adds a word as a row of chips in palette colour `colorIndex` that pop in one after another. */
  addWord(word, colorIndex) {
    const row = new cc.Node('word-' + word);
    row.y = this._rowY(this.found);
    this.rows.addChild(row);
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
