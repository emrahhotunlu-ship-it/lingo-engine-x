import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure, type AiMessageKey, type AiPhase, type PromptTemplate } from '../../ai/types';
import type { InputRoute, TabName } from '../../app/nav';
import { logError, logWarn } from '../../platform/diagnostics';

// KI-Korrekturen als App-Aufgabe (M14, Funktionsabgleich): Schreiben, Lesezusammenfassung und
// Anwenden laufen beim Bildschirmwechsel WEITER, damit Emrah nicht 20–40 s warten muss.
// Abbruch nur per Stopp-Knopf oder beim Verlassen der Seite (`pagehide`). Das Ergebnis wird
// gespeichert; ein ruhiger Hinweis „Korrektur fertig · Ansehen" führt zurück.
// Jeder Start ist eine ausdrückliche Handlung (Abgeben/Prüfen lassen), nie ein Timer (sample.d.ts).

export type AiTaskKind = 'write' | 'read' | 'discover';

export type AiTask = {
  key: string;
  kind: AiTaskKind;
  route: InputRoute;
  phase: AiPhase;
  status: 'running' | 'done' | 'error';
  error: AiMessageKey | null;
  /** Der Nutzer hat das Ergebnis gesehen (Hinweis ausblenden). */
  seen: boolean;
  startedAt: number;
  /** Geprüftes Ergebnis (nur im Speicher; maßgeblich ist, was `save` gespeichert hat). */
  data?: unknown;
};

type TaskStore = { tasks: Readonly<Record<string, AiTask>> };

export const useAiTasks = create<TaskStore>(() => ({ tasks: {} }));

const controllers = new Map<string, AbortController>();

function setTask(key: string, patch: Partial<AiTask>): void {
  useAiTasks.setState((s) => {
    const cur = s.tasks[key];
    if (!cur) return s;
    return { tasks: { ...s.tasks, [key]: { ...cur, ...patch } } };
  });
}

function removeTask(key: string): void {
  useAiTasks.setState((s) => {
    if (!(key in s.tasks)) return s;
    const next = { ...s.tasks };
    delete next[key];
    return { tasks: next };
  });
}

export const isRunning = (t: AiTask | undefined): boolean => !!t && t.status === 'running';

/**
 * Reiter mit laufender KI-Korrektur (M13, Ladepunkt): Pflicht-Einheiten an „Heute", freiwillige
 * Lesen/Schreiben-Einheiten und Entdecken-Beiträge an „Lesen" (Neubau-Rahmen, 4 Reiter).
 */
export function runningTabs(tasks: Readonly<Record<string, AiTask>>): Set<TabName> {
  const out = new Set<TabName>();
  for (const t of Object.values(tasks)) {
    if (t.status !== 'running') continue;
    const r = t.route;
    // Ohne Reiter „Lesen“ (seit 04.10.2026) zeigt nur noch „Heute“ den Ladepunkt.
    if ('ctx' in r && r.ctx === 'duty') out.add('today');
  }
  return out;
}

/**
 * Startet eine Korrektur. `save` speichert das Ergebnis (Datenbank) – erst danach gilt die
 * Aufgabe als fertig. Ein zweiter Start mit demselben Schlüssel bricht den ersten ab.
 */
export async function startAiTask<V, O>(i: {
  key: string;
  kind: AiTaskKind;
  route: InputRoute;
  template: PromptTemplate<V, O>;
  vars: V;
  save: (data: O) => Promise<void>;
}): Promise<O | null> {
  // Neuversuch nach einem Fehler (gleicher Schlüssel): Zwischenspeicher von `sample` einmal übergehen.
  const refresh = useAiTasks.getState().tasks[i.key]?.status === 'error';
  controllers.get(i.key)?.abort();
  const ctl = new AbortController();
  controllers.set(i.key, ctl);
  installPageHide();
  useAiTasks.setState((s) => ({
    tasks: { ...s.tasks, [i.key]: { key: i.key, kind: i.kind, route: i.route, phase: 'queued', status: 'running', error: null, seen: false, startedAt: Date.now() } },
  }));
  const mine = () => controllers.get(i.key) === ctl;
  try {
    const r = await askJson({
      template: i.template,
      vars: i.vars,
      signal: ctl.signal,
      refresh,
      onPhase: (p) => {
        if (mine() && p !== 'done' && p !== 'error') setTask(i.key, { phase: p });
      },
    });
    if (!mine()) return null;
    await i.save(r.data);
    if (mine()) setTask(i.key, { phase: 'done', status: 'done', data: r.data });
    return r.data;
  } catch (err) {
    if (!mine()) return null;
    if (isAiFailure(err) && err.kind === 'cancelled') {
      removeTask(i.key);
      return null;
    }
    if (!isAiFailure(err)) logError('input:aitask', err, i.key);
    else logWarn('input:aitask', { code: err.code, message: err.message }, i.key);
    setTask(i.key, { phase: 'error', status: 'error', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
    return null;
  } finally {
    if (mine()) controllers.delete(i.key);
  }
}

/** Stopp-Knopf: bricht ab, ohne etwas zu speichern. */
export function stopAiTask(key: string): void {
  controllers.get(key)?.abort();
}

export function markTaskSeen(key: string): void {
  const t = useAiTasks.getState().tasks[key];
  if (t && !t.seen && t.status !== 'running') setTask(key, { seen: true });
}

export function dismissTask(key: string): void {
  removeTask(key);
}

let pageHideInstalled = false;
function installPageHide(): void {
  if (pageHideInstalled || typeof window === 'undefined') return;
  pageHideInstalled = true;
  // Beim Verlassen der Seite nichts mehr anfragen (die Antwort käme ohnehin nicht mehr an).
  window.addEventListener('pagehide', () => {
    controllers.forEach((c) => c.abort());
  });
}

/** Nur für Tests. */
export function resetAiTasks(): void {
  controllers.forEach((c) => c.abort());
  controllers.clear();
  useAiTasks.setState({ tasks: {} });
}
