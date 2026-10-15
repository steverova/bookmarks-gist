# TODO — Bookmarks Gist Sync

Extensión cross-browser (Chromium + Firefox) para sincronizar marcadores a través de un **GitHub Gist**.
Estilos con **water.css**. UI en React. Build con **WXT**.

## Decisiones cerradas

- [x] Scaffold: **WXT** (genera Chrome + Firefox con un comando, polyfill de `browser.*` incluido)
- [x] UI: **options page con tabs** + **popup corto** (estado + acción rápida)
- [x] Merge: **unión por URL normalizada + carpetas por ruta**, metadatos resueltos por `dateModified`
- [x] Alcance v1: **vertical completo básico** (leer → normalizar → merge → gist → aplicar, con log)

## Modelo de datos (formato del gist)

```jsonc
{
  "uniqueId": "DtAWQ7ji-jk1WPS9T1Npm",
  "version": "1.0.0",
  "clientInfo": { "lastSyncedBy": "Chrome@win", "syncedAt": 1777514493005 },
  "sha": "f03a93f9...",              // revisión del gist sobre la que se construyó
  "nodes": [ { "id", "title", "dateModified", "url?", "children?" } ]
}
```

- `url` presente ⇒ marcador. Ausente + `children` ⇒ carpeta.
- Raíces normalizadas: `root_____bar`, `root_____other`, `root_____mobile`, `root_____menu`.

## Fases

### Fase 0 — Scaffold WXT
- [x] Reescribir `package.json` (scripts dev/build/zip chrome+firefox)
- [x] `wxt.config.ts` (módulo react, permisos `bookmarks` + `storage`, host `api.github.com`, iconos)
- [x] `tsconfig.json` extendiendo `./.wxt/tsconfig.json` (+ `jsx`)
- [x] Borrar restos de Vite (`vite.config.ts`, `index.html`, `src/`, tsconfigs viejos)
- [x] Iconos en `public/icon/` (16/24/32/48/96/128) generados por script
- [x] `pnpm install` + `wxt prepare`

### Fase 1 — Núcleo (lib)
- [x] `lib/types.ts` — `SyncDocument`, `SyncNode`, `ClientInfo`, `RootKey`, contadores
- [x] `lib/ids.ts` — ids deterministas + `normalizeUrl` / `normalizeTitle`
- [x] `lib/roots.ts` — detección de navegador, plataforma y mapeo de raíces nativas
- [x] `lib/bookmarks/read.ts` — árbol nativo → `SyncNode[]`
- [x] `lib/bookmarks/apply.ts` — reconcilia `SyncNode[]` contra el árbol nativo
- [x] `lib/merge.ts` — unión por URL + carpetas por ruta
- [x] `lib/gist.ts` — cliente Gist (GET/POST/PATCH, token, revisión, errores tipados)
- [x] `lib/settings.ts` — `storage.defineItem` (token en `local:`, nunca `sync:`)
- [x] `lib/sync.ts` — orquestador (pull → merge → apply → push) + log
- [x] `lib/messaging.ts` — tipos de mensajes popup/options ↔ background
- [x] `lib/format.ts` — formateo de fechas/revisiones

### Fase 2 — Entrypoints
- [x] `entrypoints/background.ts` — handler `sync`/`test-connection`/`get-state`/`open-options` + badge
- [x] `entrypoints/popup/` — estado, botón sync, abrir panel
- [x] `entrypoints/options/` — tabs

### Fase 3 — UI (water.css)
- [x] Import de `water.css` (min, claro/oscuro automático) + `assets/app.css`
- [x] Tab **Principal**: token, gist id, modo, botón *Sync bookmarks*, resultado
- [x] Tab **Ajustes**: raíces, dry-run, borrado de credenciales
- [x] Tab **Registro**: log de la última sincronización (+ vaciar)
- [x] Tab **Acerca de**: versión de formato, navegador, enlaces

### Fase 4 — Verificación
- [x] `pnpm compile` (typecheck) limpio
- [x] `pnpm build` (Chrome MV3) limpio
- [x] `pnpm build:firefox` (Firefox MV2) limpio
- [x] `pnpm lint` limpio
- [x] README con instrucciones de instalación

