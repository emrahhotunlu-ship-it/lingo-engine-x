import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../ai/types';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { readCollection, readDoc } from '../../data/reads';
import { validateDoc } from '../../data/validate';
import { dayKey } from '../../domain/date';
import { collectMistakes, uniqueMistakes, type Mistake } from '../../domain/patterns/mistakes';
import { capPatterns, countWeeks, mergeHistory, patternHintsOf, patternsDue, readPatterns, recentWeeks, type Pattern, type PatternsDoc } from '../../domain/patterns/patterns';
import { jsonEqual } from '../../domain/equal';
import { patterns as patternsTemplate } from '../../prompts/patterns';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import type { Db } from '../../platform/types';
import { aiUsable } from '../progress/assessRun';

// Persönliche „Deutsch-Fallen“ (Lernberatung 27.09., V3): Quellen lesen, Muster erkennen lassen
// (patterns@1, nur auf Knopfdruck oder höchstens einmal je ISO-Woche beim Öffnen von „Dein
// Stand“ – nie in einer Schleife, nie automatisch wiederholt), `app/patterns` schreiben (immer
// `writer.transform` auf dem frischen Stand) und den Verlauf lokal nachzählen (ohne KI).

type Doc = Record<string, unknown>;
export const PATTERNS_PATH = 'app/patterns';
/** Ab so vielen eigenen Fehlern lohnt das Erkennen. */
export const PATTERNS_MIN_MISTAKES = 3;
/** Wochen, die beim lokalen Zählen neu berechnet werden (diese + 3 davor). */
const COUNT_WEEKS = 4;

async function safeCollection(db: Db, name: string): Promise<Map<string, Doc>> {
  try {
    return (await readCollection(db, name)).valid;
  } catch (err) {
    logWarn('patterns:read', err, name);
    return new Map();
  }
}

async function safeDoc(db: Db, path: string): Promise<Doc | null> {
  try {
    const r = await readDoc(db, path);
    return r.status === 'valid' ? r.doc : null;
  } catch (err) {
    logWarn('patterns:read', err, path);
    return null;
  }
}

export type PatternData = { doc: PatternsDoc | null; mistakes: Mistake[]; preply: Map<string, Doc> };

/** Alle Fehlerquellen einmal lesen (kein Abo). Grammatik und Reparatur-Sätze kommen aus den Live-Daten. */
export async function loadPatternData(db: Db): Promise<PatternData> {
  const [talk, writing, preply, say, radar, doc] = await Promise.all([
    safeCollection(db, 'talk'),
    safeCollection(db, 'writing'),
    safeCollection(db, 'preply'),
    safeCollection(db, 'say'),
    safeDoc(db, 'app/radar'),
    safeDoc(db, PATTERNS_PATH),
  ]);
  const live = useLive.getState();
  const mistakes = collectMistakes({ grammar: live.collections.grammar ?? null, talk, writing, preply, say, radar, repair: live.docs['app/repair'] ?? null });
  const parsed = readPatterns(doc);
  cached = parsed;
  return { doc: parsed, mistakes, preply };
}

// ------------------------------------------------------------------ Hinweise für andere Prompts

let cached: PatternsDoc | null | undefined;

/** Top-3-Muster (Englisch) für Rollenspiel-Analyse und „Sag es“; ein Lesevorgang je Sitzung. */
export async function patternHints(nowMs = Date.now()): Promise<string[]> {
  try {
    if (cached === undefined) {
      const db = getDb();
      if (!db) return [];
      cached = readPatterns(await safeDoc(db, PATTERNS_PATH));
    }
    return patternHintsOf(cached, dayKey(nowMs));
  } catch (err) {
    logWarn('patterns:hints', err);
    return [];
  }
}

/** Nur für Tests. */
export function resetPatternCache(): void {
  cached = undefined;
  autoTried = null;
}

// ------------------------------------------------------------------ Schreiben

/** Verlauf nachzählen und nur schreiben, wenn er sich ändert (nur wenn das Dokument existiert). */
export async function syncHistory(mistakes: readonly Mistake[], items: readonly Pattern[], today: string): Promise<void> {
  const writer = getWriter();
  if (!writer || !items.length) return;
  const fresh = countWeeks(mistakes, items, recentWeeks(today, COUNT_WEEKS));
  try {
    await writer.transform(PATTERNS_PATH, (cur) => {
      if (!cur) return null;
      const doc = readPatterns(cur);
      if (!doc) return null;
      const history = mergeHistory(doc.history, fresh);
      if (jsonEqual(history, doc.history)) return null;
      cached = { ...doc, history };
      return { update: { history } };
    });
  } catch (err) {
    logWarn('patterns:history', err);
  }
}

