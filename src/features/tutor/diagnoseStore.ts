import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { bgVerdict } from '../../ai/budget';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../ai/types';
import { flags } from '../../app/flags';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import type { Writer } from '../../data/writer';
import { useLive } from '../../data/live';
import { readDoc } from '../../data/reads';
import { addDays } from '../../domain/date';
import { confusionOf, evidenceText, newMappedErrors, type Confusion, type ConfusionSources } from '../../domain/tutor/confusion';
import { claimOp, diagState, finishOp, lastDone, readDiag, releaseOp, reportOp, weekOf, type DiagEntry, type DiagState } from '../../domain/tutor/diag';
import { diagnose } from '../../prompts/diagnose';
import { getDb } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import type { Db } from '../../platform/types';
import { aiUsable } from '../progress/assessRun';
import { tabId } from '../progress/persist';

// Wochen-Diagnose „Was du verwechselst“ (Lernplattform 3.0 P49, K-9/K-10). Hier liegt alles mit Nebenwirkung; die Rechnung steht rein in
// `domain/tutor/confusion.ts` und `domain/tutor/diag.ts`.
//
// Ablauf eines Laufs (genau ein Aufruf von `diagnose@1`, nie in einer Schleife, nie aus Render oder Timer):
//   1. Schalter, KI nutzbar, Daten fertig geladen (Snapshot), kein Lauf in dieser Ansicht.
//   2. `app/patterns` FRISCH lesen: Ergebnis dieser Woche da? gültige Beanspruchung eines Geräts? zu wenige neue Fehler? → kein Aufruf.
//   3. Hintergrund: Zustimmung bekannt und Tagesbudget frei (`bgVerdict`), sonst still kein Aufruf und KEINE Beanspruchung.
//   4. Kooperative Sperre (`acquire`, 15 s) auf `app/patterns`, dann Beanspruchung `{w, t, st:'pending', dev}` per `writer.transform` auf dem
//      frischen Stand. Nur wer sie bekommen hat, ruft auf. Bei Fehler oder Abbruch wird sie wieder freigegeben.
//   5. Ergebnis per `writer.transform` eintragen (`st:'done'`); gibt es dort schon ein Ergebnis dieser Woche, bleibt das erste.
// Auslöser: Rundenende (Hintergrund, `diagnose.slot.tsx`) und der Knopf auf der Karte (Nutzer). Fehlerweg nach A6.2/A6.3: ein automatischer
// Neuversuch nur bei Schemaverletzung (im KI-Tor), alles andere „Erneut versuchen“ durch den Nutzer.

type Doc = Record<string, unknown>;
export const PATTERNS_PATH = 'app/patterns';
const LEASE_MS = 15_000;
/** Protokolltage: das Fenster (28) und die 28 davor (Trend). */
const LOG_DAYS = 56;

export type DiagPhase = 'idle' | 'checking' | AiPhase | 'saving' | 'error';
type RunState = { phase: DiagPhase; error: AiMessageKey | null };
export const useDiagRun = create<RunState>(() => ({ phase: 'idle', error: null }));

export const isDiagRunning = (p: DiagPhase): boolean => p !== 'idle' && p !== 'error';

// ------------------------------------------------------------------ Lesen

const pastLogs = new Map<string, Doc | null>();
/** Nur für Tests. */
export function resetDiagnoseCache(): void {
  pastLogs.clear();
}

async function readLog(db: Db, day: string): Promise<Doc | null> {
  try {
    const r = await readDoc(db, `log/${day}`);
    return r.status === 'valid' ? r.doc : null;
  } catch (err) {
    logWarn('diagnose:read', err, `log/${day}`);
    return null;
  }
}

/**
 * Belegquellen frisch zusammenstellen: Grammatik und Fehlersätze aus den Live-Daten, die Tagesprotokolle der letzten 56 Lerntage per `get()`.
 * Vergangene Tage ändern sich nicht mehr und werden je Ansicht nur einmal gelesen; heute wird immer frisch gelesen. Höchstens 4 Lesevorgänge gleichzeitig.
 */
