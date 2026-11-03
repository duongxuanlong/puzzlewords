/**
 * Game — composition root on the Canvas (ADR-0003: UI built from code).
 * Loads the sprite frames once, loads a level JSON from resources, creates the GameSession, the
 * BoardView (+ DragController), the Hud, the FoundWordsPanel and the Popup, and routes session
 * events to them. Owns the screen flow: restart, level complete → popup → next level (wrapping),
 * and the settings stub. Coins accumulate across levels for the session (persistence is M2).
 * The screen geometry is the ScreenLayout in Main.fire (slot nodes referenced from a component,
 * ADR-0006; ScreenSlots builds a default when the scene has none). Each slot may already carry
 * its component from the editor (ADR-0007: Hud, FoundWordsPanel, BoardView and DragController are
 * authored in the scene); Game adopts what it finds and adds what is missing (bare-scene fallback). Popups are instantiated on demand from one
 * prefab per kind (resources/prefabs/PopupLevelComplete, PopupSettings) into the `popup` slot.
 * The background is a referenced node too, created by `populate` when the component is added. Tunables come from the GameConfig component on the
 * Canvas when the scene has one, else from data/Layout (see GameConfig.js).
 * While the level editor has handed over a draft (systems/LevelDraft, ADR-0008) that draft is
 * played instead of the resources list, and Continue / the settings button lead back to the editor.
 * Depends on systems/GameSession, systems/EventBus, systems/LevelDraft, ui/GameAssets,
 * data/Constants, data/Layout, data/Timing.
 */
const GameSession = require('GameSession');
const EventBus = require('EventBus');
const LevelDraft = require('LevelDraft');
const { EVENTS, LEVEL_REWARD, COINS_PER_WORD } = require('Constants');
const { LAYOUT } = require('Layout');
const { TIMING } = require('Timing');
const { paletteIndex } = require('Palette');
const GameAssets = require('GameAssets');
const GameConfig = require('GameConfig');
const ScreenSlots = require('ScreenSlots');

const POPUP_KINDS = ['PopupLevelComplete', 'PopupSettings'];

/**
 * Phone or tablet, as opposed to a desktop browser. cc.sys.isMobile is a user-agent sniff that
 * misses iPadOS Safari (it reports itself as a Mac), so a multi-touch screen also counts.
 * Native builds are always handheld.
 */
