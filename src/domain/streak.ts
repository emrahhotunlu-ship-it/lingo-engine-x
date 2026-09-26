import { addDays, isoWeek, legacyDayKey } from './date';

// Serie (Kap. 7, CLAUDE.md A6.13 und A7):
// - Tage VOR der Umstellung zählen nach der alten Regel: `days[k] > 0` oder `xpDays[k] > 0`.
//   So läuft die bisherige Serie nachweislich ununterbrochen weiter.
// - Der Umstellungstag zählt nach alter ODER neuer Regel.
// - Tage NACH der Umstellung zählen, wenn die Pflicht erledigt ist. Ein Ruhetag je
//   ISO-Kalenderwoche (Mo–So) bricht die Serie nicht; er wird nicht angespart.
// - Ist heute noch nicht erledigt, beginnt die Zählung bei gestern (der Tag läuft noch).

type NumMap = Record<string, number | null | undefined> | null | undefined;

export type StreakInput = {
  days?: NumMap;
  xpDays?: NumMap;
  /** Lerntage (nach der Umstellung), an denen die Pflicht erledigt war. */
  pflichtDone?: ReadonlySet<string>;
  /** Erster Tag nach neuer Regel (`app/schema.cutover`); ohne Umstellung gilt überall die alte Regel. */
  cutover?: string | null;
  today: string;
};

export type Streak = { count: number; todayDone: boolean; restDays: string[] };

export function legacyActive(days: NumMap, xpDays: NumMap, key: string): boolean {
  return (days?.[key] ?? 0) > 0 || (xpDays?.[key] ?? 0) > 0;
}

function active(input: StreakInput, key: string): boolean {
  const { cutover } = input;
  const legacy = legacyActive(input.days, input.xpDays, key);
  if (!cutover || key < cutover) return legacy;
  const done = input.pflichtDone?.has(key) ?? false;
  return key === cutover ? legacy || done : done;
}

export function computeStreak(input: StreakInput): Streak {
  const todayDone = active(input, input.today);
  let d = todayDone ? input.today : addDays(input.today, -1);
  let count = 0;
  const usedWeeks = new Set<string>();
  const restDays: string[] = [];
  const pendingRest: string[] = [];
  for (let guard = 0; guard < 20_000; guard++) {
    if (active(input, d)) {
      count++;
      restDays.push(...pendingRest);
      pendingRest.length = 0;
      d = addDays(d, -1);
      continue;
    }
    const week = isoWeek(d);
    if (input.cutover && d > input.cutover && !usedWeeks.has(week)) {
      usedWeeks.add(week);
      pendingRest.push(d);
      d = addDays(d, -1);
      continue;
    }
    break;
  }
  return { count, todayDone, restDays };
}

/** Die Serie exakt so, wie die alte App sie berechnet (Referenz für den Umstellungstest). */
export function legacyStreak(days: NumMap, xpDays: NumMap, nowMs: number): number {
  let d = legacyDayKey(nowMs);
  if (!legacyActive(days, xpDays, d)) d = addDays(d, -1);
  let s = 0;
  while (legacyActive(days, xpDays, d)) {
    s++;
    d = addDays(d, -1);
  }
  return s;
}
