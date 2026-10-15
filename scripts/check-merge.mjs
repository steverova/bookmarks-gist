/**
 * Prueba la fusión de tres vías (`lib/merge.ts`): altas, borrados propagados y
 * resolución de conflictos.
 *
 * `lib/merge.ts` importa otros módulos `.ts` sin extensión (estilo de WXT), así
 * que se registra un pequeño *loader* que las resuelve para poder importarlo
 * desde Node sin empaquetar.
 *
 * Uso: node scripts/check-merge.mjs
 */
import { register } from 'node:module';

const LOADER = `
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const candidate = pathResolve(dirname(parent), specifier + '.ts');
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(LOADER)}`);

const { mergeThreeWay } = await import(new URL('../lib/merge.ts', import.meta.url));

let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  const detail = ok
    ? ''
    : ` → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail}`);
}

const root = (children) => [
  { id: 'root_____bar', title: 'Bar', dateModified: 1, children },
];
const bm = (id, url, title = id, dateModified = 10) => ({
  id,
  title,
  dateModified,
  url,
});
const folder = (id, title, children, dateModified = 10) => ({
  id,
  title,
  dateModified,
  children,
});

const A = bm('idA', 'https://a.example/');
const B = bm('idB', 'https://b.example/');
const C = bm('idC', 'https://c.example/');

console.log('Borrados');
{
  // Un borrado local se propaga: desaparece del resultado.
  const local = mergeThreeWay(root([A, B]), root([A]), root([A, B]));
  check('local borra B → queda [A]', local.nodes[0].children.map((n) => n.id), [
    'idA',
  ]);
  check('local borra B → deleted 1', local.deleted, 1);

  // Un borrado remoto se propaga igual.
  const remote = mergeThreeWay(root([A, B]), root([A, B]), root([A]));
  check('remoto borra B → queda [A]', remote.nodes[0].children.map((n) => n.id), [
    'idA',
  ]);
  check('remoto borra B → deleted 1', remote.deleted, 1);

  // Borrar una carpeta arrastra a sus hijos.
  const tree = mergeThreeWay(
    root([folder('idF', 'F', [A, B])]),
    root([]),
    root([folder('idF', 'F', [A, B])]),
  );
  check('borrar carpeta → sin hijos', tree.nodes[0].children, []);
  check('borrar carpeta → deleted 3', tree.deleted, 3);
}

console.log('\nAltas y unión');
{
  const merged = mergeThreeWay(root([A]), root([A, C]), root([A, B]));
  check('altas de los dos lados', merged.nodes[0].children.map((n) => n.id), [
    'idA',
    'idC',
    'idB',
  ]);
  check('sin base = unión', mergeThreeWay(root([]), root([A]), root([B])).deleted, 0);
}

console.log('\nConflictos');
{
  // Modificar en un lado gana a borrar en el otro.
  const renamed = bm('idA', 'https://a.example/', 'A2', 20);
  const modified = mergeThreeWay(root([A]), root([renamed]), root([]));
  check('modificar gana a borrar', modified.nodes[0].children[0].title, 'A2');
  check('no se cuenta como borrado', modified.deleted, 0);

  // Renombrar una carpeta conserva sus hijos.
  const folderRename = mergeThreeWay(
    root([folder('idF', 'Old', [A])]),
    root([folder('idF', 'New', [A])]),
    root([folder('idF', 'Old', [A])]),
  );
  const kids = folderRename.nodes[0].children;
  check('renombrar carpeta', kids.length, 1);
  check('título nuevo', kids[0].title, 'New');
  check('conserva hijos', kids[0].children.map((n) => n.id), ['idA']);
}

console.log('\nEstabilidad');
{
  const again = mergeThreeWay(root([A]), root([A]), root([A]));
  check('segunda sync no borra nada', again.deleted, 0);
}

console.log(
  failures === 0 ? '\nTodo OK' : `\n${failures} comprobación(es) fallida(s)`,
);
process.exit(failures === 0 ? 0 : 1);
