import { getWriter } from '../../data';
import { bookSchema } from '../../data/schemas';
import { chapterOfTopic, type BookPart } from '../../domain/grammar/book';
import { logError } from '../../platform/diagnostics';

// Grammatik-Buch: Ergebnisse in `app/book` (docs/umbau/buch/plan.md). Nur ergänzend: ein Ergebnis wird angehängt bzw. hochgezählt, nie gelöscht.
// Unerwarteter Aufbau des Dokuments → nichts schreiben (wie app/repair, data-guard).

export const BOOK_PATH = 'app/book';
const EXAM_KEEP = 10;
type Doc = Record<string, unknown>;

export type PageResult = { c: number; n: number; t: number; k: number; best: number };
export type ExamResult = { t: number; c: number; n: number; p: number; g: number; w: string[] };

const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/** Ergebnis einer Seite lesen (tolerant). */
export function pageResult(doc: Doc | null | undefined, topic: string, part: BookPart): PageResult | null {
  const r = bookSchema.safeParse(doc ?? {});
  const p = r.success ? r.data.ls?.[topic]?.[part] : null;
  if (!p || typeof p.n !== 'number' || typeof p.c !== 'number') return null;
  return { c: p.c, n: p.n, t: p.t ?? 0, k: p.k ?? 1, best: p.best ?? p.c };
}

/** Klausur-Versuche eines Kapitels (älteste zuerst). */
export function examResults(doc: Doc | null | undefined, chapter: string): ExamResult[] {
  const r = bookSchema.safeParse(doc ?? {});
  const list = r.success ? (r.data.ex?.[chapter] ?? []) : [];
  return list
    .filter((e) => typeof e.c === 'number' && typeof e.n === 'number')
    .map((e) => ({ t: e.t ?? 0, c: e.c ?? 0, n: e.n ?? 0, p: e.p ?? 0, g: e.g ?? 6, w: (e.w ?? []).filter((x): x is string => typeof x === 'string') }));
}

const writable = (cur: Doc | null): boolean => cur === null || bookSchema.safeParse(cur).success;

/** Ergebnis einer Buch-Seite speichern (letztes Ergebnis, bestes Ergebnis, Zahl der Versuche). */
export async function recordPage(topic: string, part: BookPart, c: number, n: number, t: number): Promise<boolean> {
  const writer = getWriter();
  if (!writer || n < 1) return false;
  try {
    let ok = true;
    await writer.transform(BOOK_PATH, (cur0) => {
      const cur: Doc | null = cur0 ?? null;
      if (!writable(cur)) {
        ok = false;
        logError('book:page', new Error('app/book unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
      const ls = isObj(cur?.ls) ? cur.ls : {};
      const lesson = isObj(ls[topic]) ? (ls[topic]) : {};
      const prev = isObj(lesson[part]) ? (lesson[part]) : null;
      const best = Math.max(c, typeof prev?.best === 'number' ? prev.best : typeof prev?.c === 'number' ? prev.c : 0);
      const k = (typeof prev?.k === 'number' ? prev.k : 0) + 1;
      const next = { ...(cur ?? {}), v: 1, ls: { ...ls, [topic]: { ...lesson, [part]: { c, n, t, k, best } } } };
      return cur ? { update: { v: 1, ls: next.ls } } : { set: next };
    });
    return ok;
  } catch (err) {
    logError('book:page', err);
    return false;
  }
}

/** Klausur speichern (angehängt; je Kapitel bleiben die letzten 10 Versuche). */
export async function recordExam(chapter: string, e: ExamResult): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    let ok = true;
    await writer.transform(BOOK_PATH, (cur0) => {
      const cur: Doc | null = cur0 ?? null;
      if (!writable(cur)) {
        ok = false;
        logError('book:exam', new Error('app/book unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
      const ex = isObj(cur?.ex) ? cur.ex : {};
      const list = Array.isArray(ex[chapter]) ? (ex[chapter] as unknown[]) : [];
      const nextEx = { ...ex, [chapter]: [...list, e].slice(-EXAM_KEEP) };
      return cur ? { update: { v: 1, ex: nextEx } } : { set: { v: 1, ex: nextEx } };
    });
    return ok;
  } catch (err) {
    logError('book:exam', err);
    return false;
  }
}

/** Stand des Buchs aus `app/book` für `bookNext` und die Anzeige. */
export function bookView(doc: Doc | null | undefined): {
  page: (topic: string, part: BookPart) => { best: number; n: number; k: number } | null;
  exams: (chapter: string) => ExamResult[];
  examPassed: (chapter: string) => boolean;
  /** Kapitel der letzten Buch-Aktivität (Seite oder Klausur); `null` = Buch nie begonnen. */
  recent: string | null;
} {
  const r = bookSchema.safeParse(doc ?? {});
  let recent: string | null = null;
  let at = -1;
  if (r.success) {
    for (const [topic, l] of Object.entries(r.data.ls ?? {}))
      for (const p of Object.values(l)) if (p && typeof p === 'object' && typeof (p as { t?: unknown }).t === 'number' && (p as { t: number }).t > at) [at, recent] = [(p as { t: number }).t, chapterOfTopic(topic)];
    for (const [ch, list] of Object.entries(r.data.ex ?? {})) for (const e of list) if (typeof e.t === 'number' && e.t > at) [at, recent] = [e.t, ch];
  }
  return {
    recent,
    page: (topic, part) => {
      const r = pageResult(doc, topic, part);
      return r ? { best: r.best, n: r.n, k: r.k } : null;
    },
    exams: (chapter) => examResults(doc, chapter),
    examPassed: (chapter) => examResults(doc, chapter).some((e) => e.g <= 3),
  };
}
