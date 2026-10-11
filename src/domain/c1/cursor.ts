import { isNewTopic } from '../grammar/path';
import type { ChapterInput } from '../grammar/path';
import { patternsOf } from '../grammar/patterns';
import { readTt, type TopicTest } from '../grammar/topicTest';
import { patternState, patternStateNo, patsOf, type PatEntry } from '../metrics/pattern';
import { chapterState, type ChapterProgress, type ChapterStateResult } from './state';

export { effectiveChapter } from './effective';

// Kapitel-Arbeit (K1, `docs/umbau/kapitel-plan.md`): Wo stehe ich im Kapitel, und was ist der nächste Schritt? Jedes Thema geht
// Einführung → Übung → Themen-Test. Rein und abgeleitet aus `grammar/<thema>` (`pats`, `n`, `tt`), gespeichert wird nichts davon.
// Der Kapitel-Knopf, die Karte „Als Nächstes“, Heute und der Tagesplan lesen alle diesen Cursor.

type Doc = Readonly<Record<string, unknown>>;

/** Gilt das Muster als „genug geübt“ für den nächsten Einführungsschritt (wie `introStepFor` in `path.ts`)? */
export const PAT_OK_N = 3;
export const PAT_OK_C = 2;
/** Themen ohne Musterdatei: so viele Antworten, dann ist der Themen-Test dran. */
export const TEST_READY_N = 8;

export { readTt };
export type { TopicTest };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export type TopicPhase = 'intro' | 'practice' | 'test' | 'done';

export type TopicStep = {
  phase: TopicPhase;
  /** intro: die Muster des Einführungsschritts (≤ 2); practice: nach nicht bestandenem Test die schwachen Muster des Tests (`tt.w`), sonst die
   *  schwächsten Muster (≤ 2); sonst leer. */
  pats: string[];
  /** test: Der Test war schon einmal nicht bestanden (Wiederholung). */
  retry: boolean;
  /** Der Test wurde nicht bestanden und Emrah ist trotzdem weitergegangen. */
  skipped: boolean;
};

const ready = (e: PatEntry | undefined, today: string): boolean => !!e && num(e.n) >= PAT_OK_N && num(e.c) >= PAT_OK_C && e.i !== undefined && e.i < today;

/** Die schwächsten eingeführten Muster (nicht sicher, höchste Fehlerquote zuerst), höchstens zwei. */
function weakPats(ids: readonly string[], entries: Record<string, PatEntry>, today: string): string[] {
  return ids
    .filter((id) => entries[id] && patternStateNo(patternState(entries[id], today)) < 2)
    .map((id) => {
      const e = entries[id]!;
      const n = num(e.n);
      return { id, rate: n > 0 ? (n - num(e.c)) / n : 1, n };
    })
    .sort((a, b) => b.rate - a.rate || a.n - b.n || a.id.localeCompare(b.id))
    .slice(0, 2)
    .map((x) => x.id);
}

/**
 * Phase eines Themas. `done` (Thema sicher oder Themen-Test bestanden) bestimmt der Aufrufer; hier:
 * - intro: Thema neu, oder der nächste Einführungsschritt ist dran (jedes Muster des vorigen Schritts mit 3 Antworten, 2 richtig, nicht von heute).
 * - practice: Der vorige Schritt ist noch nicht so weit, oder heute ist der Test nicht bestanden worden (morgen noch einmal).
 * - test: Alle Schritte sind eingeführt und jedes Muster hat mindestens 3 Antworten, 2 richtig, und ist nicht von heute (Themen ohne Musterdatei: 8 Antworten).
 * Altbestand: Ein begonnenes Thema ohne `pats` gilt als ganz eingeführt.
 */
export function topicStep(topic: string, doc: Doc | undefined, today: string): TopicStep {
  const tt = readTt(doc);
  const skipped = !!tt && !tt.ok && !!tt.s;
  const tp = patternsOf(topic);
  const plan = tp?.introPlan ?? [];
  const allIds = tp?.patterns.map((p) => p.id) ?? [];
  if (isNewTopic(doc)) return { phase: 'intro', pats: (plan[0] ?? []).slice(0, 2), retry: false, skipped };
  const entries = patsOf(doc);
  const legacy = !Object.keys(entries).length;
  if (!legacy && plan.length) {
    const k = plan.findIndex((step) => !step.every((id) => entries[id]?.i !== undefined));
    if (k >= 0) {
      const prev = k === 0 ? [] : (plan[k - 1] ?? []);
      if (prev.every((id) => ready(entries[id], today))) return { phase: 'intro', pats: (plan[k] ?? []).slice(0, 2), retry: false, skipped };
      return { phase: 'practice', pats: weakPats(prev.length ? prev : Object.keys(entries), entries, today), retry: false, skipped };
    }
  }
  const failedToday = !!tt && !tt.ok && tt.d === today;
  // Dieselbe Regel wie zwischen den Einführungsschritten: jedes Muster 3 Antworten, 2 richtig, nicht von heute eingeführt (Altbestand: 8 Antworten).
  const testReady = allIds.length ? allIds.every((id) => ready(entries[id], today)) || (legacy && num(doc?.n) >= TEST_READY_N) : num(doc?.n) >= TEST_READY_N;
  if (!failedToday && testReady) return { phase: 'test', pats: [], retry: !!tt && !tt.ok, skipped };
  // Nach einem nicht bestandenen Test: genau die Muster, die im Test falsch waren (`tt.w`, wie im Ergebnis „Das übst du als Nächstes“).
  const testWeak = tt && !tt.ok ? (tt.w ?? []).filter((id) => !allIds.length || allIds.includes(id)) : [];
  if (testWeak.length) return { phase: 'practice', pats: testWeak, retry: false, skipped };
  const ids = allIds.length ? allIds.filter((id) => entries[id]) : [];
  return { phase: 'practice', pats: weakPats(ids.length ? ids : Object.keys(entries), entries, today), retry: false, skipped };
}

