/**
 * Genera los iconos de la extensión sin dependencias externas.
 * Uso: node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 24, 32, 48, 96, 128];
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icon');

function crc32(buffer) {
  let c = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    c ^= buffer[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filtro none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, w, h, r) {
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inBookmark(x, y, size) {
  const center = size / 2;
  const half = size * 0.21;
  const top = size * 0.24;
  const bottom = size * 0.78;
  const notchTop = size * 0.56;
  if (y < top || y > bottom) return false;
  if (Math.abs(x - center) > half) return false;
  const notchHalf = half * ((y - notchTop) / (bottom - notchTop));
  if (y > notchTop && Math.abs(x - center) < notchHalf) return false;
  return true;
}

function render(size) {
  const samples = 3;
  const buffer = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgCoverage = 0;
      let bookmarkCoverage = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (inRoundedRect(px, py, size, size, radius)) bgCoverage += 1;
          if (inBookmark(px, py, size)) bookmarkCoverage += 1;
        }
      }

      const total = samples * samples;
      const bgAlpha = bgCoverage / total;
      const markAlpha = Math.min(bookmarkCoverage / total, bgAlpha);

      const t = (x + y) / (2 * size);
      const base = [
        37 + (29 - 37) * t,
        99 + (78 - 99) * t,
        235 + (216 - 235) * t,
      ];

      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        buffer[offset + channel] = Math.round(
          255 * markAlpha + base[channel] * (1 - markAlpha),
        );
      }
      buffer[offset + 3] = Math.round(bgAlpha * 255);
    }
  }

  return encodePng(size, size, buffer);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = resolve(OUT_DIR, `${size}.png`);
  writeFileSync(file, render(size));
  console.log(`icon/${size}.png`);
}
