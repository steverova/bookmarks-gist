import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { refreshLocale } from '@/lib/i18n';
import 'water.css/out/water.min.css';
import '@/assets/app.css';
import { App } from './App';

// Se espera a leer el idioma guardado antes de pintar, para no parpadear.
void refreshLocale().then(() => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