/** Ist ein Thema im Kapitel abgeschlossen? Sicher (dieselbe Regel wie Programmkarte und Lernpfad) oder Themen-Test bestanden. */
export const topicDone = (safe: boolean, doc: Doc | undefined): boolean => safe || readTt(doc)?.ok === true;

export type ChapterCursor = {
  /** Kapitel-Index (0-basiert). */
  chapter: number;
  /** Kapitelnummer (1-basiert, wie `app/c1.ch.n`). */
  n: number;
  /** Das Thema, an dem es weitergeht; `null`, wenn das Kapitel fertig ist. */
  topic: string | null;
  phase: TopicPhase;
  pats: string[];
  retry: boolean;
};

/**
 * Der nächste Schritt im Kapitel: das erste vorhandene Thema in Lehrreihenfolge, das nicht abgeschlossen ist. Themen, deren Test nicht bestanden ist
 * und bei denen Emrah „Nächstes Thema trotzdem beginnen“ gewählt hat, werden übersprungen; bleiben nur noch solche, geht es beim ersten weiter.
 * Nie gesperrt: Fehlersätze und die Einführungsbremse spielen hier keine Rolle.
 */
export function chapterCursor(i: { chapter: ChapterProgress; idx: number; docs: ReadonlyMap<string, Doc>; today: string }): ChapterCursor {
  const base = { chapter: i.idx, n: i.chapter.n };
  let firstSkipped: { topic: string; step: TopicStep } | null = null;
  for (const t of i.chapter.topics) {
    if (!t.exists) continue;
    const doc = i.docs.get(t.id);
    if (topicDone(t.safe, doc)) continue;
    const step = topicStep(t.id, doc, i.today);
    if (step.skipped) {
      firstSkipped ??= { topic: t.id, step };
      continue;
    }
    return { ...base, topic: t.id, phase: step.phase, pats: step.pats, retry: step.retry };
  }
  if (firstSkipped) return { ...base, topic: firstSkipped.topic, phase: firstSkipped.step.phase, pats: firstSkipped.step.pats, retry: firstSkipped.step.retry };
  return { ...base, topic: null, phase: 'done', pats: [], retry: false };
}

/** Phase je Thema eines Kapitels (für die Liste im Kapitelblatt). */
export function chapterPhases(i: { chapter: ChapterProgress; docs: ReadonlyMap<string, Doc>; today: string }): Map<string, TopicPhase> {
  const out = new Map<string, TopicPhase>();
  for (const t of i.chapter.topics) {
    if (!t.exists) continue;
    const doc = i.docs.get(t.id);
    out.set(t.id, topicDone(t.safe, doc) ? 'done' : topicStep(t.id, doc, i.today).phase);
  }
  return out;
}

/** Kapitelstand und Cursor in einem Zug (eine Quelle für Lernen, Heute und den Tagesplan). `cursor` ist `null` ohne Programm. */
export function chapterNow(i: { docs: ReadonlyMap<string, Doc>; today: string; nowMs: number; chosen?: number | null }): { state: ChapterStateResult; cursor: ChapterCursor | null } {
  const state = chapterState(i);
  const ch = state.current >= 0 ? state.chapters[state.current] : undefined;
  return { state, cursor: ch ? chapterCursor({ chapter: ch, idx: state.current, docs: i.docs, today: i.today }) : null };
}

/** Eingabe für den Kapitel-Modus des Tagesplans (`freezeGrammarDay`): das wirksame Kapitel, seine vorhandenen Themen und der Cursor. */
export function chapterPlanInput(i: { docs: ReadonlyMap<string, Doc>; today: string; nowMs: number; chosen?: number | null }): ChapterInput | null {
  const { state, cursor } = chapterNow(i);
  const ch = cursor ? state.chapters[cursor.chapter] : undefined;
  if (!cursor || !ch) return null;
  return { n: ch.n, topics: ch.topics.filter((t) => t.exists).map((t) => t.id), cursor: { topic: cursor.topic, phase: cursor.phase, pats: cursor.pats } };
}
