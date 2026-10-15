/** Merge de dos árboles: unión por URL y carpetas por ruta. */
import { normalizeTitle, normalizeUrl } from './ids';
import { isFolder, type SyncNode } from './types';

/** Clave de identidad de un nodo dentro de su carpeta padre. */
function keyOf(node: SyncNode): string {
  return isFolder(node)
    ? `d:${normalizeTitle(node.title)}`
    : `u:${normalizeUrl(node.url as string)}`;
}

/**
 * Fusiona dos listas de raíces (emparejadas por id de raíz).
 * `a` conserva el orden; los nodos nuevos de `b` se añaden al final.
 */
export function mergeTrees(a: SyncNode[], b: SyncNode[]): SyncNode[] {
  const map = new Map<string, SyncNode>();
  const order: string[] = [];

  for (const node of a) {
    map.set(node.id, node);
    order.push(node.id);
  }
  for (const node of b) {
    const existing = map.get(node.id);
    if (existing) map.set(node.id, mergeNode(existing, node));
    else {
      map.set(node.id, node);
      order.push(node.id);
    }
  }

  return order.map((id) => map.get(id) as SyncNode);
}

/** Fusiona dos nodos equivalentes. Gana el título del más reciente. */
export function mergeNode(a: SyncNode, b: SyncNode): SyncNode {
  const newer = b.dateModified > a.dateModified ? b : a;
  const merged: SyncNode = {
    id: newer.id,
    title: newer.title,
    dateModified: Math.max(a.dateModified, b.dateModified),
  };

  if (isFolder(a) && isFolder(b)) {
    merged.children = mergeChildren(a.children ?? [], b.children ?? []);
  } else {
    merged.url = a.url ?? b.url;
  }

  return merged;
}

function mergeChildren(a: SyncNode[], b: SyncNode[]): SyncNode[] {
  const map = new Map<string, SyncNode>();
  const order: string[] = [];

  for (const node of a) {
    const key = keyOf(node);
    map.set(key, node);
    order.push(key);
  }
  for (const node of b) {
    const key = keyOf(node);
    const existing = map.get(key);
    if (existing) {
      map.set(key, mergeNode(existing, node));
    } else {
      map.set(key, node);
      order.push(key);
    }
  }

  return order.map((key) => map.get(key) as SyncNode);
}
