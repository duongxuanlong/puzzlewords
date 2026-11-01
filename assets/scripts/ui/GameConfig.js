/**
 * GameConfig — editor-tunable values that are not screen geometry, as a data-only component added
 * to the Canvas in Main.fire (Add Component → Custom Component → GameConfig). Unity analogy: a
 * MonoBehaviour that only holds [SerializeField] values. Sizes and positions of the board, panel,
 * HUD and popup are not here: they are the ScreenLayout slot nodes in Main.fire (ADR-0006).
 *
 * Every property defaults to the matching data/Layout constant, so a scene without the component
 * renders exactly as before: `GameConfig.resolve(canvasNode)` returns the component when present
 * and a plain object of the same keys otherwise. Game reads it once in onLoad and hands it to the
 * components that need it; nothing else reaches for the component.
 */
const { LAYOUT } = require('Layout');

const DEFAULTS = Object.freeze({
  boardMaxCell: LAYOUT.MAX_CELL,
  slotOpacity: LAYOUT.SLOT_OPACITY,
});

const GameConfig = cc.Class({
  extends: cc.Component,

  properties: {
    boardMaxCell: {
      default: DEFAULTS.boardMaxCell,
      type: cc.Integer,
      min: 60,
      displayName: 'Board: max cell',
      tooltip: 'Cell size cap in design pixels; small boards never draw cells larger than this, whatever the board slot size',
    },
    slotOpacity: {
      default: DEFAULTS.slotOpacity,
      type: cc.Integer,
      range: [0, 255, 1],
      slide: true,
      displayName: 'Board: empty-cell square opacity',
      tooltip: 'Opacity (0-255) of the faint rounded square drawn in every board cell under the pieces; 0 hides them',
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
