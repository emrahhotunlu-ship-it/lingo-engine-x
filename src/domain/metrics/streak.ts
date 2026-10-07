import { mergeArchives } from '../capacity/compact';
import { dayKey, legacyDayKey } from '../date';
import { computeStreak, pflichtDays, weekStrip, type Streak, type StreakInput, type WeekDay } from '../streak';

// EINE Serie (Gesamtkonzept Kap. 4): Heute, Profil-Knopf, Fortschritt und Wochenstreifen lesen dieselbe Rechnung aus denselben
// Dokumenten (`app/profile`, `app/schema.pflichtSince`, ausgelagerte Jahre). Die Regel selbst steht in `domain/streak.ts` und ändert sich nicht.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export type StreakDocs = {
  nowMs: number;
  profile: unknown;
  schema: unknown;
  /** Ausgelagerte Profiljahre (`archive/*`). */
  archives?: Iterable<Doc>;
  /** Lerntag; fehlt er, wird er aus `nowMs` berechnet (nie nur einmal beim Laden). */
  today?: string;
};

/** Eingabe der Serienregel aus den Dokumenten (Profil und Archiv zusammengelesen). */
export function streakInputOf(i: StreakDocs): { input: StreakInput; merged: Doc } {
  const merged = obj(mergeArchives(i.profile ? obj(i.profile) : null, (i.archives ?? []) as Iterable<Record<string, unknown>>));
  const since = obj(i.schema).pflichtSince;
  return {
    merged,
    input: {
      days: obj(merged.days) as Record<string, number>,
      xpDays: obj(merged.xpDays) as Record<string, number>,
      pflichtSince: typeof since === 'string' ? since : null,
      pflichtDone: pflichtDays(merged.pflicht),
      today: i.today ?? dayKey(i.nowMs),
      legacyToday: legacyDayKey(i.nowMs),
    },
  };
}

/** Serie (Anzahl, heute erledigt, Ruhetage). */
export const streak = (i: StreakDocs): Streak => computeStreak(streakInputOf(i).input);

/** Serie und Wochenstreifen Mo bis So mit derselben Regel; `merged` = Profil mit Archiv (für „nur Extra“-Punkte). */
export function streakWeek(i: StreakDocs): { streak: Streak; week: WeekDay[]; merged: Doc } {
  const { input, merged } = streakInputOf(i);
  return { streak: computeStreak(input), week: weekStrip(input), merged };
}

// ------------------------------------------------------------------ Wochenziel und Ruhetag (Motivation §4.4, §4.5)

/** Wochenziel: so viele Pflichttage je ISO-Woche (MO1). */
export const WEEK_GOAL = 6;

export type WeekGoal = {
  /** Pflichttage dieser Woche (nur Zustand `done`; Extra zählt nie). */
  done: number;
  goal: 6;
  /** Mindestens 6 Pflichttage: die Serie reißt an dieser Woche nicht. */
  reached: boolean;
  /** Sind 6 noch erreichbar (heute und die kommenden Tage eingerechnet)? */
  possible: boolean;
  /** Der Tag, den der Ruhetag der Woche überbrückt (`rest`), sonst `null`. */
  rest: string | null;
};

/** Wochenziel „6 von 7“ aus dem Wochenstreifen (`weekStrip`); keine andere Quelle. */
export function weekGoal(week: readonly WeekDay[]): WeekGoal {
  let done = 0;
  let ahead = 0;
  let rest: string | null = null;
  for (const d of week) {
    if (d.state === 'done') done++;
    else if (d.state === 'future' || (d.state === 'open' && d.today)) ahead++;
    else if (d.state === 'rest') rest = d.day;
  }
  return { done, goal: WEEK_GOAL, reached: done >= WEEK_GOAL, possible: done + ahead >= WEEK_GOAL, rest };
}

export type RestInfo = {
  /** `free` = noch kein vergangener Tag ohne Pflicht in dieser Woche, `used` = ein Ruhetag wurde genutzt, `none` = Serie ohne Ruhetag (keine Aussage). */
  state: 'free' | 'used' | 'none';
  /** Der genutzte Ruhetag (Datum) bei `used`. */
  day: string | null;
};

/** Ruhetag der laufenden Woche („Ruhetag frei“ / „Ruhetag genutzt“). */
export function restInfo(week: readonly WeekDay[]): RestInfo {
  const used = week.find((d) => d.state === 'rest');
  if (used) return { state: 'used', day: used.day };
  const pastOpen = week.some((d) => d.state === 'open' && !d.today);
  return { state: pastOpen ? 'none' : 'free', day: null };
}
