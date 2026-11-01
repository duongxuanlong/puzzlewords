/**
 * PieceStyle — editor-tunable look of a piece, the Cocos stand-in for a Unity ScriptableObject.
 * Lives on the root node of resources/prefabs/PieceStyle.prefab; open that prefab in Creator and
 * edit the fields in the Properties panel. Game loads the prefab once at startup and hands the
 * component to BoardView → PieceNode, which reads the values when it builds a piece.
 * Defaults mirror data/Layout and data/Palette so the game looks the same without the prefab.
 */
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');

cc.Class({
  extends: cc.Component,

  properties: {
    badgeSize: {
      default: LAYOUT.BADGE_SIZE,
      range: [0.1, 0.5, 0.01],
      slide: true,
      tooltip: 'Word-length number font size, as a fraction of the cell size',
    },
    badgeOffset: {
      default: LAYOUT.BADGE_OFFSET,
      range: [0, 0.45, 0.01],
      slide: true,
      tooltip: 'Distance of the number from the cell centre (x right, y down), fraction of the cell size',
    },
    badgeColor: {
      default: cc.color(UI.BADGE[0], UI.BADGE[1], UI.BADGE[2]),
      tooltip: 'Colour of the word-length number',
    },
  },
});
