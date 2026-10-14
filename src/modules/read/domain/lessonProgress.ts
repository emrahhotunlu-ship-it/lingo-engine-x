import { z } from 'zod';
import type { TransformOp } from '../shared';
import { courseDef, parseLessonKey } from './courses';
import type { CourseDef, CourseId } from './courses';
import { jsonBytes, READ_DOC_MAX_BYTES } from './size';

// Kursfortschritt (Paket L8): das App-Dokument `read/cp`. NUR die App schreibt, die Routine liest höchstens (um zu wissen, wie weit
// Emrah ist). Rein: jede Funktion bekommt den FRISCHEN Stand (writer.transform) und liefert, was zu tun ist. Nichts wird gelöscht.
//
//   read/cp = { v: 1, items: [Eintrag je Lektion] }, Eintrag = { id:'k1-03', course, n, t0, sec, pos, rd, qa, qok, ap, mine, done, tD, ph }
//
// „Fertig“ = Text zu Ende gelesen (`rd`) + alle drei Prüffragen beantwortet (`qa` = 3) + Anwenden abgeschickt (`ap`). Fertig ist ein
// Zustand, kein Knopf (Kap. 2 Nr. 2): er wird einmal gesetzt und nie zurückgenommen.

type Doc = Record<string, unknown>;

export const LESSON_QUESTIONS_COUNT = 3;
export const MINE_MAX_CHARS = 700;
export const PHRASES_KEPT = 5;
export const CP_MAX_ITEMS = 200;

const num = z.number().nullish();
const bool = z.boolean().nullish();

/** Eine Wendung der fertigen Lektion mit ihrem Satz (Grundlage der Aufwärm-Lücken späterer Lektionen). */
export const keptPhraseSchema = z.looseObject({ w: z.string().min(1), de: z.string().nullish(), e: z.string().min(1) });
export type KeptPhrase = { w: string; de?: string | null; e: string };

export const lessonEntrySchema = z.looseObject({
  id: z.string().min(1),
  course: z.string().nullish(),
  n: num,
  t0: num,
  /** Gelesene Sekunden (nur Maximum). */
  sec: num,
  /** Zuletzt gelesener Satz. */
  pos: num,
  /** Text zu Ende gelesen. */
  rd: bool,
  /** Beantwortete Prüffragen und davon richtig. */
  qa: num,
  qok: num,
  /** Anwenden abgeschickt, mit dem eigenen Text. */
  ap: bool,
  mine: z.string().nullish(),
  done: bool,
  /** Zeitpunkt, an dem die Lektion fertig wurde (ms). */
  tD: num,
  ph: z.array(keptPhraseSchema).nullish(),
});
export type LessonEntry = {
  id: string;
  course?: string | null;
  n?: number | null;
  t0?: number | null;
  sec?: number | null;
  pos?: number | null;
  rd?: boolean | null;
  qa?: number | null;
  qok?: number | null;
  ap?: boolean | null;
  mine?: string | null;
  done?: boolean | null;
  tD?: number | null;
  ph?: KeptPhrase[] | null;
};

export const progressDocSchema = z.looseObject({ v: num, items: z.array(z.looseObject({})).nullish() });

export type ProgressDoc = { ok: true; items: LessonEntry[]; hidden: string[] } | { ok: false; reason: 'invalid_doc' };

