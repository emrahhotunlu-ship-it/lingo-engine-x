// Datumsschlüssel `JJJJ-MM-TT` (Format der bestehenden Datenbank).
// Der Lerntag wechselt um 04:00 Uhr Ortszeit (CLAUDE.md A7): eine Einheit nach
// Mitternacht zählt noch zum Vortag. Der Schlüssel wird bei jedem Aufruf neu
// berechnet – nie nur einmal beim Laden (Fehler der alten App).

export const DAY_START_HOUR = 4;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Lerntag zum Zeitpunkt `nowMs` (Ortszeit, Tageswechsel um `boundaryHour` Uhr). */
export function dayKey(nowMs: number, boundaryHour: number = DAY_START_HOUR): string {
  // Nach der Uhrzeit vor Ort entscheiden (nicht „jetzt minus 4 Stunden"): so liegt die Grenze
  // auch an den Tagen der Zeitumstellung genau bei 04:00 Uhr.
  const d = new Date(nowMs);
  if (d.getHours() < boundaryHour) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Kalendertag nach der Regel der alten App (Ortszeit, Wechsel um Mitternacht). */
export function legacyDayKey(nowMs: number): string {
  return dayKey(nowMs, 0);
}

export function isDayKey(v: unknown): v is string {
  return typeof v === 'string' && DAY_KEY_RE.test(v);
}

function toUtc(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Reine Kalenderrechnung auf Schlüsseln, unabhängig von Zeitzone und Sommerzeit. */
export function addDays(key: string, n: number): string {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** ISO-Kalenderwoche (Montag bis Sonntag) als `JJJJ-Www`. */
export function isoWeek(key: string): string {
  const d = toUtc(key);
  const dow = (d.getUTCDay() + 6) % 7; // Mo = 0
  d.setUTCDate(d.getUTCDate() - dow + 3); // Donnerstag derselben Woche
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${pad(week)}`;
}

/** Beginn des nächsten Lerntags (04:00 Uhr) in ms – bis dahin gilt eine Karte als „heute fällig". */
export function learningDayEnd(nowMs: number): number {
  const d = new Date(nowMs);
  if (d.getHours() >= DAY_START_HOUR) d.setDate(d.getDate() + 1);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}

/** Mittag des Lerntags `JJJJ-MM-TT` als ms (Ortszeit) – zum Anzeigen des Lerntag-Datums. */
export function dayKeyNoon(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getTime();
}

/** Beginn des laufenden Lerntags (letztes 04:00 Uhr) in ms. */
export function learningDayStart(nowMs: number): number {
  const d = new Date(nowMs);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}
