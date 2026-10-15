#!/usr/bin/env node
/**
 * Publica una versión nueva: comprueba, sube la versión, comitea, etiqueta y
 * empuja. El push del tag dispara `.github/workflows/release.yml`, que empaqueta
 * los zips y los adjunta al GitHub Release.
 *
 *   pnpm release                # pregunta qué versión publicar
 *   pnpm release patch          # 0.1.0 -> 0.1.1
 *   pnpm release minor          # 0.1.0 -> 0.2.0
 *   pnpm release 0.2.0          # versión explícita
 *   pnpm release current        # etiqueta la versión que ya hay, sin bump
 *   pnpm release current --local  # además empaqueta los zips aquí
 *
 * Flags:
 *   --local     empaqueta y verifica los zips localmente (pnpm zip*)
 *   --no-push   hace todo menos el push (no dispara CI)
 *   --dry-run   imprime los comandos sin ejecutar nada que modifique el repo
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const positional = args.filter((arg) => !arg.startsWith('--'));

const DRY_RUN = flags.has('--dry-run');
const LOCAL = flags.has('--local');
const NO_PUSH = flags.has('--no-push');

const BUMPS = ['patch', 'minor', 'major', 'current'];

const USAGE = `
Uso: pnpm release [patch|minor|major|x.y.z|current] [--local] [--no-push] [--dry-run]

  (sin versión)  pregunta interactivamente qué publicar
  current        etiqueta la versión que ya está en package.json (sin bump)
  --local        empaqueta y verifica los zips localmente
  --no-push      no hace push (no dispara el workflow)
  --dry-run      muestra lo que haría sin modificar nada
`;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

/** Comando de lectura: siempre se ejecuta (no lo afecta --dry-run). */
function capture(command) {
  const result = spawnSync(command, { shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`Falló: ${command}\n${result.stderr?.trim() ?? ''}`);
  }
  return (result.stdout ?? '').trim();
}

/** Comando que modifica algo: se imprime y se omite con --dry-run. */
function run(command) {
  console.log(`  $ ${command}`);
  if (DRY_RUN) return;
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  if (result.status !== 0) fail(`Falló: ${command}`);
}

