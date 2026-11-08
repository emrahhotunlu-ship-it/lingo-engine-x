import { z } from 'zod';
import bookRaw from '../../content/grammar/book.json?raw';
import { logError } from '../../platform/diagnostics';
import { hash32 } from '../random';
import { topicById } from '../content';
import type { GrammarTask } from '../learn/types';
import { legacyTaskKey } from './key';
import { TaskWhySchema } from './patternTypes';
import { chapters, v2Tasks } from './patterns';
import { fromV2, seedTasks } from './tasks';

// Grammatik-Buch (Emrah 08.11.2026: „Gezielte Grammatik-Übungen wie im Buch, wo man dann auch eine Klausur schreibt“; docs/umbau/buch/plan.md).
// Rein, ohne React und ohne Datenbank. Je Lektion (= Thema aus path.json) feste Seiten:
//   Regel (Musterdatei) · Übung A „Form bilden“ (Lücken, neu) · Übung B „Unterscheiden“ (Auswahl, neu) · Übung C „Umformen und Fehler finden“
//   (vorhandene Umformungen und Fehlersätze) · Lektionstest (8 Aufgaben ohne Hilfe) · am Kapitelende die Klausur (20 Aufgaben, Note 1–6).
// Die Inhalte A/B stehen in content/grammar/book.json (Vorgabe docs/umbau/buch/inhalte-spec.md, Lehrer-geprüft).

export type BookPart = 'A' | 'B' | 'C' | 'T';
export const BOOK_PARTS: readonly BookPart[] = ['A', 'B', 'C', 'T'];
/** Aufgaben je Übungsseite und im Lektionstest; bestanden ist der Test ab `LESSON_PASS`. */
export const PAGE_SIZE = 6;
export const LESSON_TEST_N = 8;
export const LESSON_PASS = 6;
export const EXAM_N = 20;

const BookTaskSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  pat: z.string().min(1),
  part: z.enum(['A', 'B']),
  type: z.enum(['gap', 'mc']),
  prompt: z.string().includes('___'),
  hint: z.string().nullish(),
  answer: z.string().min(1),
  accepted: z.array(z.string()).default([]),
  options: z.array(z.string()).length(3).optional(),
  why: TaskWhySchema,
});
const BookFileSchema = z.object({ v: z.literal(1), tasks: z.array(BookTaskSchema) });
export type BookTask = z.infer<typeof BookTaskSchema>;

let cache: readonly BookTask[] | null = null;
/** Alle Buch-Aufgaben (A und B), optional eines Themas. Eine kaputte Datei liefert eine leere Liste (protokolliert). */
export function bookTasks(topic?: string): readonly BookTask[] {
  if (!cache) {
    try {
      const r = BookFileSchema.safeParse(JSON.parse(bookRaw));
      if (!r.success) logError('grammar:book', r.error, 'book.json');
      cache = r.success ? r.data.tasks.filter((t) => !!topicById(t.topic)) : [];
    } catch (err) {
      logError('grammar:book', err, 'book.json');
      cache = [];
    }
  }
  return topic ? cache.filter((t) => t.topic === topic) : cache;
}

/** Buch-Aufgabe als Aufgabe der Runde (Lücke bzw. Auswahl; die Begründung trägt die Fehler-Karte ohne Claude). */
export function bookToTask(b: BookTask): GrammarTask {
  return {
    key: legacyTaskKey(b.prompt),
    topic: b.topic,
    type: b.type,
    prompt: b.prompt,
    answer: b.answer,
    accepted: [...b.accepted],
    options: b.type === 'mc' && b.options ? [...b.options] : null,
    hint: b.hint ?? null,
    expl: { de: b.why.ok.de, en: b.why.ok.en },
    src: 'seed',
    ref: `content/grammar/book#${b.id}`,
    errorT: null,
    pat: b.pat,
    why: b.why,
  };
}

/** Kapitel des Buchs (= Kapitel des Grammatik-Pfads) mit ihren Lektionen. */
export function bookChapters(): Array<{ id: string; n: number; name: { de: string; en: string }; topics: string[] }> {
  return chapters().map((c, i) => ({ id: c.id, n: i + 1, name: c.name, topics: c.topics.filter((t) => !!topicById(t)) }));
}

export function chapterOfTopic(topic: string): string | null {
  return bookChapters().find((c) => c.topics.includes(topic))?.id ?? null;
}

const shuffleBy = <T>(xs: readonly T[], seed: string, key: (x: T) => string): T[] => [...xs].sort((a, b) => hash32(`${seed}|${key(a)}`) - hash32(`${seed}|${key(b)}`));

/** Übung C: Umformungen (Schlüsselwort) und Fehlersätze des Themas (`tasks-v2`), ohne Bedeutungspaare; vorn die, die nicht für Tests taugen. */
function partCPool(topic: string): GrammarTask[] {
  return v2Tasks(topic)
    .filter((v) => v.type === 'kwt' || v.type === 'find')
    .map((v) => ({ v, t: fromV2(v) }))
    .filter((x): x is { v: (typeof x)['v']; t: GrammarTask } => !!x.t)
    .sort((a, b) => Number(!a.v.practiceOnly) - Number(!b.v.practiceOnly) || a.v.id.localeCompare(b.v.id))
    .map((x) => x.t);
}

