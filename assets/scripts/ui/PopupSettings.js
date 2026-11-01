/**
 * PopupSettings — settings dialog, opened from the HUD gear. A stub for now: title, one line of
 * body text and a Close button; sound and music toggles come with the audio system (M2).
 * Prefab: resources/prefabs/PopupSettings.prefab (see Popup for the base behaviour).
 */
const Popup = require('Popup');

cc.Class({
  extends: Popup,

  editor: CC_EDITOR && { executeInEditMode: true, menu: 'Puzzle Words/Popups/PopupSettings' },

  /** @param {{ onClose?: Function }} opts */
  show(opts) {
    this._super({ onButton: opts && opts.onClose });
  },
});
