/** Opciones del selector de modo, compartidas por el popup y el panel. */
import type { SyncMode } from './settings';

export interface SyncModeOption {
  id: SyncMode;
  key: 'main.modeFull' | 'main.modePull' | 'main.modePush';
}

export const SYNC_MODE_OPTIONS: SyncModeOption[] = [
  { id: 'full', key: 'main.modeFull' },
  { id: 'pull', key: 'main.modePull' },
  { id: 'push', key: 'main.modePush' },
];

/** Etiqueta corta del modo, para sitios con poco espacio (p. ej. el popup). */
export const SYNC_MODE_SHORT_KEYS: Record<
  SyncMode,
  'main.modeFullShort' | 'main.modePullShort' | 'main.modePushShort'
> = {
  full: 'main.modeFullShort',
  pull: 'main.modePullShort',
  push: 'main.modePushShort',
};
