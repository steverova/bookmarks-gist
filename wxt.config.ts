import { defineConfig } from 'wxt';

/**
 * Id de la extensión en Firefox/AMO.
 *
 * ⚠️ Es **permanente**: una vez publicada en AMO no se puede cambiar sin crear
 * una extensión distinta (perderías usuarios y actualizaciones). Cámbialo por
 * un identificador propio (un email o un dominio que controles) antes de la
 * primera publicación. Ver README → «Publicación».
 */
const GECKO_ID = 'bookmarks-gist@steverova.github.io';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['bookmarks', 'storage'],
    host_permissions: ['https://api.github.com/*'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '115.0',
        // Obligatorio en AMO para extensiones nuevas desde el 2025-11-03.
        // La extensión envía a GitHub las URLs y títulos de los marcadores
        // (a la cuenta del propio usuario, con su token), así que declarar
        // "none" sería una declaración falsa.
        data_collection_permissions: {
          required: ['browsingActivity'],
        },
      },
    },
  },
});