function compare(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

function isValidVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function nextVersion(input, from) {
  if (input === 'current') return from;

  if (!BUMPS.includes(input) && !isValidVersion(input)) {
    fail(`Versión no válida: «${input}». Usa patch|minor|major|current o x.y.z`);
  }
  if (isValidVersion(input)) return input;

  if (!isValidVersion(from)) {
    fail(`La versión actual (${from}) no es x.y.z; indica una versión explícita.`);
  }
  const [, major, minor, patch] = from.match(/^(\d+)\.(\d+)\.(\d+)$/).map(Number);
  if (input === 'major') return `${major + 1}.0.0`;
  if (input === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** Menú interactivo para cuando no se pasa la versión como argumento. */
async function promptForVersion(from) {
  if (!process.stdin.isTTY) {
    fail(`Falta la versión.${USAGE}`);
  }

  const bumpable = isValidVersion(from);
  const options = [];
  if (bumpable) {
    options.push(['1', 'patch', nextVersion('patch', from)]);
    options.push(['2', 'minor', nextVersion('minor', from)]);
    options.push(['3', 'major', nextVersion('major', from)]);
  }
  options.push([String(options.length + 1), 'current', from]);

  console.log(`\nVersión actual: ${from}`);
  console.log('\n  ¿Qué publicas?');
  for (const [key, name, result] of options) {
    const note = name === 'current' ? 'sin bump, etiqueta este commit' : '';
    console.log(`    ${key}) ${name.padEnd(8)} → ${result} ${note}`);
    if (name === 'current') break;
  }
  console.log('    (o escribe una versión, p. ej. 0.3.0)\n');

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Si se cierra la entrada (Ctrl+D) mientras esperamos, `question` se queda
  // sin resolver y Node avisa de un `await` colgado; lo tratamos como error.
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const answer = await Promise.race([
        readline.question('  Elige: '),
        new Promise((resolve) => readline.once('close', () => resolve(null))),
      ]);

      if (answer === null) {
        fail(`Entrada cerrada. Indica la versión como argumento.${USAGE}`);
      }

      const value = answer.trim().toLowerCase();
      const byNumber = options.find(([key]) => key === value);
      if (byNumber) return byNumber[1];
      if (BUMPS.includes(value)) return value;
      if (isValidVersion(value)) return value;
      console.log('  No te he entendido: elige un número o escribe una versión.');
    }
    fail(`Demasiados intentos. Indica la versión como argumento.${USAGE}`);
  } finally {
    readline.close();
  }
}

// --- Versión ---------------------------------------------------------------

if (positional.length > 1) fail(`Sobra un argumento: ${positional[1]}`);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const current = pkg.version;

const bump = positional[0] ?? (await promptForVersion(current));
const version = nextVersion(bump, current);
const tag = `v${version}`;
const bumping = version !== current;

if (bumping && compare(version, current) <= 0) {
  fail(`La versión nueva (${version}) debe ser mayor que la actual (${current}).`);
}

// --- Estado del repositorio ------------------------------------------------

if (capture('git rev-parse --is-inside-work-tree') !== 'true') {
  fail('No estás dentro de un repositorio git.');
}

const dirty = capture('git status --porcelain');
if (dirty) {
  fail(
    `Hay cambios sin commitear. Déjalos en un commit antes de publicar:\n\n${dirty}\n`,
  );
}

if (capture(`git tag -l "${tag}"`)) {
  fail(`El tag ${tag} ya existe.`);
}
if (existsSync(`.output/bookmarks-gist-${version}-chrome.zip`)) {
  console.log(
    `\n· Aviso: ya había un .output/bookmarks-gist-${version}-chrome.zip; se sobreescribirá.`,
  );
}

const branch = capture('git rev-parse --abbrev-ref HEAD');
console.log(
  `\nRelease: ${bumping ? `${current} → ${version}` : `${version} (sin bump)`}` +
    `  (tag ${tag}, rama ${branch})`,
);
if (DRY_RUN) console.log('Modo dry-run: no se modifica nada.');

// --- Ejecutar --------------------------------------------------------------

step('Comprobaciones (tipos, lint, traducciones, i18n)');
run('pnpm check');

// Sin notas en CHANGELOG.md no se publica (el workflow también lo comprueba).
step('Comprobar las notas del release (CHANGELOG.md)');
capture(`node scripts/changelog-notes.mjs ${version}`);

if (bumping) {
  step(`Subir la versión en package.json a ${version}`);
  if (!DRY_RUN) {
    const raw = readFileSync('package.json', 'utf8');
    const updated = raw.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
    if (updated === raw) fail('No se pudo actualizar "version" en package.json.');
    writeFileSync('package.json', updated);
    console.log(`  ~ package.json → ${version}`);
  }
} else {
  console.log(
    '\n· Sin bump: se etiqueta el commit actual tal cual (válido para la primera release).',
  );
}

if (LOCAL) {
  step('Empaquetar los zips');
  run('pnpm zip');
  run('pnpm zip:firefox');

  if (!DRY_RUN) {
    const artifacts = [
      `.output/bookmarks-gist-${version}-chrome.zip`,
      `.output/bookmarks-gist-${version}-firefox.zip`,
      `.output/bookmarks-gist-${version}-sources.zip`,
    ];
    const missing = artifacts.filter((file) => !existsSync(file));
    if (missing.length > 0) {
      fail(`No se generaron: ${missing.join(', ')}`);
    }
    console.log(`  ✓ ${artifacts.length} artefactos generados`);
  }
} else {
  console.log('\n· Los zips los genera el workflow al recibir el tag.');
}

step('Commit y tag');
if (bumping && !DRY_RUN) {
  // El commit del release debe contener exactamente el bump de versión: si
  // `pnpm check` o el empaquetado han modificado algún fichero rastreado, algo
  // va mal y el release quedaría inconsistente.
  const changed = capture('git status --porcelain --untracked-files=no')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const unexpected = changed.filter((line) => !line.endsWith('package.json'));

  if (unexpected.length > 0) {
    run('git checkout -- package.json');
    fail(
      `Han cambiado ficheros que no esperábamos durante el release:\n\n${unexpected.join('\n')}\n\nSe ha revertido el bump de versión; revisa el cambio anterior.`,
    );
  }
}

if (bumping) {
  run('git add package.json');
  run(`git commit -m "chore: release ${tag}"`);
} else {
  console.log(
    `  (sin commit nuevo: se etiqueta ${capture('git rev-parse --short HEAD')})`,
  );
}
run(`git tag -a ${tag} -m "${tag}"`);

if (NO_PUSH) {
  step('Push omitido (--no-push). Cuando quieras:');
  console.log(`  $ git push --set-upstream origin ${branch}`);
  console.log(`  $ git push origin ${tag}`);
} else {
  step('Push');
  run(`git push --set-upstream origin ${branch}`);
  run(`git push origin ${tag}`);
  console.log(
    `\n✓ ${tag} publicado. El workflow empaquetará los zips y los adjuntará al release.`,
  );
  console.log('  Sigue el progreso en la pestaña Actions del repositorio.');
}
