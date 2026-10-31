/**
 * Hud — top bar: settings and restart buttons, level badge, coin counter. Dumb component:
 * Game calls setLevel / setCoins and registers the button callbacks. Anchored to the top edge
 * with a cc.Widget so it stays put on every aspect ratio.
 * Depends on UiKit, data/Layout, data/Palette, data/Timing.
 */
const UiKit = require('UiKit');
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');
const { TIMING, EASING } = require('Timing');

cc.Class({
  extends: cc.Component,

  /** Builds the bar. @param {object} frames sprite frames by name */
  init(frames) {
    this.node.setContentSize(LAYOUT.DESIGN_WIDTH, LAYOUT.HUD_HEIGHT);
    const widget = this.node.addComponent(cc.Widget);
    widget.isAlignTop = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.left = widget.right = 0;
    widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;

    this._onRestart = null;
    this._onSettings = null;
    const size = LAYOUT.HUD_BUTTON;
    const settings = UiKit.button(this.node, frames.Button, size, size, '⚙', LAYOUT.HUD_ICON_FONT, UI.BUTTON_TEXT, () => this._onSettings && this._onSettings(), 'settings');
    settings.x = LAYOUT.HUD_BUTTON_X;
    const restart = UiKit.button(this.node, frames.Button, size, size, '↻', LAYOUT.HUD_ICON_FONT, UI.BUTTON_TEXT, () => this._onRestart && this._onRestart(), 'restart');
    restart.x = LAYOUT.HUD_BUTTON_X + size + LAYOUT.HUD_GAP;

    // Block (white) rather than Block_back (lavender) so the tint is the exact palette colour.
    const levelChip = UiKit.sliced(this.node, frames.Block, LAYOUT.HUD_LEVEL_CHIP[0], LAYOUT.HUD_LEVEL_CHIP[1], UI.HUD_CHIP, 'level-chip');
    this.levelLabel = UiKit.label(levelChip, '', LAYOUT.HUD_FONT, UI.HUD_TEXT, 'level').getComponent(cc.Label);

    this.coinChip = UiKit.sliced(this.node, frames.Block, LAYOUT.HUD_COIN_CHIP[0], LAYOUT.HUD_COIN_CHIP[1], UI.HUD_CHIP, 'coin-chip');
    this.coinChip.x = LAYOUT.HUD_COIN_X;
    const coinLabel = UiKit.label(this.coinChip, '', LAYOUT.HUD_FONT, UI.COIN, 'coins');
    coinLabel.x = -20;
    this.coinLabel = coinLabel.getComponent(cc.Label);
    const icon = UiKit.label(this.coinChip, '●', LAYOUT.HUD_FONT, UI.COIN, 'coin-icon');
    icon.x = LAYOUT.HUD_COIN_CHIP[0] / 2 - 44;
    this.setCoins(0, true);
  },

  setLevel(levelId) {
    this.levelLabel.string = 'LEVEL ' + levelId;
  },

  /** @param {number} coins @param {boolean} [silent] skip the punch animation */
  setCoins(coins, silent) {
    this.coinLabel.string = String(coins);
    if (!silent) {
      cc.Tween.stopAllByTarget(this.coinChip);
      this.coinChip.scale = 1.2;
      cc.tween(this.coinChip).to(TIMING.COIN_PUNCH, { scale: 1 }, { easing: EASING.PUNCH }).start();
    }
  },

  /** World position of the coin counter (target for coin fly-ins). */
  coinWorldPos() {
    return this.coinChip.convertToWorldSpaceAR(cc.v2(0, 0));
  },

  onRestart(cb) {
    this._onRestart = cb;
  },

  onSettings(cb) {
    this._onSettings = cb;
  },
});
