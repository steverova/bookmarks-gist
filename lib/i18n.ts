/**
 * i18n en tiempo de ejecución.
 *
 * `browser.i18n` **no permite cambiar el idioma en runtime** (sólo sigue el del
 * navegador), así que para poder ofrecer un selector empaquetamos los catálogos
 * `locales/*.json` y resolvemos las traducciones aquí.
 *
 * `@wxt-dev/i18n` se sigue usando para dos cosas que sí necesitan la API nativa:
 * generar `_locales/<lang>/messages.json` (nombre y descripción del manifest vía
 * `__MSG__`) y generar los tipos de las claves (`GeneratedI18nStructure`).
 *
 * La lógica pura vive en `./i18n-core.ts`.
 */
import { browser } from '#imports';
import type { GeneratedI18nStructure } from '#i18n';
import {
  matchLocale,
  translate,
  type LocaleCatalog,
  type MessageTree,
} from './i18n-core';
import * as settings from './settings';

export type MessageKey = keyof GeneratedI18nStructure;

/** Idioma al que se cae si no hay coincidencia. */
export const DEFAULT_LOCALE = 'en';

/** Valor del ajuste que significa «usa el idioma del navegador». */
export const AUTO_LOCALE = 'auto';

const modules = import.meta.glob('../locales/*.json', {
  eager: true,
  import: 'default',
}) as LocaleCatalog;

const CATALOG: LocaleCatalog = {};
for (const [path, messages] of Object.entries(modules)) {
  const code = path.split('/').pop()?.replace(/\.json$/, '');
  if (code) CATALOG[code] = messages as MessageTree;
}

/** Códigos de idioma disponibles, derivados de los ficheros de `locales/`. */
export const AVAILABLE_LOCALES = Object.keys(CATALOG).sort();

// --- Estado del idioma -----------------------------------------------------

let current: string | null = null;
const listeners = new Set<() => void>();

/** Idioma activo. Se resuelve en diferido para no tocar APIs en tiempo de build. */
export function getLocale(): string {
  current ??= detectBrowserLocale();
  return current;
}

/** Código BCP-47 (con guion) apto para `Intl` / `toLocaleString`. */
export function intlLocale(): string {
  return getLocale().replaceAll('_', '-');
}

export function setLocale(code: string): void {
  if (code === getLocale()) return;
  current = code;
  for (const listener of listeners) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resuelve una preferencia (`auto` o un código) a un idioma disponible. */
export function resolveLocale(preference: string): string {
  if (preference !== AUTO_LOCALE && CATALOG[preference]) return preference;
  return detectBrowserLocale();
}

/**
 * Lee la preferencia guardada y aplica el idioma. Se llama al arrancar cada
 * página y antes de cada operación en el background, para que el idioma del log
 * siga el ajuste aunque el service worker se recree o el usuario lo cambie.
 */
export async function refreshLocale(): Promise<void> {
  try {
    setLocale(resolveLocale(await settings.locale.getValue()));
  } catch {
    setLocale(detectBrowserLocale());
  }
}

function detectBrowserLocale(): string {
  try {
    const match = matchLocale(CATALOG, browser.i18n.getUILanguage());
    if (match) return match;
  } catch {
    // Sin API de i18n (tests): seguimos con el idioma del documento.
  }
  return matchLocale(CATALOG, globalThis.navigator?.language ?? '') ?? DEFAULT_LOCALE;
}

// --- Traducción ------------------------------------------------------------

export const i18n = {
  t(key: MessageKey, ...args: (number | string[])[]): string {
    return translate(CATALOG, getLocale(), DEFAULT_LOCALE, key, ...args);
  },
};
