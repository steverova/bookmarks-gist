/** Cliente mínimo de la API de GitHub Gists. */
import { i18n } from './i18n';
import type { SyncDocument } from './types';

const API = 'https://api.github.com';
const API_VERSION = '2022-11-28';

/** Nombre del fichero dentro del gist. */
export const GIST_FILENAME = 'bookmarks-sync.json';

export type GistErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'network'
  | 'invalid'
  | 'unknown';

export class GistError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: GistErrorKind,
  ) {
    super(message);
    this.name = 'GistError';
  }
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': API_VERSION,
  };
}

async function call(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...headers(token), ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw new GistError(
      i18n.t('gist.network', [(error as Error).message]),
      statusOf(error),
      'network',
    );
  }

  if (!response.ok) throw await toError(response);
  return response;
}

function statusOf(error: unknown): number {
  return typeof error === 'object' && error && 'status' in error
    ? Number((error as { status: unknown }).status) || 0
    : 0;
}

async function toError(response: Response): Promise<GistError> {
  let detail = response.statusText;
  try {
    const body = await response.json();
    if (body?.message) detail = body.message;
  } catch {
    // sin cuerpo JSON
  }

  const kind: GistErrorKind =
    response.status === 401
      ? 'auth'
      : response.status === 403
        ? 'forbidden'
        : response.status === 404
          ? 'not-found'
          : response.status === 409 || response.status === 422
            ? 'conflict'
            : 'unknown';

  const prefix =
    kind === 'auth'
      ? i18n.t('gist.auth')
      : kind === 'forbidden'
        ? i18n.t('gist.forbidden')
        : kind === 'not-found'
          ? i18n.t('gist.notFound')
          : kind === 'conflict'
            ? i18n.t('gist.conflict')
            : i18n.t('gist.unknown');

  return new GistError(`${prefix}: ${detail}`, response.status, kind);
}

export interface GistReadResult {
  document: SyncDocument | null;
  revision: string | null;
  description: string;
}

interface GistResponse {
  id: string;
  description: string | null;
  files: Record<
    string,
    { content?: string; truncated?: boolean; raw_url?: string } | undefined
  >;
  history?: { version: string }[];
}

async function parseGistResponse(response: Response): Promise<GistResponse> {
  return (await response.json()) as GistResponse;
}

export async function readGist(
  token: string,
  gistId: string,
): Promise<GistReadResult> {
  const response = await call(token, `/gists/${gistId}`);
  const data = await parseGistResponse(response);
  const revision = data.history?.[0]?.version ?? null;

  const file =
    data.files[GIST_FILENAME] ??
    (Object.values(data.files).find(Boolean) as GistResponse['files'][string]);

  let content = file?.content ?? '';
  if (file?.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url);
    if (raw.ok) content = await raw.text();
  }

  let document: SyncDocument | null = null;
  if (content.trim()) {
    try {
      document = JSON.parse(content) as SyncDocument;
    } catch {
      throw new GistError(
        i18n.t('gist.invalidFile', [GIST_FILENAME]),
        200,
        'invalid',
      );
    }
  }

  return { document, revision, description: data.description ?? '' };
}

export async function createGist(
  token: string,
  document: SyncDocument,
  description = 'Bookmarks Gist Sync',
): Promise<{ id: string; revision: string | null }> {
  const response = await call(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description,
      public: false,
      files: { [GIST_FILENAME]: { content: serialize(document) } },
    }),
  });
  const data = await parseGistResponse(response);
  return { id: data.id, revision: data.history?.[0]?.version ?? null };
}

export async function updateGist(
  token: string,
  gistId: string,
  document: SyncDocument,
): Promise<{ revision: string | null }> {
  const response = await call(token, `/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content: serialize(document) } },
    }),
  });
  const data = await parseGistResponse(response);
  return { revision: data.history?.[0]?.version ?? null };
}

export interface ConnectionInfo {
  login: string;
  name: string | null;
  scopes: string | null;
}

/** Comprueba token + scopes contra `/user`. */
export async function testConnection(token: string): Promise<ConnectionInfo> {
  const response = await call(token, '/user');
  const data = (await response.json()) as { login: string; name: string | null };
  return {
    login: data.login,
    name: data.name,
    scopes: response.headers.get('x-oauth-scopes'),
  };
}

export function serialize(document: SyncDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
