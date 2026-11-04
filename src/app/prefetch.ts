import { loadHome, loadOverview, loadScreens, loadWordPage } from '../modules/vocab/api';
import { logWarn } from '../platform/diagnostics';

// Emrah 04.11.2026 („Ladezeiten extrem lange bei den Bildschirmen“): Die Teil-Dateien der häufigen Bildschirme (Wörter-Reiter, Wörter-Runde,
// Wort-Seite, Übersicht) wurden erst beim ersten Öffnen über das Netz geholt – am Handy jedes Mal Sekunden. Jetzt lädt die App sie einmal im
// Leerlauf nach dem Start vor; beim Öffnen sind sie schon da. Nur Laden (keine Ausführung von Bildschirm-Code, keine Schreibvorgänge).

let done = false;

export function prefetchScreens(): void {
  if (done) return;
  done = true;
  const run = () => {
    for (const load of [loadHome, loadScreens, loadWordPage, loadOverview]) {
      load().catch((err: unknown) => logWarn('prefetch', err));
    }
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}
