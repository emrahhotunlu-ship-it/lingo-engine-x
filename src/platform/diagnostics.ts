import { measureKeyboard, recordKeyboardProbe } from './inputCore';
import { local, setStorageReporter, KEY_PREFIX } from './storage';

// Fehlerprotokoll (Kap. 3.4): Jeder Fehler wird hier protokolliert und ist in den
// Einstellungen unter „Diagnose" lesbar. Die letzten Einträge überleben ein Neuladen.

export type LogLevel = 'error' | 'warn' | 'info';

export type LogEntry = {
  id: number;
  t: number;
  level: LogLevel;
  scope: string;
  code?: string;
  message: string;
  detail?: string;
};

const MAX_ENTRIES = 200;
const PERSIST_ENTRIES = 50;
const PERSIST_KEY = `${KEY_PREFIX}diag`;

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

/** Liest `code` und `message` aus beliebigen Fehlerformen (DbError, SampleError, Error). */
export function describeError(err: unknown): { code?: string; message: string } {
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const code = typeof rec.code === 'string' ? rec.code : undefined;
    const message =
      typeof rec.message === 'string' && rec.message
        ? rec.message
        : err instanceof Error
          ? err.name
          : JSON.stringify(rec).slice(0, 300);
    return code === undefined ? { message } : { code, message };
  }
  return { message: String(err) };
}

function persist(): void {
  // Direkt über localStorage-Hülle; ein Fehler hier wird nur im Speicher vermerkt,
  // damit Protokollieren nie selbst eine Fehlerschleife auslöst.
  const ok = local.set(PERSIST_KEY, JSON.stringify(entries.slice(-PERSIST_ENTRIES)));
  if (!ok) pushEntry({ level: 'warn', scope: 'diagnostics:persist', message: 'Protokoll konnte nicht lokal gesichert werden' }, false);
}

function pushEntry(e: Omit<LogEntry, 'id' | 't'>, save: boolean): LogEntry {
  const entry: LogEntry = { ...e, id: nextId++, t: Date.now() };
  entries = [...entries, entry].slice(-MAX_ENTRIES);
  if (save) persist();
  listeners.forEach((fn) => fn());
  return entry;
}

export function log(level: LogLevel, scope: string, err: unknown, detail?: string): LogEntry {
  const d = describeError(err);
  const entry: Omit<LogEntry, 'id' | 't'> = { level, scope, message: d.message };
  if (d.code !== undefined) entry.code = d.code;
  if (detail !== undefined) entry.detail = detail;
  if (level === 'error') console.error(`[${scope}]`, d.code ?? '', d.message, detail ?? '');
  return pushEntry(entry, true);
}

export const logError = (scope: string, err: unknown, detail?: string): LogEntry => log('error', scope, err, detail);
export const logWarn = (scope: string, err: unknown, detail?: string): LogEntry => log('warn', scope, err, detail);
export const logInfo = (scope: string, message: string, detail?: string): LogEntry => log('info', scope, { message }, detail);

export function getLog(): readonly LogEntry[] {
  return entries;
}

export function subscribeLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearLog(): void {
  entries = [];
  persist();
  listeners.forEach((fn) => fn());
}

/** Beim Start: gespeicherte Einträge zurückholen und globale Fehler abfangen. */
export function initDiagnostics(): void {
  setStorageReporter((scope, err, detail) => {
    const d = describeError(err);
    pushEntry({ level: 'warn', scope, message: d.message, ...(detail === undefined ? {} : { detail }) }, false);
  });
  const saved = local.getJson<LogEntry[]>(PERSIST_KEY);
  if (Array.isArray(saved)) {
    entries = saved.filter((e) => e && typeof e.message === 'string').slice(-PERSIST_ENTRIES);
    nextId = entries.reduce((m, e) => Math.max(m, e.id + 1), 1);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => {
      logError('window:error', ev.error ?? { message: ev.message }, withContext(`${ev.filename}:${ev.lineno}`));
    });
    window.addEventListener('unhandledrejection', (ev) => {
      logError('window:unhandledrejection', ev.reason, withContext(undefined));
    });
    probeKeyboardOnFirstFocus();
  }
}

// Tastatur im claude.ai-Rahmen (Lernplattform 2.0 §6): Beim ersten Fokus eines Textfelds schreibt die
// Diagnose eine Zeile mit Rahmen (iframe), Fensterhöhe, sichtbarer Höhe 400 ms nach dem Fokus und dem
// Tastaturabstand. Emrah liest sie einmal am iPhone ab; `needsInlineCheck` (platform/input) nutzt das Ergebnis.
function probeKeyboardOnFirstFocus(): void {
  let done = false;
  const onFocus = (ev: FocusEvent): void => {
    const el = ev.target as HTMLElement | null;
    if (done || !el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    done = true;
    document.removeEventListener('focusin', onFocus, true);
    window.setTimeout(() => {
      const p = measureKeyboard();
      recordKeyboardProbe(p);
      logInfo('keyboard:probe', `iframe ${p.iframe ? 'ja' : 'nein'} · innerHeight ${p.innerHeight} · visualViewport ${p.viewportHeight ?? '–'} · Abstand ${p.inset ?? '–'}`);
    }, 400);
  };
  document.addEventListener('focusin', onFocus, true);
}

// ---------------------------------------------------------------- Kontext (Neubau WP0b, leistung.md §6)
// Globale Fehler (außerhalb des Renderns) bekommen die aktuelle Route und Position mit ins
// Protokoll. Der Rahmen meldet eine Lesefunktion an; die Diagnose importiert nichts aus dem Rahmen.
// Jeder Eintrag wird wie bisher SOFORT lokal gesichert (`persist` in `log`) und überlebt so ein
// anschließendes Neuladen.

let context: (() => string | null) | null = null;

/** Liefert die aktuelle Route/Position als kurzen Text (z. B. `trainer?round=extra · Karte 7/20`). */
export function setLogContext(fn: (() => string | null) | null): void {
  context = fn;
}

function withContext(detail: string | undefined): string | undefined {
  let ctx: string | null = null;
  try {
    ctx = context?.() ?? null;
  } catch (err) {
    pushEntry({ level: 'warn', scope: 'diagnostics:context', message: describeError(err).message }, false);
  }
  if (!ctx) return detail;
  return detail ? `${detail} · ${ctx}` : ctx;
}

/** Aktueller Kontext (für Grenzen und `runAction`). */
export function logContext(): string | undefined {
  return withContext(undefined);
}