const idOf = (x: unknown): string => (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' ? (x as { id: string }).id : '?');

/** `read/cp` lesen. Ein kaputter Eintrag wird ausgeblendet, nie gelöscht; ein Dokument ohne Listenaufbau ist unbrauchbar (dann nie darauf schreiben). */
export function parseProgress(data: Doc | undefined | null): ProgressDoc {
  if (!data) return { ok: true, items: [], hidden: [] };
  const head = progressDocSchema.safeParse(data);
  if (!head.success) return { ok: false, reason: 'invalid_doc' };
  const items: LessonEntry[] = [];
  const hidden: string[] = [];
  for (const raw of head.data.items ?? []) {
    const r = lessonEntrySchema.safeParse(raw);
    if (r.success && parseLessonKey(r.data.id)) items.push(r.data);
    else hidden.push(idOf(raw));
  }
  return { ok: true, items, hidden };
}

export type LessonStatus = 'open' | 'started' | 'done';

/** Zustand einer Lektion nach ihrem Eintrag. */
export function entryStatus(e: LessonEntry | null | undefined): LessonStatus {
  if (!e) return 'open';
  if (e.done === true) return 'done';
  if ((e.sec ?? 0) > 0 || (e.pos ?? 0) > 1 || e.rd === true || (e.qa ?? 0) > 0 || e.ap === true) return 'started';
  return 'open';
}

/** Alle drei Teile erfüllt? */
export const isComplete = (e: Pick<LessonEntry, 'rd' | 'qa' | 'ap'>): boolean => e.rd === true && (e.qa ?? 0) >= LESSON_QUESTIONS_COUNT && e.ap === true;

const maxNum = (a: unknown, b: unknown): number => Math.max(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 0);

/**
 * Eintrag fortschreiben (zwei Geräte): Zeit, Fragen nur nach oben (Maximum), `rd`/`ap`/`done` nur von falsch auf wahr, `t0` der erste Beginn,
 * `mine` der neuere Text, `ph` einmal gesetzt. `done` ergibt sich, sobald alle drei Teile erfüllt sind; `tD` hält den ersten Zeitpunkt fest.
 */
export function mergeEntry(old: LessonEntry | null | undefined, patch: Partial<LessonEntry>, now: number): LessonEntry {
  const o = old ?? ({ id: patch.id ?? '' });
  const out: LessonEntry = { ...o, ...patch, id: o.id || (patch.id ?? '') };
  out.sec = maxNum(o.sec, patch.sec);
  out.qa = maxNum(o.qa, patch.qa);
  const takePatchQ = patch.qa != null && patch.qa >= (o.qa ?? 0);
  out.qok = takePatchQ ? (patch.qok ?? 0) : (o.qok ?? 0);
  out.rd = o.rd === true || patch.rd === true;
  out.ap = o.ap === true || patch.ap === true;
  const t0 = [o.t0, patch.t0].filter((x): x is number => typeof x === 'number' && x > 0);
  if (t0.length) out.t0 = Math.min(...t0);
  if (patch.pos == null) out.pos = o.pos ?? 0;
  if (typeof patch.mine === 'string') out.mine = Array.from(patch.mine).slice(0, MINE_MAX_CHARS).join('');
  else if (o.mine != null) out.mine = o.mine;
  out.ph = (o.ph && o.ph.length > 0 ? o.ph : patch.ph)?.slice(0, PHRASES_KEPT) ?? undefined;
  if (out.ph === undefined) delete out.ph;
  const done = o.done === true || isComplete(out);
  out.done = done;
  if (done) out.tD = typeof o.tD === 'number' && o.tD > 0 ? o.tD : now;
  return out;
}

/** Schreibplan für eine Lektion in `read/cp`. Ein Dokument mit unerwartetem Aufbau wird nie angefasst; ohne Änderung `null`. */
export function lessonStatePlan(cur: Doc | undefined, key: string, patch: Partial<LessonEntry>, now: number): { op: TransformOp | null; outcome: 'updated' | 'created' | 'unchanged' | 'invalid_doc' | 'invalid_key' | 'too_big' } {
  const parsed = parseLessonKey(key);
  if (!parsed) return { op: null, outcome: 'invalid_key' };
  const base: Partial<LessonEntry> = { id: key, course: parsed.course, n: parsed.n, ...patch };
  if (!cur) {
    const entry = mergeEntry(null, base, now);
    return { op: { set: { v: 1, items: [entry] } }, outcome: 'created' };
  }
  const head = progressDocSchema.safeParse(cur);
  if (!head.success) return { op: null, outcome: 'invalid_doc' };
  const rawItems = Array.isArray(cur.items) ? (cur.items as unknown[]) : [];
  let hit = false;
  let changed = false;
  const next = rawItems.map((x) => {
    if (!x || typeof x !== 'object' || (x as { id?: unknown }).id !== key) return x;
    hit = true;
    const merged = mergeEntry(x as LessonEntry, base, now);
    // Verglichen wird mit dem Eintrag in Normalform (Vorgabewerte ergänzt): so schreibt ein unveränderter Stand nichts.
    if (JSON.stringify(merged) !== JSON.stringify(mergeEntry(x as LessonEntry, {}, now))) changed = true;
    return merged;
  });
  if (!hit) {
    if (rawItems.length >= CP_MAX_ITEMS) return { op: null, outcome: 'too_big' };
    const entry = mergeEntry(null, base, now);
    const items = [...rawItems, entry];
    if (jsonBytes({ ...cur, items }) > READ_DOC_MAX_BYTES) return { op: null, outcome: 'too_big' };
    return { op: { update: { items, ...(cur.v == null ? { v: 1 } : {}) } }, outcome: 'created' };
  }
  if (!changed) return { op: null, outcome: 'unchanged' };
  if (jsonBytes({ ...cur, items: next }) > READ_DOC_MAX_BYTES) return { op: null, outcome: 'too_big' };
  return { op: { update: { items: next } }, outcome: 'updated' };
}

// ---------------------------------------------------------------- Zustände einer Kursliste

export type LessonRowState = 'locked' | 'pending' | 'open' | 'started' | 'done';
export type LessonRow = { n: number; key: string; state: LessonRowState };

/** Die erste Lektion eines Kurses, die noch nicht fertig ist (`null`, wenn der Kurs durch ist). Lektion n+1 kommt erst nach n. */
export function firstUnfinished(def: Pick<CourseDef, 'lessons'>, entries: readonly LessonEntry[], course: CourseId): number | null {
  const done = new Set(entries.filter((e) => e.course === course && e.done === true).map((e) => e.n ?? 0));
  for (let n = 1; n <= def.lessons; n++) if (!done.has(n)) return n;
  return null;
}

/**
 * Zustand jeder Lektion eines Kurses: fertig · die aktuelle (angefangen, offen oder noch nicht bereit = `pending`, wenn die Routine sie noch
 * nicht geschrieben hat oder sie die Prüftore nicht bestand) · alle danach gesperrt (Lektion n+1 nach n).
 * `ready` sagt nur, ob das Dokument der AKTUELLEN Lektion vorhanden und gültig ist; weitere Dokumente liest die App nicht.
 */
export function courseRows(courseId: CourseId, entries: readonly LessonEntry[], ready: boolean): LessonRow[] {
  const def = courseDef(courseId);
  if (!def) return [];
  const mine = entries.filter((e) => e.course === courseId);
  const cur = firstUnfinished(def, mine, courseId);
  const rows: LessonRow[] = [];
  for (let n = 1; n <= def.lessons; n++) {
    const key = `${courseId}-${String(n).padStart(2, '0')}`;
    const entry = mine.find((e) => e.n === n);
    let state: LessonRowState;
    if (entry?.done === true) state = 'done';
    else if (cur === n) state = ready ? entryStatus(entry) : 'pending';
    else state = 'locked';
    rows.push({ n, key, state });
  }
  return rows;
}

export type NextLesson = { course: CourseId; n: number; key: string; state: 'open' | 'started' };

/**
 * Welche Lektion bietet der Hauptknopf an? Zuerst eine angefangene, sonst die nächste bereite aus dem Kurs, den Emrah am längsten nicht mehr hatte
 * (so wechseln sich zwei laufende Kurse ab). `readyByCourse` = Kurse, deren aktuelle Lektion bereit ist. `null`, wenn nichts bereit ist.
 */
export function pickNextLesson(defs: readonly CourseDef[], entries: readonly LessonEntry[], readyByCourse: ReadonlySet<CourseId>): NextLesson | null {
  const candidates: Array<{ course: CourseId; n: number; state: 'open' | 'started'; last: number }> = [];
  for (const def of defs) {
    if (!readyByCourse.has(def.id)) continue;
    const mine = entries.filter((e) => e.course === def.id);
    const n = firstUnfinished(def, mine, def.id);
    if (n === null) continue;
    const state = entryStatus(mine.find((e) => e.n === n)) === 'started' ? 'started' : 'open';
    const last = mine.reduce((a, e) => Math.max(a, e.tD ?? 0, e.t0 ?? 0), 0);
    candidates.push({ course: def.id, n, state, last });
  }
  const pick = candidates.find((c) => c.state === 'started') ?? [...candidates].sort((a, b) => a.last - b.last)[0];
  return pick ? { course: pick.course, n: pick.n, key: `${pick.course}-${String(pick.n).padStart(2, '0')}`, state: pick.state } : null;
}

/** Wurde heute (Lerntag) schon eine Lektion fertig? Dann bietet der Hauptknopf nicht gleich die nächste an (Lektionen sind Extra, 3 bis 4 je Woche). */
export function finishedToday(entries: readonly LessonEntry[], dayOf: (ms: number) => string, today: string): boolean {
  return entries.some((e) => e.done === true && typeof e.tD === 'number' && e.tD > 0 && dayOf(e.tD) === today);
}

/** Fertige Lektionen und Gesamtzahl eines Kurses. */
export function courseProgress(courseId: CourseId, entries: readonly LessonEntry[]): { done: number; total: number } {
  const def = courseDef(courseId);
  const done = new Set(entries.filter((e) => e.course === courseId && e.done === true).map((e) => e.n ?? 0)).size;
  return { done, total: def?.lessons ?? 0 };
}
