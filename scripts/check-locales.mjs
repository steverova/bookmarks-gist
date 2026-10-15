/**
 * Comprueba que todos los catálogos de `locales/` tienen exactamente las mismas
 * claves que el idioma por defecto. Falla (exit 1) si hay claves que faltan o
 * que sobran, para que las traducciones no se desincronicen.
 *
 * Uso: node scripts/check-locales.mjs
 */
import { readdir, readFile } from 'node:fs/promises';

const DEFAULT_LOCALE = 'en';

function flatten(tree, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.add(path);
    else flatten(value, path, out);
  }
  return out;
}

const files = (await readdir('locales')).filter((file) => file.endsWith('.json'));
const catalogs = new Map();

for (const file of files) {
  const code = file.replace(/\.json$/, '');
  catalogs.set(code, flatten(JSON.parse(await readFile(`locales/${file}`, 'utf8'))));
}

const reference = catalogs.get(DEFAULT_LOCALE);
if (!reference) {
  console.error(`Falta el catálogo por defecto: locales/${DEFAULT_LOCALE}.json`);
  process.exit(1);
}

let failed = false;

for (const [code, keys] of catalogs) {
  if (code === DEFAULT_LOCALE) continue;

  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${code} (${keys.size} claves)`);
    continue;
  }

  failed = true;
  console.error(`✗ ${code}`);
  if (missing.length > 0) console.error(`  faltan: ${missing.join(', ')}`);
  if (extra.length > 0) console.error(`  sobran: ${extra.join(', ')}`);
}

console.log(`\n${catalogs.size} catálogos, ${reference.size} claves en ${DEFAULT_LOCALE}`);
process.exit(failed ? 1 : 0);
