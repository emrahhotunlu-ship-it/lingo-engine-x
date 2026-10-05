import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure, type AiMessageKey } from '../../ai/types';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { readDoc } from '../../data/reads';
import { allowedActions } from '../../domain/assessment/actions';
import { assessDue, type DueReason } from '../../domain/assessment/due';
import { assessWrite, readAssess, readAssessData, type AssessResult } from '../../domain/assessment/envelope';
import { buildEvidence, evidenceText } from '../../domain/assessment/evidence';
import { allStrengths } from '../../domain/assessment/strength';
import { finalizeAssess } from '../../domain/assessment/validate';
import { addDays, dayKey } from '../../domain/date';
import { errorsOf } from '../../domain/grammar/errors';
import { mergedVocab } from '../../domain/overview';
import { assess as assessTemplate } from '../../prompts/assess';
import { getDb, getSample, useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import type { Db } from '../../platform/types';
import { tabId } from './persist';

// Ablauf der KI-Einschätzung (Plan §4.5) als App-Aufgabe mit eigenem Controller: Ein Wechsel
// des Reiters bricht sie nicht ab (E7), nur der Stopp-Knopf und `pagehide`. Auslöser sind
// Handlungen (Reiter „Dein Stand", Pflicht erledigt, Knopf), nie ein Timer (Plan W1).
// Doppellauf auf zwei Geräten verhindern `acquire` (240 s) und `run.d` (einmal je Lerntag).
// Kein automatischer zweiter Versuch: Nach einem Fehler bleibt der alte Stand, der Knopf bleibt.

type Doc = Record<string, unknown>;

export type AssessPhase = 'idle' | 'locking' | 'gathering' | 'asking' | 'saving' | 'done' | 'error' | 'busy';

type RunState = {
  phase: AssessPhase;
  /** KI-Phase während `asking` (für „Denkt nach …"/„dauert länger"). */
  aiPhase: 'thinking' | 'streaming' | 'slow' | 'queued' | null;
  error: AiMessageKey | 'assessFailed' | null;
  /** Anzahl der Antworten, die gerade ausgewertet werden (Anzeige). */
  answers: number;
  /** Tag, an dem in diesem Tab schon automatisch gestartet wurde. */
  autoDay: string | null;
};

export const useAssessRun = create<RunState>(() => ({ phase: 'idle', aiPhase: null, error: null, answers: 0, autoDay: null }));

let ctl: AbortController | null = null;
let hideInstalled = false;

// Sperre auf `app/assess` (db `acquire`): kurze Laufzeit, während des Aufrufs alle 60 s mit
// derselben Kennung verlängert (db.d.ts „renew while working", Befund H6). Läuft von selbst ab.
const LEASE_MS = 180_000;
const RENEW_MS = 60_000;
const LOG_DAYS = 14;

function installHide(): void {
  if (hideInstalled || typeof window === 'undefined') return;
  hideInstalled = true;
  window.addEventListener('pagehide', () => ctl?.abort());
}

/** Höchstens `n` Lesevorgänge gleichzeitig (Plan §4.5: parallel höchstens 4 `get()`). */
async function inPool<T, R>(items: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function safeDoc(db: Db, path: string): Promise<Doc | null> {
  try {
    const r = await readDoc(db, path);
    return r.status === 'valid' ? r.doc : null;
  } catch (err) {
    logWarn('assess:read', err, path);
    return null;
  }
}

/** Ist die KI in dieser Ansicht nutzbar (Fähigkeit bereit, nicht abgelehnt)? */
export function aiUsable(): boolean {
  const c = useCapabilities.getState();
  return c.sample === 'ready' && !c.sampleRevoked && !!getSample();
}

/** Grund für einen automatischen Lauf jetzt (ohne Lesen weiterer Dokumente). */
export function dueNow(nowMs: number): DueReason {
  const live = useLive.getState();
  const profile = live.docs['app/profile'] ?? {};
  const a = readAssess(live.docs['app/assess']);
  const today = dayKey(nowMs);
  return assessDue({
    assess: a,
    uiLang: useSettings.getState().lang,
    today,
    profileAnswers: typeof profile.answers === 'number' ? profile.answers : 0,
    lastAutoDay: useAssessRun.getState().autoDay === today ? today : (a?.runDay ?? null),
  });
}

/**
 * Automatischer Auslöser (Reiter „Dein Stand" geöffnet, Pflicht erledigt): höchstens einmal je
 * Lerntag und Tab, nur wenn `assessDue` einen Grund nennt.
 */
export async function maybeAutoAssess(nowMs: number): Promise<void> {
  const today = dayKey(nowMs);
  const s = useAssessRun.getState();
  if (s.autoDay === today || isRunning(s.phase) || !aiUsable()) return;
  if (useLive.getState().status !== 'ready') return;
  if (dueNow(nowMs) === 'none') return;
  await runAssess('auto', nowMs);
}

const isRunning = (p: AssessPhase) => p === 'locking' || p === 'gathering' || p === 'asking' || p === 'saving';

/** Stopp-Knopf: bricht den laufenden Aufruf ab; der alte Stand bleibt. */
export function stopAssess(): void {
  ctl?.abort();
}

/**
 * Eine Einschätzung erstellen. `manual` = Knopf „Neu einschätzen" (immer erlaubt, außer während
 * eines Laufs). Liefert das Ergebnis der Phase (für Tests).
 */
export async function runAssess(trigger: 'auto' | 'manual', nowMs: number = Date.now()): Promise<AssessPhase> {
  if (isRunning(useAssessRun.getState().phase)) return useAssessRun.getState().phase;
  const db = getDb();
  const writer = getWriter();
  if (!db || !writer || !aiUsable()) return 'idle';
  installHide();
  const today = dayKey(nowMs);
  const lang = useSettings.getState().lang;
  const live = useLive.getState();
  const startedAt = nowMs;
  if (trigger === 'auto') useAssessRun.setState({ autoDay: today });
  const c = new AbortController();
  ctl = c;
  let renew: ReturnType<typeof setInterval> | null = null;
  useAssessRun.setState({ phase: 'locking', aiPhase: null, error: null });

  try {
    const exists = live.docs['app/assess'] !== null && live.docs['app/assess'] !== undefined;
    if (exists) {
      const lease = await writer.acquire('app/assess', { holder: tabId(), ttlMs: LEASE_MS });
      if (!lease.acquired) {
        useAssessRun.setState({ phase: 'busy' });
        return 'busy';
      }
      renew = setInterval(() => {
        writer.acquire('app/assess', { holder: tabId(), ttlMs: LEASE_MS }).then(
          (r) => {
            if (!r.acquired) logWarn('assess:lease', { code: 'lease_lost', message: 'Sperre konnte nicht verlängert werden' }, 'app/assess');
          },
          (err: unknown) => logWarn('assess:lease', err, 'app/assess'),
        );
      }, RENEW_MS);
      // Tagessperre für den automatischen Lauf (auch für andere Geräte, Plan §4.5 Schritt 4).
      if (trigger === 'auto') await writer.update('app/assess', { run: { d: today, t: nowMs, by: tabId() } });
    }

    useAssessRun.setState({ phase: 'gathering' });
    const profile = live.docs['app/profile'] ?? {};
    const grammar = live.collections.grammar ?? new Map<string, Doc>();
    const vocab = mergedVocab(live.collections.vocab ?? new Map());
    const days = Array.from({ length: LOG_DAYS }, (_, k) => addDays(today, -k));
    const radar = await safeDoc(db, 'app/radar');
    const logDocs = await inPool(days, 4, (d) => safeDoc(db, `log/${d}`));
    const logs = new Map<string, Doc>();
    days.forEach((d, k) => {
      const doc = logDocs[k];
      if (doc) logs.set(d, doc);
    });
    const prev = readAssess(live.docs['app/assess']);
    const pack = buildEvidence({ nowMs, today, profile, grammar, radar, vocab, logs, prev });
    const errorTopics = [...grammar.entries()].filter(([, d]) => errorsOf(d).some((e) => e.done !== true)).map(([id]) => id);
    // Kein Kurs mehr: keine Lektion als Üben-Aktion.
    const allowed = allowedActions({ errorTopics, nextLesson: null });
    const answers = typeof profile.answers === 'number' ? profile.answers : 0;
    useAssessRun.setState({ phase: 'asking', answers: pack.counts.answers14 || answers });

    const res = await askJson({
      template: assessTemplate,
      vars: {
        lang,
        evidence: evidenceText(pack),
        ids: pack.ids,
        allowed,
        prev: prev ? { cefr: prev.data.cefr, dims: Object.fromEntries(prev.data.dims.map((d) => [d.id, d.level])) } : null,
        today,
      },
      signal: c.signal,
      priority: 'background',
      onPhase: (p) => {
        if (ctl !== c) return;
        if (p === 'thinking' || p === 'streaming' || p === 'slow' || p === 'queued') useAssessRun.setState({ aiPhase: p });
      },
    });

    useAssessRun.setState({ phase: 'saving', aiPhase: null });
    const data = finalizeAssess(readAssessData(res.data), allStrengths(pack.counts));
    const result: AssessResult = {
      day: today,
      t: Date.now(),
      lang,
      answers,
      // Zähler der alten Hülle (Texte): nicht mehr gezählt, der bisherige Wert bleibt stehen (Kap. 9).
      writings: prev?.writings ?? 0,
      tier: res.tierApplied,
      basis: {
        answers14: pack.counts.answers14,
        grammarN: pack.counts.grammarN,
        vtestD: pack.counts.vtestD,
      },
      data,
    };
    await writer.transform('app/assess', (cur) => assessWrite(cur, result, startedAt));
    if (ctl === c) useAssessRun.setState({ phase: 'done' });
    return 'done';
  } catch (err) {
    if (isAiFailure(err) && err.kind === 'cancelled') {
      if (ctl === c) useAssessRun.setState({ phase: 'idle', aiPhase: null });
      return 'idle';
    }
    const key = isAiFailure(err) ? (err.messageKey ?? 'assessFailed') : 'assessFailed';
    if (!isAiFailure(err)) logError('assess:run', err);
    if (ctl === c) useAssessRun.setState({ phase: 'error', aiPhase: null, error: key });
    return 'error';
  } finally {
    if (renew) clearInterval(renew);
    if (ctl === c) ctl = null;
  }
}

/** Nur für Tests. */
export function resetAssessRunForTests(): void {
  ctl?.abort();
  ctl = null;
  useAssessRun.setState({ phase: 'idle', aiPhase: null, error: null, answers: 0, autoDay: null });
}
