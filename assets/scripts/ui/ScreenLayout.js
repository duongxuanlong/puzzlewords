/**
 * ScreenLayout — the screen's slot nodes as serialized references (ADR-0006). Sits on a `Screen`
 * node under the Canvas in Main.fire; its four cc.Node properties point at empty child nodes whose
 * size, position and Widget are the layout. Unity analogy: a MonoBehaviour with [SerializeField]
 * RectTransforms, assigned by dragging in the Inspector. Game attaches BoardView, FoundWordsPanel,
 * Hud and Popup to the referenced nodes; nothing looks slots up by name.
 *
 * In the editor (executeInEditMode) it draws a labelled outline per slot with cc.Graphics so the
 * Scene view shows the layout without selecting nodes. The outline nodes carry DontSave and
 * HideInHierarchy, so they never reach the scene file or the game. Adding the component to an
 * empty node also sets the node up: `populate` sizes it to the design resolution, stretches it
 * to the Canvas, and creates (or adopts, by name) one child per slot at the data/Layout defaults.
 * Those children are ordinary nodes that the scene saves; tune them freely afterwards. In the
 * editor it then puts Hud and FoundWordsPanel on their slots, so adding this one component shows
 * the whole screen (ADR-0007). Popups are not in the scene: Game instantiates them on demand.
 */
const { WORD_COLORS } = require('Palette');
const { LAYOUT } = require('Layout');
const UiKit = require('UiKit');

const SLOT_NAMES = ['board', 'panel', 'hud', 'popup'];

/** Default geometry per slot (design pixels, from data/Layout) and which edges a Widget pins. */
const SLOT_DEFAULTS = {
  board: { width: LAYOUT.BOARD_MAX_WIDTH, height: LAYOUT.BOARD_MAX_HEIGHT, x: 0, y: LAYOUT.BOARD_CENTER_Y, stretch: null },
  panel: { width: LAYOUT.PANEL_WIDTH, height: LAYOUT.PANEL_HEIGHT, x: 0, y: LAYOUT.PANEL_Y, stretch: null },
  hud: { width: LAYOUT.DESIGN_WIDTH, height: LAYOUT.HUD_HEIGHT, x: 0, y: (LAYOUT.DESIGN_HEIGHT - LAYOUT.HUD_HEIGHT) / 2, stretch: [true, false, true, true] },
  popup: { width: LAYOUT.DESIGN_WIDTH, height: LAYOUT.DESIGN_HEIGHT, x: 0, y: 0, stretch: [true, true, true, true] },
};
const OUTLINE_WIDTH = 4;
const LABEL_SIZE = 40;
const LABEL_PAD = 12;

function slotProperty(what) {
  return {
    default: null,
    type: cc.Node,
    tooltip: 'Empty node whose size and position are the area for the ' + what + '; a cc.Widget on it is honoured',
  };
}

