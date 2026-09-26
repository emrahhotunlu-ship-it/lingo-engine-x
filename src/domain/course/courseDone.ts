import { validateDoc } from '../../data/validate';
import type { LessonDone } from '../learn/types';

// Kursstand `app/course.done` (phase2-plan §4.7, Daten-Entwurf §6.1). Der erste Abschluss einer
// Lektion bleibt stehen; eine Wiederholung schreibt nur `last`. `res` wird nie angefasst.

type Doc = Record<string, unknown>;

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : -Infinity);

export type CourseOp = { set: Doc } | { update: Doc } | null;

/** Abschluss eintragen; `null` = nichts zu tun (ungültig oder schon eingetragen). */
export function courseDone(cur: Readonly<Doc> | undefined, d: LessonDone): CourseOp {
  const e = { d: d.day, t: d.t, n: d.n, ok: d.ok };
  if (!cur) return { set: { done: { [d.lid]: e }, res: {} } };
  if (!validateDoc('app/course', cur).ok) return null;
  const done = obj(cur.done);
  const prev = done[d.lid];
  if (!prev || typeof prev !== 'object') return { update: { done: { [d.lid]: e } } };
  const p = prev as Doc;
  if (num(p.t) >= d.t || num(obj(p.last).t) >= d.t) return null;
  return { update: { done: { [d.lid]: { last: e } } } };
}

/** Ist die Lektion erledigt (irgendwann)? Wie die alte App: jeder Eintrag zählt. */
export function isLessonDone(course: Readonly<Doc> | null | undefined, lid: string): boolean {
  return !!obj(course?.done)[lid];
}

/** D10: An diesem Lerntag wurde irgendeine Lektion abgeschlossen (erstmals oder als Wiederholung). */
export function lessonDoneOn(course: Readonly<Doc> | null | undefined, day: string): boolean {
  for (const v of Object.values(obj(course?.done))) {
    const e = obj(v);
    if (e.d === day || obj(e.last).d === day) return true;
  }
  return false;
}

/** Kennungen der erledigten Lektionen. */
export function doneLessons(course: Readonly<Doc> | null | undefined): Set<string> {
  return new Set(Object.entries(obj(course?.done)).filter(([, v]) => !!v).map(([k]) => k));
}
