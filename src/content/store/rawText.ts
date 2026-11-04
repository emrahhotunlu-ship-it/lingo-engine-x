import { create } from 'zustand';
import list from 'virtual:lx-raw-list';
import { logError } from '../../platform/diagnostics';
import { fetchRawText } from './loadPacked';

// Großpaket C „schneller Start“ (04.11.2026, Plan Stufe 1 P9): Große JSON-Inhalte (`?raw`) stehen im Mehr-Datei-Build nicht mehr in der
// ersten Datei, sondern in wenigen Sammeldateien (`raw-*.txt`, scripts/vite-raw-json-zip.mjs). Jedes Modul, das einen solchen Text braucht,
// wartet per top-level await auf `rawTextReady(key)`; `loadRawTexts()` lädt beim Start alle Dateien parallel. Bis dahin zeigt die App das
// Startbild, kein Modul mit Inhalten läuft, also entsteht nie ein Plan aus halben Inhalten (W6, Kap. 15). `useScreen` und der Startknopf
// prüfen `ready` zusätzlich. Im Einzeldatei-Build und in Tests ist die Liste leer und alles sofort bereit.

/** Nach so langer Ladezeit ein ruhiger Hinweis mit „Neu laden“ (das Laden läuft weiter; Kap. 15: kein stummes Hängen). */
const SLOW_MS = 15_000;

const texts = new Map<string, string>();
const keys = Object.keys(list);

export const useRawReady = create<{ ready: boolean; failed: boolean }>(() => ({ ready: keys.length === 0, failed: false }));

let running: Promise<boolean> | null = null;

/** Alle Rohtext-Dateien parallel laden (einmal; nach einem Fehler startet der nächste Aufruf frisch, keine Schleife). */
export function loadRawTexts(): Promise<boolean> {
  if (useRawReady.getState().ready) return Promise.resolve(true);
  if (running) return running;
  const slow = setTimeout(() => showLoadNotice('slow'), SLOW_MS);
  running = (async () => {
    try {
      // Sammeldateien (scripts/vite-raw-json-zip.mjs): je Datei `{ key: text }`, jede Datei genau einmal.
      const files = [...new Set(keys.filter((k) => !texts.has(k)).map((k) => list[k]!))];
      await Promise.all(
        files.map(async (file) => {
          const doc = JSON.parse(await fetchRawText(file)) as Record<string, unknown>;
          for (const [k, v] of Object.entries(doc)) if (typeof v === 'string') texts.set(k, v);
        }),
      );
      const missing = keys.filter((k) => !texts.has(k));
      if (missing.length) throw new Error(`Inhalte fehlen nach dem Laden: ${missing.slice(0, 3).join(', ')}`);
      useRawReady.setState({ ready: true, failed: false });
      document.querySelector('[data-testid="raw-slow"]')?.remove();
      return true;
    } catch (err) {
      logError('content:raw', err);
      useRawReady.setState({ failed: true });
      return false;
    } finally {
      clearTimeout(slow);
      running = null;
    }
  })();
  return running;
}

/**
 * Text einer nachgeladenen Datei, sobald alle Sammeldateien da sind (vom Build-Plugin als `export default await rawTextReady(key)` benutzt).
 * Scheitert das Laden, zeigt die Seite einen schlichten Hinweis mit „Neu laden“ und wartet nicht weiter.
 */
export async function rawTextReady(key: string): Promise<string> {
  if (!(await loadRawTexts())) {
    showLoadNotice('failed');
    return new Promise<string>(() => undefined);
  }
  return texts.get(key) ?? '';
}

/**
 * Hinweis ohne React (die Module mit Inhalten laufen ja noch nicht). Vor dem ersten Zeichnen (Startbild `#lx-boot` steht) ersetzt „failed“
 * das Startbild; läuft die App schon, bleibt die Oberfläche stehen und `useScreen` zeigt „Verbindung verloren“ (`failed`).
 * „slow“ legt nur ein Band unten auf die Seite.
 */
function showLoadNotice(kind: 'slow' | 'failed'): void {
  const root = document.getElementById('root');
  if (!root || document.querySelector('[data-testid="raw-failed"]')) return;
  const booting = !!document.getElementById('lx-boot') || !root.hasChildNodes();
  if (kind === 'failed' && !booting) return;
  if (kind === 'slow' && (!booting || document.querySelector('[data-testid="raw-slow"]'))) return;
  const en = document.documentElement.lang === 'en';
  const box = document.createElement('div');
  box.setAttribute('role', kind === 'failed' ? 'alert' : 'status');
  box.setAttribute('data-testid', kind === 'failed' ? 'raw-failed' : 'raw-slow');
  box.style.cssText =
    kind === 'failed'
      ? 'max-width:28rem;margin:4rem auto;padding:1.5rem;font:16px/1.5 system-ui,sans-serif;text-align:center'
      : 'position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);max-width:calc(100% - 2rem);padding:.75rem 1rem;border-radius:1rem;background:rgba(20,22,20,.92);color:#f5f3ee;font:15px/1.4 system-ui,sans-serif;text-align:center;z-index:9999';
  const p = document.createElement('p');
  p.textContent =
    kind === 'failed'
      ? en
        ? 'The app could not finish loading. Please check your connection.'
        : 'Die App konnte nicht fertig laden. Bitte prüfe die Verbindung.'
      : en
        ? 'Loading is taking longer than usual.'
        : 'Das Laden dauert länger als üblich.';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = en ? 'Reload' : 'Neu laden';
  b.style.cssText = `margin-top:${kind === 'failed' ? '1rem' : '.5rem'};padding:.6rem 1.2rem;border-radius:999px;border:1px solid currentColor;background:none;color:inherit;font:inherit`;
  b.addEventListener('click', () => window.location.reload());
  box.append(p, b);
  if (kind === 'failed') {
    document.querySelector('[data-testid="raw-slow"]')?.remove();
    root.replaceChildren(box);
  } else document.body.append(box);
}

/** Sind alle Rohtexte da? (für nicht-React-Aufrufer, z. B. den Startknopf) */
export const rawReadyNow = (): boolean => useRawReady.getState().ready;
