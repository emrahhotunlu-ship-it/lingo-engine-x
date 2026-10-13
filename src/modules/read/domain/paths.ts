import { isDayKey } from '../shared';

// Pfade und Kennungen des Lesen-Moduls (docs/umbau/lesen-plan.md §4.1). Alles rein.

export const READ_COLLECTION = 'read';
/** Einstellungen. */
export const READ_PREFS_PATH = 'read/p';

const MONTH_RE = /^\d{4}-\d{2}$/;

export const monthOfDay = (day: string): string => day.slice(0, 7);
export const readDayPath = (day: string): string => `read/d-${day}`;
export const readMonthPath = (month: string): string => `read/m-${month}`;
/** Monatsindex, in dem ein Lerntag liegt. */
export const readMonthPathOfDay = (day: string): string => readMonthPath(monthOfDay(day));

export type ReadDocKind = 'day' | 'month' | 'prefs' | 'unknown';

/** Art eines Dokuments der Sammlung `read` nach seinem Pfad. */
export function readDocKind(path: string): ReadDocKind {
  if (path === READ_PREFS_PATH) return 'prefs';
  const m = /^read\/(d|m)-(.+)$/.exec(path);
  if (!m) return 'unknown';
  if (m[1] === 'd') return isDayKey(m[2]) ? 'day' : 'unknown';
  return MONTH_RE.test(m[2] ?? '') ? 'month' : 'unknown';
}

/** Kurzer, stabiler Streuwert (FNV-1a, Basis 36, 6 Zeichen) über Thema und Titel. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(6, '0').slice(-6);
}

/** Deterministische Artikel-Kennung `a-<Tag>-<laufende Nr.>-<Streuwert(Thema+Titel)>` (Plan §4.4). */
export function articleId(day: string, n: number, topic: string, title: string): string {
  return `a-${day}-${Math.max(1, Math.floor(n))}-${shortHash(`${topic}\n${title}`)}`;
}

/** Tag einer Artikel-Kennung (`a-2026-10-13-2-abc123` → `2026-10-13`), sonst null. */
export function dayOfArticleId(id: string): string | null {
  const m = /^a-(\d{4}-\d{2}-\d{2})-\d+-[0-9a-z]+$/.exec(id);
  return m ? (m[1] ?? null) : null;
}
