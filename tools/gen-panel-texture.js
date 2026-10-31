#!/usr/bin/env node
// Generates assets/resources/textures/common/Panel.png: a 9-sliceable rounded panel that fits the
// night-sky art (dark translucent body, soft light border, faint top highlight). No image library
// needed; the PNG is encoded by hand with zlib. Re-run after changing the constants below.
// Usage: node tools/gen-panel-texture.js [out.png]
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256; // texture is square; slice insets must be >= RADIUS (see data/Layout PANEL_INSET)
const RADIUS = 56;
const BORDER = 5;
const FILL = [30, 24, 84, 214];
const BORDER_COLOR = [150, 170, 255, 255];
const GLOW_WIDTH = 10; // inner glow fading from the border into the body
const HIGHLIGHT = 26; // extra brightness at the top edge of the body, fading over the top third

// Signed distance from a point to a rounded rectangle centred on the texture (negative inside).
function roundedRectDistance(x, y) {
  const half = SIZE / 2;
  const qx = Math.abs(x - half) - (half - RADIUS);
  const qy = Math.abs(y - half) - (half - RADIUS);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - RADIUS;
}

function coverage(d) {
  return Math.min(1, Math.max(0, 0.5 - d)); // 1-pixel anti-aliased edge
}

function pixel(x, y) {
  const d = roundedRectDistance(x + 0.5, y + 0.5);
  const alphaShape = coverage(d);
  if (alphaShape <= 0) {
    return [0, 0, 0, 0];
  }
  const borderMix = coverage(d + BORDER); // 1 inside the body, 0 on the border ring
  const glow = Math.max(0, 1 - Math.max(0, -d - BORDER) / GLOW_WIDTH);
  const topFade = Math.max(0, 1 - y / (SIZE / 3));
  const body = [
    FILL[0] + HIGHLIGHT * topFade + 60 * glow,
    FILL[1] + HIGHLIGHT * topFade + 60 * glow,
    FILL[2] + HIGHLIGHT * topFade + 80 * glow,
    FILL[3] + 30 * glow,
  ];
  const rgba = body.map((c, i) => c * borderMix + BORDER_COLOR[i] * (1 - borderMix));
  rgba[3] *= alphaShape;
  return rgba.map((c) => Math.round(Math.min(255, Math.max(0, c))));
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
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (SIZE * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'resources', 'textures', 'common', 'Panel.png');
fs.writeFileSync(out, encodePng());
console.log(`wrote ${out} (${SIZE}x${SIZE}, radius ${RADIUS}, border ${BORDER})`);
