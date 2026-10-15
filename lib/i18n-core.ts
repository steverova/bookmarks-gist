/**
 * Lógica pura de traducción: búsqueda de claves, plurales, sustituciones y
 * emparejado de locales. Sin dependencias del navegador ni del storage, para
 * poder ejercitarla en Node (`scripts/check-i18n.mjs`).
 */

export type MessageTree = { [key: string]: string | MessageTree };
export type LocaleCatalog = Record<string, MessageTree>;

export type Substitutions = string[];

/** Recorre claves con `.` (`settings.languageTitle`) dentro del árbol. */
export function lookup(
  tree: MessageTree | undefined,
  key: string,
): string | MessageTree | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (node == null || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node;
}

/** Elige la forma correcta de un nodo plural (`{"1": …, "n": …}`). */
export function pickPlural(node: MessageTree, count: number | undefined): string {
  if (count !== undefined) {
    const exact = node[String(count)];
    if (typeof exact === 'string') return exact;
    if (count === 1) {
      const one = node['1'];
      if (typeof one === 'string') return one;
    }
  }

  const many = node['n'];
  if (typeof many === 'string') return many;

  for (const value of Object.values(node)) {
    if (typeof value === 'string') return value;
  }
  return '';
}

/** Sustituye `$1`…`$9`. `$$` es un dólar literal, igual que en la API nativa. */
export function applySubstitutions(
  message: string,
  substitutions: Substitutions,
): string {
  let out = message.replaceAll('$$', '\u0000');
  out = out.replace(/\$([1-9])/g, (match: string, digit: string) => {
    return substitutions[Number(digit) - 1] ?? match;
  });
  return out.replaceAll('\u0000', '$');
}

/** Empareja `es-ES`/`pt-BR` con el catálogo más cercano (`es`, `pt_BR`…). */
export function matchLocale(
  catalog: LocaleCatalog,
  raw: string,
): string | null {
  if (!raw) return null;

  const normalized = raw.replaceAll('-', '_');
  if (catalog[normalized]) return normalized;

  const base = normalized.split('_')[0] ?? '';
  if (catalog[base]) return base;

  return (
    Object.keys(catalog)
      .sort()
      .find((code) => code.split('_')[0] === base) ?? null
  );
}

/**
 * Traduce una clave. Acepta un número (plurales) o un array de sustituciones,
 * igual que `@wxt-dev/i18n`. Si la clave no está en el idioma pedido, se usa el
 * valor del idioma por defecto y, si tampoco, la propia clave.
 */
export function translate(
  catalog: LocaleCatalog,
  locale: string,
  defaultLocale: string,
  key: string,
  ...args: (number | Substitutions)[]
): string {
  let count: number | undefined;
  let substitutions: Substitutions | undefined;

  for (const arg of args) {
    if (typeof arg === 'number') count = arg;
    else if (Array.isArray(arg)) substitutions = arg;
  }

  // Un número sin array de sustituciones actúa también como `$1`.
  if (count !== undefined && substitutions === undefined) {
    substitutions = [String(count)];
  }

  const node = lookup(catalog[locale], key) ?? lookup(catalog[defaultLocale], key);

  let message: string;
  if (typeof node === 'string') message = node;
  else if (node) message = pickPlural(node, count);
  else message = key;

  return applySubstitutions(message, substitutions ?? []);
}
