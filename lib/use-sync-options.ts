/** Hook de React para leer y actualizar las opciones de sincronización. */
import { useCallback, useEffect, useState } from 'react';
import * as settings from './settings';
import { withDefaultSyncOptions, type SyncOptions } from './settings';

export function useSyncOptions() {
  const [options, setOptions] = useState<SyncOptions | null>(null);

  useEffect(() => {
    let active = true;
    void settings.syncOptions.getValue().then((stored) => {
      if (active) setOptions(withDefaultSyncOptions(stored));
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(async (patch: Partial<SyncOptions>) => {
    const current = await settings.syncOptions.getValue();
    const next = { ...withDefaultSyncOptions(current), ...patch };
    await settings.syncOptions.setValue(next);
    setOptions(next);
  }, []);

  return { options, update };
}
