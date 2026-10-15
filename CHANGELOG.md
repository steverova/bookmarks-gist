# Changelog

Todos los cambios relevantes de este proyecto. El formato sigue, a grandes
rasgos, [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

Cada sección se usa como **notas del GitHub Release** de su tag (ver
`scripts/changelog-notes.mjs`).

## [0.1.2] - 2026-10-15

### Añadido

- **Propagación de borrados** con fusión de tres vías (base local / este
  navegador / gist). Al borrar un marcador o una carpeta y pulsar *Sync
  bookmarks*, desaparece también del gist; y un borrado hecho en otro navegador
  se aplica aquí. Si el otro lado había modificado el nodo, gana la
  modificación: un borrado nunca pisa un cambio en paralelo.
- La base de la fusión se guarda en `storage.local:lastSnapshot`, asociada al id
  del gist (si cambias de gist, se empieza de cero para no propagar borrados
  falsos).
- **Selector de modo en el popup** (Completa / Bajar / Subir) junto al botón de
  sync, para no tener que abrir el panel.
- Script `pnpm check:merge` con pruebas de altas, borrados y conflictos de la
  fusión.

### Cambiado

- El **modo elegido se recuerda** entre sesiones y se comparte entre el popup y
  la pestaña *Principal* del panel (antes el panel volvía siempre a «Completa»).
- El botón de sync del popup usa el modo seleccionado (antes estaba fijo en
  «Completa»).
- El popup tiene **esquinas redondeadas** y muestra la **versión** de la
  extensión.
- El enlace *Abrir panel* sustituye al botón secundario del popup.
- Se publica el estado acordado tal cual, para que el gist refleje también las
  eliminaciones.

### Notas

- La propagación de borrados se apoya en la base del último sync: después de
  actualizar, la **primera sincronización solo fija esa base**; a partir de ahí
  los borrados se propagan.

## [0.1.1] - 2026-10-15

### Arreglado

- El sufijo *(dry-run)* se añade después de traducir el modo, en lugar de
  quedar sin traducir.

### Añadido

- Menú interactivo en `pnpm release` para elegir qué versión publicar.

## [0.1.0] - 2026-10-15

### Añadido

- Versión inicial: sincronización manual de marcadores vía GitHub Gist, panel
  con pestañas (Principal / Ajustes / Registro / Acerca de), popup corto, i18n
  (inglés, español y portugués de Brasil) y empaquetado para Chrome y Firefox.
