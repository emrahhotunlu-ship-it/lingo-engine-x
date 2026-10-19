import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { buildLearnerModel, type LearnerModel } from '../../domain/tutor/learner';
import { lintTask } from '../../domain/tutor/lintTask';
import type { GrammarTask } from '../../domain/learn/types';
import { getDb } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { loadSources } from './diagnoseStore';

// Lernermodell in der Übung (Tutor-Engine v3 §3.1/§6.2): gerechnet nur bei Rundenstart (erste Aufgabe) und bei jeder Rückmeldung, und zwar
// verzögert (nach dem Zeichnen), damit weder „Prüfen“ noch das Urteil warten. Die Rückmeldung nimmt das zuletzt fertige Modell; fehlt es noch,
// gilt als Beleg für „Nicht verwechseln“ nur die Ursache `confuse` in dieser Antwort (`contrastProof`).
// Quellen: Live-Daten (Grammatik, Vokabeln, Profil), das heutige Protokoll aus dem Tages-Abo und – einmal je Tag, nach dem ersten Zeichnen –
// die Protokolle der letzten 56 Lerntage per `get()` (vergangene Tage werden je Ansicht nur einmal gelesen, `loadSources`). Erst damit gibt es
// die 28-Tage-Quote, Fehlerannahmen aus dem Protokoll und Fortschrittsbelege; bis dahin rechnet das Modell ohne sie. `act/` fehlt hier.
// Das Modell speichert je Dokument zwischen (`learner.ts`), ein zweiter Lauf ist billig.

type Doc = Record<string, unknown>;

let last: LearnerModel | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;
let pastLogs: { day: string; logs: Map<string, Doc> } | null = null;
let loading: string | null = null;

/** Das zuletzt fertige Modell, reaktiv (Rundenende, „Warum diese Aufgabe?“). */
export const useLearner = create<{ model: LearnerModel | null }>(() => ({ model: null }));

/** Das zuletzt fertige Modell (oder `null`). */
export const learnerNow = (): LearnerModel | null => last;

function logsNow(today: string): Map<string, Doc> {
  const out = new Map<string, Doc>(pastLogs && pastLogs.day === today ? pastLogs.logs : []);
  const d = useLive.getState().day;
  if (d && d.key === today && d.doc) out.set(today, d.doc);
  return out;
}

/** Das Modell sofort rechnen (synchron). Nur dort, wo schon gezeichnet ist (Tipp auf „Warum?“) – nie vor dem ersten Zeichnen. */
export function computeLearnerNow(): LearnerModel | null {
  if (pending !== null) clearTimeout(pending);
  pending = null;
  const s = useLive.getState();
  const today = useClock.getState().today;
  try {
    last = buildLearnerModel(
      { grammarDocs: s.collections.grammar ?? new Map(), logs: logsNow(today), vocab: s.collections.vocab ?? new Map(), act: new Map(), profile: s.docs['app/profile'] ?? null, diag: [] },
      Date.now(),
    );
    useLearner.setState({ model: last });
  } catch (err) {
    logWarn('tutor:learner', err, 'buildLearnerModel');
  }
  return last;
}

/** Protokolle der letzten 56 Tage einmal je Tag lesen (im Hintergrund); danach neu rechnen. */
function loadLogsOnce(): void {
  const today = useClock.getState().today;
  if ((pastLogs && pastLogs.day === today) || loading === today) return;
  const db = getDb();
  if (!db) return;
  loading = today;
  loadSources(db, today).then(
    (src) => {
      loading = null;
      const logs = new Map(src.logs);
      logs.delete(today);
      pastLogs = { day: today, logs };
      scheduleLearner();
    },
    (err: unknown) => {
      loading = null;
      logWarn('tutor:learner', err, 'log');
    },
  );
}

/** Neu rechnen, sobald der Browser Zeit hat (höchstens ein Lauf in der Warteschlange). */
export function scheduleLearner(): void {
  if (pending !== null) return;
  pending = setTimeout(() => {
    pending = null;
    computeLearnerNow();
    loadLogsOnce();
  }, 0);
}

/** Nur für Tests: Zustand zurücksetzen. */
export function resetLearnerLive(): void {
  if (pending !== null) clearTimeout(pending);
  pending = null;
  last = null;
  pastLogs = null;
  loading = null;
  useLearner.setState({ model: null });
}

const linted = new Set<string>();
let lintCount = 0;

/**
 * Aufgaben-Prüfung `lintTask` (§4.2) als Warnzähler im Diagnoseprotokoll: je Aufgabe höchstens einmal je Sitzung, nie eine Sperre.
 * Gibt die Befunde zurück (für Tests).
 */
export function lintOnce(task: GrammarTask): readonly string[] {
  const k = `${task.topic}|${task.key}`;
  if (linted.has(k)) return [];
  linted.add(k);
  let issues: readonly string[];
  try {
    issues = lintTask(task);
  } catch (err) {
    logWarn('tutor:lint', err, k);
    return [];
  }
  if (issues.length) {
    lintCount++;
    logWarn('tutor:lint', { message: `lintTask: ${issues.join(', ')}` }, `${k} · #${lintCount}`);
  }
  return issues;
}
