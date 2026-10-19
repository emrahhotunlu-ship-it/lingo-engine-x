import { create } from 'zustand';
import type { LearnerModel } from '../../domain/tutor/learner';
import { applyMove, decideMove, newSession, recordAnswer, type AnswerFact, type Move, type Session, type WhyCode } from '../../domain/tutor/policy';

// Sitzung der Tutor-Engine (docs/umbau/tutor-engine-v3.md §6.1): nur im Speicher, nichts wird geschrieben (keine Dokumente je Antwort).
// Über den Tag bleiben das 20er-Fenster der neu gestellten Aufgaben und die Stufenverschiebung (Glättung über Runden hinweg); je Runde neu
// beginnen die Serie falscher Antworten, die Ursachen-Zähler, der letzte Zug und die Gründe („Warum diese Aufgabe?“) der ersetzten Aufgaben.

type State = {
  day: string;
  s: Session;
  /** Grund je ersetzter Aufgabe der laufenden Runde (`thema|schlüssel`). */
  marks: Readonly<Record<string, WhyCode>>;
};

export const useTutorSession = create<State>(() => ({ day: '', s: newSession(false), marks: {} }));

export const taskMarkKey = (t: { topic: string; key: string }): string => `${t.topic}|${t.key}`;

/** Rundenstart: neuer Tag → alles neu; sonst bleiben Fenster und Verschiebung. */
export function tutorRoundStart(day: string, duty: boolean): void {
  const cur = useTutorSession.getState();
  const keep = cur.day === day ? { lastNew20: cur.s.lastNew20, shift: cur.s.shift, sinceShift: cur.s.sinceShift } : {};
  useTutorSession.setState({ day, s: { ...newSession(duty), ...keep }, marks: {} });
}

/** Vorschau ohne Buchung (Rückmeldung zeigt die Mini-Lektion, bevor „Weiter“ die Antwort bucht). */
export function tutorPreview(fact: AnswerFact, m: LearnerModel | null): { move: Move; why: WhyCode } {
  return decideMove(recordAnswer(useTutorSession.getState().s, fact), m, false);
}

/**
 * Antwort buchen und den Zug bestimmen. `can`: kann der Aufrufer den Zug umsetzen? Sonst gilt `ask` (z. B. keine bekannte Aufgabe für `win`):
 * Die Sitzung merkt sich dann keinen Zug, der nicht stattfand.
 */
export function tutorRecord(fact: AnswerFact, m: LearnerModel | null, can: (d: { move: Move; why: WhyCode }) => boolean): { move: Move; why: WhyCode } {
  const s1 = recordAnswer(useTutorSession.getState().s, fact);
  let d = decideMove(s1, m, false);
  if (d.move !== 'ask' && !can(d)) d = { move: 'ask', why: 'mix' };
  else if (d.move === 'ask' && d.why !== 'mix' && !can(d)) d = { move: 'ask', why: 'mix' };
  useTutorSession.setState({ s: applyMove(s1, d) });
  return d;
}

export function markTask(t: { topic: string; key: string }, why: WhyCode): void {
  useTutorSession.setState((x) => ({ marks: { ...x.marks, [taskMarkKey(t)]: why } }));
}

export const markOf = (t: { topic: string; key: string }): WhyCode | null => useTutorSession.getState().marks[taskMarkKey(t)] ?? null;

/** Nur für Tests. */
export function resetTutorSession(): void {
  useTutorSession.setState({ day: '', s: newSession(false), marks: {} });
}
