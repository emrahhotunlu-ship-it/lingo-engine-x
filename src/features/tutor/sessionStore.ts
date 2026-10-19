import { create } from 'zustand';
import type { LearnerModel } from '../../domain/tutor/learner';
import { applyMove, decideMove, newSession, recordAnswer, type AnswerFact, type Move, type Session, type WhyCode } from '../../domain/tutor/policy';

// Sitzung der Tutor-Engine (docs/umbau/tutor-engine-v3.md §6.1): nur im Speicher, nichts wird geschrieben (keine Dokumente je Antwort).
// Über den Tag bleiben das 20er-Fenster der neu gestellten Aufgaben, die Stufenverschiebung (Glättung über Runden hinweg) und die Beobachtung
// „Erfolg nach Mini-Lektion“; je Runde neu beginnen die Serie falscher Antworten, die Ursachen-Zähler, der letzte Zug, `win` (höchstens einmal
// je Runde) und die Gründe („Warum diese Aufgabe?“) der ersetzten Aufgaben.

type State = {
  day: string;
  s: Session;
  /** Grund je ersetzter Aufgabe der laufenden Runde (`thema|schlüssel`). */
  marks: Readonly<Record<string, WhyCode>>;
  /** Von der Engine absichtlich leicht eingesetzt (`win`, nach `explain`): zählt nicht für die Quote. */
  planted: Readonly<Record<string, true>>;
};

export const useTutorSession = create<State>(() => ({ day: '', s: newSession(false), marks: {}, planted: {} }));

export const taskMarkKey = (t: { topic: string; key: string }): string => `${t.topic}|${t.key}`;

/** Rundenstart: neuer Tag → alles neu; sonst bleiben Fenster und Verschiebung. */
export function tutorRoundStart(day: string, duty: boolean): void {
  const cur = useTutorSession.getState();
  const keep = cur.day === day ? { lastNew20: cur.s.lastNew20, shift: cur.s.shift, sinceShift: cur.s.sinceShift, afterLesson: cur.s.afterLesson } : {};
  useTutorSession.setState({ day, s: { ...newSession(duty), ...keep }, marks: {}, planted: {} });
}

/** Vorschau ohne Buchung (Rückmeldung zeigt die Mini-Lektion, bevor „Weiter“ die Antwort bucht). */
export function tutorPreview(fact: AnswerFact, m: LearnerModel | null): { move: Move; why: WhyCode } {
  return decideMove(recordAnswer(useTutorSession.getState().s, fact), m, false);
}

/**
 * Antwort buchen und den Zug bestimmen. `can`: kann der Aufrufer den Zug umsetzen? Lässt sich `win` nicht umsetzen (keine bekannte Aufgabe, Ende
 * des gezählten Teils), entscheidet die nächste Regel (`noWin`); sonst gilt `ask`. Die Sitzung merkt sich keinen Zug, der nicht stattfand.
 * Die Vorschau (`tutorPreview`) zeigt nur `explain`. Weil `win` nur gewinnt, wenn keine Mini-Lektion ansteht, ist der Rückfall nie `explain`:
 * Vorschau und Buchung kommen ohne Kenntnis der Umsetzbarkeit zur selben Mini-Lektion.
 */
export function tutorRecord(fact: AnswerFact, m: LearnerModel | null, can: (d: { move: Move; why: WhyCode }) => boolean): { move: Move; why: WhyCode } {
  const s1 = recordAnswer(useTutorSession.getState().s, fact);
  let d = decideMove(s1, m, false);
  if (d.move === 'win' && !can(d)) d = decideMove(s1, m, false, { noWin: true });
  if (d.move !== 'ask' && !can(d)) d = { move: 'ask', why: 'mix' };
  else if (d.move === 'ask' && d.why !== 'mix' && !can(d)) d = { move: 'ask', why: 'mix' };
  useTutorSession.setState({ s: applyMove(s1, d) });
  return d;
}

/** Grund einer ersetzten Aufgabe merken; `planted`: absichtlich leicht eingesetzt (`win`, nach `explain`), zählt dann nicht für die Quote. */
export function markTask(t: { topic: string; key: string }, why: WhyCode, planted = false): void {
  const k = taskMarkKey(t);
  useTutorSession.setState((x) => ({ marks: { ...x.marks, [k]: why }, ...(planted ? { planted: { ...x.planted, [k]: true as const } } : {}) }));
}

export const markOf = (t: { topic: string; key: string }): WhyCode | null => useTutorSession.getState().marks[taskMarkKey(t)] ?? null;

/** Von der Engine absichtlich leicht eingesetzt (K1): zählt nicht für das 20er-Fenster. */
export const plantedOf = (t: { topic: string; key: string }): boolean => useTutorSession.getState().planted[taskMarkKey(t)] === true;

/** Beobachtung „Erfolg nach Mini-Lektion“ (heute): Antworten zum Muster direkt danach, davon richtig ohne Hilfe. Steuert nichts. */
export const lessonSuccess = (): { n: number; ok: number } => useTutorSession.getState().s.afterLesson;

/** Nur für Tests. */
export function resetTutorSession(): void {
  useTutorSession.setState({ day: '', s: newSession(false), marks: {}, planted: {} });
}
