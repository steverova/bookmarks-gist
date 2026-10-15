/** Orquestador de la sincronización completa. */
import { i18n } from './i18n';
import { applyTree, type ApplyStats } from './bookmarks/apply';
import { readNativeTree } from './bookmarks/read';
import * as gist from './gist';
import { randomId } from './ids';
import { mergeThreeWay } from './merge';
import { clientLabel } from './roots';
import * as settings from './settings';
import type { LogLevel, SyncMode } from './settings';
import {
  countBookmarks,
  countFolders,
  filterByRoots,
  FORMAT_VERSION,
  ROOT_IDS,
  type SyncDocument,
  type SyncNode,
} from './types';

export type { SyncMode };

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface SyncReport {
  mode: SyncMode;
  client: string;
  at: number;
  gistId: string;
  gistCreated: boolean;
  revision: string | null;
  dryRun: boolean;
  localBookmarks: number;
  remoteBookmarks: number;
  resultBookmarks: number;
  resultFolders: number;
  applied: ApplyStats;
  log: settings.LogEntry[];
}

const EMPTY_STATS: ApplyStats = {
  created: 0,
  updated: 0,
  removed: 0,
  roots: [],
  skippedRoots: [],
};

/**
 * Sincroniza:
 *  - `full`: lee local + remoto, fusiona, aplica en local y publica.
 *  - `pull`: aplica el remoto en local, sin publicar.
 *  - `push`: publica el estado local, sin tocar el local.
 */
