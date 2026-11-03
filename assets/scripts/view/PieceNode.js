/**
 * PieceNode — renders one Piece: block sprite by shape, one letter label per cell, the word-length
 * badge for pinned letters, and the ice overlay with counter while frozen. Owns its small animations
 * (lift/settle, slide one cell, blocked bump, ice tick, thaw, clear fly). No rules live here.
 * Node tree:  PieceNode (size = cell bounding box) ─ outline ─ block ─ letters[] ─ badge ─ ice ─ counter
 * The outline is a white ring texture (tools/gen-outline-textures.js) tinted in the style's outline
 * colour, invisible until the piece is lifted.
 * Depends on data/Palette, data/Timing, data/Layout; BoardView supplies geometry and frames.
 */
const { wordColor, UI } = require('Palette');
const { TIMING, EASING } = require('Timing');
const { LAYOUT } = require('Layout');

// Piece.shapeKey() → texture base name (docs/design/technical-design.md §3.4).
const SHAPE_TEXTURE = {
  '0,0': { white: 'Block', frozen: 'Block_1Cell_Frozen', outline: 'Block_1Cell_Outline' },
  '0,0|0,1': { white: 'Block_2Cell_Horizontal_white', frozen: 'Block_2Cell_Horizontal_Frozen', outline: 'Block_2Cell_Horizontal_Outline' },
  '0,0|1,0': { white: 'Block_2Cell_Vertical_white', frozen: 'Block_2Cell_Vertical_Frozen', outline: 'Block_2Cell_Vertical_Outline' },
  '0,0|1,0|1,1': { white: 'Block_3Cell_LShape_white', frozen: 'Block_3Cell_LShape_Frozen', outline: 'Block_3Cell_LShape_Outline' },
  '0,0|1,-1|1,0': { white: 'Block_3Cell_LShapeReversed_white', frozen: 'Block_3Cell_LShapeReversed_Frozen', outline: 'Block_3Cell_LShapeReversed_Outline' },
  '0,0|0,1|1,0': { white: 'Block_3Cell_LShapeUp_white', frozen: 'Block_3Cell_LShapeUp_Frozen', outline: 'Block_3Cell_LShapeUp_Outline' },
  '0,0|0,1|1,1': { white: 'Block_3Cell_LShapeUpReversed_white', frozen: 'Block_3Cell_LShapeUpReversed_Frozen', outline: 'Block_3Cell_LShapeUpReversed_Outline' },
};

function rgb(triple) {
  return cc.color(triple[0], triple[1], triple[2]);
}

