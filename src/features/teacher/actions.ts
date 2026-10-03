import { getWriter } from '../../data';
import { dayKey } from '../../domain/date';
import { repairsFromTeacher } from '../../domain/repair/sources';
import { teacherId, teacherPath, upsertTeacher, type TeacherItem } from '../../domain/teacher/store';
import { logError } from '../../platform/diagnostics';
import { addWord, type AddOutcome } from '../vocab/list/actions';
import { saveRepairs } from '../repair/store';
import type { TeacherOut } from '../../prompts/teacherFeedback';

// Schreibwege „Lehrer-Feedback einfügen“ (28.09.2026, ersetzt die Preply-Brücke), nur über den
// einen Writer: der eingefügte Text + das Ergebnis als ein Eintrag in `teacher/<Monat>` (E5-13
// analog), Kartenvorschläge über den vorhandenen Weg (`addWord`, Stapel „Lehrer“), Korrekturen als
// Reparatur-Sätze (`app/repair`).

/** Ergebnis speichern (immer, unabhängig davon, was Emrah übernimmt). */
export async function saveTeacherFeedback(raw: string, out: TeacherOut, lang: string): Promise<TeacherItem | null> {
  const writer = getWriter();
  if (!writer) return null;
  const ms = Date.now();
  const day = dayKey(ms);
  const item: TeacherItem = { id: teacherId(ms), t: ms, lang, raw, title: out.title, summary: out.summary, corrections: out.corrections, words: out.words, tasks: out.tasks };
  try {
    await writer.transform(teacherPath(day), (cur) => upsertTeacher(cur, day, item));
    return item;
  } catch (err) {
    logError('teacher:save', err, teacherPath(day));
    return null;
  }
}

/** Kartenvorschlag übernehmen: Ursprungssatz Pflicht, Stapel/Quelle „Lehrer“ (`teacher`). */
export async function addTeacherWord(w: { word: string; de: string; pos?: string | null; ex: string }, today: string): Promise<AddOutcome> {
  if (!w.ex.trim()) return 'invalid';
  return addWord({ word: w.word, de: w.de, pos: w.pos ?? null, ex: w.ex }, 'teacher', today);
}

/** Ausgewählte Korrekturen als Reparatur-Sätze übernehmen (vorhandenes `app/repair`). */
export async function applyTeacherCorrections(corrections: ReadonlyArray<{ wrong: string; right: string; why: string }>, sel: readonly number[], ctx: string): Promise<boolean> {
  const repairs = repairsFromTeacher(corrections, sel, ctx || 'Lehrer-Feedback');
  if (!repairs.length) return true;
  return saveRepairs(repairs);
}
