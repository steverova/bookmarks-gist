import { useCallback, useEffect, useState } from 'react';
import { i18n } from '@/lib/i18n';
import { formatRelative } from '@/lib/format';
import type { AppState } from '@/lib/messaging';
import { send } from '@/lib/messaging';

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await send({ kind: 'get-state' });
    if (response.kind === 'state') setState(response.state);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSync() {
    setBusy(true);
    setMessage(null);
    const response = await send({ kind: 'sync', mode: 'full' });
    setBusy(false);
    if (response.kind === 'sync') {
      const { applied } = response.report;
      setMessage(
        i18n.t('popup.result', [
          String(applied.created),
          String(applied.updated),
          String(applied.removed),
        ]),
      );
    } else if (response.kind === 'error') {
      setMessage(response.message);
    }
    await refresh();
  }

  function openOptions() {
    void send({ kind: 'open-options' });
  }

  const ready = state?.hasToken ?? false;

  return (
    <main className="app app--popup">
      <h1 className="app__title" style={{ fontSize: '1.1rem' }}>
        Bookmarks Gist Sync
      </h1>
      <p className="app__subtitle">
        {state ? `${state.browser} · ${state.client}` : i18n.t('common.loading')}
      </p>

      <p className="status" style={{ marginTop: '0.85rem' }}>
        {ready ? (
          state?.gistId ? (
            <>
              {i18n.t('popup.gist', [`${state.gistId.slice(0, 12)}…`])}
              <br />
              {i18n.t('popup.lastSync', [
                formatRelative(state.lastSync?.at ?? null),
              ])}
            </>
          ) : (
            i18n.t('popup.willCreateGist')
          )
        ) : (
          <span className="status--warn">{i18n.t('popup.missingToken')}</span>
        )}
      </p>

      <div className="actions" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={handleSync} disabled={busy || !ready}>
          {busy ? i18n.t('common.syncing') : i18n.t('popup.sync')}
        </button>
        <button type="button" className="secondary" onClick={openOptions}>
          {i18n.t('popup.panel')}
        </button>
      </div>

      {message ? <p className="status hint">{message}</p> : null}
    </main>
  );
}
