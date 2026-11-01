#!/usr/bin/env node
/**
 * Generates one prefab per popup kind under assets/resources/prefabs (ADR-0007), each with its art
 * wired and its own component (a Popup subclass), ready to edit in Creator. Run only when the
 * structure changes or a kind is added; after that, tune in the editor. The component scripts
 * must have been imported by Creator once (their .meta files supply the uuids).
 * Usage: node tools/gen-popup-prefab.js
 *
 * Tree (the kind's component on the root references every part):
 *   <Kind> (1080x1920, stretched; <Kind> component)
 *     overlay  — Block_back sprite tinted dark, stretched, OVERLAY_OPACITY
 *     panel    — Panel sprite, 9-sliced, POPUP_WIDTH x POPUP_HEIGHT
 *       backing  — second Panel layer (first child, draws behind)
 *       title    — Label
 *       body     — Label
 *       button   — Button sprite, 9-sliced, tinted; cc.Button added by Popup.populate
 *         text   — Label
 * Sprite-frame uuids are read from the texture .meta files, the Popup script uuid from its .meta.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { LAYOUT } = require('../assets/scripts/data/Layout');
const { UI } = require('../assets/scripts/data/Palette');

const ROOT = path.join(__dirname, '..');
const ALIGN = { TOP: 1, BOT: 4, LEFT: 8, RIGHT: 32 };
const ALL_EDGES = ALIGN.TOP | ALIGN.BOT | ALIGN.LEFT | ALIGN.RIGHT;
const SPRITE_MATERIAL = 'eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432'; // builtin-2d-sprite
const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function readMeta(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel + '.meta'), 'utf8'));
}

/** Sprite-frame (sub-asset) uuid of a texture under resources/textures/common. */
function frameUuid(name) {
  const meta = readMeta('assets/resources/textures/common/' + name + '.png');
  return meta.subMetas[name].uuid;
}

/** Creator's compressed uuid, the `__type__` of a custom component in scene and prefab files. */
function compressUuid(uuid) {
  const hex = uuid.replace(/-/g, '');
  let out = hex.slice(0, 5);
  for (let i = 5; i < 32; i += 3) {
    const lhs = parseInt(hex[i], 16);
    const mhs = parseInt(hex[i + 1], 16);
    const rhs = parseInt(hex[i + 2], 16);
    out += BASE64_KEYS[(lhs << 2) | (mhs >> 2)];
    out += BASE64_KEYS[((mhs & 3) << 4) | rhs];
  }
  return out;
}

let out = [];
let currentKind = '';
function push(obj) {
  out.push(obj);
  return out.length - 1;
}

function rgba(c, a) {
  return { __type__: 'cc.Color', r: c[0], g: c[1], b: c[2], a: a === undefined ? 255 : a };
}

function node(name, width, height, x, y, parentId, color, opacity) {
  return {
    __type__: 'cc.Node',
    _name: name,
    _objFlags: 0,
    _parent: parentId === null ? null : { __id__: parentId },
    _children: [],
    _active: true,
    _components: [],
    _prefab: null,
    _opacity: opacity === undefined ? 255 : opacity,
    _color: rgba(color || [255, 255, 255]),
    _contentSize: { __type__: 'cc.Size', width, height },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [x, y, 0, 0, 0, 0, 1, 1, 1, 1] },
    _eulerAngles: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _skewX: 0,
    _skewY: 0,
    _is3DNode: false,
    _groupIndex: 0,
    groupIndex: 0,
    _id: '',
  };
}

function widget(nodeId, flags) {
  return {
    __type__: 'cc.Widget',
    _name: '',
    _objFlags: 0,
    node: { __id__: nodeId },
    _enabled: true,
    alignMode: 1,
    _target: null,
    _alignFlags: flags,
    _left: 0,
    _right: 0,
    _top: 0,
    _bottom: 0,
    _verticalCenter: 0,
    _horizontalCenter: 0,
    _isAbsLeft: true,
    _isAbsRight: true,
    _isAbsTop: true,
    _isAbsBottom: true,
    _isAbsHorizontalCenter: true,
    _isAbsVerticalCenter: true,
    _originalWidth: 0,
    _originalHeight: 0,
    _id: '',
  };
}

function sprite(nodeId, uuid, sliced) {
  return {
    __type__: 'cc.Sprite',
    _name: '',
    _objFlags: 0,
    node: { __id__: nodeId },
    _enabled: true,
    _materials: [{ __uuid__: SPRITE_MATERIAL }],
    _srcBlendFactor: 770,
    _dstBlendFactor: 771,
    _spriteFrame: { __uuid__: uuid },
    _type: sliced ? 1 : 0,
    _sizeMode: 0,
    _fillType: 0,
    _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
    _fillStart: 0,
    _fillRange: 0,
    _isTrimmedMode: false,
    _atlas: null,
    _id: '',
  };
}

