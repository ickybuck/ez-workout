#!/usr/bin/env node
/**
 * Generate the app icons.
 *
 * A script rather than committed binaries alone, so the icons are
 * reproducible and adjustable — change a colour here and re-run, rather than
 * hunting for whatever tool made a PNG a year ago.
 *
 * Written against zlib and nothing else. Pulling in sharp or canvas to draw
 * two rectangles and some rounded corners would be a lot of dependency for
 * the job, and the encoder below is short enough to read.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** indigo-600, the colour the app already uses for primary actions. */
const BRAND = [79, 70, 229];
const WHITE = [255, 255, 255];

// ---------------------------------------------------------------------------
// Minimal PNG encoder
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** rgba: Uint8Array of size*size*4 */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12: compression, filter, interlace — all 0

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy
      ? rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(rgba).copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Coverage of a rounded rectangle at a point, with a soft edge for anti-aliasing. */
function roundedRectCoverage(x, y, x0, y0, x1, y1, radius, feather) {
  const cx = Math.max(x0 + radius, Math.min(x, x1 - radius));
  const cy = Math.max(y0 + radius, Math.min(y, y1 - radius));
  const d = Math.hypot(x - cx, y - cy) - radius;
  if (feather <= 0) return d <= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, 0.5 - d / feather));
}

function blend(dst, i, colour, alpha) {
  if (alpha <= 0) return;
  const a = Math.min(1, alpha);
  dst[i] = Math.round(dst[i] * (1 - a) + colour[0] * a);
  dst[i + 1] = Math.round(dst[i + 1] * (1 - a) + colour[1] * a);
  dst[i + 2] = Math.round(dst[i + 2] * (1 - a) + colour[2] * a);
  dst[i + 3] = Math.round(dst[i + 3] * (1 - a) + 255 * a);
}

/**
 * A dumbbell: a bar, two collars, two end plates.
 * `scale` shrinks the artwork about the centre — maskable icons need their
 * content inside the middle 80%, since launchers crop to arbitrary shapes.
 */
function drawIcon(size, { maskable }) {
  const px = new Uint8Array(size * size * 4); // transparent
  const feather = 1.2;
  const S = (v) => v * size;

  // Background. A maskable icon must bleed to the edges; a regular one gets
  // rounded corners so it looks intentional where it is shown unmasked.
  const bgRadius = maskable ? 0 : 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cov = roundedRectCoverage(
        x + 0.5, y + 0.5, 0, 0, size, size, S(bgRadius), feather,
      );
      blend(px, (y * size + x) * 4, BRAND, cov);
    }
  }

  const scale = maskable ? 0.66 : 0.84;
  const at = (v) => S(0.5 + (v - 0.5) * scale);

  // x0, y0, x1, y1, cornerRadius — all in 0..1 before scaling
  const parts = [
    [0.30, 0.455, 0.70, 0.545, 0.02], // bar
    [0.20, 0.36, 0.30, 0.64, 0.035], // left plate
    [0.70, 0.36, 0.80, 0.64, 0.035], // right plate
    [0.13, 0.42, 0.20, 0.58, 0.03], // left outer plate
    [0.80, 0.42, 0.87, 0.58, 0.03], // right outer plate
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (const [x0, y0, x1, y1, r] of parts) {
        cov = Math.max(
          cov,
          roundedRectCoverage(x + 0.5, y + 0.5, at(x0), at(y0), at(x1), at(y1), S(r) * scale, feather),
        );
      }
      blend(px, (y * size + x) * 4, WHITE, cov);
    }
  }

  return Buffer.from(px);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['favicon-64.png', 64, false],
]) {
  const png = encodePng(size, drawIcon(size, { maskable }));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