async function savePatterns(items: readonly Pattern[], mistakes: readonly Mistake[], lang: string, nowMs: number): Promise<PatternsDoc> {
  const writer = getWriter();
  if (!writer) throw new Error('db unavailable');
  const today = dayKey(nowMs);
  const capped = capPatterns(items);
  const fresh = countWeeks(mistakes, capped, recentWeeks(today, COUNT_WEEKS));
  const box: { saved: PatternsDoc | null } = { saved: null };
  await writer.transform(PATTERNS_PATH, (cur) => {
    // Unerwarteter Aufbau: nie überschreiben (Kap. 9).
    if (cur && !validateDoc(PATTERNS_PATH, cur).ok) {
      logError('patterns:save', new Error('app/patterns invalid, not overwritten'));
      return null;
    }
    const old = readPatterns(cur);
    const history = mergeHistory(old?.history ?? [], fresh);
    const next = { d: today, t: nowMs, lang, pv: `${patternsTemplate.id}@${patternsTemplate.version}`, items: capped, history };
    box.saved = { ...next, items: [...capped] };
    return cur ? { update: next } : { set: next };
  });
  const out = box.saved ?? { d: today, t: nowMs, lang, pv: '', items: capped, history: fresh };
  cached = out;
  return out;
}

// ------------------------------------------------------------------ Erkennen (ein Lauf)

export type RecognizePhase = 'idle' | 'reading' | AiPhase | 'saving';

type RunState = {
  phase: RecognizePhase;
  error: AiMessageKey | 'patternsFailed' | 'patternsFew' | null;
  /** Nach einem Lauf: das neue Dokument (Anzeige ohne Warten auf ein Abo). */
  last: PatternsDoc | null;
};

export const usePatternsRun = create<RunState>(() => ({ phase: 'idle', error: null, last: null }));

let ctl: AbortController | null = null;
let autoTried: string | null = null;

export const isRunning = (p: RecognizePhase): boolean => p !== 'idle' && p !== 'done' && p !== 'error';

/** Muster neu erkennen: EIN Aufruf je Handlung. Ohne KI oder mit zu wenigen Fehlern nichts. */
export async function recognizePatterns(o: { refresh?: boolean } = {}): Promise<PatternsDoc | null> {
  if (isRunning(usePatternsRun.getState().phase)) return null;
  const db = getDb();
  if (!db || !aiUsable()) return null;
  ctl = new AbortController();
  const c = ctl;
  usePatternsRun.setState({ phase: 'reading', error: null });
  try {
    const data = await loadPatternData(db);
    const list = uniqueMistakes(data.mistakes);
    if (list.length < PATTERNS_MIN_MISTAKES) {
      usePatternsRun.setState({ phase: 'idle', error: 'patternsFew' });
      return null;
    }
    const uiLang = useSettings.getState().lang;
    const r = await askJson({
      template: patternsTemplate,
      vars: { mistakes: list.map((m) => ({ wrong: m.wrong, right: m.right, src: m.src })), uiLang },
      signal: c.signal,
      refresh: o.refresh ?? false,
      onPhase: (p) => {
        if (ctl === c) usePatternsRun.setState({ phase: p });
      },
    });
    usePatternsRun.setState({ phase: 'saving' });
    const doc = await savePatterns(r.data.patterns, data.mistakes, uiLang, Date.now());
    if (ctl === c) usePatternsRun.setState({ phase: 'idle', error: null, last: doc });
    return doc;
  } catch (err) {
    if (ctl !== c) return null;
    if (isAiFailure(err) && err.kind === 'cancelled') {
      usePatternsRun.setState({ phase: 'idle', error: null });
      return null;
    }
    logWarn('patterns:run', err);
    usePatternsRun.setState({ phase: 'error', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'patternsFailed' });
    return null;
  } finally {
    if (ctl === c) ctl = null;
  }
}

export function stopPatterns(): void {
  ctl?.abort();
}

/**
 * Beim Öffnen von „Dein Stand“: höchstens einmal je ISO-Woche neu erkennen – nur wenn es schon
 * Muster gibt (das erste Erkennen startet immer der Knopf) und nur einmal je Tab und Woche.
 */
export function maybeAutoPatterns(doc: PatternsDoc | null, today: string): void {
  if (!patternsDue(doc, today) || autoTried === today || !aiUsable()) return;
  autoTried = today;
  void recognizePatterns();
}