export async function runSync(mode: SyncMode = 'full'): Promise<SyncReport> {
  const token = (await settings.githubToken.getValue()).trim();
  if (!token) throw new SyncError(i18n.t('error.missingToken'));

  const options = await settings.syncOptions.getValue();
  const client = clientLabel();
  const log: settings.LogEntry[] = [];
  const add = (level: LogLevel, message: string) =>
    log.push({ at: Date.now(), level, message });

  add('info', i18n.t('sync.client', [client]));
  add(
    'info',
    i18n.t('sync.mode', [mode]) + (options.dryRun ? i18n.t('sync.dryRunSuffix') : ''),
  );
  add(
    'info',
    i18n.t('sync.roots', [
      options.roots.length > 0
        ? options.roots.join(', ')
        : i18n.t('sync.noRoots'),
    ]),
  );

  const localFull = await readNativeTree();
  const localBookmarks = countBookmarks(localFull);
  add(
    'info',
    i18n.t('sync.local', [String(localBookmarks), String(countFolders(localFull))]),
  );

  let currentGistId = (await settings.gistId.getValue()).trim();
  const storedRevision = await settings.lastRevision.getValue();
  const storedSnapshot = await settings.lastSnapshot.getValue();
  const managedIds = new Set(options.roots.map((root) => ROOT_IDS[root]));

  // --- 1. Leer el gist -----------------------------------------------------
  let remoteDoc: SyncDocument | null = null;
  let revision: string | null = null;

  if (currentGistId && mode !== 'push') {
    try {
      const read = await gist.readGist(token, currentGistId);
      remoteDoc = read.document;
      revision = read.revision;
      add(
        'info',
        i18n.t('sync.remote', [
          String(countBookmarks(remoteDoc?.nodes ?? [])),
          short(revision),
        ]),
      );
      if (storedRevision && revision && storedRevision !== revision) {
        add('warn', i18n.t('sync.gistChanged'));
      }
    } catch (error) {
      if (error instanceof gist.GistError && error.kind === 'not-found') {
        add('warn', i18n.t('sync.gistMissing'));
        currentGistId = '';
      } else {
        throw error;
      }
    }
  }

  // --- 2. Fusionar --------------------------------------------------------
  const localManaged = filterByRoots(localFull, options.roots);
  const remoteManaged = remoteDoc
    ? filterByRoots(remoteDoc.nodes, options.roots)
    : [];
  // Raíces del remoto que este perfil no gestiona: se conservan sin tocar.
  const preserved = remoteDoc
    ? remoteDoc.nodes.filter((node) => !managedIds.has(node.id))
    : [];

  // Base de la fusión: el último estado sincronizado en este navegador. Sólo
  // vale si pertenece al gist actual; tras cambiar de gist se empieza de cero.
  const baseManaged =
    storedSnapshot && storedSnapshot.gistId === currentGistId
      ? filterByRoots(storedSnapshot.nodes, options.roots)
      : [];

  let target: SyncNode[];
  let propagated = 0;
  if (mode === 'pull') {
    target = remoteManaged;
  } else if (mode === 'push' || !remoteDoc) {
    target = localManaged;
  } else {
    const merged = mergeThreeWay(baseManaged, localManaged, remoteManaged);
    target = merged.nodes;
    propagated = merged.deleted;
  }
  add('info', i18n.t('sync.target', [String(countBookmarks(target))]));
  if (propagated > 0) {
    add('info', i18n.t('sync.deleted', [String(propagated)]));
  }

  // --- 3. Aplicar en local ------------------------------------------------
  let applied: ApplyStats = EMPTY_STATS;
  if (mode !== 'push') {
    applied = await applyTree(target, {
      dryRun: options.dryRun,
      onlyRoots: options.roots,
    });
    add(
      'info',
      i18n.t('sync.applied', [
        String(applied.created),
        String(applied.updated),
        String(applied.removed),
      ]),
    );
    if (applied.skippedRoots.length > 0) {
      add(
        'warn',
        i18n.t('sync.skippedRoots', [applied.skippedRoots.join(', ')]),
      );
    }
  }

  // --- 4. Publicar --------------------------------------------------------
  // `target` ya es el estado acordado (con los borrados propagados). Se publica
  // tal cual para que el gist refleje también las eliminaciones; `preserved`
  // mantiene intactas las raíces que este perfil no gestiona.
  const uploadNodes = [...target, ...preserved];

  const document: SyncDocument = {
    uniqueId: remoteDoc?.uniqueId ?? randomId(),
    version: FORMAT_VERSION,
    clientInfo: { lastSyncedBy: client, syncedAt: Date.now() },
    sha: revision ?? storedRevision ?? '',
    nodes: uploadNodes,
  };

  let newRevision: string | null = revision;
  let finalGistId = currentGistId;
  let gistCreated = false;
  const shouldUpload = mode !== 'pull' && !options.dryRun;

  if (shouldUpload) {
    if (!finalGistId) {
      const created = await gist.createGist(token, document);
      finalGistId = created.id;
      newRevision = created.revision;
      gistCreated = true;
      await settings.gistId.setValue(finalGistId);
      add('info', i18n.t('sync.gistCreated', [finalGistId]));
    } else {
      const updated = await gist.updateGist(token, finalGistId, document);
      newRevision = updated.revision;
      add('info', i18n.t('sync.gistUpdated', [short(newRevision)]));
    }
    await settings.lastRevision.setValue(newRevision ?? '');
  } else if (options.dryRun) {
    add('info', i18n.t('sync.dryRun'));
  } else {
    add('info', i18n.t('sync.pullOnly'));
  }

  // Guardar la base de la próxima fusión. Sólo se incluyen las raíces
  // disponibles en este navegador: así una raíz que aquí no se puede aplicar
  // (p. ej. `menu` en Chromium) no parece «borrada» en la siguiente sync.
  if (!options.dryRun) {
    const availableRootIds = new Set(localFull.map((node) => node.id));
    await settings.lastSnapshot.setValue({
      gistId: finalGistId,
      nodes: target.filter((node) => availableRootIds.has(node.id)),
    });
  }

  // --- 5. Reportar --------------------------------------------------------
  const report: SyncReport = {
    mode,
    client,
    at: Date.now(),
    gistId: finalGistId,
    gistCreated,
    revision: newRevision,
    dryRun: options.dryRun,
    localBookmarks,
    remoteBookmarks: countBookmarks(remoteDoc?.nodes ?? []),
    resultBookmarks: countBookmarks(uploadNodes),
    resultFolders: countFolders(uploadNodes),
    applied,
    log,
  };

  if (!options.dryRun) {
    await settings.appendLog(log);
    await settings.lastSync.setValue({
      at: report.at,
      mode,
      client,
      gistId: finalGistId,
      created: applied.created,
      updated: applied.updated,
      removed: applied.removed,
      bookmarks: report.resultBookmarks,
      folders: report.resultFolders,
    });
  }

  return report;
}

function short(revision: string | null): string {
  return revision ? revision.slice(0, 7) : i18n.t('common.na');
}
