import { i18n } from '@/lib/i18n';
import type { AppState } from '@/lib/messaging';
import { FORMAT_VERSION } from '@/lib/types';

interface Props {
  state: AppState | null;
}

const GIST_FILENAME = 'bookmarks-sync.json';

export function AboutTab({ state }: Props) {
  return (
    <>
      <section className="card">
        <h2>{i18n.t('about.howTitle')}</h2>
        <ol>
          <li>{i18n.t('about.step1')}</li>
          <li>{i18n.t('about.step2')}</li>
          <li>{i18n.t('about.step3')}</li>
          <li>{i18n.t('about.step4')}</li>
        </ol>
        <p className="hint">{i18n.t('about.union')}</p>
      </section>

      <section className="card">
        <h2>{i18n.t('about.detailsTitle')}</h2>
        <ul>
          <li>{i18n.t('about.format', [FORMAT_VERSION])}</li>
          <li>
            {i18n.t('about.browser', [
              state?.browser ?? '—',
              state?.client ?? '—',
            ])}
          </li>
          <li>{i18n.t('about.file', [GIST_FILENAME])}</li>
          <li>
            {i18n.t('about.revision', [
              state?.revision || i18n.t('common.na'),
            ])}
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>{i18n.t('about.linksTitle')}</h2>
        <ul>
          <li>
            <a
              href="https://docs.github.com/en/rest/gists"
              target="_blank"
              rel="noreferrer"
            >
              {i18n.t('about.gistsApi')}
            </a>
          </li>
          <li>
            <a
              href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks"
              target="_blank"
              rel="noreferrer"
            >
              {i18n.t('about.bookmarksApi')}
            </a>
          </li>
        </ul>
      </section>
    </>
  );
}
