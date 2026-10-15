/** Formateo para la UI. */
import { i18n, intlLocale } from './i18n';

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(intlLocale());
}

export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return i18n.t('time.never');

  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return i18n.t('time.seconds');

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return i18n.t('time.minutes', minutes);

  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t('time.hours', hours);

  return i18n.t('time.days', Math.round(hours / 24));
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(intlLocale());
}

export function shortRevision(revision: string | null | undefined): string {
  return revision ? revision.slice(0, 7) : i18n.t('common.na');
}
