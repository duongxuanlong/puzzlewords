/**
 * BoardTiles — one background tile sprite per playable cell (the dark board in the demo).
 * The texture is picked from the nine challenge1/BG_* tiles by which 4-neighbours are missing:
 * none → Center, one → Edge_<side>, two adjacent → Corner_<pos>; other combos fall back to Center.
 * Over each tile a faint Block_back square (the piece outline, BLOCK_FILL of the cell) marks the
 * cell as a slot, as in the demo; pieces draw above it. Its opacity comes from GameConfig.
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
   * @param {number} slotOpacity 0-255 for the empty-cell squares; 0 skips them
   */
  build(board, cellSize, frames, cellToLocal, slotOpacity) {
    this.node.removeAllChildren();
    const scale = cellSize / LAYOUT.TILE_NATIVE;
    const slotSize = this._slotSize(frames.Block_back, cellSize);
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
        this.node.addChild(tile, 0);
        if (slotOpacity > 0 && slotSize) {
          const slot = new cc.Node('slot');
          const slotSprite = slot.addComponent(cc.Sprite);
          slotSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
          slotSprite.trim = false;
          slotSprite.spriteFrame = frames.Block_back;
          slot.setContentSize(slotSize.width, slotSize.height);
          slot.opacity = slotOpacity;
          slot.position = cellToLocal(r, c);
          this.node.addChild(slot, 1);
        }
      }
    }
  },

  /** Block_back fitted inside BLOCK_FILL of the cell without distortion, like PieceNode's block. */
  _slotSize(frame, cellSize) {
    if (!frame) {
      return null;
    }
    const size = frame.getOriginalSize();
    const k = (cellSize * LAYOUT.BLOCK_FILL) / Math.max(size.width, size.height);
    return cc.size(size.width * k, size.height * k);
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
