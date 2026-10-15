/**
 * Prueba la lógica de i18n (plurales, sustituciones, emparejado de locales y
 * fallback) contra los catálogos reales de `locales/`.
 *
 * Uso: node scripts/check-i18n.mjs
 */
import { readFile } from 'node:fs/promises';
import { matchLocale, translate } from '../lib/i18n-core.ts';

const load = async (code) =>
  JSON.parse(await readFile(`locales/${code}.json`, 'utf8'));

const catalog = {
  en: await load('en'),
  es: await load('es'),
  pt_BR: await load('pt_BR'),
};

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  const detail = ok
    ? ''
    : ` → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail}`);
}

const t = (locale, key, ...args) => translate(catalog, locale, 'en', key, ...args);

console.log('Claves simples');
check('es', t('es', 'tabs.settings'), 'Ajustes');
check('pt_BR', t('pt_BR', 'tabs.settings'), 'Configurações');
check('en', t('en', 'tabs.settings'), 'Settings');
check('claves anidadas profundas', t('pt_BR', 'settings.languageTitle'), 'Idioma');

console.log('\nPlurales');
check('es · singular', t('es', 'time.minutes', 1), 'hace 1 min');
check('es · plural', t('es', 'time.minutes', 5), 'hace 5 min');
check('es · cero', t('es', 'time.minutes', 0), 'hace 0 min');
check('pt_BR · plural', t('pt_BR', 'time.days', 3), 'há 3 d');
check('en · singular', t('en', 'time.hours', 1), '1 h ago');

console.log('\nSustituciones');
check('una', t('es', 'sync.mode', ['full']), 'Modo: full');
check(
  'dos sustituciones',
  t('es', 'about.browser', ['Chrome', 'Chrome@win']),
  'Navegador: Chrome (Chrome@win)',
);
check('sin argumentos no rompe', t('es', 'sync.client'), 'Cliente: $1');
check(
  'signos ya incluidos en el mensaje',
  t('pt_BR', 'sync.applied', ['2', '1', '3']),
  'Aplicado: +2 criados, 1 atualizados, -3 excluídos',
);
check(
  '$$ es un dólar literal',
  translate({ en: { x: 'cuesta $$5 y $1' } }, 'en', 'en', 'x', ['ok']),
  'cuesta $5 y ok',
);

console.log('\nEmparejado de locales');
check('pt-BR → pt_BR', matchLocale(catalog, 'pt-BR'), 'pt_BR');
check('pt-PT → pt_BR (por prefijo)', matchLocale(catalog, 'pt-PT'), 'pt_BR');
check('es-419 → es', matchLocale(catalog, 'es-419'), 'es');
check('en-US → en', matchLocale(catalog, 'en-US'), 'en');
check('fr-FR → null (sin catálogo)', matchLocale(catalog, 'fr-FR'), null);
check('vacío → null', matchLocale(catalog, ''), null);

console.log('\nFallbacks');
check(
  'clave ausente → idioma por defecto',
  translate({ en: { only: 'Only English' }, es: {} }, 'es', 'en', 'only'),
  'Only English',
);
check('clave inexistente → la clave', t('es', 'no.existe'), 'no.existe');
check('idioma inexistente → idioma por defecto', t('fr', 'tabs.settings'), 'Settings');

console.log(
  failures === 0 ? '\nTodo OK' : `\n${failures} comprobación(es) fallida(s)`,
);
process.exit(failures === 0 ? 0 : 1);
