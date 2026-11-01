/**
 * Game — composition root on the Canvas (ADR-0003: UI built from code).
 * Loads the sprite frames once, loads a level JSON from resources, creates the GameSession, the
 * BoardView (+ DragController), the Hud, the FoundWordsPanel and the Popup, and routes session
 * events to them. Owns the screen flow: restart, level complete → popup → next level (wrapping),
 * and the settings stub. Coins accumulate across levels for the session (persistence is M2).
 * The screen geometry is the ScreenLayout in Main.fire (slot nodes referenced from a component,
 * ADR-0006; ScreenSlots builds a default when the scene has none); each component is attached to
 * its slot node. Tunables come from the GameConfig component on the
 * Canvas when the scene has one, else from data/Layout (see GameConfig.js).
 * Depends on systems/GameSession, systems/EventBus, data/Constants, data/Layout, data/Timing.
 */
const GameSession = require('GameSession');
const EventBus = require('EventBus');
const { EVENTS, LEVEL_REWARD, COINS_PER_WORD } = require('Constants');
const { LAYOUT } = require('Layout');
const { TIMING } = require('Timing');
const { paletteIndex } = require('Palette');
const PieceStyle = require('PieceStyle');
const GameConfig = require('GameConfig');
const ScreenSlots = require('ScreenSlots');

const LEVEL_IDS = ['level_001', 'level_002', 'level_003', 'level_004'];

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

  onLoad() {
    this.bus = new EventBus();
    this.config = GameConfig.resolve(this.node);
    this.session = new GameSession(this.bus);
    this.frames = null;
    this.levelIndex = 0;
    this.totalCoins = 0;
    this._levelComplete = false;
    this._applyFitPolicy();
    cc.view.setResizeCallback(() => this._applyFitPolicy());
    this._buildBackground();
    this.bus.on(EVENTS.WORD_CLEARED, this._onWordCleared, this);
    this.bus.on(EVENTS.LEVEL_COMPLETE, this._onLevelComplete, this);
  },

  start() {
    this.screen = ScreenSlots.resolve(this.node);
    this._buildBoard();
    this._loadFrames(() => {
      this._buildUi();
      this.loadLevel(this.levelIndex);
    });
  },

  /** Loads and shows level `index` of LEVEL_IDS (wraps around). */
  loadLevel(index) {
    this.levelIndex = ((index % LEVEL_IDS.length) + LEVEL_IDS.length) % LEVEL_IDS.length;
    this._levelComplete = false;
    this.popup.hide();
    cc.resources.load('levels/' + LEVEL_IDS[this.levelIndex], cc.JsonAsset, (err, asset) => {
      if (err) {
        cc.error('Game: failed to load level ' + LEVEL_IDS[this.levelIndex], err);
        return;
      }
      const level = asset.json;
      this.session.load(level);
      this.hud.setLevel(level.id);
      this.panel.setTopic(level.topic, level.words);
      this.boardView.bind(this.session, this.frames, this.pieceStyle);
      this.boardView.setFlyTarget(this.panel.slotWorldPos());
    });
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

  _buildBackground() {
    const node = new cc.Node('background');
    const sprite = node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    this.node.addChild(node, -10);
    this.backgroundSprite = sprite;
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
    const visible = cc.view.getVisibleSize();
    const tex = sprite.spriteFrame.getOriginalSize();
    const scale = Math.max(visible.width / tex.width, visible.height / tex.height);
    sprite.node.setContentSize(tex.width * scale, tex.height * scale);
  },

  _buildBoard() {
    const node = this.screen.board;
    this.boardView = node.addComponent('BoardView');
    this.boardView.config = this.config;
    node.addComponent('DragController');
    this.boardView.onSettled = () => this._onBoardSettled();
  },

  /**
   * HUD, panel and popup need the frames, so they are built after the textures load. Each one
   * lives on its ScreenLayout slot; draw order is the slot order under Screen (board, panel, hud, popup).
   */
  _buildUi() {
    this.hud = this.screen.hud.addComponent('Hud');
    this.hud.init(this.frames);
    this.hud.onRestart(() => this.restart());
    this.hud.onSettings(() => this._showSettings());

    this.panel = this.screen.panel.addComponent('FoundWordsPanel');
    this.panel.init(this.frames);

    this.popup = this.screen.popup.addComponent('Popup');
    this.popup.init(this.frames);
  },

  /** Loads every sprite frame under resources/textures once and indexes them by file name. */
  _loadFrames(done) {
    cc.resources.loadDir('textures', cc.SpriteFrame, (err, frames) => {
      if (err) {
        cc.error('Game: failed to load textures', err);
        return;
      }
      this.frames = {};
      frames.forEach((f) => {
        this.frames[f.name] = f;
      });
      this.backgroundSprite.spriteFrame = this.frames.Background;
      this._layoutBackground();
      this._loadPieceStyle(done);
    });
  },

  /**
   * Loads resources/prefabs/PieceStyle (label templates for pieces, see PieceStyle.js). The prefab is
   * instantiated once and kept off-stage; PieceNode clones its child labels. Missing or incomplete
   * prefab → templates built in code from the data/ constants.
   */
  _loadPieceStyle(done) {
    cc.resources.load('prefabs/PieceStyle', cc.Prefab, (err, prefab) => {
      let style = null;
      if (!err && prefab) {
        this.pieceStyleNode = cc.instantiate(prefab);
        style = this.pieceStyleNode.getComponent('PieceStyle');
      }
      if (!style || !style.isComplete()) {
        cc.warn('Game: PieceStyle prefab missing or its label templates unassigned; using code defaults');
        style = PieceStyle.createDefault();
        this.pieceStyleNode = style.node;
      }
      this.pieceStyle = style;
      done();
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
    this.popup.show({
      title: 'Level completed!',
      body: '+' + LEVEL_REWARD + ' coins',
      button: 'Continue',
      onButton: () => {
        this.totalCoins += LEVEL_REWARD;
        this.hud.setCoins(this.totalCoins);
        this.loadLevel(this.levelIndex + 1);
      },
    });
  },

  _showSettings() {
    this.popup.show({
      title: 'Settings',
      body: 'Sound settings coming soon.',
      button: 'Close',
    });
  },
});
