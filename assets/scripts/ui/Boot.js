/**
 * Boot — attaches the Game component to the Canvas when the scene launches, if the scene does not
 * already carry one. Keeps Main.fire free of code-owned state (ADR-0003): the only editor step,
 * attaching Game, is optional. Creator executes every script under assets/ at startup, so this
 * plain module runs before the first scene loads. Skipped inside the editor.
 */
if (!CC_EDITOR) {
  cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, () => {
    const canvas = cc.find('Canvas');
    if (canvas && !canvas.getComponent('Game')) {
      canvas.addComponent('Game');
    }
  });
}
