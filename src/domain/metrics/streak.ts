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
