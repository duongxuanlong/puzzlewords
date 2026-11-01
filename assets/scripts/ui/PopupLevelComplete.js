/**
 * PopupLevelComplete — "Level completed!" dialog with the coin reward and a Continue button.
 * Prefab: resources/prefabs/PopupLevelComplete.prefab. Game instantiates it when the last word
 * clears; Continue awards the coins and loads the next level (see Popup for the base behaviour).
 */
const Popup = require('Popup');

cc.Class({
  extends: Popup,

  editor: CC_EDITOR && { executeInEditMode: true, menu: 'Puzzle Words/Popups/PopupLevelComplete' },

  /**
   * @param {{ coins: number, onContinue: Function }} opts reward shown as "+N coins"
   */
  show(opts) {
    this._super({
      body: '+' + opts.coins + ' coins',
      onButton: opts.onContinue,
    });
  },
});
