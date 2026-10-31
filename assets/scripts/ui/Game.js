/**
 * Game — composition root on the Canvas (ADR-0003: UI built from code).
 * Loads the sprite frames once, loads a level JSON from resources, creates the GameSession and the
 * BoardView (+ DragController), and routes session events to the UI. HUD, found-words panel and
 * the level-complete popup are added here as they land; for now a topic/level label and
 * auto-advance to the next level.
 * Depends on systems/GameSession, systems/EventBus, data/Constants, data/Layout, data/Palette.
 */
const GameSession = require('GameSession');
const EventBus = require('EventBus');
const { EVENTS } = require('Constants');
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');
const { TIMING } = require('Timing');

const LEVEL_IDS = ['level_001', 'level_002', 'level_003', 'level_004'];

cc.Class({
  extends: cc.Component,

  onLoad() {
    this.bus = new EventBus();
    this.session = new GameSession(this.bus);
    this.frames = null;
    this.levelIndex = 0;
    this._levelComplete = false;
    this._buildBackground();
    this._buildLabels();
    this._buildBoard();
    this.bus.on(EVENTS.LEVEL_COMPLETE, this._onLevelComplete, this);
  },

  start() {
    this._loadFrames(() => this.loadLevel(this.levelIndex));
  },

  /** Loads and shows level `index` of LEVEL_IDS (wraps around). */
  loadLevel(index) {
    this.levelIndex = ((index % LEVEL_IDS.length) + LEVEL_IDS.length) % LEVEL_IDS.length;
    this._levelComplete = false;
    cc.resources.load('levels/' + LEVEL_IDS[this.levelIndex], cc.JsonAsset, (err, asset) => {
      if (err) {
        cc.error('Game: failed to load level ' + LEVEL_IDS[this.levelIndex], err);
        return;
      }
      this.session.load(asset.json);
      this.topicLabel.string = asset.json.topic;
      this.levelLabel.string = 'LEVEL ' + asset.json.id;
      this.boardView.bind(this.session, this.frames);
      this.boardView.setFlyTarget(this.topicNode.convertToWorldSpaceAR(cc.v2(0, 0)));
    });
  },

  restart() {
    this.loadLevel(this.levelIndex);
  },

  // ---- construction -------------------------------------------------------------------------

  _buildBackground() {
    const node = new cc.Node('background');
    const sprite = node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    const widget = node.addComponent(cc.Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
    this.node.addChild(node, -10);
    this.backgroundSprite = sprite;
  },

  _buildLabels() {
    const makeLabel = (name, fontSize, color, y) => {
      const node = new cc.Node(name);
      const label = node.addComponent(cc.Label);
      label.fontSize = fontSize;
      label.lineHeight = fontSize;
      label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
      node.color = cc.color(color[0], color[1], color[2]);
      const widget = node.addComponent(cc.Widget);
      widget.isAlignTop = true;
      widget.top = y;
      widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
      this.node.addChild(node, 5);
      return node;
    };
    this.levelNode = makeLabel('level', LAYOUT.HUD_FONT, UI.HUD_TEXT, LAYOUT.HUD_HEIGHT / 2 - LAYOUT.HUD_FONT / 2);
    this.topicNode = makeLabel('topic', LAYOUT.TOPIC_FONT, UI.HUD_TEXT, LAYOUT.HUD_HEIGHT + LAYOUT.PANEL_RADIUS_PAD);
    this.levelLabel = this.levelNode.getComponent(cc.Label);
    this.topicLabel = this.topicNode.getComponent(cc.Label);
  },

  _buildBoard() {
    const node = new cc.Node('board');
    node.y = LAYOUT.BOARD_CENTER_Y;
    this.boardView = node.addComponent('BoardView');
    node.addComponent('DragController');
    this.boardView.onSettled = () => this._onBoardSettled();
    this.node.addChild(node, 1);
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
      done();
    });
  },

  // ---- flow -----------------------------------------------------------------------------------

  _onLevelComplete() {
    this._levelComplete = true;
  },

  _onBoardSettled() {
    if (this._levelComplete) {
      this.scheduleOnce(() => this.loadLevel(this.levelIndex + 1), TIMING.LEVEL_ADVANCE);
    }
  },
});
