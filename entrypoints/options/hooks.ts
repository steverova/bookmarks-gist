import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUTO_LOCALE, resolveLocale, setLocale } from '@/lib/i18n';
import { send, type AppState } from '@/lib/messaging';
import * as settings from '@/lib/settings';
import type { SyncOptions } from '@/lib/settings';

interface StoredItem {
  getValue(): Promise<string>;
  setValue(value: string): Promise<void>;
}

/** Estado general expuesto por el background. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);

  const refresh = useCallback(async () => {
    const response = await send({ kind: 'get-state' });
    if (response.kind === 'state') setState(response.state);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, refresh };
}

/** Campo de texto con autoguardado en storage. */
export function useStoredField(item: StoredItem, delay = 400) {
  const [value, setValue] = useState('');
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const lastPersisted = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void item.getValue().then((stored) => {
      if (!active) return;
      setValue(typeof stored === 'string' ? stored : String(stored ?? ''));
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [item]);

  useEffect(() => {
    if (!ready) return;
    if (lastPersisted.current === null) {
      lastPersisted.current = value;
      return;
    }
    if (lastPersisted.current === value) return;

    const timer = setTimeout(() => {
      void item.setValue(value).then(() => {
        lastPersisted.current = value;
        setSaved(true);
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [item, value, ready, delay]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [saved]);

  return { value, setValue, ready, saved };
}

/** Opciones de sincronización persistidas. */
export function useSyncOptions() {
  const [options, setOptions] = useState<SyncOptions | null>(null);

  useEffect(() => {
    void settings.syncOptions.getValue().then(setOptions);
  }, []);

  const update = useCallback(async (patch: Partial<SyncOptions>) => {
    const current = await settings.syncOptions.getValue();
    const next = { ...current, ...patch };
    await settings.syncOptions.setValue(next);
    setOptions(next);
  }, []);

  return { options, update };
}

/** Preferencia de idioma (`auto` o un código) con aplicación inmediata. */
export function useLocalePreference() {
  const [preference, setPreference] = useState<string>(AUTO_LOCALE);

  useEffect(() => {
    void settings.locale.getValue().then(setPreference);
  }, []);

  const update = useCallback(async (code: string) => {
    await settings.locale.setValue(code);
    setLocale(resolveLocale(code));
    setPreference(code);
  }, []);

  return { preference, update };
}

/** Devuelve el nombre de cada idioma en el idioma activo («Portugués (Brasil)»). */
export function useLanguageNames(locale: string) {
  return useMemo(() => {
    let displayNames: Intl.DisplayNames | null = null;
    try {
      displayNames = new Intl.DisplayNames([locale.replaceAll('_', '-')], {
        type: 'language',
      });
    } catch {
      displayNames = null;
    }

    return (code: string): string => {
      if (!displayNames) return code;
      try {
        return displayNames.of(code.replaceAll('_', '-')) ?? code;
      } catch {
        return code;
      }
    };
  }, [locale]);
}
