import { daysBetween, isDayKey } from '../date';
import { DOC_BLOCK_TOTAL, DOC_WARN_TOTAL } from './docGuard';

// Kapazitätsanzeige (Lernplattform 3.0 P29, §8.2): Wie voll ist die Datenbank, und wann wird die Warnschwelle erreicht? Rein, nichts wird
// geschrieben. Die Vertragsgrenzen stehen in `contract/db.d.ts`: höchstens 5.000 Dokumente je Artefakt und 1.000 Treffer je Sammlung
// (`snapshot.ts` behandelt genau 1.000 als „vielleicht abgeschnitten“). Das Abschneiden bei 1.000 ist hart, deshalb gibt es je Sammlung eine
// Vorwarnung bei 900. Die Prognose ist eine lineare Anpassung der letzten 28 Tage; ohne genug Daten gibt es keine (lieber nichts als erfunden).

export const DOC_LIMIT = 5000;
export const DOC_WARN = DOC_WARN_TOTAL;
export const DOC_BLOCK = DOC_BLOCK_TOTAL;
/** Je Sammlung: hartes Abfragefenster und Vorwarnung. */
export const COLLECTION_LIMIT = 1000;
export const COLLECTION_PREWARN = 900;
/** Sammlungen, die einzeln beobachtet werden. */
export const WATCHED_COLLECTIONS = ['vocab', 'chunk', 'log'] as const;
export type WatchedCollection = (typeof WATCHED_COLLECTIONS)[number];

export const WINDOW_DAYS = 28;
/** Mindestens so viele Tagesbilder mit Dokumentzahl über mindestens so viele Tage, sonst „noch keine Prognose“. */
export const MIN_POINTS = 5;
export const MIN_SPAN_DAYS = 14;
/** Unter diesem Zuwachs je Tag gilt der Bestand als stabil (keine Prognose). */
export const MIN_RATE_PER_DAY = 0.05;
/** Unsicherheit der Prognose: das aktuelle Tempo ±30 Prozent. */
const SPREAD = 0.3;
const MONTH_DAYS = 30.4;

type Doc = Readonly<Record<string, unknown>>;

export type Rate = { perDay: number; points: number; span: number };

/** Zuwachs je Tag aus den Tagesbildern (`history[].dc`) der letzten 28 Tage; `null`, wenn zu wenig Daten vorliegen. */
export function docRate(history: unknown, today: string): Rate | null {
  const rows = (Array.isArray(history) ? history : [])
    .filter((h): h is Doc => !!h && typeof h === 'object')
    .filter((h) => isDayKey(h.d) && typeof h.dc === 'number' && Number.isFinite(h.dc) && h.dc > 0)
    .map((h) => ({ x: -daysBetween(h.d as string, today), y: h.dc as number }))
    .filter((p) => p.x <= 0 && p.x >= -WINDOW_DAYS);
  if (rows.length < MIN_POINTS) return null;
  const span = Math.max(...rows.map((r) => r.x)) - Math.min(...rows.map((r) => r.x));
  if (span < MIN_SPAN_DAYS) return null;
  const n = rows.length;
  const mx = rows.reduce((a, r) => a + r.x, 0) / n;
  const my = rows.reduce((a, r) => a + r.y, 0) / n;
  const sxx = rows.reduce((a, r) => a + (r.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = rows.reduce((a, r) => a + (r.x - mx) * (r.y - my), 0) / sxx;
  return { perDay: slope, points: n, span };
}

/** Zuwachs je Tag einer Sammlung aus den Anlage-Tagen ihrer Dokumente (Tage `JJJJ-MM-TT`) in den letzten 28 Tagen. */
export function collectionRate(addedDays: readonly string[], today: string): number {
  let n = 0;
  for (const d of addedDays) {
    const k = daysBetween(d, today);
    if (isDayKey(d) && k >= 0 && k < WINDOW_DAYS) n++;
  }
  return n / WINDOW_DAYS;
}

export type Months = { lo: number; hi: number };

/** Monate bis `threshold` bei Tempo `perDay` (±30 %); `null` ohne Zuwachs. Bereits erreicht: `'reached'`. */
export function monthsUntil(threshold: number, current: number, perDay: number | null): Months | 'reached' | null {
  if (current >= threshold) return 'reached';
  if (perDay === null || perDay < MIN_RATE_PER_DAY) return null;
  const left = threshold - current;
  const lo = Math.max(1, Math.round(left / (perDay * (1 + SPREAD)) / MONTH_DAYS));
  const hi = Math.max(lo, Math.round(left / (perDay * (1 - SPREAD)) / MONTH_DAYS));
  return { lo, hi };
}

export type DocForecast = {
  total: number;
  limit: number;
  warnAt: number;
  state: 'ok' | 'warn' | 'full';
  rate: Rate | null;
  /** `null` = noch keine Prognose (zu wenig Daten oder kein Zuwachs). */
  months: Months | 'reached' | null;
};

/** Gesamtbestand gegen die Warnschwelle (3.500). */
export function docForecast(i: { total: number; history: unknown; today: string }): DocForecast {
  const total = Math.max(0, Math.round(i.total));
  const rate = docRate(i.history, i.today);
  return {
    total,
    limit: DOC_LIMIT,
    warnAt: DOC_WARN,
    state: total >= DOC_BLOCK ? 'full' : total >= DOC_WARN ? 'warn' : 'ok',
    rate,
    months: monthsUntil(DOC_WARN, total, rate ? rate.perDay : null),
  };
}

export type CollectionForecast = {
  name: WatchedCollection;
  count: number;
  limit: number;
  prewarnAt: number;
  /** Ab 900 Dokumenten: Hinweis; ab 1.000 ist das Abfragefenster voll (Sperren statt raten, A6.15). */
  state: 'ok' | 'prewarn' | 'full';
  months: Months | 'reached' | null;
};

/** Eine Sammlung gegen die Vorwarnung (900) des harten 1.000er-Fensters. */
export function collectionForecast(i: { name: WatchedCollection; count: number; perDay: number | null }): CollectionForecast {
  const count = Math.max(0, Math.round(i.count));
  return {
    name: i.name,
    count,
    limit: COLLECTION_LIMIT,
    prewarnAt: COLLECTION_PREWARN,
    state: count >= COLLECTION_LIMIT ? 'full' : count >= COLLECTION_PREWARN ? 'prewarn' : 'ok',
    months: monthsUntil(COLLECTION_PREWARN, count, i.perDay),
  };
}

const monthsValue = (m: Months | 'reached' | null): number => (m === null ? Infinity : m === 'reached' ? 0 : m.lo);

/** Die frühere von mehreren Schwellen (Gesamtwarnung oder Sammlungs-Vorwarnung): kleinste untere Monatszahl; `null`, wenn keine Prognose vorliegt. */
export function earliest(items: ReadonlyArray<{ label: string; months: Months | 'reached' | null }>): { label: string; months: Months | 'reached' } | null {
  let best: { label: string; months: Months | 'reached' } | null = null;
  for (const it of items) {
    if (it.months === null) continue;
    if (best === null || monthsValue(it.months) < monthsValue(best.months)) best = { label: it.label, months: it.months };
  }
  return best;
}
