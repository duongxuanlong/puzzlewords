/**
 * ScreenSlots — finds the ScreenLayout (ADR-0006) that holds the screen's slot nodes, or builds one.
 * Resolution: a ScreenLayout under the Canvas with every slot assigned (authored in Main.fire),
 * else `createDefault()`, which builds the same tree from the data/Layout constants so the game
 * runs with an empty scene (headless builds, tests). Game attaches one component per slot.
 */
const ScreenLayout = require('ScreenLayout');

const ROOT_NAME = 'Screen';

/** @returns {ScreenLayout} a Screen tree built from data/Layout, with its slots referenced */
function createDefault() {
  const root = new cc.Node(ROOT_NAME);
  return ScreenLayout.populate(root.addComponent(ScreenLayout));
}

/**
 * The scene's ScreenLayout under `canvas`, or a code-built one added to it.
 * @param {cc.Node} canvas
 * @returns {ScreenLayout}
 */
function resolve(canvas) {
  const inScene = canvas.getComponentInChildren(ScreenLayout);
  if (inScene && inScene.isComplete()) {
    return inScene;
  }
  if (inScene) {
    cc.warn('ScreenSlots: the ScreenLayout on "' + inScene.node.name + '" has an unassigned slot; using code defaults');
  } else if (canvas.parent && canvas.parent.children.some((n) => n !== canvas && n.getComponentInChildren(ScreenLayout))) {
    cc.warn('ScreenSlots: a ScreenLayout sits beside the Canvas, not under it; it is ignored. Drag its node onto Canvas in the Node Tree.');
  }
  const layout = createDefault();
  canvas.addChild(layout.node);
  return layout;
}

module.exports = { ROOT_NAME, createDefault, resolve };
