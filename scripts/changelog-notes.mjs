#!/usr/bin/env node
/**
 * Imprime la sección de `CHANGELOG.md` correspondiente a una versión, para
 * usarla como cuerpo del GitHub Release (`.github/workflows/release.yml`).
 *
 * Falla si la sección no existe o está vacía, de modo que no se publique una
 * versión sin notas.
 *
 * Uso: node scripts/changelog-notes.mjs 0.1.2
 */
import { readFileSync } from 'node:fs';

const version = process.argv[2]?.replace(/^v/, '');
if (!version) {
  console.error('Uso: node scripts/changelog-notes.mjs <versión>');
  process.exit(1);
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = new RegExp(`^##\\s*\\[?v?${escaped}\\]?`);
const anyHeading = /^##\s/;

let from = -1;
for (let i = 0; i < lines.length; i += 1) {
  if (heading.test(lines[i])) {
    from = i + 1;
    break;
  }
}

if (from === -1) {
  console.error(`✗ No hay sección para la versión ${version} en CHANGELOG.md`);
  process.exit(1);
}

let to = lines.length;
for (let i = from; i < lines.length; i += 1) {
  if (anyHeading.test(lines[i])) {
    to = i;
    break;
  }
}

const body = lines.slice(from, to).join('\n').trim();
if (!body) {
  console.error(`✗ La sección de ${version} en CHANGELOG.md está vacía`);
  process.exit(1);
}

process.stdout.write(`${body}\n`);
