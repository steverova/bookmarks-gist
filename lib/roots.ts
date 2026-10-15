/** Detección de navegador y mapeo de raíces nativas. */
import { ROOT_IDS, type RootKey } from './types';

/** Ids nativos de Chromium (Chrome/Edge/Brave/Opera). */
const CHROMIUM_ROOT_IDS: Partial<Record<RootKey, string>> = {
  bar: '1',
  other: '2',
  mobile: '3',
};

/** Ids nativos de Firefox. */
const FIREFOX_ROOT_IDS: Partial<Record<RootKey, string>> = {
  bar: 'toolbar_____',
  other: 'unfiled_____',
  mobile: 'mobile______',
  menu: 'menu________',
};

const NATIVE_ID_TO_KEY: Record<string, RootKey> = {};
for (const [key, id] of Object.entries(CHROMIUM_ROOT_IDS)) {
  NATIVE_ID_TO_KEY[id] = key as RootKey;
}
for (const [key, id] of Object.entries(FIREFOX_ROOT_IDS)) {
  NATIVE_ID_TO_KEY[id] = key as RootKey;
}

export function detectBrowserName():
  | 'Firefox'
  | 'Edge'
  | 'Opera'
  | 'Brave'
  | 'Chrome' {
  const ua = globalThis.navigator?.userAgent ?? '';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Brave/.test(ua)) return 'Brave';
  return 'Chrome';
}

export function isFirefox(): boolean {
  return detectBrowserName() === 'Firefox';
}

export function detectPlatform(): string {
  const ua = globalThis.navigator?.userAgent ?? '';
  if (/Windows/.test(ua)) return 'win';
  if (/Mac OS X|Macintosh/.test(ua)) return 'mac';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Linux/.test(ua)) return 'linux';
  return 'unknown';
}

/** Etiqueta tipo `Chrome@win` que se guarda en `clientInfo.lastSyncedBy`. */
export function clientLabel(): string {
  return `${detectBrowserName()}@${detectPlatform()}`;
}

export function rootKeyFromNativeId(id: string): RootKey | null {
  return NATIVE_ID_TO_KEY[id] ?? null;
}

/** Id nativo de una raíz en este navegador (null si no existe aquí). */
export function nativeRootId(key: RootKey): string | null {
  const table = isFirefox() ? FIREFOX_ROOT_IDS : CHROMIUM_ROOT_IDS;
  return table[key] ?? null;
}

/** Raíces que este navegador puede escribir. */
export function supportedRoots(): RootKey[] {
  return Object.keys(isFirefox() ? FIREFOX_ROOT_IDS : CHROMIUM_ROOT_IDS) as RootKey[];
}

/** Id de raíz en el documento (por si hiciera falta desde fuera). */
export function rootDocumentId(key: RootKey): string {
  return ROOT_IDS[key];
}
