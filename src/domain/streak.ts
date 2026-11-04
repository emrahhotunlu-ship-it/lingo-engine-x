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
  /**
   * Angekündigter Urlaub (Großpaket B10, `app/profile.vac`): diese Lerntage überspringt die Serie – sie zählen nicht und reißen sie nicht,
   * und sie verbrauchen den Ruhetag der Woche nicht. Ein erledigter Urlaubstag zählt trotzdem.
   */
  pauseDays?: ReadonlySet<string>;
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
    if (input.pauseDays?.has(d)) {
      pendingRest.push(d);
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

/** Höchstens so viele Tage je Urlaubseintrag (gegen Tippfehler wie ein ganzes Jahr). */
export const VACATION_MAX_DAYS = 31;
/** Höchstens so viele Urlaubseinträge in `app/profile.vac` (die ältesten vergangenen fallen beim Eintragen heraus). */
export const VACATION_MAX_ENTRIES = 24;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
type VacLike = { from?: unknown; to?: unknown; t?: unknown; x?: unknown };
const vacOk = (e: unknown): e is { from: string; to: string } & VacLike => {
  if (!e || typeof e !== 'object') return false;
  const { from, to } = e as VacLike;
  return typeof from === 'string' && typeof to === 'string' && DAY_RE.test(from) && DAY_RE.test(to) && to >= from;
};

/**
 * Urlaubstage aus `app/profile.vac` (`[{from: 'JJJJ-MM-TT', to: 'JJJJ-MM-TT', t, x?, cut?}]`, Großpaket B10; `x` = aufgehoben, `cut` = beim
 * Aufheben auf gestern gekürzt). Tolerant: ungültige Einträge, umgedrehte oder zu lange Spannen (> 31 Tage) werden übergangen – nie ein Fehler,
 * der die Serie sperrt. Gelesen werden die 24 jüngsten gültigen Einträge nach Ende (`to`) – dieselbe Reihenfolge, nach der `vacAdd` aussortiert.
 */
export function vacationDays(vac: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(vac)) return out;
  const valid = vac.filter(vacOk).filter((e) => !e.x);
  valid.sort((a, b) => (a.to < b.to ? 1 : a.to > b.to ? -1 : 0));
  for (const e of valid.slice(0, VACATION_MAX_ENTRIES)) {
    const days: string[] = [];
    for (let d = e.from; d <= e.to && days.length <= VACATION_MAX_DAYS; d = addDays(d, 1)) days.push(d);
    if (days.length > VACATION_MAX_DAYS) continue;
    for (const d of days) out.add(d);
  }
  return out;
}

/**
 * Urlaub eintragen (rein): neue Liste oder `null` (voll mit laufenden/kommenden Einträgen). Fremde oder ungültige Einträge werden unverändert
 * durchgereicht; sind es mehr als 24 gültige, fällt der vergangene mit dem frühesten Ende heraus (ein laufender oder kommender nie).
 */
export function vacAdd(list: readonly unknown[], entry: { from: string; to: string; t: number }, today: string): unknown[] | null {
  const out: unknown[] = [...list, entry];
  for (;;) {
    const live = out.filter(vacOk).filter((e) => !e.x);
    if (live.length <= VACATION_MAX_ENTRIES) return out;
    const past = live.filter((e) => e.to < today).sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0))[0];
    if (!past) return null;
    out.splice(out.indexOf(past), 1);
  }
}

/**
 * Urlaub aufheben (rein, data-guard Sollte 1): ein kommender Urlaub (Beginn ab heute) bekommt `x`; ein laufender wird auf gestern gekürzt
 * (`cut`), damit schon vergangene Urlaubstage nie rückwirkend zu verpassten werden (Serie nie rückwirkend kürzer, A6.13). `null` = nichts zu tun.
 */
export function vacCancel(list: readonly unknown[], t: number, today: string, nowMs: number): unknown[] | null {
  let changed = false;
  const out = list.map((e) => {
    if (!vacOk(e) || e.x || e.t !== t || e.to < today) return e;
    changed = true;
    return e.from >= today ? { ...e, x: nowMs } : { ...e, to: addDays(today, -1), cut: nowMs };
  });
  return changed ? out : null;
}

/** Gewählter Ruhetag (`app/profile.restDow`, Großpaket B10): 1 = Montag … 7 = Sonntag, sonst `null` (frei, wie bisher). Ändert die Serienregel nicht. */
export function restDowOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7 ? v : null;
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
