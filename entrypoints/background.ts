import { browser, defineBackground } from '#imports';
import { i18n, refreshLocale } from '@/lib/i18n';
import { testConnection } from '@/lib/gist';
import type { AppState, Request, Response, TestConnectionResult } from '@/lib/messaging';
import { clientLabel, detectBrowserName, supportedRoots } from '@/lib/roots';
import * as settings from '@/lib/settings';
import { runSync } from '@/lib/sync';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    async (message: Request): Promise<Response> => {
      try {
        await refreshLocale();
        switch (message.kind) {
          case 'sync': {
            const report = await runSync(message.mode);
            await showBadge(report.applied);
            return { kind: 'sync', report };
          }
          case 'test-connection':
            return { kind: 'test', result: await testCredentials() };
          case 'get-state':
            return { kind: 'state', state: await getState() };
          case 'open-options':
            await browser.runtime.openOptionsPage();
            return { kind: 'ok' };
          default:
            return { kind: 'error', message: i18n.t('error.unsupportedMessage') };
        }
      } catch (error) {
        return { kind: 'error', message: (error as Error).message };
      }
    },
  );
});

async function testCredentials(): Promise<TestConnectionResult> {
  const token = (await settings.githubToken.getValue()).trim();
  if (!token) return { ok: false, message: i18n.t('error.missingToken') };

  try {
    const info = await testConnection(token);
    const scopes = info.scopes
      ? info.scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : null;
    // Los tokens fine-grained no informan de scopes: no se puede comprobar.
    const hasGistScope = scopes ? scopes.includes('gist') : true;
    return {
      ok: true,
      login: info.login,
      name: info.name,
      scopes: info.scopes,
      hasGistScope,
      message: hasGistScope
        ? i18n.t('status.connected', [info.login])
        : i18n.t('status.connectedNoScope', [info.login]),
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

async function getState(): Promise<AppState> {
  const [token, gist, revision, last, log] = await Promise.all([
    settings.githubToken.getValue(),
    settings.gistId.getValue(),
    settings.lastRevision.getValue(),
    settings.lastSync.getValue(),
    settings.syncLog.getValue(),
  ]);

  return {
    hasToken: token.trim().length > 0,
    gistId: gist,
    revision,
    client: clientLabel(),
    browser: detectBrowserName(),
    supportedRoots: supportedRoots(),
    lastSync: last,
    log,
  };
}

async function showBadge(applied: {
  created: number;
  updated: number;
  removed: number;
}): Promise<void> {
  const changed = applied.created + applied.updated + applied.removed;
  const text = changed > 0 ? `+${changed}` : '✓';
  try {
    await browser.action.setBadgeBackgroundColor({ color: '#2563eb' });
    await browser.action.setBadgeText({ text });
    setTimeout(() => {
      void browser.action.setBadgeText({ text: '' });
    }, 8000);
  } catch {
    // El navegador puede no soportar badges; no es crítico.
  }
}
