import { validateDoc } from '../../data/validate';
import { logWarn } from '../../platform/diagnostics';
import { jsonBytes, monthOf, upsertById } from '../speak/talkDoc';

// Lehrer-Feedback als Monatsdokument `teacher/<JJJJ-MM>` (28.09.2026, ersetzt die Preply-Brücke):
// ein Eintrag je verarbeitetem Text, idempotent über `id`. Grenzen wie `out/<Monat>`
// (domain/nbdrill/outDoc.ts, data-guard, Kap. 9 Regel 6):
// - höchstens 200 Einträge (die ältesten fallen weg, nie still),
// - `raw` höchstens 4 KB,
// - das Dokument bleibt unter 200 KiB: verdichtet wird zuerst `raw` der ältesten.

type Doc = Record<string, unknown>;

export const TEACHER_DOC_MAX_BYTES = 200 * 1024;
export const TEACHER_MAX_ITEMS = 200;
export const TEACHER_RAW_MAX_BYTES = 4096;

export type TeacherCorrection = { wrong: string; right: string; why: string };
export type TeacherWord = { en: string; de: string; pos: string; ex: string; fromLesson: boolean };

export type TeacherItem = {
  id: string;
  t: number;
  lang: string;
  raw: string;
  title: string;
  summary: string;
  corrections: TeacherCorrection[];
  words: TeacherWord[];
  tasks: string[];
};

const encoder = new TextEncoder();
const bytes = (s: string) => encoder.encode(s).length;

/** Text auf höchstens `max` Bytes (UTF-8) kürzen, mit „…“. */
export function clipRaw(s: string, max = TEACHER_RAW_MAX_BYTES): string {
  if (bytes(s) <= max) return s;
  const chars = Array.from(s);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (bytes(chars.slice(0, mid).join('')) + 3 <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join('').trimEnd()}…`;
}

const objOf = (x: unknown): Doc => (x && typeof x === 'object' && !Array.isArray(x) ? { ...(x as Doc) } : {});

/**
 * Verdichtet die Liste (älteste zuerst): höchstens 200 Einträge, dann `raw` der ältesten leeren,
 * bis das Dokument unter 200 KiB liegt. `keepId` (der gerade geschriebene) bleibt immer vollständig.
 */
export function compactTeacher(items: readonly unknown[], month = '0000-00', keepId?: string): unknown[] {
  let list = items.map(objOf);
  if (list.length > TEACHER_MAX_ITEMS) {
    logWarn('teacher:compact:drop', new Error(`${list.length - TEACHER_MAX_ITEMS} oldest teacher entries removed (max ${TEACHER_MAX_ITEMS})`), month);
    list = list.slice(list.length - TEACHER_MAX_ITEMS);
  }
  const base = jsonBytes({ v: 1, items: [] });
  let total = base + list.reduce((a, x) => a + jsonBytes(x), 0) + Math.max(0, list.length - 1);
  for (let i = 0; i < list.length && total > TEACHER_DOC_MAX_BYTES; i++) {
    const cur = list[i];
    if (!cur || (keepId !== undefined && cur.id === keepId) || !('raw' in cur)) continue;
    const before = jsonBytes(cur);
    const next = { ...cur };
    delete next.raw;
    const after = jsonBytes(next);
    total += after - before;
    list[i] = next;
  }
  let dropped = 0;
  while (total > TEACHER_DOC_MAX_BYTES && list.length > 1) {
    const i = list.findIndex((x) => keepId === undefined || x.id !== keepId);
    if (i < 0) break;
    total -= jsonBytes(list[i]) + 1;
    list.splice(i, 1);
    dropped++;
  }
  if (dropped) logWarn('teacher:compact:drop', new Error(`${dropped} oldest teacher entries removed to stay under ${TEACHER_DOC_MAX_BYTES} bytes`), month);
  return list;
}

/** Pfad des Monatsdokuments eines Lerntags. */
export const teacherPath = (day: string): string => `teacher/${monthOf(day)}`;

/** Kennung eines Eintrags: Beginn (Basis 36). */
export const teacherId = (t: number): string => `tf-${Math.max(0, Math.floor(t)).toString(36)}`;

/** Eintrag in Speicherform: `raw` gekappt. */
function teacherEntry(i: TeacherItem): Doc {
  return {
    id: i.id,
    t: Math.max(0, Math.floor(i.t)),
    lang: i.lang,
    raw: clipRaw(i.raw),
    title: i.title,
    summary: i.summary,
    corrections: i.corrections,
    words: i.words,
    tasks: i.tasks,
  };
}

/** Schreibvorgang für `teacher/<Monat>` aus dem frischen Stand (writer.transform). `null` = nichts schreiben. */
export function upsertTeacher(cur: Doc | undefined, day: string, item: TeacherItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(day);
  const entry = teacherEntry(item);
  if (!cur) return { set: { v: 1, items: compactTeacher([entry], month, item.id) } };
  if (!validateDoc(teacherPath(day), cur).ok) return null;
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactTeacher(upsertById(list, { ...entry, id: item.id, t: entry.t as number }), month, item.id) } };
}
