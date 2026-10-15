/** Lectura del árbol nativo de marcadores → formato del documento. */
import { browser } from '#imports';
import { normalizeTitle, stableId } from '../ids';
import { rootKeyFromNativeId } from '../roots';
import {
  ROOT_FALLBACK_TITLES,
  ROOT_IDS,
  type RootKey,
  type SyncNode,
} from '../types';

/** Subconjunto de `browser.bookmarks.BookmarkTreeNode` que usamos. */
export interface NativeNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: NativeNode[];
}

export async function readNativeTree(): Promise<SyncNode[]> {
  const tree = (await browser.bookmarks.getTree()) as unknown as NativeNode[];
  const root = tree[0];
  if (!root?.children) return [];

  const result: SyncNode[] = [];
  for (const child of root.children) {
    const key = rootKeyFromNativeId(child.id);
    if (!key) continue;
    result.push({
      id: ROOT_IDS[key],
      title: child.title || ROOT_FALLBACK_TITLES[key],
      dateModified: child.dateGroupModified ?? Date.now(),
      children: (child.children ?? []).map((node) =>
        convert(node, key, []),
      ),
    });
  }
  return result;
}

function convert(node: NativeNode, key: RootKey, path: string[]): SyncNode {
  const folder = node.url == null;
  const seed = [key, ...path, folder ? node.title : node.url].join('\u0000');

  const out: SyncNode = {
    id: stableId(seed),
    title: node.title ?? '',
    dateModified: node.dateGroupModified ?? node.dateAdded ?? Date.now(),
  };

  if (folder) {
    const nextPath = [...path, normalizeTitle(node.title ?? '')];
    out.children = (node.children ?? []).map((child) =>
      convert(child, key, nextPath),
    );
  } else {
    out.url = node.url;
  }

  return out;
}
