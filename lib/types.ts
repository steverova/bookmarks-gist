/**
 * Tipos del formato de sincronización.
 *
 * El documento que se guarda en el gist es compatible con el árbol de
 * marcadores de Chrome/Firefox, pero con ids propios y raíces normalizadas.
 */

/** Raíces portables. `menu` sólo existe en Firefox. */
export type RootKey = 'bar' | 'other' | 'mobile' | 'menu';

/** Id normalizado de cada raíz dentro del documento. */
export const ROOT_IDS: Record<RootKey, string> = {
  bar: 'root_____bar',
  other: 'root_____other',
  mobile: 'root_____mobile',
  menu: 'root_____menu',
};

/**
 * Títulos de reserva para las raíces cuando el navegador no da uno.
 * Son datos que van al gist, así que se mantienen en un idioma neutro
 * (no se traducen) para que no cambien según el idioma del navegador.
 */
export const ROOT_FALLBACK_TITLES: Record<RootKey, string> = {
  bar: 'Bookmarks bar',
  other: 'Other bookmarks',
  mobile: 'Mobile bookmarks',
  menu: 'Bookmarks menu',
};

/** Claves de i18n para las etiquetas de raíz que se muestran en la UI. */
export const ROOT_LABEL_KEYS: Record<
  RootKey,
  'roots.bar' | 'roots.other' | 'roots.mobile' | 'roots.menu'
> = {
  bar: 'roots.bar',
  other: 'roots.other',
  mobile: 'roots.mobile',
  menu: 'roots.menu',
};

export const ROOT_KEYS = Object.keys(ROOT_IDS) as RootKey[];

/** Versión del formato del documento. */
export const FORMAT_VERSION = '1.0.0';

/** Un nodo del árbol: carpeta (sin `url`) o marcador (con `url`). */
export interface SyncNode {
  id: string;
  title: string;
  dateModified: number;
  url?: string;
  children?: SyncNode[];
}

export interface ClientInfo {
  lastSyncedBy: string;
  syncedAt: number;
}

/** El JSON que vive en el gist. */
export interface SyncDocument {
  uniqueId: string;
  version: string;
  clientInfo: ClientInfo;
  /**
   * Revisión del gist sobre la que se construyó este documento.
   * Se rellena al leer/escribir para detectar cambios concurrentes.
   */
  sha: string;
  nodes: SyncNode[];
}

export function isFolder(node: SyncNode): boolean {
  return node.url == null;
}

/** Cuenta marcadores (no carpetas) de forma recursiva. */
export function countBookmarks(nodes: SyncNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (isFolder(node)) total += countBookmarks(node.children ?? []);
    else total += 1;
  }
  return total;
}

/** Cuenta carpetas de forma recursiva. */
export function countFolders(nodes: SyncNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (isFolder(node)) {
      total += 1;
      total += countFolders(node.children ?? []);
    }
  }
  return total;
}

export function rootIdToKey(id: string): RootKey | null {
  const entry = (Object.entries(ROOT_IDS) as [RootKey, string][]).find(
    ([, value]) => value === id,
  );
  return entry ? entry[0] : null;
}

export function filterByRoots(nodes: SyncNode[], roots: RootKey[]): SyncNode[] {
  const allowed = new Set(roots.map((root) => ROOT_IDS[root]));
  return nodes.filter((node) => allowed.has(node.id));
}
