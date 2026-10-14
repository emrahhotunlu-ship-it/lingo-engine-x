import { logError, logWarn } from './shared';
import type { Writer } from './shared';
import { ACTIVE_COURSES, courseDef } from './domain/courses';
import type { CourseId } from './domain/courses';
import { acceptLesson } from './domain/lesson';
import type { Lesson } from './domain/lesson';
import { firstUnfinished, lessonStatePlan, parseProgress, pickNextLesson } from './domain/lessonProgress';
import type { LessonEntry, NextLesson } from './domain/lessonProgress';
import { readLessonPath, READ_PROGRESS_PATH } from './domain/paths';
import { notifyReadStateSaved } from './store';
import type { Reader } from './store';

// Zugriff auf die Kurse (Paket L8, docs/umbau/lesen-routine-kurse.md). Gelesen wird träge: `read/cp` und je aktivem Kurs genau das eine
// Dokument der aktuellen Lektion (nie die Sammlung, nie alle Lektionen). Geschrieben wird nur `read/cp` (App-eigen) und nur auf eine
// Handlung hin, über den einen Schreibpfad. Die Lektionsdokumente schreibt allein die Routine; hier gibt es kein Schreiben und kein Löschen.

export type LessonLoad =
  | { status: 'ready'; lesson: Lesson }
  | { status: 'missing' }
  | { status: 'hidden'; reason: string }
  | { status: 'failed' };

/** Eine Lektion lesen und streng prüfen. Fehlend ist normal (die Routine hat sie noch nicht geschrieben), Durchfallen blendet sie aus (Protokoll). */
export async function loadLesson(read: Reader, course: CourseId, n: number): Promise<LessonLoad> {
  const path = readLessonPath(course, n);
  let doc: Record<string, unknown> | undefined;
  try {
    doc = await read(path);
  } catch (err) {
    logWarn('read:lesson', err, path);
    return { status: 'failed' };
  }
  if (!doc) return { status: 'missing' };
  const res = acceptLesson(doc, { course, n });
  if (!res.ok) {
    logWarn('read:lesson', { code: 'lesson_hidden', message: res.reason }, path);
    return { status: 'hidden', reason: res.reason };
  }
  return { status: 'ready', lesson: res.lesson };
}

export type CourseHome = {
  entries: LessonEntry[];
  /** Einträge in `read/cp` mit unerwartetem Aufbau (ausgeblendet, nie gelöscht). */
  hidden: number;
  /** `read/cp` hat keinen lesbaren Aufbau: es wird nie darauf geschrieben. */
  progressInvalid: boolean;
  /** Je aktivem Kurs: ist die aktuelle Lektion bereit (Dokument da und gültig)? */
  ready: Set<CourseId>;
  /** Die Lektion für den Hauptknopf (angefangen, sonst die nächste bereite) oder `null`. */
  next: NextLesson | null;
};

/** Fortschritt und die aktuelle Lektion jedes aktiven Kurses lesen (höchstens 1 + 2 kleine Zugriffe). */
export async function loadCourseHome(read: Reader): Promise<CourseHome> {
  let cp: Record<string, unknown> | undefined;
  try {
    cp = await read(READ_PROGRESS_PATH);
  } catch (err) {
    logError('read:courses', err, READ_PROGRESS_PATH);
    throw err;
  }
  const parsed = parseProgress(cp);
  const entries = parsed.ok ? parsed.items : [];
  if (!parsed.ok) logWarn('read:courses', { code: 'invalid_doc', message: 'read/cp hat keinen lesbaren Aufbau' }, READ_PROGRESS_PATH);
  const ready = new Set<CourseId>();
  await Promise.all(
    ACTIVE_COURSES.map(async (def) => {
      const n = firstUnfinished(def, entries, def.id);
      if (n === null) return;
      const res = await loadLesson(read, def.id, n);
      if (res.status === 'ready') ready.add(def.id);
    }),
  );
  return { entries, hidden: parsed.ok ? parsed.hidden.length : 0, progressInvalid: !parsed.ok, ready, next: pickNextLesson(ACTIVE_COURSES, entries, ready) };
}

/**
 * Fortschritt einer Lektion fortschreiben: lesen, rechnen, schreiben in EINEM Schritt (`writer.transform`), nur Zeit, Fragen, Anwenden und
 * Abschluss werden nur aufwärts gesetzt. `read/cp` mit unerwartetem Aufbau wird nie angefasst. Gibt zurück, ob etwas geschrieben wurde.
 */
export async function saveLessonProgress(writer: Writer, key: string, patch: Partial<LessonEntry>, now: number = Date.now()): Promise<'saved' | 'unchanged' | 'blocked'> {
  const box: { outcome: string } = { outcome: 'unchanged' };
  try {
    await writer.transform(READ_PROGRESS_PATH, (cur) => {
      const plan = lessonStatePlan(cur, key, patch, now);
      box.outcome = plan.outcome;
      return plan.op;
    });
  } catch (err) {
    logError('read:courses', err, READ_PROGRESS_PATH);
    throw err;
  }
  if (box.outcome === 'invalid_doc' || box.outcome === 'too_big' || box.outcome === 'invalid_key') {
    logWarn('read:courses', { code: box.outcome, message: `${key} nicht gespeichert` }, READ_PROGRESS_PATH);
    return 'blocked';
  }
  if (box.outcome === 'unchanged') return 'unchanged';
  notifyReadStateSaved();
  return 'saved';
}

/** Anzeigename eines Kurses (Katalog); unbekannte Kurse gibt es nicht. */
export const courseTitle = (id: string, lang: 'de' | 'en'): string => {
  const def = courseDef(id);
  return def ? (lang === 'de' ? def.titleDe : def.titleEn) : id;
};
