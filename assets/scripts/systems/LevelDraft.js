/**
 * LevelDraft — hand-off of an unsaved level between the editor scene and the game (ADR-0008).
 * Engine-free module state: Creator loads scripts once per run, so a value set here before
 * `cc.director.loadScene` is still there in the next scene (Unity analogy: a static field).
 * The editor calls `set(level)` then loads Main; Game calls `peek()` at start and plays that
 * level instead of the resources list, and `returnScene` tells it where "back" leads.
 * Release builds never set a draft, so `has()` is false and the player flow is untouched.
 */
'use strict';

let current = null;
let returnScene = null;

/** @param {object} level a level definition @param {string} scene scene name to return to */
function set(level, scene) {
  current = level;
  returnScene = scene || null;
}

function has() {
  return current !== null;
}

/** @returns {object|null} the draft, left in place so a restart replays it */
function peek() {
  return current;
}

/** @returns {string|null} */
function returnTo() {
  return returnScene;
}

function clear() {
  current = null;
  returnScene = null;
}

module.exports = { set, has, peek, returnTo, clear };
