import type { TransformOp } from '../shared';
import { readDaysOf } from './count';
import type { Prefs } from './docs';
import { jsonBytes, READ_DOC_MAX_BYTES } from './size';

// Schreibpläne für `read/p` (Einstellungen, Themenverlauf, Lerntage). Rein: bekommen den FRISCHEN Stand (writer.transform).
// Nichts wird gelöscht; ein Dokument mit unerwartetem Aufbau (kein Objekt) wird nie angefasst.

type Doc = Record<string, unknown>;

/** Obergrenze der Themen-Merkliste (`lastTopics`). */
export const LAST_TOPICS_MAX = 10;
/** Höchstens so viele Lerntage in `days` (≈ 2,7 Jahre täglich; Wächter stoppt vorher, Plan §4.3). */
export const DAYS_MAX = 1000;

export type PrefsPatch = Partial<Pick<Prefs, 'topics' | 'custom' | 'perDay' | 'view' | 'autoSpeak'>>;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Einstellungen ändern (nur die übergebenen Felder; unverändert → kein Schreiben). */
export function prefsPatchPlan(cur: Doc | undefined, patch: PrefsPatch): TransformOp | null {
  const fields: Doc = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined && !same(cur?.[k], v)) fields[k] = v;
  if (Object.keys(fields).length === 0) return null;
  if (!cur) return { set: { v: 1, ...fields } };
  return { update: { ...(cur.v == null ? { v: 1 } : {}), ...fields } };
}

export type AfterSave = {
  /** Lerntag des gespeicherten Artikels. */
  day: string;
  /** Eindeutige Themenkennung (`topicId`), für die Abwertung beim nächsten Mal. */
  topicId: string;
  /** Artikel, die an diesem Tag jetzt im Index stehen. */
  countToday: number;
};

/**
 * Nach einem gespeicherten Artikel: Lerntag in `days` eintragen (neu berechnet aus dem frischen Stand, kein Zähler),
 * Themenverlauf und „heute erzeugt“ fortschreiben. Gibt `null` zurück, wenn sich nichts ändert.
 */
export function afterSavePlan(cur: Doc | undefined, a: AfterSave): TransformOp | null {
  const days = readDaysOf(cur);
  const nextDays = days.includes(a.day) ? days : [...days, a.day].sort().slice(-DAYS_MAX);
  const lastRaw = Array.isArray(cur?.lastTopics) ? (cur.lastTopics as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const last = [a.topicId, ...lastRaw].slice(0, LAST_TOPICS_MAX);
  const genOld = cur?.gen && typeof cur.gen === 'object' ? (cur.gen as { d?: unknown; n?: unknown }) : null;
  const gen = { d: a.day, n: Math.max(a.countToday, genOld && genOld.d === a.day && typeof genOld.n === 'number' ? genOld.n : 0) };
  const fields: Doc = { days: nextDays, lastTopics: last, gen };
  const changed: Doc = {};
  for (const [k, v] of Object.entries(fields)) if (!same(cur?.[k], v)) changed[k] = v;
  if (Object.keys(changed).length === 0) return null;
  const body = cur ? { ...(cur.v == null ? { v: 1 } : {}), ...changed } : { v: 1, ...changed };
  if (jsonBytes({ ...(cur ?? {}), ...body }) > READ_DOC_MAX_BYTES) return null;
  return cur ? { update: body } : { set: body };
}