cc.Class({
  extends: cc.Component,

  /**
   * Builds the node tree for a piece. Call once after addComponent.
   * @param {Piece} piece
   * @param {number} cellSize
   * @param {object} frames sprite frames by texture name
   * @param {string} badgeText word length shown on a pinned letter ('' for free pieces)
   * @param {number|null} pinColor palette index of the pinned word (null for free pieces)
   * @param {PieceStyle} style label templates from resources/prefabs/PieceStyle (letter, badge, counter)
   */
  init(piece, cellSize, frames, badgeText, pinColor, style) {
    this.piece = piece;
    this.cellSize = cellSize;
    this.frames = frames;
    this.style = style;
    this.pinColor = pinColor === undefined ? null : pinColor;
    this.tint = null; // palette index currently tinting the block, or null for white
    this._bounds = this._cellBounds(piece);
    this.node.name = 'piece-' + piece.id;
    this.node.setContentSize(this._bounds.width * cellSize, this._bounds.height * cellSize);

    const textures = SHAPE_TEXTURE[piece.shapeKey()] || SHAPE_TEXTURE['0,0'];
    this.outline = this._addOutline(frames[textures.outline], frames[textures.white]); // added first: draws under the block
    this.block = this._addSprite('block', frames[textures.white]);
    this.letters = piece.offsets.map((offset, i) => this._addLetter(piece.letters[i], offset));
    this.badge = piece.isPinned ? this._addBadge(piece.offsets[0], badgeText) : null;
    this.ice = null;
    this.counter = null;
    if (piece.isFrozen) {
      this.ice = this._addSprite('ice', frames[textures.frozen]);
      this.counter = this._addCounter();
    }
    this.setTint(null, true);
    this.setFrozen(piece.frozen);
  },

  /** Local offset from the node centre to the centre of the anchor cell. */
  anchorOffset() {
    return cc.v2(-this._bounds.centerC * this.cellSize, this._bounds.centerR * this.cellSize);
  },

  /** @param {number|null} colorIndex palette index to show; pinned pieces fall back to their word's colour */
  setTint(colorIndex, immediate) {
    const target = colorIndex === null && this.piece.isPinned ? this.pinColor : colorIndex;
    if (target === this.tint && !immediate) {
      return;
    }
    this.tint = target;
    const blockColor = target === null ? rgb(UI.WHITE) : rgb(wordColor(target));
    const letterColor = target === null ? this.style.letter.color : this.style.letterColorOnTint;
    const apply = (node, color) => {
      cc.Tween.stopAllByTarget(node);
      if (immediate) {
        node.color = color;
      } else {
        cc.tween(node).to(TIMING.TINT, { color }).start();
      }
    };
    apply(this.block, blockColor);
    this.letters.forEach((l) => apply(l, letterColor));
  },

  /** Shows or hides the ice and updates the counter; letters are hidden while frozen. */
  setFrozen(remaining) {
    const frozen = remaining > 0;
    this.letters.forEach((l) => (l.opacity = frozen ? 0 : 255));
    if (this.ice) {
      this.ice.active = frozen;
    }
    if (this.counter) {
      this.counter.active = frozen;
      this.counter.getComponent(cc.Label).string = String(remaining);
    }
  },

  playTick(remaining) {
    this.setFrozen(remaining);
    if (this.counter && remaining > 0) {
      cc.Tween.stopAllByTarget(this.counter);
      this.counter.scale = 1.3;
      cc.tween(this.counter).to(TIMING.ICE_TICK, { scale: 1 }, { easing: EASING.PUNCH }).start();
    }
  },

  /** Ice grows and fades, letters fade in. @param {Function} done */
  playThaw(done) {
    this.letters.forEach((l) => {
      l.opacity = 0;
      cc.tween(l).to(TIMING.THAW, { opacity: 255 }).start();
    });
    if (this.counter) {
      this.counter.active = false;
    }
    if (!this.ice) {
      done();
      return;
    }
    const ice = this.ice;
    this.ice = null;
    cc.tween(ice)
      .to(TIMING.THAW, { scale: 1.3, opacity: 0 })
      .call(() => {
        ice.destroy();
        done();
      })
      .start();
  },

  /**
   * Holds in the word colour, then flies to `targetLocal` (in the parent's space) shrinking and
   * fading, and destroys the node. @param {cc.Vec2} targetLocal @param {number} delay @param {Function} done
   */
  playClear(colorIndex, targetLocal, delay, done) {
    this.setTint(colorIndex, true);
    cc.Tween.stopAllByTarget(this.node);
    this.node.zIndex = LAYOUT.LIFT_Z;
    cc.tween(this.node)
      .delay(TIMING.CLEAR_HOLD + delay)
      .to(TIMING.CLEAR_FLY, { position: cc.v3(targetLocal.x, targetLocal.y), scale: LAYOUT.FLY_SCALE, opacity: 0 }, { easing: EASING.FLY })
      .call(() => {
        this.node.destroy();
        done();
      })
      .start();
  },

  lift() {
    this.node.zIndex = LAYOUT.LIFT_Z;
    cc.tween(this.node).to(TIMING.LIFT, { scale: LAYOUT.LIFT_SCALE }, { easing: EASING.LIFT }).start();
    this._showOutline(true);
  },

  settle() {
    cc.tween(this.node)
      .to(TIMING.SETTLE, { scale: 1 }, { easing: EASING.SETTLE })
      .call(() => {
        this.node.zIndex = 0;
      })
      .start();
    this._showOutline(false);
  },

  _showOutline(visible) {
    if (!this.outline) {
      return;
    }
    cc.Tween.stopAllByTarget(this.outline);
    cc.tween(this.outline).to(TIMING.OUTLINE, { opacity: visible ? 255 : 0 }).start();
  },

  /** Slides to a new centre position (one cell). @param {cc.Vec2} localPos @param {Function} done */
  slideTo(localPos, done) {
    cc.tween(this.node)
      .to(TIMING.SLIDE_STEP, { position: cc.v3(localPos.x, localPos.y) }, { easing: EASING.SLIDE })
      .call(done)
      .start();
  },

  /** Small nudge toward (dx, dy) and back; the piece stays on its cell. */
  playBlocked(dx, dy, done) {
    const from = this.node.position;
    const len = Math.hypot(dx, dy) || 1;
    const nudge = cc.v3(from.x + (dx / len) * LAYOUT.BUMP_PX, from.y + (dy / len) * LAYOUT.BUMP_PX);
    cc.tween(this.node)
      .to(TIMING.BUMP / 2, { position: nudge })
      .to(TIMING.BUMP / 2, { position: from })
      .call(done)
      .start();
  },

  // ---- helpers -------------------------------------------------------------------------------

  _cellBounds(piece) {
    const rows = piece.offsets.map((o) => o[0]);
    const cols = piece.offsets.map((o) => o[1]);
    const minR = Math.min.apply(null, rows);
    const maxR = Math.max.apply(null, rows);
    const minC = Math.min.apply(null, cols);
    const maxC = Math.max.apply(null, cols);
    return { minR, maxR, minC, maxC, width: maxC - minC + 1, height: maxR - minR + 1, centerR: (minR + maxR) / 2, centerC: (minC + maxC) / 2 };
  },

  /** Local position of a cell offset relative to the node centre. */
  _offsetToLocal(offset) {
    return cc.v2((offset[1] - this._bounds.centerC) * this.cellSize, (this._bounds.centerR - offset[0]) * this.cellSize);
  },

  _addSprite(name, frame) {
    const node = new cc.Node(name);
    const sprite = node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    sprite.spriteFrame = frame;
    // Fit the texture inside the cell bounding box without distorting it.
    const size = frame ? frame.getOriginalSize() : cc.size(1, 1);
    const scale = Math.min((this.node.width * LAYOUT.BLOCK_FILL) / size.width, (this.node.height * LAYOUT.BLOCK_FILL) / size.height);
    node.setContentSize(size.width * scale, size.height * scale);
    this.node.addChild(node);
    return node;
  },

  /**
   * The highlight ring, sized relative to the block it was generated from: both canvases share a
   * centre and the ring's canvas is the block's plus a fixed pad, so the ring keeps that ratio
   * rather than being refitted to the cell box. Returns null when the ring texture is missing.
   */
  _addOutline(frame, blockFrame) {
    if (!frame || !blockFrame) {
      return null;
    }
    const node = this._addSprite('outline', frame);
    const ring = frame.getOriginalSize();
    const block = blockFrame.getOriginalSize();
    const fit = Math.min((this.node.width * LAYOUT.BLOCK_FILL) / block.width, (this.node.height * LAYOUT.BLOCK_FILL) / block.height);
    node.setContentSize(ring.width * fit, ring.height * fit);
    node.color = this.style.outlineColor;
    node.opacity = 0;
    return node;
  },

  /**
   * Clones a label template from the PieceStyle prefab. The template is authored at LAYOUT.MAX_CELL,
   * so font size and position scale by cellSize / MAX_CELL; text and visibility are set here.
   */
  _cloneLabel(template, name, text) {
    const k = this.cellSize / LAYOUT.MAX_CELL;
    const source = template.getComponent(cc.Label);
    const node = cc.instantiate(template);
    node.name = name;
    node.active = true;
    const label = node.getComponent(cc.Label);
    label.string = text;
    label.fontSize = Math.round(source.fontSize * k);
    label.lineHeight = Math.round(source.lineHeight * k);
    node.setPosition(template.x * k, template.y * k);
    this.node.addChild(node);
    return node;
  },

  _addLetter(letter, offset) {
    const node = this._cloneLabel(this.style.letter, 'letter', letter);
    const centre = this._offsetToLocal(offset);
    node.setPosition(node.x + centre.x, node.y + centre.y);
    return node;
  },

  _addBadge(offset, text) {
    const node = this._cloneLabel(this.style.badge, 'badge', text);
    const centre = this._offsetToLocal(offset);
    node.setPosition(node.x + centre.x, node.y + centre.y);
    return node;
  },

  /**
   * The freeze counter sits at the centre of an L shape's elbow cell (the only cell whose two
   * in-piece 4-neighbours are perpendicular). Shapes without exactly one such cell (single cells,
   * bars, squares, T shapes) keep it at the node centre. The ice sprite is drawn shrunk inside the
   * cell box (BLOCK_FILL), so the cell is measured in the sprite's own pitch rather than the grid's,
   * keeping the number centred on the drawn ice cell.
   */
  _addCounter() {
    const node = this._cloneLabel(this.style.counter, 'counter', String(this.piece.frozen));
    const elbow = this._elbowOffset();
    if (elbow) {
      const b = this._bounds;
      const pitchX = this.ice ? this.ice.width / b.width : this.cellSize;
      const pitchY = this.ice ? this.ice.height / b.height : this.cellSize;
      node.setPosition(node.x + (elbow[1] - b.centerC) * pitchX, node.y + (b.centerR - elbow[0]) * pitchY);
    }
    return node;
  },

  /** [row, col] offset of the unique elbow cell (two perpendicular in-piece neighbours), or null. */
  _elbowOffset() {
    const offsets = this.piece.offsets;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const has = (r, c) => offsets.some((o) => o[0] === r && o[1] === c);
    const elbows = offsets.filter((o) => {
      const n = dirs.filter((d) => has(o[0] + d[0], o[1] + d[1]));
      return n.length === 2 && (n[0][0] + n[1][0] !== 0 || n[0][1] + n[1][1] !== 0);
    });
    return elbows.length === 1 ? elbows[0] : null;
  },
});