function isHandheld() {
  if (cc.sys.isNative || cc.sys.isMobile) {
    return true;
  }
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

cc.Class({
  extends: cc.Component,

  editor: CC_EDITOR && { executeInEditMode: true, menu: 'Puzzle Words/Game' },

  properties: {
    backgroundFrame: {
      default: null,
      type: cc.SpriteFrame,
      tooltip: 'Background from resources/textures/common, drawn cover-style behind everything. Left empty, the runtime uses the loaded texture',
      notify() {
        this._applyBackgroundFrame(null);
      },
    },
    background: { default: null, type: cc.Node, tooltip: 'Background sprite node (created by populate when empty)' },
  },

  onLoad() {
    if (CC_EDITOR) {
      this.populate(null);
      return;
    }
    this.bus = new EventBus();
    this.config = GameConfig.resolve(this.node);
    this.session = new GameSession(this.bus);
    this.frames = null;
    this.levelIndex = 0;
    this.totalCoins = 0;
    this._levelComplete = false;
    this.populate(null);
    this._applyFitPolicy();
    cc.view.setResizeCallback(() => this._applyFitPolicy());
    this.bus.on(EVENTS.WORD_CLEARED, this._onWordCleared, this);
    this.bus.on(EVENTS.LEVEL_COMPLETE, this._onLevelComplete, this);
  },

  start() {
    if (CC_EDITOR) {
      return;
    }
    this.screen = ScreenSlots.resolve(this.node);
    this._buildBoard();
    this._loadFrames(() => {
      this._loadPopupPrefabs(() => {
        GameAssets.loadLevels((levels) => {
          if (!cc.isValid(this)) {
            return; // the scene changed while assets were loading (e.g. straight into the editor)
          }
          this.levels = levels;
          this._buildUi();
          this.loadLevel(this.levelIndex);
        });
      });
    });
  },

  /**
   * Shows level `index` of the levels found under resources/levels, sorted by id (wraps around).
   * While the level editor has handed over a draft (systems/LevelDraft, ADR-0008) the draft is
   * shown instead, whatever the index.
   */
  loadLevel(index) {
    this._levelComplete = false;
    this._closePopup();
    if (LevelDraft.has()) {
      this._showLevel(LevelDraft.peek());
      return;
    }
    const count = this.levels.length;
    if (!count) {
      cc.error('Game: no levels under resources/levels');
      return;
    }
    this.levelIndex = ((index % count) + count) % count;
    this._showLevel(this.levels[this.levelIndex]);
  },

  _showLevel(level) {
    this.session.load(level);
    this.hud.setLevel(level.id);
    this.panel.setTopic(level.topic, level.words);
    this.boardView.bind(this.session, this.frames, this.pieceStyle);
    this.boardView.setFlyTarget(this.panel.slotWorldPos());
  },

  /** Test play of an editor draft: back to the editor scene, which still holds the document. */
  _returnToEditor() {
    const scene = LevelDraft.returnTo();
    LevelDraft.clear();
    cc.director.loadScene(scene);
  },

  restart() {
    this.loadLevel(this.levelIndex);
  },

  // ---- construction -------------------------------------------------------------------------

  /**
   * Handheld devices fill their screen: portrait phones fit the design width (extra height shows
   * more background); a tablet wider than 9:16 fits the design height instead, so the canvas grows
   * sideways while the layout stays a centred 1080-wide column (every element is positioned from
   * the centre) and the background covers the whole screen.
   * Desktop browsers fit both axes (SHOW_ALL): the game is a letterboxed portrait phone column
   * with black bars, like a phone held up to the monitor. SHOW_ALL clips the GL viewport to that
   * column, so nothing (not even the background) can paint the bars; that is intended there.
   * Re-applied on every window resize.
   */
  _applyFitPolicy() {
    const canvas = this.getComponent(cc.Canvas);
    if (!canvas) {
      return;
    }
    if (isHandheld()) {
      const frame = cc.view.getFrameSize();
      const wide = frame.width / frame.height > LAYOUT.DESIGN_WIDTH / LAYOUT.DESIGN_HEIGHT;
      canvas.fitWidth = !wide;
      canvas.fitHeight = wide;
    } else {
      canvas.fitWidth = true;
      canvas.fitHeight = true;
    }
    this._layoutBackground();
  },

  /** Creates the background node when unassigned (editor on add, or runtime on a bare scene). */
  populate(frames) {
    if (!this.background) {
      this.background = new cc.Node('background');
      const sprite = this.background.addComponent(cc.Sprite);
      sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
      sprite.trim = false;
      this.node.addChild(this.background);
      this.background.setSiblingIndex(0);
    }
    this.background.zIndex = -10;
    this.backgroundSprite = this.background.getComponent(cc.Sprite);
    this._applyBackgroundFrame(frames);
  },

  _applyBackgroundFrame(frames) {
    if (!this.background) {
      return;
    }
    const sprite = this.background.getComponent(cc.Sprite);
    const frame = this.backgroundFrame || (frames && frames.Background);
    if (frame && (this.backgroundFrame || !sprite.spriteFrame)) {
      sprite.spriteFrame = frame;
    }
    this._layoutBackground();
  },

  /**
   * Sizes the background like CSS `background-size: cover`: scaled uniformly until it fills the
   * visible canvas, centred, with the overflow cropped by the screen edge. A stretch-to-fit
   * cc.Widget would distort the 9:16 texture on tablets and desktop windows, which are wider.
   * Called after every fit-policy change and once the texture is assigned.
   */
  _layoutBackground() {
    const sprite = this.backgroundSprite;
    if (!sprite || !sprite.spriteFrame) {
      return;
    }
    const visible = CC_EDITOR ? cc.size(LAYOUT.DESIGN_WIDTH, LAYOUT.DESIGN_HEIGHT) : cc.view.getVisibleSize();
    const tex = sprite.spriteFrame.getOriginalSize();
    const scale = Math.max(visible.width / tex.width, visible.height / tex.height);
    sprite.node.setContentSize(tex.width * scale, tex.height * scale);
  },

  _buildBoard() {
    const node = this.screen.board;
    this.boardView = node.getComponent('BoardView') || node.addComponent('BoardView');
    this.boardView.config = this.config;
    if (!node.getComponent('DragController')) {
      node.addComponent('DragController');
    }
    this.boardView.onSettled = () => this._onBoardSettled();
  },

  /**
   * HUD, panel and popup need the frames, so they are built after the textures load. Each one
   * lives on its ScreenLayout slot; draw order is the slot order under Screen (board, panel, hud, popup).
   */
  _buildUi() {
    const hudSlot = this.screen.hud;
    this.hud = hudSlot.getComponent('Hud') || hudSlot.addComponent('Hud');
    this.hud.init(this.frames);
    this.hud.onRestart(() => this.restart());
    // Playing an editor draft: the settings button is the way back to the editor.
    this.hud.onSettings(() => (LevelDraft.has() ? this._returnToEditor() : this._showSettings()));

    const panelSlot = this.screen.panel;
    this.panel = panelSlot.getComponent('FoundWordsPanel') || panelSlot.addComponent('FoundWordsPanel');
    this.panel.init(this.frames);
  },

  /** Loads one prefab per popup kind (POPUP_KINDS); a missing prefab falls back to a code-built popup. */
  _loadPopupPrefabs(done) {
    this.popupPrefabs = {};
    let pending = POPUP_KINDS.length;
    POPUP_KINDS.forEach((kind) => {
      cc.resources.load('prefabs/' + kind, cc.Prefab, (err, prefab) => {
        if (err || !prefab) {
          cc.warn('Game: prefab ' + kind + ' missing; that popup will be built in code');
        } else {
          this.popupPrefabs[kind] = prefab;
        }
        if (--pending === 0) {
          done();
        }
      });
    });
  },

  /**
   * Instantiates the popup of `kind` (a component name and prefab name) into the popup slot and
   * shows it. Only one popup at a time: an open one is closed first. The popup destroys its node
   * when it hides.
   * @param {string} kind
   * @param {object} opts passed to the kind's show()
   * @returns {Popup}
   */
  _showPopup(kind, opts) {
    this._closePopup();
    const prefab = this.popupPrefabs[kind];
    const node = prefab ? cc.instantiate(prefab) : new cc.Node(kind);
    this.screen.popup.addChild(node);
    const popup = node.getComponent(kind) || node.addComponent(kind);
    popup.init(this.frames);
    popup.show(opts);
    this.popup = popup;
    return popup;
  },

  _closePopup() {
    if (this.popup && this.popup.isShowing()) {
      this.popup.hide();
    }
    this.popup = null;
  },

  /** Sprite frames by texture name, then the PieceStyle (see ui/GameAssets). */
  _loadFrames(done) {
    GameAssets.loadFrames((frames) => {
      if (!frames) {
        return;
      }
      this.frames = frames;
      this._applyBackgroundFrame(this.frames);
      GameAssets.loadPieceStyle((style, node) => {
        this.pieceStyle = style;
        this.pieceStyleNode = node;
        done();
      });
    });
  },

  // ---- flow -----------------------------------------------------------------------------------

  _onWordCleared({ word, wordIndex }) {
    // The chips pop in when the flying letters arrive (hold + flight + stagger of the last letter).
    const arrival = TIMING.CLEAR_HOLD + TIMING.CLEAR_FLY + TIMING.CLEAR_STAGGER * (word.length - 1);
    this.scheduleOnce(() => {
      this.panel.addWord(word, paletteIndex(this.session.level, wordIndex));
      this.boardView.setFlyTarget(this.panel.slotWorldPos());
      this.totalCoins += COINS_PER_WORD;
      this.hud.setCoins(this.totalCoins);
    }, arrival);
  },

  _onLevelComplete() {
    this._levelComplete = true;
  },

  _onBoardSettled() {
    if (this._levelComplete) {
      this.scheduleOnce(() => this._showLevelComplete(), TIMING.LEVEL_ADVANCE);
    }
  },

  _showLevelComplete() {
    this._showPopup('PopupLevelComplete', {
      coins: LEVEL_REWARD,
      onContinue: () => {
        if (LevelDraft.has()) {
          this._returnToEditor();
          return;
        }
        this.totalCoins += LEVEL_REWARD;
        this.hud.setCoins(this.totalCoins);
        this.loadLevel(this.levelIndex + 1);
      },
    });
  },

  _showSettings() {
    this._showPopup('PopupSettings', {});
  },
});
