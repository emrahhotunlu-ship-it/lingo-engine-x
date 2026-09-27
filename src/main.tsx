import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';
import { initDiagnostics, logError } from './platform/diagnostics';
import { applyDocumentSettings, resolveTheme, useSettings } from './app/settings';

async function boot(): Promise<void> {
  // Messpunkt (P7-1): Skript geladen und ausgewertet, erstes Zeichnen folgt.
  performance.mark('lx:boot');
  initDiagnostics();
  // Entwicklungs-Adapter nur im Dev-Server; im Produktions-Build ist dieser Zweig
  // entfernt (import.meta.env.DEV === false) – scripts/check-platform.mjs prüft das.
  if (import.meta.env.DEV) {
    const { installFakeRuntime, optionsFromUrl } = await import('./platform/dev/install');
    installFakeRuntime(optionsFromUrl(window.location.search));
  }
  const s = useSettings.getState();
  applyDocumentSettings(s.lang, resolveTheme(s.theme, window.matchMedia('(prefers-color-scheme: light)').matches), s.palette);
  const root = document.getElementById('root');
  if (!root) throw new Error('#root fehlt');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((err: unknown) => logError('boot', err));
