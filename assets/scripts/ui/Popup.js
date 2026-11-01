/**
 * Popup — modal dialog: dimmed overlay that blocks input, a panel with a title, a body line and
 * one button. Used for "Level completed" (Continue) and the Settings stub. Dumb component:
 * show({ title, body, button, onButton }) / hide().
 * Depends on UiKit, data/Layout, data/Palette, data/Timing.
 */
const UiKit = require('UiKit');
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');
const { TIMING, EASING } = require('Timing');

cc.Class({
  extends: cc.Component,

  /** Builds the (hidden) popup covering the `popup` slot (the whole canvas). @param {object} frames */
  init(frames) {
    UiKit.stretch(this.node, true, true, true, true);
    this.node.addComponent(cc.BlockInputEvents);

    this.overlay = new cc.Node('overlay');
    const overlayWidget = this.overlay.addComponent(cc.Widget);
    overlayWidget.isAlignTop = overlayWidget.isAlignBottom = overlayWidget.isAlignLeft = overlayWidget.isAlignRight = true;
    overlayWidget.top = overlayWidget.bottom = overlayWidget.left = overlayWidget.right = 0;
    overlayWidget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
    const overlaySprite = this.overlay.addComponent(cc.Sprite);
    overlaySprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    overlaySprite.spriteFrame = frames.Block_back; // flat texture used as a solid colour
    this.overlay.color = UiKit.color(UI.OVERLAY);
    this.node.addChild(this.overlay);

    this.panel = UiKit.sliced(this.node, frames.Panel, LAYOUT.POPUP_WIDTH, LAYOUT.POPUP_HEIGHT, null, 'panel', LAYOUT.PANEL_INSET);
    // The Panel texture is translucent by design; a second layer makes the dialog nearly opaque so
    // the board underneath does not show through the text.
    UiKit.sliced(this.panel, frames.Panel, LAYOUT.POPUP_WIDTH, LAYOUT.POPUP_HEIGHT, null, 'backing', LAYOUT.PANEL_INSET).zIndex = -1;
    const title = UiKit.label(this.panel, '', LAYOUT.POPUP_TITLE_FONT, UI.PANEL_TITLE, 'title');
    title.y = LAYOUT.POPUP_TITLE_Y;
    this.titleLabel = title.getComponent(cc.Label);
    const body = UiKit.label(this.panel, '', LAYOUT.POPUP_BODY_FONT, UI.POPUP_TEXT, 'body');
    body.y = LAYOUT.POPUP_BODY_Y;
    this.bodyLabel = body.getComponent(cc.Label);
    this.button = UiKit.button(this.panel, frames.Button, LAYOUT.BUTTON_WIDTH, LAYOUT.BUTTON_HEIGHT, '', LAYOUT.BUTTON_FONT, UI.BUTTON_TEXT, () => this._onButton(), 'button');
    this.button.y = LAYOUT.POPUP_BUTTON_Y;
    this.buttonLabel = this.button.getChildByName('text').getComponent(cc.Label);
    this._callback = null;
    this.node.active = false;
  },

  /** @param {{ title: string, body: string, button: string, onButton: Function }} opts */
  show(opts) {
    this.titleLabel.string = opts.title;
    this.bodyLabel.string = opts.body || '';
    this.buttonLabel.string = opts.button;
    this._callback = opts.onButton || null;
    this.node.active = true;
    this.overlay.opacity = 0;
    this.panel.scale = 0.8;
    cc.tween(this.overlay).to(TIMING.POPUP, { opacity: LAYOUT.OVERLAY_OPACITY }).start();
    cc.tween(this.panel).to(TIMING.POPUP, { scale: 1 }, { easing: EASING.POPUP }).start();
  },

  hide() {
    cc.Tween.stopAllByTarget(this.overlay);
    cc.Tween.stopAllByTarget(this.panel);
    this.node.active = false;
  },

  // A plain method, not an ES getter: cc.Class reads every key of this object while defining
  // the class, which would run a getter before any node exists.
  isShowing() {
    return this.node.active;
  },

  _onButton() {
    const cb = this._callback;
    this.hide();
    if (cb) {
      cb();
    }
  },
});
