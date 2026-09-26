// Tagesplan (Daten-Entwurf §3.4, phase2-plan §6.1): Format der alten App `{d, ids, why}` plus neue Felder.

export type WhyKey = [key: string] | [key: string, n: number];
export type DutyId = 'review' | 'lesson' | `ch:${string}`;

export type StoredPlan = {
  /** Lerntag (dayKey, Wechsel um 04:00). */
  d: string;
  /** Kanäle der alten App; ids[0] = Pflichtkanal (ab Phase 2), ids[1..2] = Angebote. */
  ids: string[];
  why: WhyKey[][];
  v: 1;
  /** Eingefrorene Pflichtschritte des Tages (Phase 1: höchstens „Wiederholen"; Phase 2: review, lesson, ch:<id>). */
  duty: DutyId[];
  /** Eingefrorene Mengen: „Wiederholen" (Anzeige „x von N"), Aufteilung und Rundengröße im Pflichtkanal. */
  goal: { review: number; due?: number; new?: number; ahead?: number; ch?: number };
  lesson: string | null;
  /** ms der Festlegung. */
  at: number;
};

export type DutyState = { id: DutyId; state: 'done' | 'open'; progress: { done: number; total: number } | null };

export type TodayState = {
  day: string;
  status: 'noPlan' | 'nothing' | 'open' | 'allDone';
  /** Die Pflichtpunkte des Tages (Phase 2). Erledigtes ist Zustand, kein Knopf (Kap. 2.2). */
  duties: { done: number; total: number; missing: DutyId[]; items: DutyState[] };
  review: { done: number; total: number };
  extra: number;
  /** `talks`/`biz`: Gespräche und Business-Einheiten (Phase 3), nicht in `answers` enthalten. */
  balance: { answers: number; correct: number; minutes: number; talks: number; biz: number };
};
