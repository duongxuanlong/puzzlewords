/**
 * Layout — sizes and positions in design pixels (1080x1920, origin at the canvas centre, y up).
 * Engine-free. BoardView derives the cell size from these; everything else reads them directly.
 */
'use strict';

const LAYOUT = Object.freeze({
  DESIGN_WIDTH: 1080,
  DESIGN_HEIGHT: 1920,

  // Board
  MAX_CELL: 180, // never larger than this, so small boards do not look huge
  BOARD_MAX_WIDTH: 960,
  BOARD_MAX_HEIGHT: 1000,
  BOARD_CENTER_Y: -150, // below the HUD and found-words panel
  TILE_NATIVE: 215, // source size of the BG_* tile textures
  BLOCK_FILL: 0.86, // block sprite width as a fraction of its cell bounding box
  LETTER_SIZE: 0.46, // font size as a fraction of the cell size
  BADGE_SIZE: 0.2, // word-length badge font size as a fraction of the cell size
  BADGE_OFFSET: 0.27, // badge distance from the cell centre, fraction of the cell size (x right, y down)
  COUNTER_SIZE: 0.42, // freeze counter font size as a fraction of the cell size
  LIFT_SCALE: 1.08,
  LIFT_Z: 100, // zIndex of the dragged piece
  BUMP_PX: 8, // blocked-step nudge distance
  FLY_SCALE: 0.5, // cleared letters shrink to this while flying to the panel

  // HUD and panels
  HUD_HEIGHT: 180,
  HUD_FONT: 56,
  TOPIC_FONT: 44,
  PANEL_WIDTH: 900,
  PANEL_HEIGHT: 380,
  PANEL_Y: 560,
  PANEL_RADIUS_PAD: 24,
  POPUP_WIDTH: 900,
  POPUP_HEIGHT: 1100,
});

module.exports = { LAYOUT };
