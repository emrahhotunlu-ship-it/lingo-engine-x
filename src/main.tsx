import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';
import { initDiagnostics, logContext, logError, logWarn } from './platform/diagnostics';
import { applyDocumentSettings, resolveTheme, useSettings } from './app/settings';
import { startC1xPreload } from './features/c1x/ready';

/** Komponenten-Stapel kurz fürs Protokoll. */
const stackOf = (info: { componentStack?: string | null }): string => (info.componentStack ?? '').split('\n').slice(0, 6).join(' ‹ ').replace(/\s+/g, ' ').trim();

async function boot(): Promise<void> {
  // Messpunkt (P7-1): Skript geladen und ausgewertet, erstes Zeichnen folgt.
  performance.mark('lx:boot');
  initDiagnostics();
  // Gepackte c1x-Inhalte laden; der Start wartet darauf nur, wenn eine Aufgabenart eingeschaltet ist (`useScreen`).
  startC1xPreload();
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
  // Wurzel-Ebene der Fehlergrenzen (architektur.md §3.1 Nr. 1): Was keine Grenze fängt, landet
  // sofort im Diagnose-Protokoll (mit Route). Gefangene Fehler protokolliert die Grenze selbst.
  createRoot(root, {
    onUncaughtError: (err, info) => logError('react:uncaught', err, [logContext(), stackOf(info)].filter(Boolean).join(' · ')),
    onCaughtError: () => undefined,
    onRecoverableError: (err, info) => logWarn('react:recoverable', err, stackOf(info)),
  }).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((err: unknown) => logError('boot', err));