### Fase 5 — i18n (idioma del navegador + selector)
- [x] Módulo `@wxt-dev/i18n` + `manifest.default_locale: 'en'`
- [x] `locales/en`, `locales/es` y `locales/pt_BR` (JSON anidado, 124 claves)
- [x] `name`/`description` del manifest vía `__MSG_extName__` / `__MSG_extDescription__`
- [x] Plurales (`time.minutes`) y sustituciones (`$1`) en el log de sync
- [x] Título de la pestaña del panel fijado con `i18n.t('optionsTitle')`
- [x] Títulos de raíz del gist se mantienen neutros (no se traducen)
- [x] `_locales/en`, `_locales/es`, `_locales/pt_BR` generados en los dos builds
- [x] **i18n en runtime** propio (`lib/i18n.ts`) porque `browser.i18n` no cambia en runtime
- [x] Selector de idioma en Ajustes (`auto` por defecto) + `storage.local:locale`
- [x] Detección/emparejado de locale (`pt-BR` → `pt_BR`, `es-419` → `es`)
- [x] Fechas y nombres de idioma siguen el idioma seleccionado (`Intl`)
- [x] `pnpm check:locales` (integrado en `build`) para evitar traducciones desincronizadas
- [x] `scripts/check-i18n.mjs` (22 comprobaciones) sobre `lib/i18n-core.ts` — pilló 2 bugs
- [x] Corregido: los plurales no aplicaban `$1` desde el número
- [x] Corregido: `+`/`-` duplicados en `sync.applied` y `popup.result`

### Fase 6 — Publicación y release
- [x] `pnpm zip` / `pnpm zip:firefox` (3 artefactos: chrome, firefox, sources)
- [x] Repo git inicializado en `main`
- [x] `packageManager: pnpm@11.9.0` para builds reproducibles en CI
- [x] `browser_specific_settings.gecko.data_collection_permissions` = `["browsingActivity"]`
      (obligatorio en AMO desde 2025-11-03; antes salía como WARN en el build)
- [x] `.github/workflows/release.yml`: tag `v*` → chequeo tag↔versión, `pnpm check`,
      zips y adjuntos al release (+ artefactos en ejecución manual)
- [x] `.env*` en `.gitignore` por si se usa `wxt submit init`
- [x] `pnpm release <bump>` (`scripts/release.mjs`): valida versión, exige árbol limpio,
      corre `pnpm check`, hace bump, `--local` para zips, comitea, etiqueta y empuja
      (`--no-push`, `--dry-run`)
- [x] Sin argumentos abre un **menú interactivo**; con `stdin` no interactivo exige
      la versión como argumento
- [x] `pnpm release current` para etiquetar sin bump (primera release)
- [x] Salvaguarda: el commit del release debe contener **solo** `package.json`
      (si no, revierte el bump y falla)
- [x] Verificado en un repo de prueba: los 4 caminos de error y los 2 de éxito
- [x] README → «Publicación» (zips, proceso manual, CI, checklist previo, AMO sources)
- [ ] Cambiar `gecko.id` por un identificador propio **antes** de publicar en AMO (es permanente)
- [ ] Ficha de tienda: capturas, descripción larga, política de privacidad
- [ ] Opcional: activar el paso comentado de `wxt submit` (envío automático a las tiendas)

## Pendiente / futuro

- [ ] Sincronizar la raíz `menu________` de Firefox en Chromium (v1 la conserva pero no la replica)
- [ ] Modo «última escritura gana» con lápidas para propagar borrados
- [ ] Movimientos sin perder `dateAdded` (usar `bookmarks.move` en vez de crear+borrar)
- [ ] Sync automático por `browser.alarms`
- [ ] Resolución de conflictos interactiva / vista diff
- [ ] Gists cifrados (passphrase) y OAuth device flow en vez de PAT manual
- [ ] Tests unitarios del merge (`wxt` trae soporte vitest)
- [ ] Más idiomas (basta con añadir `locales/<código>.json`)
