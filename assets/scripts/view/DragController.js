/**
 * DragController — grid-constrained sliding (docs/design/technical-design.md §6.4).
 * Lives on the BoardView node. The piece never floats under the finger: on every move the finger
 * is mapped to a target cell, the session's BFS gives a route through free cells, and the piece is
 * stepped there one cell at a time (session.dragStep commits each step, then the node tweens).
 * Release waits for the step queue to drain, then session.endDrag and BoardView.afterDrop.
 * Depends on BoardView (geometry, piece nodes) and GameSession (beginDrag/dragStep/endDrag/findPath).
 */
const { TIMING } = require('Timing');

cc.Class({
  extends: cc.Component,

  onLoad() {
    this.board = this.getComponent('BoardView');
    this.active = null; // { id, view, touchId, grabOffset, queue, stepping, released, lastTarget }
    this.node.on(cc.Node.EventType.TOUCH_START, this._onTouchStart, this);
    this.node.on(cc.Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
    this.node.on(cc.Node.EventType.TOUCH_END, this._onTouchEnd, this);
    this.node.on(cc.Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
  },

  onDestroy() {
    this.node.off(cc.Node.EventType.TOUCH_START, this._onTouchStart, this);
    this.node.off(cc.Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
    this.node.off(cc.Node.EventType.TOUCH_END, this._onTouchEnd, this);
    this.node.off(cc.Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
  },

  _onTouchStart(event) {
    const session = this.board.session;
    if (this.active || !session) {
      return;
    }
    const local = this.node.convertToNodeSpaceAR(event.getLocation());
    const cell = this.board.localToCell(local);
    const id = cell && session.board.pieceAt(cell.row, cell.col);
    if (!id || !session.beginDrag(id).ok) {
      return;
    }
    const view = this.board.pieceNode(id);
    const anchor = this.board.cellToLocal(session.piece(id).at[0], session.piece(id).at[1]);
    this.active = {
      id,
      view,
      touchId: event.getID(),
      grabOffset: cc.v2(local.x - anchor.x, local.y - anchor.y),
      queue: [],
      stepping: false,
      released: false,
      lastTarget: null,
    };
    view.lift();
    this._armTimeout();
  },

  _onTouchMove(event) {
    const drag = this.active;
    if (!drag || drag.released || event.getID() !== drag.touchId) {
      return;
    }
    this._armTimeout();
    const local = this.node.convertToNodeSpaceAR(event.getLocation());
    const target = this.board.localToCell(cc.v2(local.x - drag.grabOffset.x, local.y - drag.grabOffset.y));
    if (!target) {
      return;
    }
    if (drag.lastTarget && drag.lastTarget.row === target.row && drag.lastTarget.col === target.col) {
      return;
    }
    drag.lastTarget = target;
    drag.queue = this._route(drag, target);
    this._stepNext();
  },

  _onTouchEnd(event) {
    const drag = this.active;
    if (!drag || drag.released || event.getID() !== drag.touchId) {
      return;
    }
    this._release();
  },

  /** Shortest route from where the piece will be after the queued steps to `target`, or toward the nearest reachable cell. */
  _route(drag, target) {
    const session = this.board.session;
    const piece = session.piece(drag.id);
    const path = session.board.findPath(piece, target.row, target.col);
    if (path) {
      return path;
    }
    // Unreachable: slide toward the reachable cell closest to the finger (Manhattan).
    let best = null;
    let bestDist = Math.abs(piece.at[0] - target.row) + Math.abs(piece.at[1] - target.col);
    session.board.reachable(piece).forEach(({ at }) => {
      const d = Math.abs(at[0] - target.row) + Math.abs(at[1] - target.col);
      if (d < bestDist) {
        bestDist = d;
        best = at;
      }
    });
    return best ? session.board.findPath(piece, best[0], best[1]) || [] : [];
  },

  _stepNext() {
    const drag = this.active;
    if (!drag || drag.stepping) {
      return;
    }
    const step = drag.queue.shift();
    if (!step) {
      if (drag.released) {
        this._finish();
      }
      return;
    }
    const session = this.board.session;
    const piece = session.piece(drag.id);
    const from = this.board.cellToLocal(piece.at[0], piece.at[1]);
    const result = session.dragStep(drag.id, step[0], step[1]);
    drag.stepping = true;
    if (result.ok) {
      drag.view.slideTo(this.board.pieceLocal(drag.view, step[0], step[1]), () => {
        drag.stepping = false;
        this._stepNext();
      });
    } else {
      drag.queue = [];
      const to = this.board.cellToLocal(step[0], step[1]);
      drag.view.playBlocked(to.x - from.x, to.y - from.y, () => {
        drag.stepping = false;
        this._stepNext();
      });
    }
  },

  _release() {
    const drag = this.active;
    drag.released = true;
    this.unschedule(this._onTimeout);
    if (!drag.stepping) {
      this._finish();
    }
  },

  _finish() {
    const drag = this.active;
    this.active = null;
    drag.view.settle();
    this.board.session.endDrag(drag.id);
    this.board.afterDrop();
  },

  /** Safety net: a lifted piece with no touch events for a while is dropped where it is. */
  _armTimeout() {
    this.unschedule(this._onTimeout);
    this.scheduleOnce(this._onTimeout, TIMING.DRAG_TIMEOUT);
  },

  _onTimeout() {
    if (this.active && !this.active.released) {
      this._release();
    }
  },
});
