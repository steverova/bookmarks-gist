/**
 * Fusión de tres vías (base / local / remoto).
 *
 * `base` es el último estado sincronizado que conoce este navegador. Es lo que
 * permite distinguir un **borrado** de un nodo que «nunca existió»: si estaba en
 * la base y ya no está en un lado, se propaga como borrado al otro lado, siempre
 * que allí no se haya modificado. Si el otro lado sí lo tocó, gana la
 * modificación (nunca se pierde trabajo por un borrado en paralelo).
 */
import { normalizeTitle, normalizeUrl } from './ids';
import { isFolder, type SyncNode } from './types';

export interface MergeResult {
  nodes: SyncNode[];
  /** Nodos que desaparecen porque un lado los borró y el otro no los cambió. */
  deleted: number;
}

/** Función que da la identidad de un nodo dentro de su lista. */
type KeyFn = (node: SyncNode) => string;

/** Identidad de un nodo dentro de su carpeta: URL o título de carpeta. */
function childKey(node: SyncNode): string {
  return isFolder(node)
    ? `d:${normalizeTitle(node.title)}`
    : `u:${normalizeUrl(node.url as string)}`;
}

/** Las raíces se emparejan por su id normalizado. */
function rootKey(node: SyncNode): string {
  return node.id;
}

/**
 * Fusiona tres árboles. Devuelve el árbol resultante y cuántos nodos se
 * eliminaron como consecuencia de un borrado propagado.
 */
export function mergeThreeWay(
  base: SyncNode[],
  local: SyncNode[],
  remote: SyncNode[],
): MergeResult {
  const counter = { deleted: 0 };
  const nodes = mergeLists(base, local, remote, rootKey, counter);
  return { nodes, deleted: counter.deleted };
}

function mergeLists(
  base: SyncNode[],
  local: SyncNode[],
  remote: SyncNode[],
  keyOf: KeyFn,
  counter: { deleted: number },
): SyncNode[] {
  const baseMap = indexBy(base, keyOf);
  const localMap = indexBy(local, keyOf);
  const remoteMap = indexBy(remote, keyOf);

  // Orden: primero lo que ya está en local, después lo nuevo del remoto.
  const order: string[] = [];
  const seen = new Set<string>();
  const remember = (key: string) => {
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  };
  for (const node of local) remember(keyOf(node));
  for (const node of remote) remember(keyOf(node));

  const result: SyncNode[] = [];
  for (const key of order) {
    const before = baseMap.get(key);
    const here = localMap.get(key);
    const there = remoteMap.get(key);

    if (here && there) {
      result.push(mergeNode(before, here, there, counter));
      continue;
    }

    if (here) {
      // Sólo en local: es nuevo, o el remoto lo borró.
      if (before && contentEquals(here, before)) {
        counter.deleted += countNodes(here);
        continue;
      }
      result.push(here);
      continue;
    }

    if (there) {
      // Sólo en remoto: es nuevo, o el local lo borró.
      if (before && contentEquals(there, before)) {
        counter.deleted += countNodes(there);
        continue;
      }
      result.push(there);
    }
    // Ni local ni remoto: ya no existe en ningún lado.
  }

  return result;
}

/** Fusiona un nodo presente en los dos lados. */
function mergeNode(
  before: SyncNode | undefined,
  here: SyncNode,
  there: SyncNode,
  counter: { deleted: number },
): SyncNode {
  const node: SyncNode = {
    id: here.id,
    title: pickTitle(before, here, there),
    dateModified: Math.max(here.dateModified, there.dateModified),
  };

  if (isFolder(here)) {
    node.children = mergeLists(
      before && isFolder(before) ? (before.children ?? []) : [],
      here.children ?? [],
      there.children ?? [],
      childKey,
      counter,
    );
  } else {
    node.url = here.url ?? there.url;
  }

  return node;
}

/** Gana el título del lado que cambió respecto a la base; si los dos, el más reciente. */
function pickTitle(
  before: SyncNode | undefined,
  here: SyncNode,
  there: SyncNode,
): string {
  const hereChanged = before ? here.title !== before.title : true;
  const thereChanged = before ? there.title !== before.title : true;

  if (hereChanged && !thereChanged) return here.title;
  if (thereChanged && !hereChanged) return there.title;
  if (!hereChanged && !thereChanged) return here.title;
  return here.dateModified >= there.dateModified ? here.title : there.title;
}

/**
 * Compara dos nodos por contenido, ignorando id y fechas. Lo usan las ramas de
 * borrado: un nodo «sin cambios» puede desaparecer sin perder información.
 */
function contentEquals(a: SyncNode, b: SyncNode): boolean {
  if (isFolder(a) !== isFolder(b)) return false;
  if (a.title !== b.title) return false;

  if (!isFolder(a)) {
    return normalizeUrl(a.url ?? '') === normalizeUrl(b.url ?? '');
  }

  const aChildren = a.children ?? [];
  const bChildren = b.children ?? [];
  if (aChildren.length !== bChildren.length) return false;

  const bMap = indexBy(bChildren, childKey);
  return aChildren.every((child) => {
    const match = bMap.get(childKey(child));
    return match != null && contentEquals(child, match);
  });
}

/** Cuenta un nodo y todos sus descendientes. */
function countNodes(node: SyncNode): number {
  if (!isFolder(node)) return 1;
  return (
    1 +
    (node.children ?? []).reduce((total, child) => total + countNodes(child), 0)
  );
}

function indexBy(list: SyncNode[], keyOf: KeyFn): Map<string, SyncNode> {
  const map = new Map<string, SyncNode>();
  for (const node of list) {
    const key = keyOf(node);
    // Ante claves duplicadas (p. ej. dos carpetas con el mismo nombre), la primera gana.
    if (!map.has(key)) map.set(key, node);
  }
  return map;
}
