#!/usr/bin/env node
// Generates the white outline ring used to highlight a lifted piece, one PNG per block shape,
// from the white block textures. No image library: PNGs are decoded and encoded by hand with zlib
// (same approach as gen-panel-texture.js). The ring is built from the block's alpha mask: pixels
// within RING_OUT px outside the opaque body, plus RING_IN px inside it so the ring overlaps the
// block edge with no gap. The baked drop shadow is excluded by the alpha THRESHOLD, so the ring
// follows the block body, not the shadow. Output canvas = source canvas + 2*PAD on every side,
// centred, so a view can place it on the block's centre and scale it by the canvas ratio.
//
// Usage: node tools/gen-outline-textures.js [--out=N] [--in=N] [--threshold=N] [--pad=N] [--stats]
//   --stats  print the alpha histogram and opaque-body margins per source instead of writing files.
//   --preview=DIR  also write DIR/<name>_preview.png: the block over the ring tinted gold on a dark
//                  background, as the game will composite it, for eyeballing ring width and pad.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TEXTURES = path.join(__dirname, '..', 'assets', 'resources', 'textures');

// Source white block → outline name, kept beside the source (naming per .claude/skills/asset-pipeline).
const SOURCES = [
  ['common/Block.png', 'common/Block_1Cell_Outline.png'],
  ['challenge2/Block_2Cell_Horizontal_white.png', 'challenge2/Block_2Cell_Horizontal_Outline.png'],
  ['challenge2/Block_2Cell_Vertical_white.png', 'challenge2/Block_2Cell_Vertical_Outline.png'],
  ['challenge2/Block_3Cell_LShape_white.png', 'challenge2/Block_3Cell_LShape_Outline.png'],
  ['challenge2/Block_3Cell_LShapeReversed_white.png', 'challenge2/Block_3Cell_LShapeReversed_Outline.png'],
  ['challenge2/Block_3Cell_LShapeUp_white.png', 'challenge2/Block_3Cell_LShapeUp_Outline.png'],
  ['challenge2/Block_3Cell_LShapeUpReversed_white.png', 'challenge2/Block_3Cell_LShapeUpReversed_Outline.png'],
];

const options = {
  out: 7, // ring width outside the body, px at source resolution
  in: 2, // ring overlap inside the body
  threshold: 250, // alpha at or above this counts as body (the drop shadow is softer)
  pad: 8, // transparent margin added around the source canvas, every side (>= out)
  stats: false,
};
process.argv.slice(2).forEach((arg) => {
  const m = /^--(\w+)(?:=(.*))?$/.exec(arg);
  if (!m) {
    throw new Error(`unknown argument ${arg}`);
  }
  options[m[1]] = m[2] === undefined ? true : m[1] === 'preview' ? m[2] : Number(m[2]);
});

// ---- PNG decode (8-bit RGBA, non-interlaced; what the art pack uses) ------------------------

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

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

