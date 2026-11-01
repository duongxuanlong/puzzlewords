/**
 * GameConfig — editor-tunable layout values, as a data-only component added to the Canvas in
 * Main.fire (Add Component → Custom Component → GameConfig). Unity analogy: a MonoBehaviour that
 * only holds [SerializeField] values, or a ScriptableObject referenced by the scene.
 *
 * Every property defaults to the matching data/Layout constant, so a scene without the component
 * renders exactly as before: `GameConfig.resolve(canvasNode)` returns the component when present
 * and a plain object of the same keys otherwise. Game reads it once in onLoad and hands it to
 * BoardView, FoundWordsPanel and Hud; nothing else reaches for the component.
 * Values are design pixels (1080x1920, origin at the canvas centre, y up), like data/Layout.
 */
const { LAYOUT } = require('Layout');

const DEFAULTS = Object.freeze({
  boardMaxCell: LAYOUT.MAX_CELL,
  boardMaxWidth: LAYOUT.BOARD_MAX_WIDTH,
  boardMaxHeight: LAYOUT.BOARD_MAX_HEIGHT,
  boardCenterY: LAYOUT.BOARD_CENTER_Y,
  panelWidth: LAYOUT.PANEL_WIDTH,
  panelHeight: LAYOUT.PANEL_HEIGHT,
  panelY: LAYOUT.PANEL_Y,
  hudHeight: LAYOUT.HUD_HEIGHT,
});

const GameConfig = cc.Class({
  extends: cc.Component,

  properties: {
    boardMaxCell: {
      default: DEFAULTS.boardMaxCell,
      type: cc.Integer,
      min: 60,
      displayName: 'Board: max cell',
      tooltip: 'Cell size cap in design pixels; small boards never draw cells larger than this',
    },
    boardMaxWidth: {
      default: DEFAULTS.boardMaxWidth,
      type: cc.Integer,
      min: 200,
      displayName: 'Board: max width',
      tooltip: 'Widest the board may grow; wide boards shrink their cells to fit',
    },
    boardMaxHeight: {
      default: DEFAULTS.boardMaxHeight,
      type: cc.Integer,
      min: 200,
      displayName: 'Board: max height',
      tooltip: 'Tallest the board may grow; tall boards shrink their cells to fit',
    },
    boardCenterY: {
      default: DEFAULTS.boardCenterY,
      type: cc.Integer,
      displayName: 'Board: centre Y',
      tooltip: 'Vertical centre of the board from the canvas centre (negative = lower)',
    },
    panelWidth: {
      default: DEFAULTS.panelWidth,
      type: cc.Integer,
      min: 200,
      displayName: 'Panel: width',
      tooltip: 'Found-words panel width',
    },
    panelHeight: {
      default: DEFAULTS.panelHeight,
      type: cc.Integer,
      min: 100,
      displayName: 'Panel: height',
      tooltip: 'Found-words panel height',
    },
    panelY: {
      default: DEFAULTS.panelY,
      type: cc.Integer,
      displayName: 'Panel: centre Y',
      tooltip: 'Vertical centre of the found-words panel from the canvas centre',
    },
    hudHeight: {
      default: DEFAULTS.hudHeight,
      type: cc.Integer,
      min: 60,
      displayName: 'HUD: height',
      tooltip: 'Height of the top bar holding the buttons, level and coin chips',
    },
  },

  statics: {
    /** @returns {object} the Layout defaults as a plain object with the component's keys */
    defaults() {
      return Object.assign({}, DEFAULTS);
    },

    /**
     * The GameConfig on `node` when the scene carries one, else the defaults.
     * @param {cc.Node} node
     * @returns {GameConfig|object}
     */
    resolve(node) {
      return (node && node.getComponent(GameConfig)) || GameConfig.defaults();
    },
  },
});

module.exports = GameConfig;
