/**
 * UiKit — small node-building helpers shared by the ui/ components (labels, sprites, 9-sliced
 * panels from the pack's Block / Button textures, buttons). Plain module, engine-dependent.
 * Keeps every component free of repeated cc.Node / cc.Sprite / cc.Label boilerplate.
 */
const { LAYOUT } = require('Layout');
const { UI } = require('Palette');

function color(rgb) {
  return cc.color(rgb[0], rgb[1], rgb[2]);
}

/**
 * Stretches `node` to its parent's edges with a cc.Widget (reused when one exists): which edges to
 * pin, at zero inset. Unity analogy: RectTransform anchors set to stretch.
 */
function stretch(node, top, bottom, left, right) {
  const widget = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
  widget.isAlignTop = top;
  widget.isAlignBottom = bottom;
  widget.isAlignLeft = left;
  widget.isAlignRight = right;
  widget.top = widget.bottom = widget.left = widget.right = 0;
  widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
  return widget;
}

/** @returns {cc.Node} label node added to parent */
function label(parent, text, fontSize, rgb, name) {
  const node = new cc.Node(name || 'label');
  const l = node.addComponent(cc.Label);
  l.string = text;
  l.fontSize = fontSize;
  l.lineHeight = fontSize;
  l.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
  l.verticalAlign = cc.Label.VerticalAlign.CENTER;
  l.cacheMode = cc.Label.CacheMode.BITMAP; // UI text changes rarely; lets labels batch with sprites
  node.color = color(rgb);
  parent.addChild(node);
  return node;
}

/**
 * Assigns `frame` to the Sprite on `node` when the sprite has none yet, or always with `replace`
 * (an inspector-assigned frame wins over whatever the node carries); applies 9-slice insets when
 * the sprite is SLICED.
 */
function setFrame(node, frame, inset, replace) {
  const s = node && node.getComponent(cc.Sprite);
  if (!s) {
    return;
  }
  if (frame && (replace || !s.spriteFrame)) {
    s.spriteFrame = frame;
  }
  if (s.type === cc.Sprite.Type.SLICED) {
    slice(s.spriteFrame, inset);
    // The inset setters recompute the frame's UVs but do not touch sprites already rendered with
    // it (scene-loaded ones), so ask the sprite to rebuild its sliced vertices.
    s.setVertsDirty();
  }
}

/** @returns {cc.Node} sprite node of a fixed size added to parent */
function sprite(parent, frame, width, height, name) {
  const node = new cc.Node(name || 'sprite');
  const s = node.addComponent(cc.Sprite);
  s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  s.trim = false;
  s.spriteFrame = frame;
  node.setContentSize(width, height);
  parent.addChild(node);
  return node;
}

/**
 * Gives `frame` 9-slice insets in place. The pack's textures carry no borders in their import
 * settings; setting them on the shared frame is safe because SIMPLE sprites (pieces) ignore insets.
 * Idempotent, so scene-authored sprites and runtime-built ones can both call it.
 * @returns {cc.SpriteFrame} the same frame
 */
function slice(frame, inset) {
  if (frame) {
    frame.insetTop = frame.insetBottom = frame.insetLeft = frame.insetRight = inset || LAYOUT.SLICE_INSET;
  }
  return frame;
}

/** 9-sliced panel from a pack texture (see slice). */
function sliced(parent, frame, width, height, rgb, name, inset) {
  const node = sprite(parent, slice(frame, inset), width, height, name || 'panel');
  node.getComponent(cc.Sprite).type = cc.Sprite.Type.SLICED;
  if (rgb) {
    node.color = color(rgb);
  }
  return node;
}

/**
 * Button with a scale transition and a centred text label. The cc.Button emits 'click' on the
 * node; `onClick` is optional so scene-authored buttons can be wired later with node.on('click').
 * @param {Function} [onClick]
 * @returns {cc.Node}
 */
function button(parent, frame, width, height, text, fontSize, textRgb, onClick, name) {
  const node = sliced(parent, frame, width, height, UI.BUTTON, name || 'button');
  const b = node.addComponent(cc.Button);
  b.transition = cc.Button.Transition.SCALE;
  b.zoomScale = 0.92;
  if (onClick) {
    node.on('click', onClick);
  }
  label(node, text || '', fontSize, textRgb, 'text'); // always present so callers can retitle it
  return node;
}

module.exports = { color, label, sprite, slice, sliced, setFrame, button, stretch };
