import { topicP } from '../../grammar/bkt';
import { introDay } from '../../grammar/path';
import { addDays, daysBetween } from '../../date';
import type { C1Gate } from '../c1doc';
import type { ChapterProgress } from '../state';

// Kapitelprüfung, Auslöser (Lernplattform 3.0 §4.4, P42): REINE Funktion. Die Prüfung ist ein Extra auf Heute, nie Pflicht. Sie erscheint, wenn
// alle Themen des Kapitels eingeführt sind, die letzte Einführung mindestens 14 Tage her ist und jedes Thema p ≥ 0,6 hat. Bestanden ist bestanden;
// nach einem Fehlversuch gibt es eine Pause (7 Tage, nach dem dritten Versuch 28). Es gibt höchstens 5 Versuche je Kapitel (Speichergrenze
// `C1_LIMITS.gates` = 7 × 5). Bestehen ändert weder Serie noch Pflicht.

type Doc = Readonly<Record<string, unknown>>;

export const GATE = {
  /** Mindestabstand zwischen der letzten Einführung eines Themas des Kapitels und der Prüfung (Tage). */
  settleDays: 14,
  /** Mindest-p jedes Themas. */
  minP: 0.6,
  /** Pause nach einem Fehlversuch (Tage). */
  pauseDays: 7,
  /** Ab dem vierten Versuch ist die Pause länger (Tage). */
  longPauseDays: 28,
  /** So viele Versuche je Kapitel gibt es mit der kurzen Pause. */
  freeAttempts: 3,
  /** Höchstzahl der Versuche je Kapitel (gespeichert). */
  maxAttempts: 5,
  /** Ungesehene Aufgaben je Thema und Versuch. */
  perTopic: 2,
  /** Kapitelwörter je Prüfung und Mindestzahl, unter der der Wörterteil entfällt. */
  words: 8,
  wordsMin: 4,
  /** Bestehensgrenzen: Grammatik (Kapitel 1–2 / 3–7) und Wörter. */
  passGrammarEarly: 0.85,
  passGrammarLate: 0.8,
  passWords: 0.8,
} as const;

export type GateWhy = 'no-content' | 'topics' | 'settle' | 'strength';
export type GateStatus =
  /** Noch nicht dran. `from` = frühestes Datum, soweit es sich sagen lässt; `weak` = Themen unter der p-Grenze. */
  | { state: 'locked'; chapter: number; why: GateWhy; from?: string; weak?: string[]; attempts: number }
  /** Bestanden (Datum des bestandenen Versuchs). */
  | { state: 'passed'; chapter: number; on: string; attempts: number }
  /** Wartezeit nach einem Fehlversuch. */
  | { state: 'pause'; chapter: number; from: string; attempts: number }
  /** Alle fünf Versuche sind verbraucht. */
  | { state: 'spent'; chapter: number; attempts: number }
  | { state: 'ready'; chapter: number; attempts: number };

/** Versuche eines Kapitels, ältester zuerst. */
export const attemptsOf = (gates: readonly C1Gate[], chapter: number): C1Gate[] => gates.filter((g) => g.ch === chapter);

/** Frühestes Datum für den nächsten Versuch nach dem letzten (`null` = noch kein Versuch). */
export function retryFrom(attempts: readonly C1Gate[]): string | null {
  const last = attempts.at(-1);
  if (!last) return null;
  return addDays(last.d, attempts.length >= GATE.freeAttempts ? GATE.longPauseDays : GATE.pauseDays);
}

/** Bestehensgrenze für Grammatik im Kapitel `n` (1 bis 7). */
export const grammarThreshold = (n: number): number => (n <= 2 ? GATE.passGrammarEarly : GATE.passGrammarLate);

/**
 * Ist die Kapitelprüfung dran? Rein: dieselben Eingaben, dasselbe Ergebnis. `chapter` kommt aus `chapterState` (Kapitelstand), `docs` sind die
 * Grammatik-Dokumente nach Thema, `gates` die bisherigen Versuche (`app/c1.gates`).
 */
export function gateStatus(i: { chapter: ChapterProgress; docs: ReadonlyMap<string, Doc>; gates: readonly C1Gate[]; today: string; nowMs: number }): GateStatus {
  const n = i.chapter.n;
  const tries = attemptsOf(i.gates, n);
  const passed = tries.find((g) => g.ok);
  if (passed) return { state: 'passed', chapter: n, on: passed.d, attempts: tries.length };
  if (tries.length >= GATE.maxAttempts) return { state: 'spent', chapter: n, attempts: tries.length };
  const retry = retryFrom(tries);
  if (retry && i.today < retry) return { state: 'pause', chapter: n, from: retry, attempts: tries.length };

  const live = i.chapter.topics.filter((t) => t.exists);
  if (!i.chapter.ready || live.length === 0) return { state: 'locked', chapter: n, why: 'no-content', attempts: tries.length };
  if (!i.chapter.allIntroduced) return { state: 'locked', chapter: n, why: 'topics', attempts: tries.length };

  const days = live.map((t) => introDay(i.docs.get(t.id))).filter((d): d is string => d !== null);
  const last = days.sort().at(-1);
  if (last && daysBetween(last, i.today) < GATE.settleDays) return { state: 'locked', chapter: n, why: 'settle', from: addDays(last, GATE.settleDays), attempts: tries.length };

  const weak = live.filter((t) => topicP(t.id, i.docs.get(t.id), i.nowMs) < GATE.minP).map((t) => t.id);
  if (weak.length) return { state: 'locked', chapter: n, why: 'strength', weak, attempts: tries.length };
  return { state: 'ready', chapter: n, attempts: tries.length };
}

/** Das erste Kapitel (in Programmreihenfolge), dessen Prüfung bereit ist; `null`, wenn keines. Es steht höchstens eine Prüfung gleichzeitig an. */
export function firstReadyGate(statuses: readonly GateStatus[]): Extract<GateStatus, { state: 'ready' }> | null {
  const r = statuses.find((s) => s.state === 'ready');
  return r && r.state === 'ready' ? r : null;
}
