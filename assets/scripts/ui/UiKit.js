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

/** @returns {cc.Node} label node added to parent */
function label(parent, text, fontSize, rgb, name) {
  const node = new cc.Node(name || 'label');
  const l = node.addComponent(cc.Label);
  l.string = text;
  l.fontSize = fontSize;
  l.lineHeight = fontSize;
  l.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
  l.verticalAlign = cc.Label.VerticalAlign.CENTER;
  node.color = color(rgb);
  parent.addChild(node);
  return node;
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
 * 9-sliced panel. The pack's textures carry no slice borders in their import settings, so a
 * copy of the frame gets insets at runtime (the shared frame is left untouched).
 */
function sliced(parent, frame, width, height, rgb, name) {
  const copy = new cc.SpriteFrame(frame.getTexture(), frame.getRect(), frame.isRotated(), frame.getOffset(), frame.getOriginalSize());
  copy.insetTop = copy.insetBottom = copy.insetLeft = copy.insetRight = LAYOUT.SLICE_INSET;
  const node = sprite(parent, copy, width, height, name || 'panel');
  node.getComponent(cc.Sprite).type = cc.Sprite.Type.SLICED;
  if (rgb) {
    node.color = color(rgb);
  }
  return node;
}

/**
 * Button with a scale transition and a centred text label.
 * @param {Function} onClick
 * @returns {cc.Node}
 */
function button(parent, frame, width, height, text, fontSize, textRgb, onClick, name) {
  const node = sliced(parent, frame, width, height, UI.BUTTON, name || 'button');
  const b = node.addComponent(cc.Button);
  b.transition = cc.Button.Transition.SCALE;
  b.zoomScale = 0.92;
  node.on('click', onClick);
  label(node, text || '', fontSize, textRgb, 'text'); // always present so callers can retitle it
  return node;
}

module.exports = { color, label, sprite, sliced, button };
