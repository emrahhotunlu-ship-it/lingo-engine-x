import { addDays, isoWeek, legacyDayKey } from './date';

// Serie (Kap. 7, CLAUDE.md A6.13 und A7):
// - Bis die App die Pflicht erfasst, zählt die alte Regel: `days[k] > 0` oder `xpDays[k] > 0`.
//   So läuft die bisherige Serie nachweislich ununterbrochen weiter – auch über die Umstellung.
// - Ab `pflichtSince` (erster Lerntag, an dem die App die Pflicht erfasst; setzt Phase 1 in
//   `app/schema`) zählt ein Tag, wenn die Pflicht erledigt ist; an genau diesem Tag zählt
//   auch noch die alte Regel. Ein Ruhetag je ISO-Kalenderwoche (Mo–So) bricht die Serie
//   nicht; er wird nicht angespart.
// - Ist heute noch nicht erledigt, beginnt die Zählung bei gestern (der Tag läuft noch).
// - Zwischen 0 und 4 Uhr liegt der Kalendertag der alten App schon einen Tag weiter als der
//   Lerntag. Hat die alte App dort Aktivität verbucht, beginnt die Zählung dort – so geht bei
//   einer nächtlichen Umstellung kein Tag verloren.

type NumMap = Record<string, number | null | undefined> | null | undefined;

export type StreakInput = {
  days?: NumMap;
  xpDays?: NumMap;
  /** Lerntage, an denen die Pflicht erledigt war (`app/profile.pflicht`). */
  pflichtDone?: ReadonlySet<string>;
  /** Ab diesem Lerntag gilt die Pflicht-Regel; fehlt er, gilt überall die alte Regel. */
  pflichtSince?: string | null;
  /** Heutiger Lerntag (Wechsel um 04:00). */
  today: string;
  /** Heutiger Kalendertag der alten App (Wechsel um Mitternacht). */
  legacyToday?: string;
};

export type Streak = { count: number; todayDone: boolean; restDays: string[] };

export function legacyActive(days: NumMap, xpDays: NumMap, key: string): boolean {
  return (days?.[key] ?? 0) > 0 || (xpDays?.[key] ?? 0) > 0;
}

function active(input: StreakInput, key: string): boolean {
  const { pflichtSince } = input;
  const legacy = legacyActive(input.days, input.xpDays, key);
  if (!pflichtSince || key < pflichtSince) return legacy;
  const done = input.pflichtDone?.has(key) ?? false;
  return key === pflichtSince ? legacy || done : done;
}

export function computeStreak(input: StreakInput): Streak {
  const { legacyToday, pflichtSince } = input;
  let start = input.today;
  if (
    legacyToday &&
    legacyToday > input.today &&
    (!pflichtSince || legacyToday <= pflichtSince) &&
    legacyActive(input.days, input.xpDays, legacyToday)
  ) {
    start = legacyToday;
  }
  const todayDone = active(input, start);
  let d = todayDone ? start : addDays(input.today, -1);
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
    if (pflichtSince && d >= pflichtSince && !usedWeeks.has(week)) {
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

/** Lerntage mit erledigter Pflicht aus `app/profile.pflicht` (Datum → Wert, wahr = erledigt). */
export function pflichtDays(pflicht: unknown): Set<string> {
  const out = new Set<string>();
  if (pflicht && typeof pflicht === 'object' && !Array.isArray(pflicht)) {
    for (const [k, v] of Object.entries(pflicht as Record<string, unknown>)) if (v) out.add(k);
  }
  return out;
}

// ------------------------------------------------------------------ Wochenstreifen (M7)

export type WeekDayState = 'done' | 'rest' | 'open' | 'future';
export type WeekDay = { day: string; state: WeekDayState; today: boolean };

/**
 * Die sieben Lerntage der ISO-Woche (Mo–So) von `input.today` mit derselben Regel wie die Serie:
 * `done` = der Tag zählt (Pflicht erledigt bzw. vor `pflichtSince` die alte Regel), `rest` = Ruhetag,
 * den die Serie überbrückt (aus `computeStreak`), `future` = nach heute, sonst `open` (heute noch
 * offen oder ein vergangener Tag ohne Pflicht).
 */
export function weekStrip(input: StreakInput): WeekDay[] {
  const { restDays } = computeStreak(input);
  const rest = new Set(restDays);
  const noon = new Date(`${input.today}T12:00:00Z`);
  const monday = addDays(input.today, -((noon.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, k) => {
    const day = addDays(monday, k);
    let state: WeekDayState;
    if (day > input.today) state = 'future';
    else if (active(input, day)) state = 'done';
    else if (rest.has(day)) state = 'rest';
    else state = 'open';
    return { day, state, today: day === input.today };
  });
}
