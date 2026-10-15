/**
 * Ajustes y estado persistidos.
 *
 * El token vive en `local:` y nunca en `sync:` para que no se replique
 * a otras máquinas a través de la cuenta del navegador.
 */
import { storage } from '#imports';
import { ROOT_KEYS, type RootKey } from './types';

export type LogLevel = 'info' | 'warn' | 'error';

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

export const syncLog = storage.defineItem<LogEntry[]>('local:syncLog', {
  fallback: [],
});

export const lastSync = storage.defineItem<LastSync | null>('local:lastSync', {
  fallback: null,
});

export const syncOptions = storage.defineItem<SyncOptions>('local:syncOptions', {
  fallback: { roots: ['bar', 'other', 'mobile'], dryRun: false },
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
    lastSync.setValue(null),
  ]);
}

export function defaultRootsFor(available: RootKey[]): RootKey[] {
  const availableSet = new Set(available);
  return ROOT_KEYS.filter((key) => availableSet.has(key));
}
