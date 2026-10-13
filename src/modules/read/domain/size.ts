import type { ArticleItem, IndexItem } from '../schemas';

// Größenrechnung (docs/umbau/lesen-plan.md §4.2, A6 Nr. 6): Die Datenbank erlaubt 256 KiB je Dokument (contract/db.d.ts);
// das Modul schreibt nur bis 200 KiB, damit Reserve für Fremdfelder und spätere Ergänzungen bleibt.

const encoder = new TextEncoder();

/** UTF-8-Größe der JSON-Darstellung (so zählt auch die Datenbank). */
export const jsonBytes = (v: unknown): number => encoder.encode(JSON.stringify(v)).length;

/** Harte Grenze der Datenbank je Dokument. */
export const DB_DOC_LIMIT_BYTES = 256 * 1024;
/** Eigene Obergrenze vor jedem Schreiben (Wächter). */
export const READ_DOC_MAX_BYTES = 200 * 1024;
/** Ein einzelner Artikel darf höchstens so groß sein (Plan: ≈ 10 KB, 800 Wörter ≈ 14 KB). */
export const ARTICLE_MAX_BYTES = 24 * 1024;
/** Obergrenze je Lesetag (Einstellung „höchstens 8 Artikel“). */
export const MAX_ARTICLES_PER_DAY = 8;
/** Einträge im Monatsindex höchstens (4/Tag × 31 = 124; reichlich Luft). */
export const MONTH_INDEX_MAX_ITEMS = 400;

export const articleBytes = (a: ArticleItem): number => jsonBytes(a);

/** Größe eines Tagesdokuments, wenn `item` hinzukäme (Komma und Gerüst eingerechnet). */
export function dayBytesWith(items: readonly unknown[], item: unknown, day = '0000-00-00'): number {
  const base = jsonBytes({ v: 1, day, items: [] });
  return base + items.reduce<number>((a, x) => a + jsonBytes(x) + 1, 0) + jsonBytes(item);
}

export type SizeVerdict = { ok: true; bytes: number } | { ok: false; reason: 'article_too_big' | 'doc_too_big' | 'day_full'; bytes: number };

/** Passt der Artikel noch ins Tagesdokument? (Größe, Artikel je Tag.) */
export function checkDayFits(items: readonly unknown[], item: ArticleItem, day: string, perDayMax = MAX_ARTICLES_PER_DAY): SizeVerdict {
  const a = articleBytes(item);
  if (a > ARTICLE_MAX_BYTES) return { ok: false, reason: 'article_too_big', bytes: a };
  if (items.length >= perDayMax) return { ok: false, reason: 'day_full', bytes: a };
  const total = dayBytesWith(items, item, day);
  if (total > READ_DOC_MAX_BYTES) return { ok: false, reason: 'doc_too_big', bytes: total };
  return { ok: true, bytes: total };
}

/** Passt ein weiterer Eintrag in den Monatsindex? */
export function checkMonthFits(items: readonly unknown[], entry: IndexItem, month = '0000-00'): SizeVerdict {
  const base = jsonBytes({ v: 1, month, items: [] });
  const total = base + items.reduce<number>((a, x) => a + jsonBytes(x) + 1, 0) + jsonBytes(entry) + 1;
  if (items.length >= MONTH_INDEX_MAX_ITEMS || total > READ_DOC_MAX_BYTES) return { ok: false, reason: 'doc_too_big', bytes: total };
  return { ok: true, bytes: total };
}
