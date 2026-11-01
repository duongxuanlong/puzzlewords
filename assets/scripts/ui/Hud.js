/**
 * Hud — top bar: settings and restart buttons, level badge, coin counter. Dumb component:
 * Game calls setLevel / setCoins and registers the button callbacks. Sits on the `hud` slot of
 * the ScreenLayout (ADR-0006), stretched to the top edge with a cc.Widget.
 *
 * Scene-authored (ADR-0007): its child nodes are referenced properties. Adding the component in
 * Creator runs `populate`, which creates each missing child at the data/Layout defaults as a real
 * saved node; from then on the scene owns positions, sizes and text styles, and the `buttonFrame`
 * and `chipFrame` properties take the pack textures: drag Button and Block from
 * resources/textures/common into them in the Properties panel.
 * At runtime Game calls init(frames): anything still unassigned is built from the loaded frames,
 * so a slot without the component, or without textures assigned, renders as before.
 * Depends on UiKit, data/Layout, data/Palette, data/Timing.
 */
const UiKit = require('UiKit');
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');
const { TIMING, EASING } = require('Timing');

function nodeRef(what) {
  return { default: null, type: cc.Node, tooltip: what + ' (created by populate when empty)' };
}

cc.Class({
  extends: cc.Component,

  editor: CC_EDITOR && { executeInEditMode: true, menu: 'Puzzle Words/Hud' },

  properties: {
    buttonFrame: {
      default: null,
      type: cc.SpriteFrame,
      tooltip: 'Button.png: the round buttons. Left empty, the runtime uses the loaded texture',
      notify() {
        this._applyFrames(null);
      },
    },
    chipFrame: {
      default: null,
      type: cc.SpriteFrame,
      tooltip: 'Block.png: level and coin chips (tinted). Left empty, the runtime uses the loaded texture',
      notify() {
        this._applyFrames(null);
      },
    },
    settingsButton: nodeRef('Settings button'),
    restartButton: nodeRef('Restart button'),
    levelChip: nodeRef('Level badge'),
    levelLabel: { default: null, type: cc.Label, tooltip: 'Label inside the level badge' },
    coinChip: nodeRef('Coin counter chip (punches on gain)'),
    coinLabel: { default: null, type: cc.Label, tooltip: 'Label inside the coin chip' },
  },

  onLoad() {
    if (CC_EDITOR) {
      this.populate(null);
    }
  },

  /**
   * Wires the bar for play. @param {object} frames sprite frames by name (fallback textures)
   */
  init(frames) {
    this.populate(frames);
    this._onRestart = null;
    this._onSettings = null;
    this.settingsButton.on('click', () => this._onSettings && this._onSettings(), this);
    this.restartButton.on('click', () => this._onRestart && this._onRestart(), this);
    this.setCoins(0, true);
  },

  /**
   * Creates whatever is unassigned, at the data/Layout defaults, and applies textures.
   * @param {object|null} frames loaded frames by name, or null in the editor
   */
  populate(frames) {
    UiKit.stretch(this.node, true, false, true, true);
    const button = this.buttonFrame || (frames && frames.Button);
    const chip = this.chipFrame || (frames && frames.Block);
    const size = LAYOUT.HUD_BUTTON;
    if (!this.settingsButton) {
      this.settingsButton = UiKit.button(this.node, button, size, size, '⚙', LAYOUT.HUD_ICON_FONT, UI.BUTTON_TEXT, null, 'settings');
      this.settingsButton.x = LAYOUT.HUD_BUTTON_X;
    }
    if (!this.restartButton) {
      this.restartButton = UiKit.button(this.node, button, size, size, '↻', LAYOUT.HUD_ICON_FONT, UI.BUTTON_TEXT, null, 'restart');
      this.restartButton.x = LAYOUT.HUD_BUTTON_X + size + LAYOUT.HUD_GAP;
    }
    if (!this.levelChip) {
      // Block (white) rather than Block_back (lavender) so the tint is the exact palette colour.
      this.levelChip = UiKit.sliced(this.node, chip, LAYOUT.HUD_LEVEL_CHIP[0], LAYOUT.HUD_LEVEL_CHIP[1], UI.HUD_CHIP, 'level-chip');
    }
    if (!this.levelLabel) {
      this.levelLabel = UiKit.label(this.levelChip, 'LEVEL 1', LAYOUT.HUD_FONT, UI.HUD_TEXT, 'level').getComponent(cc.Label);
    }
    if (!this.coinChip) {
      this.coinChip = UiKit.sliced(this.node, chip, LAYOUT.HUD_COIN_CHIP[0], LAYOUT.HUD_COIN_CHIP[1], UI.HUD_CHIP, 'coin-chip');
      this.coinChip.x = LAYOUT.HUD_COIN_X;
      const icon = UiKit.label(this.coinChip, '●', LAYOUT.HUD_FONT, UI.COIN, 'coin-icon');
      icon.x = LAYOUT.HUD_COIN_CHIP[0] / 2 - 44;
    }
    if (!this.coinLabel) {
      const coinLabel = UiKit.label(this.coinChip, '0', LAYOUT.HUD_FONT, UI.COIN, 'coins');
      coinLabel.x = -20;
      this.coinLabel = coinLabel.getComponent(cc.Label);
    }
    this._applyFrames(frames);
  },

  _applyFrames(frames) {
    const button = this.buttonFrame || (frames && frames.Button);
    const chip = this.chipFrame || (frames && frames.Block);
    UiKit.setFrame(this.settingsButton, button, null, !!this.buttonFrame);
    UiKit.setFrame(this.restartButton, button, null, !!this.buttonFrame);
    UiKit.setFrame(this.levelChip, chip, null, !!this.chipFrame);
    UiKit.setFrame(this.coinChip, chip, null, !!this.chipFrame);
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
