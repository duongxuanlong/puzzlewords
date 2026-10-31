/**
 * BoardView — renders a GameSession's board: owns the grid geometry (cellToLocal / localToCell),
 * the BoardTiles child, one PieceNode per piece, and turns session events into animations.
 * Calls session.animationsDone() once every clear/thaw animation of a drop has finished and then
 * invokes `onSettled`. Input is handled by DragController on the same node.
 * Depends on systems/GameSession (events only), data/Constants, data/Layout.
 */
const { EVENTS } = require('Constants');
const { LAYOUT } = require('Layout');
const { TIMING } = require('Timing');
const { paletteIndex } = require('Palette');

cc.Class({
  extends: cc.Component,

  properties: {
    cellSize: { default: LAYOUT.MAX_CELL, visible: false },
  },

  onLoad() {
    this.node.anchorX = 0.5;
    this.node.anchorY = 0.5;
    this.tilesNode = new cc.Node('tiles');
    this.tiles = this.tilesNode.addComponent('BoardTiles');
    this.node.addChild(this.tilesNode, 0);
    this.piecesNode = new cc.Node('pieces');
    this.node.addChild(this.piecesNode, 1);
    this.pieceNodes = new Map(); // pieceId → PieceNode component
    this.session = null;
    this.frames = null;
    this.flyTarget = cc.v2(0, 0); // world position cleared letters fly to
    // `onSettled` (callback after a drop's animations finish) is assigned by the owner, possibly
    // before onLoad runs, so it is deliberately not reset here.
    this._pending = 0;
    this._awaitingSettle = false;
    this._unsubscribe = [];
  },

  onDestroy() {
    this._unsubscribe.forEach((off) => off());
    this._unsubscribe = [];
  },

  /**
   * Binds to a loaded session and builds tiles and pieces. Call again on restart / next level.
   * @param {GameSession} session
   * @param {object} frames sprite frames by texture name
   */
  bind(session, frames) {
    this._unsubscribe.forEach((off) => off());
    this.session = session;
    this.frames = frames;
    const bus = session.bus;
    this._unsubscribe = [
      bus.on(EVENTS.WORD_PROGRESS, this._onProgress, this),
      bus.on(EVENTS.WORD_CLEARED, this._onCleared, this),
      bus.on(EVENTS.FREEZE_TICK, this._onTick, this),
      bus.on(EVENTS.FREEZE_THAWED, this._onThawed, this),
    ];
    this.rebuild();
  },

  /** Rebuilds everything from the session's current board and pieces. */
  rebuild() {
    const board = this.session.board;
    this.rows = board.rows;
    this.cols = board.cols;
    this.cellSize = Math.min(LAYOUT.MAX_CELL, Math.floor(LAYOUT.BOARD_MAX_WIDTH / this.cols), Math.floor(LAYOUT.BOARD_MAX_HEIGHT / this.rows));
    this.node.setContentSize(this.cols * this.cellSize, this.rows * this.cellSize);
    this.tiles.build(board, this.cellSize, this.frames, (r, c) => this.cellToLocal(r, c));
    this.piecesNode.removeAllChildren();
    this.pieceNodes.clear();
    this.session.pieces.forEach((piece) => this._addPiece(piece));
    this._pending = 0;
    this._awaitingSettle = false;
  },

  /** @param {cc.Vec2} worldPos where cleared letters fly (e.g. the found-words panel) */
  setFlyTarget(worldPos) {
    this.flyTarget = worldPos;
  },

  // ---- geometry: the only place that maps cells ↔ pixels ---------------------------------------

  /** Centre of cell (row, col) in this node's local space; row 0 is the top. Fractions allowed. */
  cellToLocal(row, col) {
    return cc.v2((col - (this.cols - 1) / 2) * this.cellSize, ((this.rows - 1) / 2 - row) * this.cellSize);
  },

  /** @returns {{row:number, col:number}|null} nearest board cell to a local point, null off the board */
  localToCell(pos) {
    if (!this.session) {
      return null;
    }
    const row = Math.round((this.rows - 1) / 2 - pos.y / this.cellSize);
    const col = Math.round(pos.x / this.cellSize + (this.cols - 1) / 2);
    return this.session.board.has(row, col) ? { row, col } : null;
  },

  /** Node centre for a piece whose anchor sits at (row, col). */
  pieceLocal(pieceNode, row, col) {
    const anchor = this.cellToLocal(row, col);
    const offset = pieceNode.anchorOffset();
    return cc.v2(anchor.x - offset.x, anchor.y - offset.y);
  },

  /** @returns {PieceNode|null} */
  pieceNode(pieceId) {
    return this.pieceNodes.get(pieceId) || null;
  },

  /**
   * Called by DragController after session.endDrag. Waits for clear/thaw animations (started
   * synchronously by the session's events) and then releases the session.
   */
  afterDrop() {
    this._awaitingSettle = true;
    this._checkSettled();
  },

  // ---- event handlers ----------------------------------------------------------------------------

  _onProgress({ prefixes }) {
    const tintOf = new Map();
    prefixes.forEach((p) => p.pieceIds.forEach((id) => {
      if (!tintOf.has(id)) {
        tintOf.set(id, paletteIndex(this.session.level, p.wordIndex));
      }
    }));
    this.pieceNodes.forEach((view, id) => view.setTint(tintOf.has(id) ? tintOf.get(id) : null, false));
  },

  _onCleared({ wordIndex, pieceIds }) {
    const target = this.piecesNode.convertToNodeSpaceAR(this.flyTarget);
    const colorIndex = paletteIndex(this.session.level, wordIndex);
    pieceIds.forEach((id, i) => {
      const view = this.pieceNodes.get(id);
      if (!view) {
        return;
      }
      this.pieceNodes.delete(id);
      this._begin();
      view.playClear(colorIndex, target, i * TIMING.CLEAR_STAGGER, () => this._end());
    });
  },

  _onTick({ pieceId, remaining }) {
    const view = this.pieceNodes.get(pieceId);
    if (view) {
      view.playTick(remaining);
    }
  },

  _onThawed({ pieceId }) {
    const view = this.pieceNodes.get(pieceId);
    if (view) {
      this._begin();
      view.playThaw(() => this._end());
    }
  },

  // ---- helpers -----------------------------------------------------------------------------------

  _addPiece(piece) {
    const node = new cc.Node();
    const view = node.addComponent('PieceNode');
    const badge = piece.isPinned ? String(this.session.level.words[piece.pin].length) : '';
    const pinColor = piece.isPinned ? paletteIndex(this.session.level, piece.pin) : null;
    view.init(piece, this.cellSize, this.frames, badge, pinColor);
    node.position = this.pieceLocal(view, piece.at[0], piece.at[1]);
    this.piecesNode.addChild(node);
    this.pieceNodes.set(piece.id, view);
  },

  _begin() {
    this._pending++;
  },

  _end() {
    this._pending--;
    this._checkSettled();
  },

  _checkSettled() {
    if (!this._awaitingSettle || this._pending > 0) {
      return;
    }
    this._awaitingSettle = false;
    this.session.animationsDone();
    if (this.onSettled) {
      this.onSettled();
    }
  },
});
