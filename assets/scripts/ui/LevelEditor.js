/**
 * LevelEditor — the level editor scene's one component, on the Canvas of Editor.fire (ADR-0008).
 * Builds its controls from code and renders the draft with the game's own BoardView / BoardTiles /
 * PieceNode, bound to a session-shaped read model built from a model/LevelDocument. A tap on the
 * board applies the active tool to that cell; nothing here knows a rule, the document does.
 *
 * Screen (design pixels, y up):  top bar (title, New, Load, Test play) · id / topic / size steppers ·
 * word chips (tap = pin target, × removes) · word input + Add + Undo · tool bar · board ·
 * validation + solver lines · Save / Copy JSON / Download · on-screen keyboard (physical keys work too).
 * Save POSTs the JSON to tools/level-server.js (`npm run editor:server`), which writes it into
 * assets/resources/levels; the game discovers levels by folder, so a saved level is playable on the
 * next start. The draft autosaves to localStorage and survives a reload or the test-play round trip
 * through Main (systems/LevelDraft). Depends on ui/GameAssets, ui/UiKit, view/BoardView, model/*, data/*.
 */
const LevelDocument = require('LevelDocument');
const LevelDraft = require('LevelDraft');
const Board = require('Board');
const Piece = require('Piece');
const WordMatcher = require('WordMatcher');
const Solver = require('Solver');
const EventBus = require('EventBus');
const GameAssets = require('GameAssets');
const UiKit = require('UiKit');
const { EVENTS } = require('Constants');
const { LAYOUT } = require('Layout');
const { UI, wordColor, paletteIndex } = require('Palette');

const SCENE_NAME = 'Editor';
const GAME_SCENE = 'Main';
const STORAGE_KEY = 'puzzlewords.editor.draft';
const SAVE_URL = 'http://localhost:7457/levels'; // tools/level-server.js (npm run editor:server)
const SOLVER_DELAY = 0.3;
const SOLVER_BUDGET = { exactBudget: 3000, guidedBudget: 6000 };
const FLASH_SECONDS = 2;

const TOOLS = [
  { id: 'cell', label: 'Cell', hint: 'Tap a cell to make it a hole, or a hole to make it a cell' },
  { id: 'letter', label: 'Letter', hint: 'Tap a cell, then a key; the selection moves on by itself' },
  { id: 'pin', label: 'Pin', hint: 'Tap a letter to pin it to the selected word (tap a chip to pick the word)' },
  { id: 'freeze', label: 'Freeze', hint: 'Tap a piece to cycle its counter 1 → 2 → 3 → off' },
  { id: 'link', label: 'Link', hint: 'Tap a piece, then an adjacent one, to join them; tap a block twice to split it' },
  { id: 'erase', label: 'Erase', hint: 'Tap a piece to remove it' },
];
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

// Geometry (design pixels, canvas-centred).
const G = Object.freeze({
  TOP_Y: 880,
  HEADER_Y: 770,
  CHIPS_Y: 665,
  CHIP_ROW: 70,
  INPUT_Y: 555,
  TOOLS_Y: 450,
  BOARD: { width: 960, height: 800, y: -45 },
  STATUS_Y: -500,
  SOLVER_Y: -555,
  ACTIONS_Y: -640,
  KEYS_Y: -745,
  KEY: 76,
  KEY_GAP: 10,
  BUTTON_H: 84,
  FONT: 34,
  SMALL_FONT: 28,
  TITLE_FONT: 44,
  CHIP_H: 60,
  CHIP_FONT: 30,
  MARGIN: 520,
});

function col(rgb) {
  return cc.color(rgb[0], rgb[1], rgb[2]);
}

