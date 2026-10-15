import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { i18n } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import { useAppState } from './hooks';
import { AboutTab } from './tabs/AboutTab';
import { LogTab } from './tabs/LogTab';
import { MainTab } from './tabs/MainTab';
import { SettingsTab } from './tabs/SettingsTab';

type TabId = 'main' | 'settings' | 'log' | 'about';

const TABS: { id: TabId; key: 'tabs.main' | 'tabs.settings' | 'tabs.log' | 'tabs.about' }[] =
  [
    { id: 'main', key: 'tabs.main' },
    { id: 'settings', key: 'tabs.settings' },
    { id: 'log', key: 'tabs.log' },
    { id: 'about', key: 'tabs.about' },
  ];

export function App() {
  const [active, setActive] = useState<TabId>('main');
  const { state, refresh } = useAppState();
  const locale = useLocale();

  useEffect(() => {
    document.title = i18n.t('optionsTitle');
  }, [locale]);

  const render = useCallback((): ReactNode => {
    switch (active) {
      case 'settings':
        return <SettingsTab state={state} onChanged={refresh} />;
      case 'log':
        return <LogTab state={state} onChanged={refresh} />;
      case 'about':
        return <AboutTab state={state} />;
      default:
        return <MainTab state={state} onChanged={refresh} />;
    }
  }, [active, state, refresh]);

  return (
    <main className="app">
      <header>
        <h1 className="app__title">Bookmarks Gist Sync</h1>
        <p className="app__subtitle">
          {state
            ? `${state.browser} · ${state.client} · ${
                state.hasToken
                  ? i18n.t('header.hasToken')
                  : i18n.t('header.noToken')
              }`
            : i18n.t('common.loading')}
        </p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            className="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActive(tab.id)}
          >
            {i18n.t(tab.key)}
          </button>
        ))}
      </nav>

      <section
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {render()}
      </section>
    </main>
  );
}
