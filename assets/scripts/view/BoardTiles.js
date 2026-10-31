/**
 * BoardTiles — one background tile sprite per playable cell (the dark board in the demo).
 * The texture is picked from the nine challenge1/BG_* tiles by which 4-neighbours are missing:
 * none → Center, one → Edge_<side>, two adjacent → Corner_<pos>; other combos fall back to Center.
 * Depends on BoardView for geometry; knows nothing about pieces or rules.
 */
const { LAYOUT } = require('Layout');

const TILE_BY_MISSING = {
  '': 'BG_Center',
  T: 'BG_Edge_Top',
  B: 'BG_Edge_Bot',
  L: 'BG_Edge_Left',
  R: 'BG_Edge_Right',
  TL: 'BG_Corner_TopLeft',
  TR: 'BG_Corner_TopRight',
  BL: 'BG_Corner_BotLeft',
  BR: 'BG_Corner_BotRight',
};

cc.Class({
  extends: cc.Component,

  /**
   * Rebuilds the tiles for a board. Safe to call again for a new level.
   * @param {Board} board model board (cells, rows, cols)
   * @param {number} cellSize
   * @param {object} frames sprite frames by texture name
   * @param {Function} cellToLocal BoardView.cellToLocal
   */
  build(board, cellSize, frames, cellToLocal) {
    this.node.removeAllChildren();
    const scale = cellSize / LAYOUT.TILE_NATIVE;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (!board.has(r, c)) {
          continue;
        }
        const tile = new cc.Node('tile');
        const sprite = tile.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.RAW;
        sprite.trim = false;
        sprite.spriteFrame = frames[this._tileName(board, r, c)] || frames.BG_Center;
        tile.scale = scale;
        tile.position = cellToLocal(r, c);
        this.node.addChild(tile);
      }
    }
  },

  _tileName(board, r, c) {
    let missing = '';
    if (!board.has(r - 1, c)) {
      missing += 'T';
    }
    if (!board.has(r + 1, c)) {
      missing += 'B';
    }
    if (!board.has(r, c - 1)) {
      missing += 'L';
    }
    if (!board.has(r, c + 1)) {
      missing += 'R';
    }
    return TILE_BY_MISSING[missing] || 'BG_Center';
  },
});
