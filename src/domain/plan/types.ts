// Tagesplan (Daten-Entwurf §3.4): Format der alten App `{d, ids, why}` plus neue Felder.

export type WhyKey = [key: string] | [key: string, n: number];
export type DutyId = 'review' | 'lesson' | `ch:${string}`;

export type StoredPlan = {
  /** Lerntag (dayKey, Wechsel um 04:00). */
  d: string;
  /** Kanäle der alten App; ids[0] = Pflichtkanal. Nur ausführbare Kanäle, in Phase 1 keine. */
  ids: string[];
  why: WhyKey[][];
  v: 1;
  /** Eingefrorene Pflichtschritte des Tages (Phase 1: höchstens „Wiederholen"). */
  duty: DutyId[];
  /** Eingefrorene Zielmenge „Wiederholen" (Anzeige „x von N"). */
  goal: { review: number };
  lesson: string | null;
  /** ms der Festlegung. */
  at: number;
};

export type TodayState = {
  day: string;
  status: 'noPlan' | 'nothing' | 'open' | 'allDone';
  review: { done: number; total: number };
  extra: number;
  balance: { answers: number; correct: number; minutes: number };
};
