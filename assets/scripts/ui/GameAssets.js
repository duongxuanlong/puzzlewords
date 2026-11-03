/**
 * GameAssets — loads the shared runtime assets once per scene: every sprite frame under
 * resources/textures indexed by file name, and the PieceStyle prefab (label templates for pieces,
 * with a code-built fallback). Used by Game and by the level editor (ADR-0008) so both draw the
 * board with the same frames and style. Plain module, engine-dependent.
 */
const PieceStyle = require('PieceStyle');

/**
 * @param {Function} done (frames) frames by texture name; called with null after a load error
 */
function loadFrames(done) {
  cc.resources.loadDir('textures', cc.SpriteFrame, (err, frames) => {
    if (err) {
      cc.error('GameAssets: failed to load textures', err);
      done(null);
      return;
    }
    const byName = {};
    frames.forEach((f) => {
      byName[f.name] = f;
    });
    done(byName);
  });
}

/**
 * Loads resources/prefabs/PieceStyle. The prefab is instantiated once and kept off-stage; PieceNode
 * clones its child labels. Missing or incomplete prefab → templates built in code from data/.
 * @param {Function} done (style, node) the PieceStyle component and the node that carries it
 */
function loadPieceStyle(done) {
  cc.resources.load('prefabs/PieceStyle', cc.Prefab, (err, prefab) => {
    let node = null;
    let style = null;
    if (!err && prefab) {
      node = cc.instantiate(prefab);
      style = node.getComponent('PieceStyle');
    }
    if (!style || !style.isComplete()) {
      cc.warn('GameAssets: PieceStyle prefab missing or its label templates unassigned; using code defaults');
      style = PieceStyle.createDefault();
      node = style.node;
    }
    done(style, node);
  });
}

/**
 * Every level under resources/levels, sorted by id. Levels are discovered by folder so a file the
 * editor saves (tools/level-server.js) is picked up without a code change.
 * @param {Function} done (levels) array of level definitions; empty after a load error
 */
function loadLevels(done) {
  cc.resources.loadDir('levels', cc.JsonAsset, (err, assets) => {
    if (err) {
      cc.error('GameAssets: failed to load levels', err);
      done([]);
      return;
    }
    const levels = assets.map((a) => a.json).filter((l) => l && Number.isInteger(l.id));
    levels.sort((a, b) => a.id - b.id);
    done(levels);
  });
}

module.exports = { loadFrames, loadPieceStyle, loadLevels };
