import { mergeArchives } from '../capacity/compact';
import { dayKey, legacyDayKey } from '../date';
import { computeStreak, pflichtDays, weekStrip, type Streak, type WeekDay } from '../streak';

// Wochenstreifen im Profil-Blatt (plan.md §1.2, markt.md UI 4): sieben Punkte Mo–So mit
// Pflicht · nur Extra · Ruhetag · offen. Grundlage ist `weekStrip` (dieselbe Regel wie die Serie);
// hier kommt nur „nur Extra“ dazu: ein Tag, der für die Serie nicht zählt, an dem aber geübt wurde
// (Minuten, alte Tageszähler oder Einträge in `act`). Auch ein Ruhetag, an dem geübt wurde, zeigt
// „nur Extra“ (die Serie überbrückt ihn trotzdem). Rein und getestet.

export type DotState = 'done' | 'extra' | 'rest' | 'open' | 'future';
export type WeekDot = WeekDay & { dot: DotState };

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const pos = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Wurde an diesem Lerntag überhaupt geübt? (Minuten, alte Zähler, Tätigkeiten in `act`.) */
export function practicedOn(profile: unknown, day: string): boolean {
  const p = obj(profile);
  if (pos(obj(p.minutes)[day]) || pos(obj(p.days)[day]) || pos(obj(p.xpDays)[day])) return true;
  const act = obj(p.act)[day];
  if (Array.isArray(act)) return act.length > 0;
  if (act && typeof act === 'object') return Object.values(act as Doc).some((v) => v === true || pos(v));
  return false;
}

export function weekDots(week: readonly WeekDay[], profile: unknown): WeekDot[] {
  return week.map((d) => ({ ...d, dot: (d.state === 'open' || d.state === 'rest') && practicedOn(profile, d.day) ? 'extra' : d.state }));
}

/**
 * Serie und Wochenpunkte für den Kopf des Profil-Blatts – dieselbe Regel wie „Dein Stand“
 * (`buildOverview`), aber ohne Karten und Kurs zu lesen (leicht genug für jedes Öffnen).
 */
export function streakView(input: { nowMs: number; profile: unknown; schema: unknown; archives?: Iterable<Doc> }): { streak: Streak; dots: WeekDot[] } {
  const merged = obj(mergeArchives(input.profile ? (obj(input.profile)) : null, (input.archives ?? []) as Iterable<Record<string, unknown>>));
  const since = obj(input.schema).pflichtSince;
  const streakInput = {
    days: obj(merged.days) as Record<string, number>,
    xpDays: obj(merged.xpDays) as Record<string, number>,
    pflichtSince: typeof since === 'string' ? since : null,
    pflichtDone: pflichtDays(merged.pflicht),
    today: dayKey(input.nowMs),
    legacyToday: legacyDayKey(input.nowMs),
  };
  return { streak: computeStreak(streakInput), dots: weekDots(weekStrip(streakInput), merged) };
}

/** „Solides B2+. Im Verhandeln fast C1 …“ → der erste Satz, höchstens `max` Zeichen. */
export function firstSentence(text: string | null | undefined, max = 140): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  const one = m?.[1] ?? s;
  if (Array.from(one).length <= max) return one;
  return `${Array.from(one).slice(0, max - 1).join('').replace(/\s+\S*$/, '')}…`;
}