export async function loadSources(db: Db, today: string): Promise<ConfusionSources> {
  const days = Array.from({ length: LOG_DAYS }, (_, k) => addDays(today, -k));
  const got = new Map<string, Doc | null>();
  for (const d of days) if (d !== today && pastLogs.has(d)) got.set(d, pastLogs.get(d) ?? null);
  const todo = days.filter((d) => !got.has(d));
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < todo.length) {
      const d = todo[next++] as string;
      const doc = await readLog(db, d);
      got.set(d, doc);
      if (d !== today) pastLogs.set(d, doc);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
  const logs = new Map<string, Doc>();
  for (const d of days) {
    const doc = got.get(d);
    if (doc) logs.set(d, doc);
  }
  const live = useLive.getState();
  return { grammar: live.collections.grammar ?? null, logs, repair: live.docs['app/repair'] ?? null };
}

/** Hook für die Karte: Belege einmal je Öffnen und Tag lesen (kein Abo). */
export function useConfusion(enabled: boolean): { status: 'loading' | 'ready' | 'error'; confusion: Confusion | null; sources: ConfusionSources | null } {
  const today = useClock((s) => s.today);
  const db = getDb();
  const liveStatus = useLive((s) => s.status);
  const grammar = useLive((s) => s.collections.grammar);
  const repair = useLive((s) => s.docs['app/repair']);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; sources: ConfusionSources | null }>({ status: 'loading', sources: null });
  useEffect(() => {
    if (!enabled || !db || liveStatus !== 'ready') return;
    let alive = true;
    loadSources(db, today).then(
      (s) => {
        if (alive) setState({ status: 'ready', sources: s });
      },
      (err: unknown) => {
        logWarn('diagnose:load', err);
        if (alive) setState({ status: 'error', sources: null });
      },
    );
    return () => {
      alive = false;
    };
    // `grammar`/`repair` ändern sich nach jeder Antwort; die Karte liest nach einem Schreiben neu.
  }, [enabled, db, liveStatus, today, grammar, repair]);
  const confusion = state.sources ? confusionOf(state.sources, today) : null;
  return { status: state.status, confusion, sources: state.sources };
}

// ------------------------------------------------------------------ Lauf

let ctl: AbortController | null = null;
export const stopDiagnose = (): void => ctl?.abort();

export type RunResult = 'done' | 'skip' | 'busy' | 'error' | 'cancelled';

/** Zustand der Woche aus einem frischen Lesen von `app/patterns`. */
async function freshState(db: Db, sources: ConfusionSources, today: string, now: number): Promise<{ state: DiagState; entries: DiagEntry[]; last: DiagEntry | null }> {
  // Ohne frisches Lesen kein Aufruf (K-10): „nicht lesbar“ ist nie „noch keine Diagnose“, deshalb wird der Lesefehler weitergereicht.
  const r = await readDoc(db, PATTERNS_PATH).catch((err: unknown) => {
    logWarn('diagnose:read', err, PATTERNS_PATH);
    throw err;
  });
  const doc: Doc | null = r.status === 'valid' ? r.doc : null;
  const entries = readDiag(doc);
  const last = lastDone(entries);
  return { state: diagState(entries, today, now, newMappedErrors(sources, today, last?.t ?? 0)), entries, last };
}

/**
 * Die Woche beanspruchen (K-10): kooperative Sperre (`acquire`, kurz) und danach `transform` auf dem frischen Stand. Wahr nur, wenn DIESES Gerät
 * den `pending`-Eintrag geschrieben hat; ein anderes Gerät mit Sperre, ein Ergebnis dieser Woche oder eine gültige fremde Beanspruchung ergeben falsch.
 */
export async function claimWeek(writer: Writer, i: { w: string; dev: string; now: number; lang: string }): Promise<boolean> {
  const lease = await writer.acquire(PATTERNS_PATH, { holder: i.dev, ttlMs: LEASE_MS });
  if (!lease.acquired) return false;
  const box: { claimed: boolean } = { claimed: false };
  await writer.transform(PATTERNS_PATH, (cur) => {
    const r = claimOp(cur, i);
    box.claimed = r.claimed;
    return r.op;
  });
  return box.claimed;
}

/**
 * Wochen-Diagnose holen. `auto` = Hintergrund (Rundenende, Budget und Zustimmung gelten), `manual` = Knopf auf der Karte (Nutzer).
 * Liefert, was passiert ist; der Zustand für die Oberfläche steht in `useDiagRun`.
 */