/** @returns {{width:number,height:number,rgba:Buffer}} */
function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${file}: not a PNG`);
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error(`${file}: expected 8-bit RGBA non-interlaced (got depth ${data[8]}, type ${data[9]}, interlace ${data[12]})`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= 4 ? rgba[dst + i - 4] : 0;
      const b = y > 0 ? rgba[dst - stride + i] : 0;
      const c = y > 0 && i >= 4 ? rgba[dst - stride + i - 4] : 0;
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`${file}: bad filter ${filter} on row ${y}`);
      }
      rgba[dst + i] = v & 0xff;
    }
  }
  return { width, height, rgba };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Ring ----------------------------------------------------------------------------------

/** Body mask on the padded canvas: 1 where the source alpha reaches the threshold. */
function bodyMask(img, pad) {
  const w = img.width + pad * 2;
  const h = img.height + pad * 2;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.rgba[(y * img.width + x) * 4 + 3] >= options.threshold) {
        mask[(y + pad) * w + x + pad] = 1;
      }
    }
  }
  return { w, h, mask };
}

/**
 * Euclidean distance from every pixel to the nearest pixel where `mask` equals `value`, capped at
 * `limit`. Brute force over a (2*limit+1)² window: the images are small and this runs offline.
 */
function distanceTo(field, value, limit) {
  const { w, h, mask } = field;
  const dist = new Float32Array(w * h).fill(limit);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === value) {
        dist[y * w + x] = 0;
        continue;
      }
      let best = limit;
      for (let dy = -limit; dy <= limit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) {
          continue;
        }
        for (let dx = -limit; dx <= limit; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || mask[yy * w + xx] !== value) {
            continue;
          }
          const d = Math.hypot(dx, dy);
          if (d < best) {
            best = d;
          }
        }
      }
      dist[y * w + x] = best;
    }
  }
  return dist;
}

function coverage(d) {
  return Math.min(1, Math.max(0, d)); // 1-pixel anti-aliased edge
}

function buildOutline(img) {
  const field = bodyMask(img, options.pad);
  const limit = Math.max(options.out, options.in) + 1;
  const toBody = distanceTo(field, 1, limit); // 0 inside the body
  const toSpace = distanceTo(field, 0, limit); // 0 outside the body
  const rgba = Buffer.alloc(field.w * field.h * 4);
  for (let i = 0; i < field.w * field.h; i++) {
    const inside = field.mask[i] === 1;
    const a = inside ? coverage(options.in + 0.5 - toSpace[i]) : coverage(options.out + 0.5 - toBody[i]);
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = Math.round(a * 255);
  }
  return { width: field.w, height: field.h, rgba };
}

// ---- Preview -------------------------------------------------------------------------------

/** Source block drawn over the ring (tinted) over a dark board colour; same canvas as the ring. */
function composite(img, outline) {
  const TINT = [255, 200, 60];
  const BG = [40, 32, 96];
  const pad = options.pad;
  const rgba = Buffer.alloc(outline.width * outline.height * 4);
  const blend = (dst, src, a) => dst + (src - dst) * a;
  for (let y = 0; y < outline.height; y++) {
    for (let x = 0; x < outline.width; x++) {
      const o = (y * outline.width + x) * 4;
      let r = BG[0];
      let g = BG[1];
      let b = BG[2];
      const ringA = outline.rgba[o + 3] / 255;
      r = blend(r, TINT[0], ringA);
      g = blend(g, TINT[1], ringA);
      b = blend(b, TINT[2], ringA);
      const sx = x - pad;
      const sy = y - pad;
      if (sx >= 0 && sy >= 0 && sx < img.width && sy < img.height) {
        const s = (sy * img.width + sx) * 4;
        const a = img.rgba[s + 3] / 255;
        r = blend(r, img.rgba[s], a);
        g = blend(g, img.rgba[s + 1], a);
        b = blend(b, img.rgba[s + 2], a);
      }
      rgba[o] = Math.round(r);
      rgba[o + 1] = Math.round(g);
      rgba[o + 2] = Math.round(b);
      rgba[o + 3] = 255;
    }
  }
  return { width: outline.width, height: outline.height, rgba };
}

// ---- Stats ---------------------------------------------------------------------------------

function stats(name, img) {
  const bins = new Array(8).fill(0);
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const a = img.rgba[(y * img.width + x) * 4 + 3];
      bins[a >> 5]++;
      if (a >= options.threshold) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  console.log(`${name} ${img.width}x${img.height}`);
  console.log(`  alpha histogram (32-wide bins): ${bins.join(' ')}`);
  console.log(`  body (alpha>=${options.threshold}) margins: left ${minX} top ${minY} right ${img.width - 1 - maxX} bottom ${img.height - 1 - maxY}`);
}

// ---- Main ----------------------------------------------------------------------------------

if (options.pad < options.out) {
  throw new Error(`--pad (${options.pad}) must be >= --out (${options.out}) or the ring is clipped`);
}
SOURCES.forEach(([src, dst]) => {
  const img = decodePng(path.join(TEXTURES, src));
  if (options.stats) {
    stats(src, img);
    return;
  }
  const outline = buildOutline(img);
  const file = path.join(TEXTURES, dst);
  fs.writeFileSync(file, encodePng(outline.width, outline.height, outline.rgba));
  console.log(`wrote ${dst} (${outline.width}x${outline.height} from ${img.width}x${img.height}, ring ${options.out}+${options.in}px, pad ${options.pad})`);
  if (options.preview) {
    const preview = composite(img, outline);
    const previewFile = path.join(options.preview, path.basename(dst, '.png') + '_preview.png');
    fs.writeFileSync(previewFile, encodePng(preview.width, preview.height, preview.rgba));
  }
});