const ScreenLayout = cc.Class({
  extends: cc.Component,

  editor: CC_EDITOR && {
    executeInEditMode: true,
    menu: 'Puzzle Words/ScreenLayout',
    disallowMultiple: true,
  },

  properties: {
    board: slotProperty('board (cells shrink to fit it, capped by GameConfig)'),
    panel: slotProperty('found-words panel'),
    hud: slotProperty('top bar'),
    popup: slotProperty('modal popup layer'),
    showOutlines: {
      default: true,
      tooltip: 'Draw a labelled outline per slot in the Scene view (editor only, never saved or shipped)',
    },
  },

  /** @returns {boolean} true when every slot is assigned */
  isComplete() {
    return SLOT_NAMES.every((name) => !!this[name]);
  },

  // ---- editor outlines --------------------------------------------------------------------------

  onLoad() {
    if (CC_EDITOR) {
      ScreenLayout.populate(this);
      this._populateComponents();
      this._ensureGizmo();
    }
  },

  /** Editor only: the slot components, when missing. */
  _populateComponents() {
    if (!this.hud.getComponent('Hud')) {
      this.hud.addComponent('Hud');
    }
    if (!this.panel.getComponent('FoundWordsPanel')) {
      this.panel.addComponent('FoundWordsPanel');
    }
  },

  update() {
    if (CC_EDITOR) {
      this._drawOutlines();
    }
  },

  onDestroy() {
    if (this._gizmo && this._gizmo.isValid) {
      this._gizmo.destroy();
    }
    this._gizmo = null;
  },

  _ensureGizmo() {
    if (this._gizmo && this._gizmo.isValid) {
      return;
    }
    const gizmo = new cc.Node('slot-outlines (editor only)');
    gizmo._objFlags |= cc.Object.Flags.DontSave | cc.Object.Flags.HideInHierarchy;
    gizmo.zIndex = cc.macro.MAX_ZINDEX;
    this._graphics = gizmo.addComponent(cc.Graphics);
    this._graphics.lineWidth = OUTLINE_WIDTH;
    this._labels = {};
    SLOT_NAMES.forEach((name, i) => {
      const labelNode = new cc.Node(name);
      labelNode._objFlags |= cc.Object.Flags.DontSave | cc.Object.Flags.HideInHierarchy;
      labelNode.anchorX = 0;
      labelNode.anchorY = 1;
      const label = labelNode.addComponent(cc.Label);
      label.string = name;
      label.fontSize = LABEL_SIZE;
      label.lineHeight = LABEL_SIZE;
      label.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
      labelNode.color = this._slotColor(i);
      gizmo.addChild(labelNode);
      this._labels[name] = labelNode;
    });
    this.node.addChild(gizmo);
    this._gizmo = gizmo;
  },

  statics: {
    SLOT_NAMES,

    /**
     * Fills in whatever the layout lacks: the root's size and stretch Widget when the node is still
     * unsized, and for each unassigned slot a child of that name, adopted if present or created at
     * the data/Layout defaults. Used by the editor on add and by ScreenSlots.createDefault.
     * @param {ScreenLayout} layout
     * @returns {ScreenLayout} the same layout, now complete
     */
    populate(layout) {
      const root = layout.node;
      if (root.width === 0 || root.height === 0) {
        root.setContentSize(LAYOUT.DESIGN_WIDTH, LAYOUT.DESIGN_HEIGHT);
        root.setPosition(0, 0);
        UiKit.stretch(root, true, true, true, true);
      }
      SLOT_NAMES.forEach((name) => {
        if (layout[name] && layout[name].isValid) {
          return;
        }
        const d = SLOT_DEFAULTS[name];
        let node = root.getChildByName(name);
        if (!node) {
          node = new cc.Node(name);
          node.setContentSize(d.width, d.height);
          node.setPosition(d.x, d.y);
          root.addChild(node);
          if (d.stretch) {
            UiKit.stretch(node, d.stretch[0], d.stretch[1], d.stretch[2], d.stretch[3]);
          }
        }
        layout[name] = node;
      });
      return layout;
    },
  },

  _slotColor(i) {
    const rgb = WORD_COLORS[i % WORD_COLORS.length];
    return cc.color(rgb[0], rgb[1], rgb[2]);
  },

  _drawOutlines() {
    this._ensureGizmo();
    const g = this._graphics;
    g.clear();
    SLOT_NAMES.forEach((name, i) => {
      const slot = this[name];
      const labelNode = this._labels[name];
      const visible = this.showOutlines && !!slot && slot.isValid;
      labelNode.active = visible;
      if (!visible) {
        return;
      }
      // Slot rectangle in this node's space (slots are direct children; deeper nesting is converted).
      const world = slot.convertToWorldSpaceAR(cc.v2(-slot.width * slot.anchorX, -slot.height * slot.anchorY));
      const local = this.node.convertToNodeSpaceAR(world);
      g.strokeColor = this._slotColor(i);
      g.rect(local.x, local.y, slot.width, slot.height);
      g.stroke();
      labelNode.setPosition(local.x + LABEL_PAD, local.y + slot.height - LABEL_PAD);
    });
  },
});

module.exports = ScreenLayout;
