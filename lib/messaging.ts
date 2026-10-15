/** Mensajería entre las páginas de la UI y el background. */
import { browser } from '#imports';
import type { LastSync, LogEntry } from './settings';
import type { SyncMode, SyncReport } from './sync';

export interface TestConnectionResult {
  ok: boolean;
  login?: string;
  name?: string | null;
  scopes?: string | null;
  hasGistScope?: boolean;
  message: string;
}

export interface AppState {
  hasToken: boolean;
  gistId: string;
  revision: string;
  client: string;
  browser: string;
  supportedRoots: string[];
  lastSync: LastSync | null;
  log: LogEntry[];
}

export type Request =
  | { kind: 'sync'; mode: SyncMode }
  | { kind: 'test-connection' }
  | { kind: 'get-state' }
  | { kind: 'open-options' };

export type Response =
  | { kind: 'sync'; report: SyncReport }
  | { kind: 'test'; result: TestConnectionResult }
  | { kind: 'state'; state: AppState }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

/** Envía un mensaje al background y devuelve la respuesta tipada. */
export async function send(request: Request): Promise<Response> {
  return (await browser.runtime.sendMessage(request)) as Response;
}
