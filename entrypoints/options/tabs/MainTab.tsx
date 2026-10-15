import { useEffect, useState } from 'react';
import { i18n } from '@/lib/i18n';
import { formatRelative, shortRevision } from '@/lib/format';
import type { AppState, TestConnectionResult } from '@/lib/messaging';
import { send } from '@/lib/messaging';
import * as settings from '@/lib/settings';
import type { SyncMode, SyncReport } from '@/lib/sync';
import { SYNC_MODE_OPTIONS } from '@/lib/sync-modes';
import { useStoredField, useSyncOptions } from '../hooks';

interface Props {
  state: AppState | null;
  onChanged: () => void;
}

export function MainTab({ state, onChanged }: Props) {
  const token = useStoredField(settings.githubToken);
  const gist = useStoredField(settings.gistId);
  const { options: syncOptions, update: updateSyncOptions } = useSyncOptions();
  const mode: SyncMode = syncOptions?.mode ?? 'full';
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestConnectionResult | null>(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token.saved) onChanged();
  }, [token.saved, onChanged]);

  async function handleTest() {
    setBusy(true);
    setError(null);
    setTest(null);
    const response = await send({ kind: 'test-connection' });
    setBusy(false);
    if (response.kind === 'test') setTest(response.result);
    else if (response.kind === 'error') setError(response.message);
  }

  async function handleSync() {
    setBusy(true);
    setError(null);
    setReport(null);
    const response = await send({ kind: 'sync', mode });
    setBusy(false);
    if (response.kind === 'sync') {
      setReport(response.report);
      onChanged();
    } else if (response.kind === 'error') {
      setError(response.message);
    }
  }

  const canSync = token.ready && token.value.trim().length > 0 && !busy;

  return (
    <>
      <section className="card">
        <div className="field">
          <label htmlFor="token">{i18n.t('main.tokenLabel')}</label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={i18n.t('main.tokenPlaceholder')}
            value={token.value}
            onChange={(event) => token.setValue(event.target.value)}
          />
          <small>
            {i18n.t('main.tokenHelp')}
            {token.saved ? ` ${i18n.t('common.saved')}` : ''}
          </small>
        </div>

        <div className="field">
          <label htmlFor="gist">{i18n.t('main.gistIdLabel')}</label>
          <input
            id="gist"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={i18n.t('main.gistPlaceholder')}
            value={gist.value}
            onChange={(event) => gist.setValue(event.target.value)}
          />
          <small>
            {i18n.t('main.gistHelp')}
            {gist.saved ? ` ${i18n.t('common.saved')}` : ''}
          </small>
        </div>

        <div className="field">
          <label htmlFor="mode">{i18n.t('main.modeLabel')}</label>
          <select
            id="mode"
            value={mode}
            onChange={(event) =>
              void updateSyncOptions({ mode: event.target.value as SyncMode })
            }
          >
            {SYNC_MODE_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {i18n.t(item.key)}
              </option>
            ))}
          </select>
        </div>

        <div className="actions">
          <button type="button" onClick={handleSync} disabled={!canSync}>
            {busy ? i18n.t('common.syncing') : i18n.t('main.sync')}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleTest}
            disabled={busy || !token.value.trim()}
          >
            {i18n.t('main.test')}
          </button>
        </div>

        {test ? (
          <p
            className={`status ${
              test.ok
                ? test.hasGistScope
                  ? 'status--ok'
                  : 'status--warn'
                : 'status--error'
            }`}
          >
            {test.ok ? '✓ ' : '✕ '}
            {test.message}
          </p>
        ) : null}

        {error ? <p className="status status--error">✕ {error}</p> : null}
      </section>

      <section className="card">
        <h2>{i18n.t('main.lastSyncTitle')}</h2>
        {state?.lastSync ? (
          <>
            <p className="hint">
              {i18n.t('main.summary', [
                formatRelative(state.lastSync.at),
                state.lastSync.client,
                state.lastSync.mode,
                shortRevision(state.revision),
              ])}
            </p>
            <div className="stats">
              <Stat
                value={state.lastSync.bookmarks}
                label={i18n.t('stats.bookmarks')}
              />
              <Stat
                value={state.lastSync.folders}
                label={i18n.t('stats.folders')}
              />
              <Stat
                value={`+${state.lastSync.created}`}
                label={i18n.t('stats.created')}
              />
              <Stat
                value={state.lastSync.updated}
                label={i18n.t('stats.updated')}
              />
              <Stat
                value={`-${state.lastSync.removed}`}
                label={i18n.t('stats.removed')}
              />
            </div>
          </>
        ) : (
          <p className="empty">{i18n.t('main.never')}</p>
        )}
        {state?.gistId ? (
          <p className="hint">
            {i18n.t('main.gistLink')}{' '}
            <a
              className="mono"
              href={`https://gist.github.com/${state.gistId}`}
              target="_blank"
              rel="noreferrer"
            >
              {state.gistId}
            </a>
          </p>
        ) : null}
      </section>

      {report ? (
        <section className="card">
          <h2>{i18n.t('main.resultTitle')}</h2>
          <div className="stats">
            <Stat
              value={`+${report.applied.created}`}
              label={i18n.t('stats.created')}
            />
            <Stat
              value={report.applied.updated}
              label={i18n.t('stats.updated')}
            />
            <Stat
              value={`-${report.applied.removed}`}
              label={i18n.t('stats.removed')}
            />
            <Stat value={report.localBookmarks} label={i18n.t('stats.local')} />
            <Stat value={report.remoteBookmarks} label={i18n.t('stats.remote')} />
            <Stat
              value={report.resultBookmarks}
              label={i18n.t('stats.result')}
            />
          </div>
          {report.applied.skippedRoots.length > 0 ? (
            <p className="status status--warn">
              {i18n.t('main.skippedRoots', [
                report.applied.skippedRoots.join(', '),
              ])}
            </p>
          ) : null}
          <ul className="log">
            {report.log.map((entry, index) => (
              <li key={index}>
                <span className={`log__level log__level--${entry.level}`}>
                  {entry.level}
                </span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
