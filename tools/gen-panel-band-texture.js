#!/usr/bin/env node
// Generates assets/resources/textures/common/PanelBand.png: the header band drawn across the top
// of the found-words panel (behind the topic title). Drawn at its final size, so it is used as a
// SIMPLE sprite with no slicing: a flat dark fill whose top corners follow the Panel.png corner
// radius exactly, sitting just inside the panel's border, with a straight bottom edge. Transparent
// margins of BORDER pixels on the top, left and right let the node be placed flush with the
// panel's top edge at the panel's full width. Re-run after changing the panel geometry.
// Usage: node tools/gen-panel-band-texture.js [out.png]
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 900; // = LAYOUT.PANEL_WIDTH
const HEIGHT = 84; // band height
const RADIUS = 56; // Panel.png RADIUS
const BORDER = 5; // Panel.png BORDER: the band sits inside it
const FILL = [10, 8, 46, 165];
const EDGE = [120, 136, 220, 70]; // faint line along the bottom edge, like a seam

const INNER_RADIUS = RADIUS - BORDER;

// Signed distance to the band shape: rounded top corners, square bottom, inset by BORDER.
function distance(x, y) {
  const left = BORDER;
  const right = WIDTH - BORDER;
  const top = BORDER;
  const cx = x < left + INNER_RADIUS ? left + INNER_RADIUS : x > right - INNER_RADIUS ? right - INNER_RADIUS : x;
  const cy = top + INNER_RADIUS;
  if (y < cy) {
    return Math.hypot(x - cx, y - cy) - INNER_RADIUS; // corner arcs and the top edge
  }
  return Math.max(left - x, x - right); // straight sides below the corners, open bottom
}

function coverage(d) {
  return Math.min(1, Math.max(0, 0.5 - d));
}

function pixel(x, y) {
  const a = coverage(distance(x + 0.5, y + 0.5));
  if (a <= 0) {
    return [0, 0, 0, 0];
  }
  const seam = y >= HEIGHT - 2 ? 1 : 0;
  const rgba = seam ? EDGE : FILL;
  return [rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * a)];
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng() {
  const stride = WIDTH * 4 + 1;
  const raw = Buffer.alloc(stride * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < WIDTH; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'resources', 'textures', 'common', 'PanelBand.png');
fs.writeFileSync(out, encodePng());
console.log(`wrote ${out} (${WIDTH}x${HEIGHT}, radius ${RADIUS}, inset ${BORDER})`);
