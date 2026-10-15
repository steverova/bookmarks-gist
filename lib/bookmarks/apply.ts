/** Reconciliación del documento con el árbol nativo (crear/renombrar/borrar). */
import { browser } from '#imports';
import { normalizeTitle, normalizeUrl } from '../ids';
import { nativeRootId } from '../roots';
import { isFolder, rootIdToKey, type RootKey, type SyncNode } from '../types';
import type { NativeNode } from './read';

export interface ApplyStats {
  created: number;
  updated: number;
  removed: number;
  /** Raíces efectivamente reconciliadas. */
  roots: RootKey[];
  /** Raíces presentes en el documento pero inexistentes en este navegador. */
  skippedRoots: RootKey[];
}

export interface ApplyOptions {
  dryRun?: boolean;
  /** Si se indica, sólo se tocan estas raíces. */
  onlyRoots?: RootKey[];
}

/**
 * Hace que el árbol nativo (dentro de las raíces gestionadas) coincida con
 * `nodes`. Las coincidencias se calculan por título de carpeta y por URL
 * normalizada; lo que sobra se elimina y lo que falta se crea.
 */
export async function applyTree(
  nodes: SyncNode[],
  options: ApplyOptions = {},
): Promise<ApplyStats> {
  const { dryRun = false, onlyRoots } = options;
  const allowed = onlyRoots ? new Set<RootKey>(onlyRoots) : null;

  const stats: ApplyStats = {
    created: 0,
    updated: 0,
    removed: 0,
    roots: [],
    skippedRoots: [],
  };

  for (const rootNode of nodes) {
    if (!isFolder(rootNode)) continue;
    const key = rootIdToKey(rootNode.id);
    if (!key) continue;
    if (allowed && !allowed.has(key)) continue;

    const parentId = nativeRootId(key);
    if (!parentId) {
      stats.skippedRoots.push(key);
      continue;
    }

    stats.roots.push(key);
    await reconcileChildren(parentId, rootNode.children ?? [], stats, dryRun);
  }

  return stats;
}

async function reconcileChildren(
  parentId: string,
  desired: SyncNode[],
  stats: ApplyStats,
  dryRun: boolean,
): Promise<void> {
  const existing = (await browser.bookmarks.getChildren(
    parentId,
  )) as unknown as NativeNode[];

  const foldersByTitle = new Map<string, NativeNode[]>();
  const bookmarksByUrl = new Map<string, NativeNode[]>();
  for (const node of existing) {
    if (node.url == null) {
      push(foldersByTitle, normalizeTitle(node.title ?? ''), node);
    } else {
      push(bookmarksByUrl, normalizeUrl(node.url), node);
    }
  }

  const used = new Set<string>();

  for (const [index, node] of desired.entries()) {
    if (isFolder(node)) {
      const match = take(foldersByTitle, normalizeTitle(node.title));
      let folderId = match?.id;
      if (!folderId) {
        stats.created += 1;
        if (dryRun) continue;
        const created = (await browser.bookmarks.create({
          parentId,
          title: node.title,
          index,
        })) as unknown as NativeNode;
        folderId = created.id;
      } else {
        used.add(folderId);
        if ((match?.title ?? '') !== node.title) {
          stats.updated += 1;
          if (!dryRun) {
            await browser.bookmarks.update(folderId, { title: node.title });
          }
        }
      }
      if (!dryRun) {
        await reconcileChildren(folderId, node.children ?? [], stats, dryRun);
      }
      continue;
    }

    const url = node.url as string;
    const match = take(bookmarksByUrl, normalizeUrl(url));
    if (!match) {
      stats.created += 1;
      if (dryRun) continue;
      await browser.bookmarks.create({ parentId, title: node.title, url, index });
      continue;
    }

    used.add(match.id);
    if (match.title !== node.title || normalizeUrl(match.url ?? '') !== normalizeUrl(url)) {
      stats.updated += 1;
      if (!dryRun) {
        await browser.bookmarks.update(match.id, { title: node.title, url });
      }
    }
  }

  // Lo que no se emparejó ya no está en el documento → se elimina.
  for (const node of existing) {
    if (used.has(node.id)) continue;
    stats.removed += 1;
    if (dryRun) continue;
    await browser.bookmarks.removeTree(node.id);
  }
}

function push(map: Map<string, NativeNode[]>, key: string, node: NativeNode): void {
  const list = map.get(key);
  if (list) list.push(node);
  else map.set(key, [node]);
}

function take(map: Map<string, NativeNode[]>, key: string): NativeNode | undefined {
  const list = map.get(key);
  if (!list || list.length === 0) return undefined;
  return list.shift();
}
