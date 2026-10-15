# Bookmarks Gist Sync

Extensión de navegador (Chromium + Firefox) que sincroniza tus marcadores entre
navegadores usando un **GitHub Gist** como almacenamiento compartido.

- Estilos con [water.css](https://water.css) (claro/oscuro automático).
- UI en React con **options page** (tabs) + **popup** corto.
- Build con [WXT](https://wxt.dev): un comando genera Chrome MV3 y Firefox MV2.
- Sin servidores propios: sólo la API de Gists + `chrome/bookmarks` API nativa.

## Puesta en marcha

```bash
pnpm install
pnpm dev            # Chrome/Chromium con recarga en caliente
pnpm dev:firefox    # Firefox con recarga en caliente
```

### Cargar la extensión generada

```bash
pnpm build          # .output/chrome-mv3
pnpm build:firefox  # .output/firefox-mv2
```

- **Chromium**: `chrome://extensions` → activa *Modo para desarrolladores* →
  *Cargar descomprimida* → elige `.output/chrome-mv3`.
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Cargar complemento
  temporal* → elige `.output/firefox-mv2/manifest.json`.

## Uso

1. Crea un **token de GitHub** con el scope `gist`
   (Settings → Developer settings → Personal access tokens).
2. Abre el panel (botón *Panel* del popup, o el botón *Opciones* de la
   extensión) y pega el token en la pestaña **Principal**.
3. Deja el campo *ID del gist* vacío la primera vez: se creará uno nuevo.
   Para unirte a un gist existente, pega su id (el trozo final de
   `gist.github.com/usuario/<id>`).
4. Pulsa **Sync bookmarks**.

El token se guarda en `storage.local`, es decir **sólo en ese navegador**;
nunca se sube a la nube ni al gist.

## Modos de sincronización

| Modo       | Qué hace                                                     |
| ---------- | ------------------------------------------------------------ |
| `full`     | Lee local + remoto, fusiona, aplica en local y publica.      |
| `pull`     | Aplica el gist en este navegador, sin publicar.              |
| `push`     | Publica el estado local, sin tocar los marcadores locales.   |

En **Ajustes** hay un *dry-run* que calcula y registra lo que haría sin escribir
nada.

## Formato del documento

El gist contiene `bookmarks-sync.json`:

```jsonc
{
  "uniqueId": "DtAWQ7ji-jk1WPS9T1Npm",
  "version": "1.0.0",
  "clientInfo": { "lastSyncedBy": "Chrome@win", "syncedAt": 1777514493005 },
  "sha": "f03a93f9…",
  "nodes": [
    {
      "id": "root_____bar",
      "title": "Barra de marcadores",
      "dateModified": 1777514450961,
      "children": [
        { "id": "…", "title": "YouTube", "dateModified": 0, "url": "https://www.youtube.com/" }
      ]
    }
  ]
}
```

- Un nodo con `url` es un marcador; sin `url` y con `children` es una carpeta.
- Raíces normalizadas: `root_____bar`, `root_____other`, `root_____mobile`
  y `root_____menu` (sólo Firefox).
- Los `id` son **deterministas** (derivados de raíz + ruta + url), de forma que
  un mismo marcador conserva su id entre sincronizaciones.

## Cómo funciona la fusión

Unión de ambos lados: las carpetas se emparejan por ruta y título, y los
marcadores por **URL normalizada**. Cuando un nodo existe en los dos lados, gana
el título del que tenga `dateModified` más reciente. El árbol resultante se
reconcilia contra el navegador (crear / renombrar / eliminar) dentro de las
raíces seleccionadas.

## Limitaciones conocidas (v1)

- La fusión es una **unión**: borrar un marcador no se propaga al otro lado
  (nunca se pierde nada, pero tampoco se propaga el borrado). Requiere un modo
  «última escritura gana» con lápidas.
- Mover un marcador de carpeta se resuelve como *crear + eliminar* (el
  marcador pierde su id nativo y `dateAdded`).
- Firefox `menu________` no se toca en Chromium: se conserva en el gist tal cual
  pero no se replica allí.
- No hay resolución de conflictos interactiva ni sincronización automática por
  alarmas todavía.

## Estructura

```
entrypoints/
  background.ts        # mensajes: sync, test-connection, get-state, open-options
  popup/               # UI corta
  options/             # panel con tabs (Principal / Ajustes / Registro / Acerca de)
lib/
  types.ts             # modelo del documento y raíces
  ids.ts               # ids deterministas + normalización de URLs
  roots.ts             # detección de navegador y mapeo de raíces nativas
  bookmarks/read.ts    # árbol nativo -> documento
  bookmarks/apply.ts   # documento -> árbol nativo
  merge.ts             # fusión por URL + carpetas por ruta
  gist.ts              # cliente de la API de Gists
  settings.ts          # storage tipado
  sync.ts              # orquestador
  messaging.ts         # tipos de mensajes
  format.ts            # formateo de fechas/revisiones
locales/
  en.json              # idioma por defecto (default_locale)
  es.json              # español
  pt_BR.json           # portugués (Brasil)
assets/app.css         # layout sobre water.css
scripts/make-icons.mjs # genera public/icon/*.png (sin dependencias)
scripts/check-locales.mjs # valida que las traducciones no se desincronicen
```

## Idiomas (i18n)

Idiomas incluidos: **inglés** (`en`, por defecto), **español** (`es`) y
**portugués de Brasil** (`pt_BR`). Por defecto se usa **el idioma del
navegador**; además, en *Ajustes → Idioma* se puede forzar otro.

### Cómo está montado (y por qué así)

Hay dos capas independientes:

1. **`@wxt-dev/i18n`** genera `_locales/<lang>/messages.json` a partir de
   `locales/*.json` y es lo que localiza el **nombre y la descripción del
   manifest** (`__MSG_extName__`). Esa parte la resuelve el navegador y
   **siempre sigue el idioma del navegador** — no se puede forzar por código.
2. **`lib/i18n.ts`** es el i18n de la UI. `browser.i18n` **no permite cambiar el
   idioma en runtime**, así que para el selector empaquetamos los mismos
   catálogos con `import.meta.glob` y resolvemos las traducciones nosotros
   (incluidos plurales y `$1`…`$9`).

```json
// locales/es.json
{
  "main": { "sync": "Sync bookmarks" },
  "time": { "minutes": { "1": "hace 1 min", "n": "hace $1 min" } }
}
```

```ts
import { i18n } from '@/lib/i18n';

i18n.t('main.sync');                        // "Sync bookmarks"
i18n.t('time.minutes', 5);                  // "hace 5 min" (plural por número)
i18n.t('sync.applied', ['+2', '1', '-3']);  // sustituciones $1..$3
```

La preferencia se guarda en `storage.local:locale`: `auto` (por defecto) o un
código. `resolveLocale()` empareja el idioma del navegador con el catálogo más
cercano (`pt-BR` → `pt_BR`, `es-419` → `es`) y cae a `en` si no hay nada.

**Añadir un idioma**: crea `locales/<código>.json` con las mismas claves. Aparece
solo en el selector y se añade a `_locales` en el build. Usa códigos de
[locale de Chrome](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales):
`fr`, `de`, `pt_BR`, `zh_CN`… Si falta una clave, la UI cae al inglés.

`pnpm check:locales` (y por tanto `pnpm build`) falla si un idioma tiene claves
de menos o de más respecto a `en`.

> Nota: los títulos de las raíces que se **guardan en el gist** no se traducen
> (`ROOT_FALLBACK_TITLES`): son datos, no UI, y si cambiaran con el idioma del
> navegador provocarían escrituras espurias en el gist.

## Scripts

| Script               | Descripción                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | desarrollo (Chrome)                  |
| `pnpm dev:firefox`   | desarrollo (Firefox)                 |
| `pnpm build`         | build Chrome MV3                     |
| `pnpm build:firefox` | build Firefox MV2                    |
| `pnpm zip`           | empaqueta el zip de Chrome/Edge      |
| `pnpm zip:firefox`   | empaqueta el zip de Firefox + sources |
| `pnpm compile`       | typecheck (`tsc --noEmit`)           |
| `pnpm lint`          | [oxlint](https://oxc.rs)             |
| `pnpm check`         | compile + lint + check:locales + check:i18n |
| `pnpm release <bump>`| publica una versión: `patch\|minor\|major\|x.y.z\|current` |
| `pnpm check:locales` | valida la consistencia de traducciones |
| `pnpm check:i18n`    | ejercita plurales, sustituciones y locales |
| `node scripts/make-icons.mjs` | regenera los iconos        |

## Publicación

### Los zips

```bash
pnpm zip           # .output/bookmarks-gist-<version>-chrome.zip
pnpm zip:firefox   # .output/bookmarks-gist-<version>-firefox.zip
                   # .output/bookmarks-gist-<version>-sources.zip
```

La `<version>` sale del campo `version` de `package.json`, que WXT inyecta también
en el `manifest.json`. Por eso **el tag y el zip van atados a ese campo**: haz
siempre el bump antes de etiquetar.

| Artefacto | Para qué |
| --- | --- |
| `-chrome.zip` | Chrome Web Store. **Sirve igual para Edge Addons.** |
| `-firefox.zip` | Firefox Add-ons (AMO). |
| `-sources.zip` | **AMO lo exige aparte**: sube tu código para poder reconstruirlo y revisarlo. |

`pnpm zip` encadena `check:locales`, así que un zip con traducciones
desincronizadas no se genera.

### Proceso manual

Con `scripts/release.mjs`:

```bash
pnpm release patch           # 0.1.0 -> 0.1.1
pnpm release minor           # 0.1.0 -> 0.2.0
pnpm release 0.2.0           # versión explícita
pnpm release current         # etiqueta la versión que ya hay (sin bump)
pnpm release current --local # además empaqueta y verifica los zips aquí
pnpm release 0.2.0 --dry-run # muestra lo que haría, sin tocar nada
```

Usa `current` para la **primera release** (etiquetar `v0.1.0` sin subir la versión)
o cuando ya hayas cambiado `version` a mano: etiqueta el commit actual sin crear
uno nuevo.

El script hace, en orden:

1. Valida que la versión sea un `patch|minor|major` o un `x.y.z` **mayor** que la actual.
2. Exige el **árbol limpio** (todo commiteado) y que el tag no exista todavía.
3. Corre `pnpm check`.
4. Sube `version` en `package.json`.
5. Con `--local`, ejecuta `pnpm zip` y `pnpm zip:firefox` y comprueba que los
   tres artefactos existen con la versión nueva.
6. Verifica que el release solo cambia `package.json` (si `pnpm check` o el
   empaquetado han tocado algún fichero rastreado, **revierte el bump y falla**).
7. `git add package.json`, commit `chore: release vX` y tag anotado `vX`.
8. `git push` de la rama y del tag → dispara el workflow. Con `--no-push` te
   imprime los comandos y para.

Opciones: `--local`, `--no-push`, `--dry-run`.

Equivale a esto, si prefieres hacerlo a mano:

```bash
npm version 0.2.0 --no-git-tag-version
pnpm zip && pnpm zip:firefox
git add package.json && git commit -m "chore: release v0.2.0"
git tag -a v0.2.0 -m "v0.2.0"
git push --set-upstream origin main && git push origin v0.2.0

# release con los zips adjuntos, si lo haces sin CI
gh release create v0.2.0 .output/*.zip --generate-notes
```

### Proceso automático

`.github/workflows/release.yml` se dispara al empujar un tag `v*`:

1. Comprueba que el tag coincide con `version` de `package.json` (si no, **falla**;
   así no se publica un `v0.2.0` con un zip `0.1.0`).
2. Corre `pnpm check`.
3. Empaqueta Chrome y Firefox.
4. Adjunta los tres zips al GitHub Release.

Con `workflow_dispatch` (ejecución manual) los zips quedan como artefactos del
run, sin crear release.

Opcionalmente, el workflow trae comentado el paso de **envío automático a las
tiendas** con `pnpm wxt submit`, que sube los zips por API sin entrar al
dashboard. Necesita secretos en el repo; genera el `.env.submit` con
`pnpm wxt submit init` y copia esos valores a los secrets.

### Antes de la primera publicación

- [ ] **`gecko.id` en `wxt.config.ts`**: está puesto como
      `bookmarks-gist@steverova0594.github.io`. El id es **permanente** en AMO —
      cambiarlo después significa publicar como otra extensión y perder usuarios
      y actualizaciones. Ponlo a un email o dominio que controles.
- [ ] `data_collection_permissions` ya está declarado como
      `required: ["browsingActivity"]`, porque la extensión envía a GitHub las
      URLs y títulos de los marcadores (a la cuenta del propio usuario). Si
      cambias qué se envía, revisa esta declaración.
- [ ] Iconos, capturas y ficha de la tienda.

### Código fuente para AMO

AMO reconstruye la extensión a partir del `-sources.zip`. Para que el revisor
pueda hacerlo, el zip debe incluir este README con los comandos exactos (ya los
tiene, en *Puesta en marcha*):

```bash
pnpm install
pnpm build:firefox   # o pnpm zip:firefox
```

Comprueba que el resultado de reconstruir dentro del `-sources.zip` es idéntico
al de tu proyecto; si no, el revisor lo rechazará.

> `.env*` no debe contener secretos que acaben en el zip. Este proyecto no usa
> ninguno para el build, así que no hay nada que excluir.

