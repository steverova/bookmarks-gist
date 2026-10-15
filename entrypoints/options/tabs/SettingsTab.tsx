import { useState } from 'react';
import { AVAILABLE_LOCALES, AUTO_LOCALE, i18n } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import type { AppState } from '@/lib/messaging';
import * as settings from '@/lib/settings';
import { ROOT_LABEL_KEYS, type RootKey } from '@/lib/types';
import { useLanguageNames, useLocalePreference, useSyncOptions } from '../hooks';

interface Props {
  state: AppState | null;
  onChanged: () => void;
}

export function SettingsTab({ state, onChanged }: Props) {
  const { options, update } = useSyncOptions();
  const [confirming, setConfirming] = useState(false);
  const { preference, update: updateLocale } = useLocalePreference();
  const currentLocale = useLocale();
  const languageName = useLanguageNames(currentLocale);

  const available = (state?.supportedRoots ?? []) as RootKey[];
  const selected = new Set<RootKey>((options?.roots ?? []) as RootKey[]);

  function toggleRoot(key: RootKey, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    void update({ roots: [...next] });
  }

  async function handleClear() {
    await settings.clearCredentials();
    setConfirming(false);
    onChanged();
  }

  return (
    <>
      <section className="card">
        <h2>{i18n.t('settings.languageTitle')}</h2>
        <div className="field">
          <select
            id="locale"
            aria-label={i18n.t('settings.languageTitle')}
            value={preference}
            onChange={(event) => void updateLocale(event.target.value)}
          >
            <option value={AUTO_LOCALE}>{i18n.t('settings.languageAuto')}</option>
            {AVAILABLE_LOCALES.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
          <small>
            {i18n.t('settings.languageHelp', [languageName(currentLocale)])}
          </small>
          <small className="hint">{i18n.t('settings.languageNote')}</small>
        </div>
      </section>

      <section className="card">
        <h2>{i18n.t('settings.rootsTitle')}</h2>
        <p className="hint">{i18n.t('settings.rootsHelp', [state?.browser ?? ''])}</p>
        <div className="roots">
          {available.map((key) => (
            <label key={key} className="checkbox">
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={(event) => toggleRoot(key, event.target.checked)}
              />
              <span>
                {i18n.t(ROOT_LABEL_KEYS[key])}
                <br />
                <small className="mono">{key}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{i18n.t('settings.behaviorTitle')}</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={options?.dryRun ?? false}
            onChange={(event) => void update({ dryRun: event.target.checked })}
          />
          <span>
            {i18n.t('settings.dryRun')}
            <br />
            <small className="hint">{i18n.t('settings.dryRunHelp')}</small>
          </span>
        </label>
      </section>

      <section className="card">
        <h2>{i18n.t('settings.credentialsTitle')}</h2>
        <p className="hint">{i18n.t('settings.credentialsHelp')}</p>
        <div className="actions">
          {confirming ? (
            <>
              <button type="button" onClick={handleClear}>
                {i18n.t('settings.confirmDelete')}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirming(false)}
              >
                {i18n.t('settings.cancel')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)}>
              {i18n.t('settings.deleteCredentials')}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
