#!/usr/bin/env node
/**
 * Generates assets/scenes/Editor.fire, the level editor scene (ADR-0008): a Canvas (1080x1920,
 * stretched) with the LevelEditor component, and a Main Camera, mirroring Main.fire's skeleton.
 * Everything on screen is built by LevelEditor at runtime, so the scene stays this small.
 * Run once; afterwards the scene is Creator's (never hand-edit .fire files).
 *
 * The component's uuid comes from assets/scripts/ui/LevelEditor.js.meta, which Creator writes the
 * first time it imports the script. Without it the scene is written bare and the component must be
 * added in the Properties panel (or re-run this script after opening the project once).
 * Usage: node tools/gen-editor-scene.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'assets', 'scenes', 'Editor.fire');
const COMPONENT_META = path.join(ROOT, 'assets', 'scripts', 'ui', 'LevelEditor.js.meta');
const DESIGN = { width: 1080, height: 1920 };
const ALL_EDGES = 1 | 4 | 8 | 32; // top | bottom | left | right
const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Creator's compressed uuid: the `__type__` of a custom component and the `_id` of nodes. */
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

function shortId() {
  return compressUuid(crypto.randomUUID());
}

const out = [];
function push(obj) {
  out.push(obj);
  return out.length - 1;
}

function color(r, g, b) {
  return { __type__: 'cc.Color', r, g, b, a: 255 };
}

function node(name, parentId, x, y, width, height) {
  return {
    __type__: 'cc.Node',
    _name: name,
    _objFlags: 0,
    _parent: { __id__: parentId },
    _children: [],
    _active: true,
    _components: [],
    _prefab: null,
    _opacity: 255,
    _color: color(255, 255, 255),
    _contentSize: { __type__: 'cc.Size', width, height },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [x, y, 0, 0, 0, 0, 1, 1, 1, 1] },
    _eulerAngles: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _skewX: 0,
    _skewY: 0,
    _is3DNode: false,
    _groupIndex: 0,
    groupIndex: 0,
    _id: shortId(),
  };
}

// Once Creator has imported the scene, its asset uuid lives in the .meta; keep the two in step.
const sceneUuid = fs.existsSync(TARGET + '.meta') ? JSON.parse(fs.readFileSync(TARGET + '.meta', 'utf8')).uuid : crypto.randomUUID();
push({ __type__: 'cc.SceneAsset', _name: '', _objFlags: 0, _native: '', scene: { __id__: 1 } });
const scene = push({
  __type__: 'cc.Scene',
  _objFlags: 0,
  _parent: null,
  _children: [],
  _active: true,
  _components: [],
  _prefab: null,
  _opacity: 255,
  _color: color(255, 255, 255),
  _contentSize: { __type__: 'cc.Size', width: 0, height: 0 },
  _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 0 },
  _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
  _is3DNode: true,
  _groupIndex: 0,
  groupIndex: 0,
  autoReleaseAssets: false,
  _id: sceneUuid,
});

const canvas = push(node('Canvas', scene, DESIGN.width / 2, DESIGN.height / 2, DESIGN.width, DESIGN.height));
out[scene]._children.push({ __id__: canvas });

const camera = push(node('Main Camera', canvas, 0, 0, DESIGN.width, DESIGN.height));
out[canvas]._children.push({ __id__: camera });
const cameraComponent = push({
  __type__: 'cc.Camera',
  _name: '',
  _objFlags: 0,
  node: { __id__: camera },
  _enabled: true,
  _cullingMask: 4294967295,
  _clearFlags: 7,
  _backgroundColor: color(0, 0, 0),
  _depth: -1,
  _zoomRatio: 1,
  _targetTexture: null,
  _fov: 60,
  _orthoSize: 10,
  _nearClip: 1,
  _farClip: 4096,
  _ortho: true,
  _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 },
  _renderStages: 1,
  _alignWithScreen: true,
  _id: shortId(),
});
out[camera]._components.push({ __id__: cameraComponent });

const canvasComponent = push({
  __type__: 'cc.Canvas',
  _name: '',
  _objFlags: 0,
  node: { __id__: canvas },
  _enabled: true,
  _designResolution: { __type__: 'cc.Size', width: DESIGN.width, height: DESIGN.height },
  _fitWidth: true,
  _fitHeight: true,
  _id: shortId(),
});
const widgetComponent = push({
  __type__: 'cc.Widget',
  _name: '',
  _objFlags: 0,
  node: { __id__: canvas },
  _enabled: true,
  alignMode: 1,
  _target: null,
  _alignFlags: ALL_EDGES,
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
  _id: shortId(),
});
out[canvas]._components.push({ __id__: canvasComponent }, { __id__: widgetComponent });

let attached = false;
if (fs.existsSync(COMPONENT_META)) {
  const uuid = JSON.parse(fs.readFileSync(COMPONENT_META, 'utf8')).uuid;
  const editor = push({ __type__: compressUuid(uuid), _name: '', _objFlags: 0, node: { __id__: canvas }, _enabled: true, _id: shortId() });
  out[canvas]._components.push({ __id__: editor });
  attached = true;
}

fs.writeFileSync(TARGET, JSON.stringify(out, null, 2) + '\n');
console.log('wrote ' + path.relative(process.cwd(), TARGET) + ' (' + out.length + ' objects)');
if (!attached) {
  console.log('LevelEditor.js has no .meta yet: open the project in Creator once, then re-run this script, or add the LevelEditor component to the Canvas by hand.');
}