/** Testtaugliche Aufgaben eines Themas, die in den Übungsseiten nicht vorkommen: Bank (gap/mc/transform), Bedeutungspaare, Umformungen/Fehlersätze ohne `practiceOnly`. */
function testPool(topic: string, exclude: ReadonlySet<string>): GrammarTask[] {
  const bank = seedTasks().filter((t) => t.topic === topic && t.ref === 'content/grammar-bank' && (t.type === 'gap' || t.type === 'mc' || t.type === 'transform'));
  const v2 = v2Tasks(topic)
    .filter((v) => !v.practiceOnly)
    .map(fromV2)
    .filter((t): t is GrammarTask => !!t);
  return [...bank, ...v2].filter((t) => !exclude.has(t.key));
}

/**
 * Aufgaben einer Seite. A/B: die 6 Buch-Aufgaben in fester Reihenfolge (wie im Buch). C: 6 Umformungen und Fehlersätze, Lücke vor Satz.
 * T (Lektionstest): je eine A- und B-Aufgabe, die übrigen aus Aufgaben, die in den Übungen nicht vorkommen (Bank, Bedeutungspaare, Umformungen);
 * `attempt` mischt bei jedem neuen Versuch anders.
 */
export function pageTasks(topic: string, part: BookPart, attempt = 0): GrammarTask[] {
  const own = bookTasks(topic);
  if (part === 'A' || part === 'B') return own.filter((b) => b.part === part).map(bookToTask);
  const c = partCPool(topic).slice(0, PAGE_SIZE);
  if (part === 'C') return c;
  const seed = `${topic}|T|${attempt}`;
  const used = new Set([...own.map((b) => legacyTaskKey(b.prompt)), ...c.map((t) => t.key)]);
  const fresh = shuffleBy(testPool(topic, used), seed, (t) => t.key);
  const a = shuffleBy(own.filter((b) => b.part === 'A'), seed, (b) => b.id).slice(0, 1).map(bookToTask);
  const b = shuffleBy(own.filter((x) => x.part === 'B'), seed, (x) => x.id).slice(0, 1).map(bookToTask);
  const rest = fresh.slice(0, LESSON_TEST_N - a.length - b.length);
  // Zu wenig frische Aufgaben: mit weiteren A/B-Aufgaben auffüllen (dann kennt Emrah sie aus der Übung – besser als ein kürzerer Test).
  const fill = shuffleBy(own, `${seed}|fill`, (x) => x.id)
    .map(bookToTask)
    .filter((t) => ![...a, ...b].some((x) => x.key === t.key));
  const out = [...a, ...rest.slice(0, 3), ...b, ...rest.slice(3)];
  for (const t of fill) if (out.length < LESSON_TEST_N) out.push(t);
  return out.slice(0, LESSON_TEST_N);
}

/**
 * Klausur eines Kapitels: `EXAM_N` Aufgaben gleichmäßig über alle Lektionen, je Lektion abwechselnd A, B und eine Test-Aufgabe (Bank, Umformung,
 * Fehlersatz). `attempt` (Zahl der bisherigen Versuche) mischt neu, damit ein zweiter Versuch andere Sätze bringt.
 */
export function examTasks(chapterId: string, attempt = 0): GrammarTask[] {
  const ch = bookChapters().find((c) => c.id === chapterId);
  if (!ch || !ch.topics.length) return [];
  const per = Math.ceil(EXAM_N / ch.topics.length);
  const lists = ch.topics.map((topic) => {
    const seed = `${chapterId}|X|${attempt}|${topic}`;
    const own = bookTasks(topic);
    const A = shuffleBy(own.filter((b) => b.part === 'A'), seed, (b) => b.id).map(bookToTask);
    const B = shuffleBy(own.filter((b) => b.part === 'B'), seed, (b) => b.id).map(bookToTask);
    const T = shuffleBy(testPool(topic, new Set()), seed, (t) => t.key);
    const out: GrammarTask[] = [];
    for (let i = 0; out.length < per && i < 12; i++) {
      const src = [A, B, T][i % 3]!;
      const t = src[Math.floor(i / 3)];
      if (t && !out.some((x) => x.key === t.key)) out.push(t);
    }
    return out;
  });
  // Reihum je Lektion, damit Kürzen auf EXAM_N kein Thema ganz streicht.
  const out: GrammarTask[] = [];
  for (let i = 0; out.length < EXAM_N && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < EXAM_N) out.push(l[i]!);
  return shuffleBy(out, `${chapterId}|X|${attempt}|order`, (t) => `${t.topic}|${t.key}`);
}

/** Schulnote aus dem Anteil richtiger Antworten (Emrah 08.11.2026, Klausur „A: Schulnote 1–6 + Prozent“). Bestanden ab Note 3 (70 %). */
export function examGrade(right: number, total: number): { pct: number; grade: 1 | 2 | 3 | 4 | 5 | 6; passed: boolean } {
  const pct = total > 0 ? Math.round((right / total) * 100) : 0;
  const grade = pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 70 ? 3 : pct >= 55 ? 4 : pct >= 30 ? 5 : 6;
  return { pct, grade, passed: grade <= 3 };
}

/** Lektionen, die in der Klausur schwach waren (weniger als die Hälfte richtig): zum Nachüben markiert. */
export function weakTopics(rows: ReadonlyArray<{ topic: string; ok: boolean }>): string[] {
  const by = new Map<string, { c: number; n: number }>();
  for (const r of rows) {
    const e = by.get(r.topic) ?? { c: 0, n: 0 };
    e.n++;
    if (r.ok) e.c++;
    by.set(r.topic, e);
  }
  return [...by.entries()].filter(([, e]) => e.c * 2 < e.n).map(([t]) => t);
}
