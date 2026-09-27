import { addDays, isDayKey } from '../date';

// Profil-Wachstum (Plan §12.3, A6.6): `app/profile` darf 256 KiB nicht überschreiten, die
// Datenbank höchstens 5.000 Dokumente halten. Gemessen werden die UTF-8-Bytes des Profils und der
// Zuwachs der Tageskarten (`days`, `xpDays`, `minutes`, `act`, `pflicht`) der letzten 90 Tage.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export const DOC_LIMIT_BYTES = 256 * 1024;
export const PROFILE_WARN_BYTES = 128 * 1024;
export const PROFILE_COMPACT_BYTES = 160 * 1024;
export const DOC_COUNT_LIMIT = 5000;
export const DOC_COUNT_WARN = 4000;
export const DAY_MAPS = ['days', 'xpDays', 'minutes', 'act', 'pflicht'] as const;

const encoder = new TextEncoder();
export const jsonBytes = (v: unknown): number => encoder.encode(JSON.stringify(v ?? null)).length;

export type ProfileSize = {
  bytes: number;
  /** Bytes der Tageskarten-Einträge der letzten 90 Tage (Zuwachs). */
  grow90: number;
  /** Jahre bis zur Grenze bei gleichem Tempo; `null` ohne Zuwachs. */
  yearsLeft: number | null;
  warn: boolean;
  compactable: boolean;
};

export function profileSize(profile: Doc | null | undefined, today: string): ProfileSize {
  const p = profile ?? {};
  const bytes = jsonBytes(p);
  const from = addDays(today, -89);
  let grow = 0;
  for (const k of DAY_MAPS) {
    for (const [d, v] of Object.entries(obj(p[k]))) {
      if (isDayKey(d) && d >= from && d <= today) grow += encoder.encode(`${JSON.stringify(d)}:${JSON.stringify(v ?? null)},`).length;
    }
  }
  const perYear = (grow / 90) * 365;
  const yearsLeft = perYear > 0 ? Math.max(0, Math.round(((DOC_LIMIT_BYTES - bytes) / perYear) * 10) / 10) : null;
  return { bytes, grow90: grow, yearsLeft, warn: bytes >= PROFILE_WARN_BYTES, compactable: bytes >= PROFILE_COMPACT_BYTES };
}

export type DocCount = { total: number; warn: boolean; byCollection: Record<string, number> };

export function docCount(byCollection: Record<string, number>): DocCount {
  const total = Object.values(byCollection).reduce((a, b) => a + b, 0);
  return { total, warn: total >= DOC_COUNT_WARN, byCollection };
}
