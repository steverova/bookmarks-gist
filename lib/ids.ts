/** Utilidades de ids y normalización de texto/URLs. */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/** Id aleatorio de 21 caracteres (mismo aspecto que los ids del formato). */
export function randomId(size = 21): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length] ?? '';
  return out;
}

/**
 * Id determinista a partir de una semilla (raíz + ruta de carpetas + url/título).
 * Que sea determinista evita que un mismo marcador cambie de id en cada sync.
 */
export function stableId(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code + i, 0x85ebca6b) >>> 0;
  }
  let state = (h1 ^ h2) >>> 0;
  let out = '';
  for (let i = 0; i < 21; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out += ALPHABET[state % ALPHABET.length] ?? '';
  }
  return out;
}

/**
 * Normaliza una URL para comparar entre navegadores.
 * No elimina query ni hash (hay sitios que dependen de ellos).
 */
export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    let out = url.toString();
    if (url.pathname === '/' && url.search === '' && out.endsWith('/')) {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return value;
  }
}

/** Clave para comparar títulos de carpeta (sin distinguir mayúsculas). */
export function normalizeTitle(raw: string): string {
  return raw.trim().toLowerCase();
}
