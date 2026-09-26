import { validateDoc } from '../../data/validate';
import { normalizeTask } from '../grammar/tasks';
import type { GrammarTask, LessonContent, LessonMeta } from '../learn/types';
import type { Lang } from '../srs/types';
import { asText } from '../text/str';

// Lektionsinhalt `lesson/<lid>` im Format der alten App (phase2-plan §4.8, Daten-Entwurf §6.2).
// - Lesen: gespeicherte Fragen kennen beide Sprachen (`q`/`q_alt`); alte Fragen ohne `lang`
//   gelten als Deutsch. Aufgaben werden wie überall mit `normalizeTask` gelesen.
// - Schreiben: fehlt → anlegen; mindestens ein Wort vorhanden → nichts (das Gespeicherte gilt,
//   l07/l08 bleiben unberührt); gültig, aber ohne Wörter → nur die leeren Felder ergänzen + `lx.regen`;
//   ungültig → nie. Die Grundfassung wird nie gespeichert.

type Doc = Record<string, unknown>;

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const str = (v: unknown): string => asText(v).trim();
const strs = (v: unknown): string[] => arr(v).map(asText).map((s) => s.trim()).filter(Boolean);

/** Frage in der Oberflächensprache (wie `qInLang` der alten App). */
export function questionInLang(q: Readonly<Doc>, lang: Lang): { q: string; options: string[]; answer: string } | null {
  const stored = str(q.lang) || 'de';
  const options = strs(q.options);
  const answer = str(q.answer);
  const base = { q: str(q.q), options, answer };
  let out = base;
  if (stored !== lang && str(q.q_alt)) {
    const alt = strs(q.options_alt);
    const altAnswer = str(q.answer_alt);
    out = { q: str(q.q_alt), options: alt.length === options.length ? alt : options, answer: alt.length === options.length && altAnswer ? altAnswer : answer };
  }
  if (!out.q || out.options.length < 2 || !out.options.includes(out.answer)) return null;
  return out;
}

/** Gespeicherte Lektion lesen; `null`, wenn es keine Wörter gibt (dann gilt KI oder Grundfassung). */
export function readLesson(doc: Readonly<Doc> | null | undefined, lang: Lang, meta: LessonMeta): LessonContent | null {
  if (!doc) return null;
  const words = arr(doc.words)
    .map(obj)
    .map((w) => ({ en: str(w.en), de: str(w.de), pos: str(w.pos) || 'phrase', def: str(w.def), ex: str(w.ex) }))
    .filter((w) => w.en);
  if (!words.length) return null;
  const dlg = obj(doc.dialogue);
  const lines = arr(dlg.lines)
    .map(obj)
    .map((l) => ({ sp: str(l.sp), en: str(l.en), de: str(l.de) }))
    .filter((l) => l.en);
  const questions = arr(doc.questions)
    .map((q) => questionInLang(obj(q), lang))
    .filter((q): q is NonNullable<typeof q> => !!q);
  const tasks = arr(doc.tasks)
    .map((t) => normalizeTask({ ...obj(t), topic: str(obj(t).topic) || meta.grammar }, 'lesson', `lesson/${meta.id}`))
    .filter((t): t is GrammarTask => !!t);
  const out = obj(doc.output);
  const output = str(out.de) || str(out.en) ? { de: str(out.de) || str(out.en), en: str(out.en) || str(out.de), mustUse: strs(out.mustUse) } : null;
  return { words, dialogue: { title: str(dlg.title) || meta.en, lines }, questions, tasks, output, source: 'db' };
}

export type LessonWriteOp = { set: Doc } | { update: Doc } | null;

/** Schreibweg `lesson/<lid>` für einen erfolgreich erzeugten Inhalt (`out` = Speicherform). */
export function lessonWrite(cur: Readonly<Doc> | undefined, out: Readonly<Doc>, lid: string): LessonWriteOp {
  if (!cur) return { set: { ...out } };
  if (!validateDoc(`lesson/${lid}`, cur).ok) return null;
  if (arr(cur.words).length > 0) return null;
  const update: Doc = {};
  for (const [k, v] of Object.entries(out)) {
    if (k === 'lx') continue;
    const c = cur[k];
    const empty = c === undefined || c === null || (Array.isArray(c) && !c.length) || (typeof c === 'object' && !Array.isArray(c) && !Object.keys(c).length);
    if (empty) update[k] = v;
  }
  update.lx = { ...obj(out.lx), regen: true };
  return { update };
}