export async function runDiagnose(o: { trigger: 'auto' | 'manual'; now?: number }): Promise<RunResult> {
  if (!flags.tutor.diagnose || isDiagRunning(useDiagRun.getState().phase)) return 'skip';
  const db = getDb();
  const writer = getWriter();
  if (!db || !writer || !aiUsable()) return 'skip';
  // Nur bei fertig geladenem Snapshot (K-10): sonst fehlen die Fehlerdaten und die Zählung wäre falsch.
  if (useLive.getState().status !== 'ready') return 'skip';
  const now = o.now ?? Date.now();
  const today = useClock.getState().today;
  const w = weekOf(today);
  const lang = useSettings.getState().lang;
  const c = new AbortController();
  ctl = c;
  const dev = tabId();
  let claimedAt = 0;
  useDiagRun.setState({ phase: 'checking', error: null });
  const release = async (): Promise<void> => {
    if (!claimedAt) return;
    const t = claimedAt;
    claimedAt = 0;
    try {
      await writer.transform(PATTERNS_PATH, (cur) => releaseOp(cur, { dev, t }));
    } catch (err) {
      logWarn('diagnose:release', err, PATTERNS_PATH);
    }
  };
  try {
    const sources = await loadSources(db, today);
    const fresh = await freshState(db, sources, today, now);
    if (fresh.state.kind !== 'due') {
      useDiagRun.setState({ phase: 'idle', error: null });
      return 'skip';
    }
    // Hintergrund: ohne bekannte Zustimmung oder ohne Tagesbudget gar nicht erst beanspruchen.
    if (o.trigger === 'auto' && bgVerdict(diagnose.id, diagnose.budget?.bgPerDay ?? 1, now) !== null) {
      useDiagRun.setState({ phase: 'idle', error: null });
      return 'skip';
    }
    if (!(await claimWeek(writer, { w, dev, now, lang }))) {
      useDiagRun.setState({ phase: 'idle', error: null });
      return 'busy';
    }
    claimedAt = now;
    const conf = confusionOf(sources, today);
    if (!conf.lines.length || !conf.ids.length) {
      await release();
      useDiagRun.setState({ phase: 'idle', error: null });
      return 'skip';
    }
    const prev = fresh.last?.out ? { headline: fresh.last.out.headline, titles: fresh.last.out.findings.map((f) => f.title) } : null;
    const r = await askJson({
      template: diagnose,
      vars: { lang, evidence: evidenceText(conf.lines), ids: conf.ids, allowed: conf.allowed, prev, today },
      signal: c.signal,
      priority: o.trigger === 'auto' ? 'background' : 'user',
      onPhase: (p) => {
        if (ctl === c) useDiagRun.setState({ phase: p });
      },
    });
    useDiagRun.setState({ phase: 'saving' });
    const t = claimedAt;
    await writer.transform(PATTERNS_PATH, (cur) => finishOp(cur, { dev, t, w, now: Date.now(), out: r.data, pv: `${diagnose.id}@${diagnose.version}`, lang, rep: conf.mapped }));
    claimedAt = 0;
    useDiagRun.setState({ phase: 'idle', error: null });
    return 'done';
  } catch (err) {
    await release();
    if (isAiFailure(err) && err.kind === 'cancelled') {
      useDiagRun.setState({ phase: 'idle', error: null });
      return 'cancelled';
    }
    logWarn('diagnose:run', err);
    // Hintergrund ist immer still (§5.3); der Nutzer sieht den Fehler nur nach seinem eigenen Knopf.
    if (o.trigger === 'auto') {
      useDiagRun.setState({ phase: 'idle', error: null });
      return 'error';
    }
    useDiagRun.setState({ phase: 'error', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
    return 'error';
  } finally {
    if (ctl === c) ctl = null;
  }
}

/** „Melden“ eines Befunds: markiert ihn in `app/patterns.diag` (löscht nie). */
export async function reportFinding(w: string, index: number): Promise<void> {
  const writer = getWriter();
  if (!writer) return;
  try {
    await writer.transform(PATTERNS_PATH, (cur) => reportOp(cur, { w, index }));
  } catch (err) {
    logWarn('diagnose:report', err, PATTERNS_PATH);
  }
}
