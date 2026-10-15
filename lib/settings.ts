/**
 * Ajustes y estado persistidos.
 *
 * El token vive en `local:` y nunca en `sync:` para que no se replique
 * a otras máquinas a través de la cuenta del navegador.
 */
import { storage } from '#imports';
import { ROOT_KEYS, type RootKey, type SyncNode } from './types';

export type LogLevel = 'info' | 'warn' | 'error';

/** Modo de sincronización elegido (se recuerda entre sesiones). */
export type SyncMode = 'full' | 'pull' | 'push';

export interface LogEntry {
  at: number;
  level: LogLevel;
  message: string;
}

export interface SyncOptions {
  /** Raíces que se sincronizan. */
  roots: RootKey[];
  /** Si es true, calcula lo que haría pero no escribe nada. */
  dryRun: boolean;
  /** Modo por defecto del botón de sync (popup y panel). */
  mode: SyncMode;
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  roots: ['bar', 'other', 'mobile'],
  dryRun: false,
  mode: 'full',
};

/** Rellena huecos de valores guardados por versiones anteriores. */
export function withDefaultSyncOptions(options: SyncOptions): SyncOptions {
  return {
    roots: options.roots ?? DEFAULT_SYNC_OPTIONS.roots,
    dryRun: options.dryRun ?? DEFAULT_SYNC_OPTIONS.dryRun,
    mode: options.mode ?? DEFAULT_SYNC_OPTIONS.mode,
  };
}

export interface LastSync {
  at: number;
  mode: string;
  client: string;
  gistId: string;
  created: number;
  updated: number;
  removed: number;
  bookmarks: number;
  folders: number;
}

/**
 * Último estado sincronizado que conoce este navegador (la «base» de la fusión
 * de tres vías). Se guarda junto al id del gist al que pertenece: si el usuario
 * cambia de gist, la base anterior se descarta para no propagar borrados falsos.
 */
export interface SyncSnapshot {
  gistId: string;
  nodes: SyncNode[];
}

export const MAX_LOG_ENTRIES = 200;

export const githubToken = storage.defineItem<string>('local:githubToken', {
  fallback: '',
});

export const gistId = storage.defineItem<string>('local:gistId', {
  fallback: '',
});

/** Última revisión del gist que hemos escrito (para avisar de cambios ajenos). */
export const lastRevision = storage.defineItem<string>('local:lastRevision', {
  fallback: '',
});

/** Base de la fusión de tres vías (estado común tras la última sincronización). */
export const lastSnapshot = storage.defineItem<SyncSnapshot | null>(
  'local:lastSnapshot',
  { fallback: null },
);

export const syncLog = storage.defineItem<LogEntry[]>('local:syncLog', {
  fallback: [],
});

export const lastSync = storage.defineItem<LastSync | null>('local:lastSync', {
  fallback: null,
});

export const syncOptions = storage.defineItem<SyncOptions>('local:syncOptions', {
  fallback: DEFAULT_SYNC_OPTIONS,
});

/** Idioma de la UI: `auto` (sigue al navegador) o un código de `locales/`. */
export const locale = storage.defineItem<string>('local:locale', {
  fallback: 'auto',
});

export async function appendLog(entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const current = await syncLog.getValue();
  const next = [...current, ...entries].slice(-MAX_LOG_ENTRIES);
  await syncLog.setValue(next);
}

export async function clearLog(): Promise<void> {
  await syncLog.setValue([]);
}

export async function clearCredentials(): Promise<void> {
  await Promise.all([
    githubToken.setValue(''),
    gistId.setValue(''),
    lastRevision.setValue(''),
    lastSnapshot.setValue(null),
    lastSync.setValue(null),
  ]);
}

export function defaultRootsFor(available: RootKey[]): RootKey[] {
  const availableSet = new Set(available);
  return ROOT_KEYS.filter((key) => availableSet.has(key));
}