cc.Class({
  extends: cc.Component,

  editor: CC_EDITOR && { executeInEditMode: true, menu: 'Puzzle Words/LevelEditor' },

  onLoad() {
    if (CC_EDITOR) {
      this._drawEditorPreview();
      return;
    }
    const canvas = this.getComponent(cc.Canvas);
    if (canvas) {
      canvas.fitWidth = true;
      canvas.fitHeight = true;
    }
    this.doc = this._restore() || new LevelDocument();
    this.tool = 'letter';
    this.selectedWord = 0;
    this.selection = null; // { r, c } for the letter and link tools
    this.frames = null;
    this.style = null;
    this.picker = null; // level list node while open
    this.levels = []; // the project's levels, from GameAssets.loadLevels
    this.editing = false; // an EditBox has the keyboard
    this.chips = [];
    this.toolButtons = {};
    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKey, this);
  },

  onDestroy() {
    if (this._preview && this._preview.isValid) {
      this._preview.destroy();
    }
    this._preview = null;
    if (!CC_EDITOR) {
      cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKey, this);
    }
  },

  start() {
    if (CC_EDITOR) {
      return;
    }
    GameAssets.loadFrames((frames) => {
      if (!frames) {
        return;
      }
      this.frames = frames;
      GameAssets.loadPieceStyle((style, node) => {
        this.style = style;
        this.styleNode = node;
        GameAssets.loadLevels((levels) => {
          if (!cc.isValid(this)) {
            return;
          }
          this.levels = levels;
          this._build();
          this._refresh();
        });
      });
    });
  },

  // ---- construction -----------------------------------------------------------------------------

  /**
   * The screen as a flat list of items, shared by the runtime build and the editor preview so the
   * two cannot drift. Kinds: label, button (`on` = method name, `arg` its argument, `id` to keep
   * a reference), field (`id` → this[id + 'Box'], `commit` = method name), area (board / chips),
   * status (`id` → this[id + 'Label']). Keys carry `key: true` for their colour.
   */
  _layoutItems() {
    const items = [
      { kind: 'label', x: -G.MARGIN, y: G.TOP_Y, text: 'LEVEL EDITOR', font: G.TITLE_FONT, color: UI.PANEL_TITLE, anchorX: 0 },
      { kind: 'button', x: -30, y: G.TOP_Y, w: 130, text: 'New', on: '_newLevel' },
      { kind: 'button', x: 85, y: G.TOP_Y, w: 70, text: '◂', on: '_loadStep', arg: -1 },
      { kind: 'button', id: 'levelButton', x: 205, y: G.TOP_Y, w: 160, text: 'Level ▾', on: '_togglePicker' },
      { kind: 'button', x: 325, y: G.TOP_Y, w: 70, text: '▸', on: '_loadStep', arg: 1 },
      { kind: 'button', x: 455, y: G.TOP_Y, w: 170, text: 'Test play', on: '_testPlay' },
      { kind: 'field', id: 'id', x: -460, y: G.HEADER_Y, w: 140, placeholder: 'id', commit: '_commitId' },
      { kind: 'field', id: 'topic', x: -130, y: G.HEADER_Y, w: 460, placeholder: 'topic', commit: '_commitTopic' },
      { kind: 'status', id: 'size', x: 170, y: G.HEADER_Y, text: '5×5', font: G.FONT, color: UI.EDITOR_TEXT },
      { kind: 'button', x: 250, y: G.HEADER_Y, w: 64, text: 'R−', on: '_resize', arg: [-1, 0] },
      { kind: 'button', x: 320, y: G.HEADER_Y, w: 64, text: 'R+', on: '_resize', arg: [1, 0] },
      { kind: 'button', x: 400, y: G.HEADER_Y, w: 64, text: 'C−', on: '_resize', arg: [0, -1] },
      { kind: 'button', x: 470, y: G.HEADER_Y, w: 64, text: 'C+', on: '_resize', arg: [0, 1] },
      { kind: 'area', id: 'chips', x: 0, y: G.CHIPS_Y, w: 2 * G.MARGIN, h: G.CHIP_H, text: 'word chips' },
      { kind: 'field', id: 'word', x: -300, y: G.INPUT_Y, w: 420, placeholder: 'new word', commit: null },
      { kind: 'button', x: 10, y: G.INPUT_Y, w: 150, text: 'Add', on: '_addWord' },
      { kind: 'button', id: 'undoButton', x: 400, y: G.INPUT_Y, w: 180, text: 'Undo', on: '_undo' },
      { kind: 'area', id: 'board', x: 0, y: G.BOARD.y, w: G.BOARD.width, h: G.BOARD.height, text: 'board' },
      { kind: 'status', id: 'status', x: 0, y: G.STATUS_Y, text: 'validation', font: G.FONT, color: UI.EDITOR_TEXT, w: 1000 },
      { kind: 'status', id: 'solver', x: 0, y: G.SOLVER_Y, text: 'solver', font: G.SMALL_FONT, color: UI.EDITOR_MUTED, w: 1000 },
      { kind: 'button', x: -340, y: G.ACTIONS_Y, w: 300, text: 'Save', on: '_save' },
      { kind: 'button', x: 0, y: G.ACTIONS_Y, w: 300, text: 'Copy JSON', on: '_copyJson' },
      { kind: 'button', x: 340, y: G.ACTIONS_Y, w: 300, text: 'Download', on: '_download' },
    ];
    const pitch = 170;
    TOOLS.forEach((t, i) => {
      items.push({ kind: 'button', id: 'tool:' + t.id, x: -pitch * (TOOLS.length - 1) / 2 + i * pitch, y: G.TOOLS_Y, w: 160, text: t.label, on: '_selectTool', arg: t.id });
    });
    KEY_ROWS.forEach((row, r) => {
      const y = G.KEYS_Y - r * (G.KEY + G.KEY_GAP);
      const keys = row.split('');
      if (r === KEY_ROWS.length - 1) {
        keys.push('⌫');
      }
      const width = keys.length * (G.KEY + G.KEY_GAP) - G.KEY_GAP;
      keys.forEach((k, i) => {
        const x = -width / 2 + G.KEY / 2 + i * (G.KEY + G.KEY_GAP);
        items.push({ kind: 'button', key: true, x, y, w: G.KEY, h: G.KEY, text: k, on: k === '⌫' ? '_eraseSelected' : '_typeLetter', arg: k });
      });
    });
    return items;
  },

  /** Runtime: real controls from the layout items, plus the board view and the background. */
  _build() {
    const f = this.frames;
    const bg = UiKit.sprite(this.node, f.Background, LAYOUT.DESIGN_WIDTH, LAYOUT.DESIGN_HEIGHT, 'background');
    bg.zIndex = -10;
    this._layoutItems().forEach((it) => {
      switch (it.kind) {
        case 'label': {
          const node = UiKit.label(this.node, it.text, it.font, it.color, 'title');
          node.anchorX = it.anchorX === undefined ? 0.5 : it.anchorX;
          node.setPosition(it.x, it.y);
          break;
        }
        case 'button': {
          const node = this._button(it.x, it.y, it.w, it.text, () => this[it.on].apply(this, Array.isArray(it.arg) ? it.arg : [it.arg]), it.h);
          if (it.key) {
            node.color = col(UI.EDITOR_TOOL);
          }
          if (it.id && it.id.indexOf('tool:') === 0) {
            this.toolButtons[it.id.slice(5)] = node;
          } else if (it.id) {
            this[it.id] = node;
          }
          break;
        }
        case 'field':
          this[it.id + 'Box'] = this._editBox(it.x, it.y, it.w, it.placeholder, '', it.commit ? (text) => this[it.commit](text) : null);
          break;
        case 'status':
          this[it.id + 'Label'] = this._text(it.x, it.y, it.id === 'size' ? it.text : '', it.font, it.color, it.id, it.w);
          break;
        case 'area':
          if (it.id === 'chips') {
            this.chipsNode = new cc.Node('chips');
            this.chipsNode.setPosition(it.x, it.y);
            this.node.addChild(this.chipsNode);
          } else {
            this._buildBoard(it);
          }
          break;
        default:
          break;
      }
    });
    this.wordBox.node.on('editing-return', () => this._addWord(), this);
  },

  /** The game's BoardView on a slot-sized node, plus a selection ring and hole outlines. */
  _buildBoard(it) {
    this.boardNode = new cc.Node('board');
    this.boardNode.setContentSize(it.w, it.h);
    this.boardNode.setPosition(it.x, it.y);
    this.node.addChild(this.boardNode);
    this.boardView = this.boardNode.addComponent('BoardView');
    this.boardView.config = { boardMaxCell: LAYOUT.MAX_CELL, slotOpacity: LAYOUT.SLOT_OPACITY };
    this.overlay = new cc.Node('overlay');
    this.overlay.zIndex = 50;
    this.boardNode.addChild(this.overlay);
    this.graphics = this.overlay.addComponent(cc.Graphics);
    this.boardNode.on(cc.Node.EventType.TOUCH_START, this._onBoardTouch, this);
  },

  _commitId(text) {
    this.doc.setId(text) && this._changed();
  },

  _commitTopic(text) {
    this.doc.setTopic(text) && this._changed();
  },

  /**
   * Editor only: the layout as outlined boxes with their captions, so the Scene view shows the
   * screen without pressing Play. The nodes carry DontSave and HideInHierarchy (like ScreenLayout's
   * slot outlines), so they never reach the scene file or a build; no textures are needed.
   */
  _drawEditorPreview() {
    if (this._preview && this._preview.isValid) {
      this._preview.destroy();
    }
    const root = new cc.Node('editor-preview (editor only)');
    root._objFlags |= cc.Object.Flags.DontSave | cc.Object.Flags.HideInHierarchy;
    this.node.addChild(root);
    this._preview = root;
    const g = root.addComponent(cc.Graphics);
    g.lineWidth = 4;
    const caption = (x, y, text, font, rgb, anchorX) => {
      const node = new cc.Node('caption');
      node._objFlags |= cc.Object.Flags.DontSave | cc.Object.Flags.HideInHierarchy;
      const label = node.addComponent(cc.Label);
      label.string = text;
      label.fontSize = font;
      label.lineHeight = font;
      label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
      label.verticalAlign = cc.Label.VerticalAlign.CENTER;
      node.color = col(rgb);
      node.anchorX = anchorX === undefined ? 0.5 : anchorX;
      node.setPosition(x, y);
      root.addChild(node);
    };
    const box = (it, rgb, h) => {
      const height = h || it.h || G.BUTTON_H;
      g.strokeColor = col(rgb);
      g.rect(it.x - it.w / 2, it.y - height / 2, it.w, height);
      g.stroke();
    };
    this._layoutItems().forEach((it) => {
      switch (it.kind) {
        case 'label':
          caption(it.x, it.y, it.text, it.font, it.color, it.anchorX);
          break;
        case 'button':
          box(it, it.key ? UI.EDITOR_TOOL : UI.BUTTON);
          caption(it.x, it.y, it.text, it.key ? G.SMALL_FONT : G.FONT, UI.BUTTON_TEXT);
          break;
        case 'field':
          box(it, UI.EDITOR_MUTED);
          caption(it.x - it.w / 2 + 12, it.y, it.placeholder, G.FONT, UI.EDITOR_MUTED, 0);
          break;
        case 'status':
          caption(it.x, it.y, it.text, it.font, it.color);
          break;
        case 'area':
          box(it, UI.EDITOR_SELECTION);
          caption(it.x, it.y, it.text, G.TITLE_FONT, UI.EDITOR_SELECTION);
          break;
        default:
          break;
      }
    });
  },

  _button(x, y, width, text, onClick, height) {
    const node = UiKit.button(this.node, this.frames.Button, width, height || G.BUTTON_H, text, G.FONT, UI.BUTTON_TEXT, onClick);
    node.setPosition(x, y);
    return node;
  },

  _text(x, y, text, fontSize, rgb, name, width) {
    const node = UiKit.label(this.node, text, fontSize, rgb, name);
    node.setPosition(x, y);
    const label = node.getComponent(cc.Label);
    label.cacheMode = cc.Label.CacheMode.NONE; // changes often
    if (width) {
      node.width = width;
      label.overflow = cc.Label.Overflow.RESIZE_HEIGHT;
      label.enableWrapText = true;
    }
    return node;
  },

  /**
   * A cc.EditBox built from code: the Block texture as background, a text label and a placeholder.
   * `onCommit(text)` runs when editing ends. @returns {cc.EditBox}
   */
  _editBox(x, y, width, placeholder, value, onCommit) {
    const node = UiKit.sliced(this.node, this.frames.Block, width, G.BUTTON_H, UI.EDITOR_FIELD, 'edit-' + placeholder);
    node.setPosition(x, y);
    const box = node.addComponent(cc.EditBox);
    box.background = node.getComponent(cc.Sprite);
    const text = UiKit.label(node, '', G.FONT, UI.EDITOR_TEXT, 'text');
    const hint = UiKit.label(node, placeholder, G.FONT, UI.EDITOR_MUTED, 'placeholder');
    [text, hint].forEach((n) => {
      const label = n.getComponent(cc.Label);
      // Order matters: while overflow is NONE a cache-mode change re-lays the (empty) label out
      // and shrinks the node to zero width, which CLAMP would then keep.
      label.overflow = cc.Label.Overflow.CLAMP;
      n.setContentSize(width - 24, G.BUTTON_H);
      label.cacheMode = cc.Label.CacheMode.NONE;
    });
    box.textLabel = text.getComponent(cc.Label);
    box.placeholderLabel = hint.getComponent(cc.Label);
    // The EditBox setters re-anchor both labels to their top-left corner; place them accordingly.
    [text, hint].forEach((n) => {
      n.setAnchorPoint(0, 1);
      n.setPosition(-width / 2 + 12, G.BUTTON_H / 2);
      n.getComponent(cc.Label).horizontalAlign = cc.Label.HorizontalAlign.LEFT;
    });
    box.inputMode = cc.EditBox.InputMode.SINGLE_LINE;
    box.returnType = cc.EditBox.KeyboardReturnType.DONE;
    box.maxLength = 24;
    box.string = value || '';
    node.on('editing-did-began', () => (this.editing = true), this);
    node.on('editing-did-ended', () => {
      this.editing = false;
      if (onCommit) {
        onCommit(box.string);
      }
    }, this);
    return box;
  },

  // ---- rendering --------------------------------------------------------------------------------

  /** Redraws everything from the document: chips, board, size, tool state, status; schedules the solver. */
  _refresh() {
    this.sizeLabel.getComponent(cc.Label).string = this.doc.rows + '×' + this.doc.cols;
    this._renderLevelButton();
    this.idBox.string = String(this.doc.id);
    this.topicBox.string = this.doc.topic;
    this._renderChips();
    this._renderBoard();
    this._renderTools();
    this._renderStatus();
    this.unschedule(this._runSolver);
    this.solverLabel.getComponent(cc.Label).string = this.doc.validate().length ? '' : 'solving…';
    if (!this.doc.validate().length) {
      this.scheduleOnce(this._runSolver, SOLVER_DELAY);
    }
  },

  _renderChips() {
    this.chipsNode.removeAllChildren();
    this.chips = [];
    const words = this.doc.words;
    const level = this.doc.toLevel();
    const gap = 14;
    let x = -G.MARGIN;
    let row = 0;
    words.forEach((w, i) => {
      const text = i + 1 + ' ' + w;
      const width = text.length * G.CHIP_FONT * 0.62 + 90;
      if (x + width > G.MARGIN) {
        x = -G.MARGIN;
        row += 1;
      }
      const chip = UiKit.sliced(this.chipsNode, this.frames.Block, width, G.CHIP_H, wordColor(paletteIndex(level, i)), 'chip-' + i);
      chip.anchorX = 0;
      chip.setPosition(x, -row * G.CHIP_ROW);
      const label = UiKit.label(chip, text, G.CHIP_FONT, UI.LETTER_ON_COLOR, 'text');
      label.setPosition(width / 2 - 16, 0);
      chip.addComponent(cc.Button);
      chip.on('click', () => this._selectWord(i), this);
      // The × is a child button: its node swallows the touch, so the chip's own click never fires.
      const close = new cc.Node('remove');
      close.setContentSize(48, G.CHIP_H);
      close.setPosition(width - 24, 0);
      chip.addChild(close);
      UiKit.label(close, '×', G.CHIP_FONT, UI.LETTER_ON_COLOR, 'text');
      close.addComponent(cc.Button);
      close.on('click', () => this._removeWord(i), this);
      chip.opacity = i === this.selectedWord ? 255 : 170;
      chip.scale = i === this.selectedWord ? 1.06 : 1;
      this.chips.push(chip);
      x += width + gap;
    });
  },

  /** A GameSession-shaped read model from the document, so BoardView draws it unchanged. */
  _renderBoard() {
    const level = this.doc.toLevel();
    const board = new Board(level.shape);
    const pieces = level.pieces.map((def, i) => Piece.fromLevel(def, i));
    pieces.forEach((p) => board.place(p, p.at[0], p.at[1]));
    this.preview = { bus: new EventBus(), board, pieces, level };
    this.boardView.bind(this.preview, this.frames, this.style);
    const prefixes = WordMatcher.find(board, level, pieces).map((m) => ({ wordIndex: m.wordIndex, cells: m.cells, pieceIds: m.pieceIds }));
    this.preview.bus.emit(EVENTS.WORD_PROGRESS, { prefixes });
    this._drawOverlay();
  },

  /** Hole outlines (so a hole can be tapped back into a cell) and the selection ring. */
  _drawOverlay() {
    const g = this.graphics;
    g.clear();
    const size = this.boardView.cellSize;
    g.lineWidth = 4;
    g.strokeColor = col(UI.EDITOR_HOLE);
    for (let r = 0; r < this.doc.rows; r++) {
      for (let c = 0; c < this.doc.cols; c++) {
        if (!this.doc.isCell(r, c)) {
          const p = this.boardView.cellToLocal(r, c);
          g.rect(p.x - size * 0.4, p.y - size * 0.4, size * 0.8, size * 0.8);
          g.stroke();
        }
      }
    }
    if (this.selection) {
      const p = this.boardView.cellToLocal(this.selection.r, this.selection.c);
      g.lineWidth = 8;
      g.strokeColor = col(UI.EDITOR_SELECTION);
      g.rect(p.x - size * 0.47, p.y - size * 0.47, size * 0.94, size * 0.94);
      g.stroke();
    }
  },

  _renderTools() {
    TOOLS.forEach((t) => {
      this.toolButtons[t.id].color = col(t.id === this.tool ? UI.BUTTON : UI.EDITOR_TOOL);
    });
    this.undoButton.opacity = this.doc.canUndo ? 255 : 120;
  },

  _renderStatus() {
    if (this._flash) {
      return;
    }
    const errors = this.doc.validate();
    const label = this.statusLabel.getComponent(cc.Label);
    if (!errors.length) {
      label.string = '✓ Valid level';
      this.statusLabel.color = col(UI.EDITOR_OK);
      return;
    }
    const balance = this.doc.letterBalance()
      .map((b) => b.letter + ' ' + b.provided + '/' + b.needed)
      .join('  ');
    label.string = errors[0] + (balance ? '\nLetters placed/needed: ' + balance : '');
    this.statusLabel.color = col(UI.EDITOR_ERROR);
  },

  /** Short message in the status line, then back to validation. */
  _flashStatus(text, rgb) {
    this.statusLabel.getComponent(cc.Label).string = text;
    this.statusLabel.color = col(rgb || UI.EDITOR_TEXT);
    this._flash = true;
    this.unschedule(this._endFlash);
    this.scheduleOnce(this._endFlash, FLASH_SECONDS);
  },

  _endFlash() {
    this._flash = false;
    this._renderStatus();
  },

  _runSolver() {
    const level = this.doc.toLevel();
    if (this.doc.validate().length) {
      return;
    }
    const result = Solver.analyze(level, SOLVER_BUDGET);
    let text;
    if (result.solvable === null) {
      text = 'Solver: undecided within the state budget';
    } else if (!result.solvable) {
      text = 'Solver: unsolvable';
    } else {
      text = 'Solver: ' + (result.optimal ? '' : '≤ ') + result.moves + ' moves, ' + (result.optimal ? '' : '≤ ') + result.slides + ' slides';
    }
    this.solverLabel.getComponent(cc.Label).string = text;
  },

  // ---- input ------------------------------------------------------------------------------------

  _selectTool(id) {
    this.tool = id;
    this.selection = null;
    this._flashStatus(TOOLS.find((t) => t.id === id).hint, UI.EDITOR_MUTED);
    this._renderTools();
    this._drawOverlay();
  },

  _removeWord(index) {
    this.doc.removeWord(index);
    this.selectedWord = Math.max(0, Math.min(this.selectedWord, this.doc.words.length - 1));
    this._changed();
  },

  /** Tapping a chip picks the pin target and switches to the pin tool. */
  _selectWord(index) {
    this.selectedWord = index;
    if (this.tool !== 'pin') {
      this._selectTool('pin');
    }
    this._renderChips();
  },

  /** @returns {{r:number, c:number}|null} grid cell (holes included) under a world point */
  _cellAtWorld(worldPos) {
    const local = this.boardNode.convertToNodeSpaceAR(worldPos);
    const size = this.boardView.cellSize;
    const r = Math.round((this.doc.rows - 1) / 2 - local.y / size);
    const c = Math.round(local.x / size + (this.doc.cols - 1) / 2);
    return r >= 0 && c >= 0 && r < this.doc.rows && c < this.doc.cols ? { r, c } : null;
  },

  _onBoardTouch(event) {
    const cell = this._cellAtWorld(event.getLocation());
    if (!cell) {
      return;
    }
    const { r, c } = cell;
    const doc = this.doc;
    switch (this.tool) {
      case 'cell':
        doc.toggleCell(r, c) && this._changed();
        break;
      case 'letter':
        if (doc.isCell(r, c)) {
          this.selection = cell;
          this._drawOverlay();
        }
        break;
      case 'pin':
        if (!doc.words.length) {
          this._flashStatus('Add a word first', UI.EDITOR_ERROR);
        } else if (doc.pieceAt(r, c) && doc.pieceAt(r, c).letters.length > 1) {
          this._flashStatus('Only single letters can be pinned', UI.EDITOR_ERROR);
        } else {
          doc.togglePin(r, c, this.selectedWord) && this._changed();
        }
        break;
      case 'freeze': {
        const p = doc.pieceAt(r, c);
        if (p && p.pin !== undefined) {
          this._flashStatus('Pinned letters cannot be frozen', UI.EDITOR_ERROR);
        } else {
          doc.cycleFrozen(r, c) && this._changed();
        }
        break;
      }
      case 'link':
        this._linkTap(r, c);
        break;
      case 'erase':
        doc.erase(r, c) && this._changed();
        break;
      default:
        break;
    }
  },

  _linkTap(r, c) {
    const doc = this.doc;
    if (!doc.pieceAt(r, c)) {
      this.selection = null;
      this._drawOverlay();
      return;
    }
    if (!this.selection) {
      this.selection = { r, c };
      this._drawOverlay();
      return;
    }
    const s = this.selection;
    this.selection = null;
    if (s.r === r && s.c === c) {
      doc.unlink(r, c) ? this._changed() : this._drawOverlay();
      return;
    }
    if (doc.link(s.r, s.c, r, c)) {
      this._changed();
    } else {
      this._flashStatus('Cannot link: pieces must be adjacent, unpinned, and at most 3 letters together', UI.EDITOR_ERROR);
      this._drawOverlay();
    }
  },

  _typeLetter(letter) {
    if (!this.selection) {
      this._flashStatus('Tap a cell first', UI.EDITOR_MUTED);
      return;
    }
    const { r, c } = this.selection;
    if (this.doc.setLetter(r, c, letter)) {
      this.selection = this._nextCell(r, c);
      this._changed();
    }
  },

  _eraseSelected() {
    if (this.selection && this.doc.erase(this.selection.r, this.selection.c)) {
      this._changed();
    }
  },

  /** Next playable cell in reading order (wrapping), or null when there is none. */
  _nextCell(r, c) {
    const total = this.doc.rows * this.doc.cols;
    for (let i = 1; i <= total; i++) {
      const k = (r * this.doc.cols + c + i) % total;
      const nr = Math.floor(k / this.doc.cols);
      const nc = k % this.doc.cols;
      if (this.doc.isCell(nr, nc)) {
        return { r: nr, c: nc };
      }
    }
    return null;
  },

  _onKey(event) {
    if (this.editing || !this.frames) {
      return;
    }
    const code = event.keyCode;
    if (code >= cc.macro.KEY.a && code <= cc.macro.KEY.z) {
      if (this.tool !== 'letter') {
        this._selectTool('letter');
      }
      this._typeLetter(String.fromCharCode(code - cc.macro.KEY.a + 65));
    } else if (code === cc.macro.KEY.backspace) {
      this._eraseSelected();
    }
  },

  // ---- commands ---------------------------------------------------------------------------------

  _changed() {
    this._persist();
    this._refresh();
  },

  _resize(dr, dc) {
    this.selection = null;
    this.doc.resize(this.doc.rows + dr, this.doc.cols + dc) && this._changed();
  },

  _addWord() {
    const result = this.doc.addWord(this.wordBox.string);
    if (!result.ok) {
      this._flashStatus(result.error, UI.EDITOR_ERROR);
      return;
    }
    this.wordBox.string = '';
    this.selectedWord = this.doc.words.length - 1;
    this._changed();
  },

  _undo() {
    this.selection = null;
    this.doc.undo() && this._changed();
  },

  /** A blank board with the next free id after the levels in the project. */
  _newLevel() {
    const nextId = this.levels.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    this.doc = new LevelDocument(LevelDocument.blankLevel(nextId, 5, 5));
    this.selection = null;
    this.selectedWord = 0;
    this._changed();
  },

  /** Index in `levels` of the level the document was loaded from (by id), or -1 for a new one. */
  _currentIndex() {
    return this.levels.findIndex((l) => l.id === this.doc.id);
  },

  /** Previous (-1) or next (+1) project level, wrapping; from a new level, ▸ starts at the first. */
  _loadStep(dir) {
    if (!this.levels.length) {
      this._flashStatus('No levels under resources/levels', UI.EDITOR_ERROR);
      return;
    }
    const n = this.levels.length;
    const current = this._currentIndex();
    const next = current < 0 ? (dir > 0 ? 0 : n - 1) : (current + dir + n) % n;
    this._loadLevel(next);
  },

  /** Replaces the document with project level `index` (resources/levels, sorted by id). */
  _loadLevel(index) {
    const level = this.levels[index];
    if (!level) {
      return;
    }
    this._closePicker();
    this.doc = new LevelDocument(level);
    this.selection = null;
    this.selectedWord = 0;
    this._changed();
    this._flashStatus('Loaded ' + this._fileName() + ' (' + level.topic + ')', UI.EDITOR_OK);
  },

  /** The level button shows which project level is open: "Level 5 ▾", or "New ▾" for an unsaved id. */
  _renderLevelButton() {
    const label = this.levelButton.getChildByName('text').getComponent(cc.Label);
    label.string = (this._currentIndex() < 0 ? 'New' : 'Level ' + this.doc.id) + ' ▾';
  },

  _togglePicker() {
    if (this.picker) {
      this._closePicker();
    } else {
      this._openPicker();
    }
  },

  _closePicker() {
    if (this.picker && this.picker.isValid) {
      this.picker.destroy();
    }
    this.picker = null;
  },

  /**
   * A list of every project level under the top bar: id, topic and words per row; tap a row to load
   * it, tap the dimmed screen behind to close. Built on demand, destroyed on close.
   */
  _openPicker() {
    if (!this.levels.length) {
      this._flashStatus('No levels under resources/levels', UI.EDITOR_ERROR);
      return;
    }
    const rowH = 80;
    const width = 900;
    const rows = this.levels.length;
    const height = rows * rowH + 40;
    const picker = new cc.Node('picker');
    picker.zIndex = 200;
    picker.setContentSize(LAYOUT.DESIGN_WIDTH, LAYOUT.DESIGN_HEIGHT);
    picker.on(cc.Node.EventType.TOUCH_START, () => this._closePicker(), this); // the backdrop swallows the tap
    this.node.addChild(picker);
    const panel = UiKit.sliced(picker, this.frames.Block, width, height, UI.EDITOR_FIELD, 'panel');
    panel.setPosition(0, G.TOP_Y - G.BUTTON_H / 2 - 20 - height / 2);
    const current = this._currentIndex();
    this.levels.forEach((level, i) => {
      const row = UiKit.button(panel, this.frames.Button, width - 40, rowH - 10, '', G.FONT, UI.BUTTON_TEXT, () => this._loadLevel(i), 'row-' + level.id);
      row.setPosition(0, height / 2 - 20 - rowH / 2 - i * rowH);
      row.color = col(i === current ? UI.BUTTON : UI.EDITOR_TOOL);
      const text = row.getChildByName('text');
      const label = text.getComponent(cc.Label);
      label.string = level.id + '  ' + level.topic + '  ·  ' + level.words.join(', ');
      label.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
      label.overflow = cc.Label.Overflow.CLAMP;
      text.anchorX = 0;
      text.setContentSize(width - 80, rowH - 10);
      text.setPosition(-(width - 40) / 2 + 20, 0);
    });
    this.picker = picker;
  },

  /**
   * Writes the level into assets/resources/levels through tools/level-server.js. The file lands
   * in the project at once; Creator imports it and the game lists it on its next start.
   */
  _save() {
    const errors = this.doc.validate();
    if (errors.length) {
      this._flashStatus('Fix the level first: ' + errors[0], UI.EDITOR_ERROR);
      return;
    }
    if (typeof fetch !== 'function') {
      this._flashStatus('Save needs a browser; use Download', UI.EDITOR_ERROR);
      return;
    }
    const level = this.doc.toLevel();
    fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(level) })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!cc.isValid(this)) {
          return;
        }
        if (!ok) {
          this._flashStatus('Save refused: ' + ((body.errors && body.errors[0]) || body.error), UI.EDITOR_ERROR);
          return;
        }
        const i = this.levels.findIndex((l) => l.id === level.id);
        if (i >= 0) {
          this.levels[i] = level;
        } else {
          this.levels.push(level);
          this.levels.sort((a, b) => a.id - b.id);
        }
        this._flashStatus('Saved ' + body.file + ' — restart the game scene to play it', UI.EDITOR_OK);
      })
      .catch(() => {
        if (cc.isValid(this)) {
          this._flashStatus('Save server not running: npm run editor:server (or use Download)', UI.EDITOR_ERROR);
        }
      });
  },

  _testPlay() {
    const errors = this.doc.validate();
    if (errors.length) {
      this._flashStatus('Fix the level first: ' + errors[0], UI.EDITOR_ERROR);
      return;
    }
    this._persist();
    LevelDraft.set(this.doc.toLevel(), SCENE_NAME);
    cc.director.loadScene(GAME_SCENE);
  },

  _json() {
    return JSON.stringify(this.doc.toLevel(), null, 2) + '\n';
  },

  _fileName() {
    return 'level_' + String(this.doc.id).padStart(3, '0') + '.json';
  },

  _copyJson() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(this._json()).then(
        () => this._flashStatus('Copied ' + this._fileName() + ' to the clipboard', UI.EDITOR_OK),
        () => this._flashStatus('Clipboard refused; use Download', UI.EDITOR_ERROR)
      );
    } else {
      console.log(this._json());
      this._flashStatus('No clipboard here; the JSON is in the console', UI.EDITOR_MUTED);
    }
  },

  _download() {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') {
      this._flashStatus('Download needs a browser; use Copy JSON', UI.EDITOR_ERROR);
      return;
    }
    const url = URL.createObjectURL(new Blob([this._json()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = this._fileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._flashStatus('Downloaded ' + this._fileName() + ' — drop it into assets/resources/levels', UI.EDITOR_OK);
  },

  // ---- persistence ------------------------------------------------------------------------------

  _persist() {
    try {
      cc.sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.doc.toLevel()));
    } catch (_e) {
      // private mode or quota: the draft simply does not survive a reload
    }
  },

  /** @returns {LevelDocument|null} */
  _restore() {
    try {
      const raw = cc.sys.localStorage.getItem(STORAGE_KEY);
      return raw ? new LevelDocument(JSON.parse(raw)) : null;
    } catch (_e) {
      return null;
    }
  },
});
