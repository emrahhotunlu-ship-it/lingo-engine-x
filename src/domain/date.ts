// Datumsschlüssel `JJJJ-MM-TT` (Format der bestehenden Datenbank).
// Der Lerntag wechselt um 04:00 Uhr Europe/Berlin (CLAUDE.md A7; Wörter-Plan V1 §4.4): eine Einheit nach
// Mitternacht zählt noch zum Vortag. Der Schlüssel wird bei jedem Aufruf neu berechnet – nie nur einmal beim Laden
// (Fehler der alten App).
//
// Paket V1 (docs/umbau/vokabeln/plan.md §4.4): EINE Datumsquelle, zentral auf die Zeitzone Europe/Berlin gestellt
// (`Intl.DateTimeFormat` mit `timeZone`), unabhängig von der Zeitzone des Geräts. Für ein Gerät in Deutschland ändert
// sich nichts (gleiche Ergebnisse wie vorher mit Ortszeit); auf einem Gerät in anderer Zeitzone gilt trotzdem der
// deutsche Lerntag, damit Serie, `log/<Tag>`, Pflicht und Wörter-Planer denselben Tag sehen.

export const DAY_START_HOUR = 4;
export const APP_TIME_ZONE = 'Europe/Berlin';
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 3_600_000;

const pad = (n: number) => String(n).padStart(2, '0');

let fmt: Intl.DateTimeFormat | null = null;
/** Versatz Berlin − UTC in ms zum Zeitpunkt `ms` (+1 h Winter, +2 h Sommer). Zwischenspeicher je Stunde (der Versatz wechselt nur zur vollen Stunde). */
const offCache = new Map<number, number>();
export function berlinOffsetMs(ms: number): number {
  const bucket = Math.floor(ms / HOUR);
  const hit = offCache.get(bucket);
  if (hit !== undefined) return hit;
  fmt ??= new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const at = bucket * HOUR;
  const p: Record<string, number> = {};
  for (const x of fmt.formatToParts(new Date(at))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  const wall = Date.UTC(p.year ?? 1970, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0);
  const off = wall - at;
  if (offCache.size > 4096) offCache.clear();
  offCache.set(bucket, off);
  return off;
}

/** Berliner Wanduhr zum Zeitpunkt `ms` als Date, dessen UTC-Felder die Berliner Uhrzeit tragen. */
function wall(ms: number): Date {
  return new Date(ms + berlinOffsetMs(ms));
}

/** Zeitpunkt (ms) zu einer Berliner Wanduhrzeit (UTC-Felder von `wallMs`). Bei der Lücke der Sommerzeit gilt die Uhrzeit danach. */
function fromWall(wallMs: number): number {
  let t = wallMs - berlinOffsetMs(wallMs);
  t = wallMs - berlinOffsetMs(t);
  return t;
}

/** Lerntag zum Zeitpunkt `nowMs` (Europe/Berlin, Tageswechsel um `boundaryHour` Uhr). */
export function dayKey(nowMs: number, boundaryHour: number = DAY_START_HOUR): string {
  // Nach der Berliner Uhrzeit entscheiden (nicht „jetzt minus 4 Stunden"): so liegt die Grenze
  // auch an den Tagen der Zeitumstellung genau bei 04:00 Uhr.
  const d = wall(nowMs);
  if (d.getUTCHours() < boundaryHour) d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Kalendertag nach der Regel der alten App (Europe/Berlin, Wechsel um Mitternacht). */
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
  return dayStartOf(addDays(dayKey(nowMs), 1));
}

/** 04:00 Uhr Europe/Berlin am Lerntag `key` in ms. */
export function dayStartOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return fromWall(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, DAY_START_HOUR));
}

/** Mittag des Lerntags `JJJJ-MM-TT` als ms (Europe/Berlin) – zum Anzeigen des Lerntag-Datums. */
export function dayKeyNoon(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return fromWall(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

/**
 * Kurzname des Wochentags für jeden Wochenstreifen („Mo“, „Di“ … / „Mon“, „Tue“ …), ohne Abkürzungspunkt. Eine Stelle,
 * damit Heute-Abschluss und Profil dieselben Beschriftungen zeigen (UX-Audit U1: vorher „Mo Di Mi“ und „M D M“).
 */
export function weekdayShort(key: string, lang: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short', timeZone: APP_TIME_ZONE }).format(dayKeyNoon(key)).replace(/\.$/, '');
}

/** Beginn des laufenden Lerntags (letztes 04:00 Uhr) in ms. */
export function learningDayStart(nowMs: number): number {
  return dayStartOf(dayKey(nowMs));
}

/**
 * `ms` plus `n` Kalendertage in Europe/Berlin (gleiche Uhrzeit, auch über die Zeitumstellung hinweg).
 * Fälligkeiten der Fehlersätze nutzen das statt `+ n · 24 h`: Am Tag mit 25 Stunden würde ein Satz
 * sonst schon am Tag des Anlegens fällig (Fälligkeit < Lerntagsende).
 */
export function addLocalDays(ms: number, n: number): number {
  const d = wall(ms);
  d.setUTCDate(d.getUTCDate() + n);
  return fromWall(d.getTime());
}
