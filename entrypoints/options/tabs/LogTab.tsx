import { i18n } from '@/lib/i18n';
import { formatDateTime, formatTime } from '@/lib/format';
import type { AppState } from '@/lib/messaging';
import * as settings from '@/lib/settings';

interface Props {
  state: AppState | null;
  onChanged: () => void;
}

export function LogTab({ state, onChanged }: Props) {
  const entries = [...(state?.log ?? [])].reverse();

  async function handleClear() {
    await settings.clearLog();
    onChanged();
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{i18n.t('logTab.title')}</h2>
        <div className="actions">
          <button type="button" className="secondary" onClick={onChanged}>
            {i18n.t('logTab.refresh')}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleClear}
            disabled={entries.length === 0}
          >
            {i18n.t('logTab.clear')}
          </button>
        </div>
      </div>
      {state?.lastSync ? (
        <p className="hint" style={{ marginTop: '0.75rem' }}>
          {i18n.t('logTab.lastSyncAt', [formatDateTime(state.lastSync.at)])}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="empty" style={{ marginTop: '1rem' }}>
          {i18n.t('logTab.empty')}
        </p>
      ) : (
        <ul className="log" style={{ marginTop: '1rem' }}>
          {entries.map((entry, index) => (
            <li key={index}>
              <span className="log__time">{formatTime(entry.at)}</span>
              <span className={`log__level log__level--${entry.level}`}>
                {entry.level}
              </span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
