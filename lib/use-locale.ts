/** Hook de React para re-renderizar cuando cambia el idioma. */
import { useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale } from './i18n';

export function useLocale(): string {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