function label(nodeId, text, fontSize) {
  return {
    __type__: 'cc.Label',
    _name: '',
    _objFlags: 0,
    node: { __id__: nodeId },
    _enabled: true,
    _materials: [{ __uuid__: SPRITE_MATERIAL }],
    _srcBlendFactor: 770,
    _dstBlendFactor: 771,
    _string: text,
    _N$string: text,
    _fontSize: fontSize,
    _lineHeight: fontSize,
    _enableWrapText: false,
    _N$file: null,
    _isSystemFontUsed: true,
    _spacingX: 0,
    _batchAsBitmap: false,
    _styleFlags: 0,
    _underlineHeight: 0,
    _N$horizontalAlign: 1,
    _N$verticalAlign: 1,
    _N$fontFamily: 'Arial',
    _N$overflow: 0,
    _N$cacheMode: 1,
    _id: '',
  };
}

function prefabInfo(name) {
  const fileId = Buffer.from(currentKind + '-' + name).toString('base64').replace(/=+$/, '').slice(0, 22);
  return { __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, fileId, sync: false };
}

function addNode(spec) {
  const n = node(spec.name, spec.width, spec.height, spec.x || 0, spec.y || 0, spec.parent === undefined ? null : spec.parent, spec.color, spec.opacity);
  const id = push(n);
  if (spec.parent !== undefined && spec.parent !== null) {
    out[spec.parent]._children.push({ __id__: id });
  }
  (spec.components || []).forEach((make) => n._components.push({ __id__: push(make(id)) }));
  n._prefab = { __id__: push(prefabInfo(spec.name)) };
  return id;
}

const panelUuid = frameUuid('Panel');
const buttonUuid = frameUuid('Button');
const overlayUuid = frameUuid('Block_back');

const KINDS = [
  { name: 'PopupLevelComplete', title: 'Level completed!', body: '+10 coins', button: 'Continue' },
  { name: 'PopupSettings', title: 'Settings', body: 'Sound settings coming soon.', button: 'Close' },
];

function generate(kind) {
out = [];
currentKind = kind.name;
const popupScript = compressUuid(readMeta('assets/scripts/ui/' + kind.name + '.js').uuid);
push({ __type__: 'cc.Prefab', _name: '', _objFlags: 0, _native: '', data: { __id__: 1 }, optimizationPolicy: 0, asyncLoadAssets: false, readonly: false });

const popupComponentIndex = { value: -1 };
const root = addNode({
  name: kind.name,
  width: LAYOUT.DESIGN_WIDTH,
  height: LAYOUT.DESIGN_HEIGHT,
  components: [
    (id) => widget(id, ALL_EDGES),
    (id) => {
      popupComponentIndex.value = out.length;
      return { __type__: popupScript, _name: '', _objFlags: 0, node: { __id__: id }, _enabled: true, _id: '' };
    },
  ],
});
const overlay = addNode({
  name: 'overlay',
  parent: root,
  width: LAYOUT.DESIGN_WIDTH,
  height: LAYOUT.DESIGN_HEIGHT,
  color: UI.OVERLAY,
  opacity: LAYOUT.OVERLAY_OPACITY,
  components: [(id) => sprite(id, overlayUuid, false), (id) => widget(id, ALL_EDGES)],
});
const panel = addNode({ name: 'panel', parent: root, width: LAYOUT.POPUP_WIDTH, height: LAYOUT.POPUP_HEIGHT, components: [(id) => sprite(id, panelUuid, true)] });
addNode({ name: 'backing', parent: panel, width: LAYOUT.POPUP_WIDTH, height: LAYOUT.POPUP_HEIGHT, components: [(id) => sprite(id, panelUuid, true)] });
const title = addNode({ name: 'title', parent: panel, width: 0, height: 0, y: LAYOUT.POPUP_TITLE_Y, color: UI.PANEL_TITLE, components: [(id) => label(id, kind.title, LAYOUT.POPUP_TITLE_FONT)] });
const body = addNode({ name: 'body', parent: panel, width: 0, height: 0, y: LAYOUT.POPUP_BODY_Y, color: UI.POPUP_TEXT, components: [(id) => label(id, kind.body, LAYOUT.POPUP_BODY_FONT)] });
const button = addNode({ name: 'button', parent: panel, width: LAYOUT.BUTTON_WIDTH, height: LAYOUT.BUTTON_HEIGHT, y: LAYOUT.POPUP_BUTTON_Y, color: UI.BUTTON, components: [(id) => sprite(id, buttonUuid, true)] });
const text = addNode({ name: 'text', parent: button, width: 0, height: 0, color: UI.BUTTON_TEXT, components: [(id) => label(id, kind.button, LAYOUT.BUTTON_FONT)] });

function componentOf(nodeId, type) {
  return out[nodeId]._components.map((c) => c.__id__).find((i) => out[i].__type__ === type);
}

Object.assign(out[popupComponentIndex.value], {
  _N$panelFrame: { __uuid__: panelUuid }, // `notify` properties are stored under _N$<name>
  _N$overlayFrame: { __uuid__: overlayUuid },
  _N$buttonFrame: { __uuid__: buttonUuid },
  overlay: { __id__: overlay },
  panel: { __id__: panel },
  titleLabel: { __id__: componentOf(title, 'cc.Label') },
  bodyLabel: { __id__: componentOf(body, 'cc.Label') },
  button: { __id__: button },
  buttonLabel: { __id__: componentOf(text, 'cc.Label') },
});

const target = path.join(ROOT, 'assets', 'resources', 'prefabs', kind.name + '.prefab');
fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log('wrote ' + path.relative(process.cwd(), target) + ' (' + out.length + ' objects)');
}

KINDS.forEach(generate);
