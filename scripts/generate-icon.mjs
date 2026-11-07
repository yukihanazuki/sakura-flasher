// Generates build/icon.ico and build/icon.png (256x256) for the app and installer.
// Pure Node: builds an RGBA raster, encodes a PNG with zlib, and wraps it in an ICO.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const BUILD_DIR = path.join(ROOT, 'build');

const SIZE = 256;
const SS = 4; // supersampling factor
const W = SIZE * SS;

const ACCENT = [232, 50, 30]; // Xiaomi-ish red
const DARK = [18, 18, 20];
const WHITE = [255, 255, 255];

/** Simple RGBA canvas backed by a Float32 buffer for smooth downsampling. */
const canvas = new Float32Array(W * W * 3).fill(0);

function blend(x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 3;
  canvas[i] = canvas[i] * (1 - alpha) + color[0] * alpha;
  canvas[i + 1] = canvas[i + 1] * (1 - alpha) + color[1] * alpha;
  canvas[i + 2] = canvas[i + 2] * (1 - alpha) + color[2] * alpha;
}

function roundedRect(x0, y0, x1, y1, radius, color) {
  const r = radius;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const cx = Math.min(Math.max(x, x0 + r), x1 - r);
      const cy = Math.min(Math.max(y, y0 + r), y1 - r);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) blend(x, y, color, 1);
    }
  }
}

function polygon(points, color) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        intersections.push(x1 + t * (x2 - x1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      for (let x = Math.floor(intersections[i]); x <= Math.ceil(intersections[i + 1]); x++) {
        blend(x, y, color, 1);
      }
    }
  }
}

// Background: dark rounded tile with a red inset tile
roundedRect(0, 0, W, W, 56 * SS, DARK);
roundedRect(18 * SS, 18 * SS, (SIZE - 18) * SS, (SIZE - 18) * SS, 44 * SS, ACCENT);

// Lightning bolt in white, centered.
const bolt = [
  [156, 34],
  [88, 140],
  [126, 140],
  [98, 222],
  [172, 108],
  [132, 108],
].map(([x, y]) => [x * SS, y * SS]);
polygon(bolt, WHITE);

// Downsample 4x4 -> 256x256 RGBA
const rgba = Buffer.alloc(SIZE * SIZE * 4);
const inv = 1 / (SS * SS);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 3;
        r += canvas[i];
        g += canvas[i + 1];
        b += canvas[i + 2];
      }
    }
    const o = (y * SIZE + x) * 4;
    rgba[o] = Math.round(r * inv);
    rgba[o + 1] = Math.round(g * inv);
    rgba[o + 2] = Math.round(b * inv);
    rgba[o + 3] = 255;
  }
}

// ── PNG encoder ─────────────────────────────────────────────────────────────

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgbaBuf, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgbaBuf.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = encodePng(rgba, SIZE, SIZE);

// ── ICO wrapper (PNG-embedded single 256x256 entry) ─────────────────────────

function encodeIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256
  entry[1] = 0; // height 256
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // offset after header+entry
  return Buffer.concat([header, entry, pngBuf]);
}

fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), png);
fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), encodeIco(png));
console.log(`[icon] wrote ${path.join(BUILD_DIR, 'icon.ico')} and icon.png`);
