import { hash32 } from '../random';
import { topicById } from '../content';
import type { GrammarTask } from '../learn/types';
import { legacyTaskKey } from './key';
import { bookTasks, bookToTask } from './bookContent';
import { chapters, v2Tasks } from './patterns';
import { fromV2, seedTasks } from './tasks';
export { bookTasks, bookToTask, type BookTask } from './bookContent';

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
  // learning-scientist 08.11.2026: der Test prüft Übertragen, nicht Wiedererkennen – zuerst Aufgaben, die in den Übungen nicht vorkamen;
  // nur wenn sie fehlen, mit A/B-Aufgaben auffüllen (abwechselnd A und B).
  const out = shuffleBy(testPool(topic, used), seed, (t) => t.key).slice(0, LESSON_TEST_N);
  const A = shuffleBy(own.filter((b) => b.part === 'A'), `${seed}|fill`, (b) => b.id).map(bookToTask);
  const B = shuffleBy(own.filter((b) => b.part === 'B'), `${seed}|fill`, (b) => b.id).map(bookToTask);
  for (let i = 0; out.length < LESSON_TEST_N && i < Math.max(A.length, B.length); i++) for (const t of [A[i], B[i]]) if (t && out.length < LESSON_TEST_N) out.push(t);
  return shuffleBy(out, `${seed}|order`, (t) => t.key);
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
    // Zuerst Aufgaben, die in den Übungen nicht vorkamen (Übertragen statt Wiedererkennen), dann abwechselnd A und B.
    const out: GrammarTask[] = T.slice(0, per);
    for (let i = 0; out.length < per && i < 6; i++) for (const t of [A[i], B[i]]) if (t && out.length < per && !out.some((x) => x.key === t.key)) out.push(t);
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

export type PageState = { best: number; n: number; k: number; t?: number } | null;
/** Letzte Klausur eines Kapitels für `bookNext`: Zeitpunkt, bestanden, schwache Lektionen. */
export type LastExam = { t: number; passed: boolean; w: readonly string[] } | null;
export type BookStep = { kind: 'page'; chapter: string; topic: string; part: BookPart } | { kind: 'exam'; chapter: string };

/** Ist die Seite erledigt? Übungen: einmal gemacht. Lektionstest: bestanden (mindestens `LESSON_PASS` richtig). */
export function pageDone(part: BookPart, st: PageState): boolean {
  if (!st || st.k < 1) return false;
  return part === 'T' ? st.best >= Math.min(LESSON_PASS, st.n) : true;
}

/**
 * Nächster Schritt im Buch (Tagesvorschlag, „Weiter im Buch“): ab dem zuletzt bearbeiteten Kapitel das erste, dessen Klausur noch nicht bestanden ist; darin die erste
 * Lektion mit offener Seite (Reihenfolge A, B, C, Test); sind alle Lektionen erledigt, die Klausur. `null`, wenn das ganze Buch geschafft ist.
 */
export function bookNext(
  page: (topic: string, part: BookPart) => PageState,
  examPassed: (chapter: string) => boolean,
  from: string | null = null,
  opts: { today?: (t: number) => boolean; lastExam?: (chapter: string) => LastExam } = {},
): BookStep | null {
  // Emrah wählt selbst, wo er im Buch arbeitet: weiter geht es im zuletzt bearbeiteten Kapitel (`from`), danach in den folgenden, zuletzt vorn.
  const all = bookChapters();
  const at = from ? Math.max(0, all.findIndex((c) => c.id === from)) : 0;
  // learning-scientist 08.11.2026: Lektionstest frühestens am nächsten Lerntag nach der letzten Übung dieser Lektion (sonst massiert);
  // bis dahin geht es mit der nächsten Lektion weiter. Gibt es keine andere offene Seite, kommt der Test trotzdem.
  const practicedToday = (topic: string): boolean => !!opts.today && (['A', 'B', 'C'] as const).some((p) => opts.today!(page(topic, p)?.t ?? -1));
  for (const c of [...all.slice(at), ...all.slice(0, at)]) {
    if (examPassed(c.id)) continue;
    let later: BookStep | null = null;
    for (const topic of c.topics)
      for (const part of BOOK_PARTS) {
        if (pageDone(part, page(topic, part))) continue;
        if (part === 'T' && practicedToday(topic)) {
          later ??= { kind: 'page', chapter: c.id, topic, part };
          break;
        }
        return { kind: 'page', chapter: c.id, topic, part };
      }
    if (later) return later;
    // Nach einer nicht bestandenen Klausur: zuerst die schwachen Lektionen neu testen (neue Mischung), dann die Klausur.
    const last = opts.lastExam?.(c.id) ?? null;
    if (last && !last.passed) for (const topic of last.w) if (c.topics.includes(topic) && (page(topic, 'T')?.t ?? 0) < last.t) return { kind: 'page', chapter: c.id, topic, part: 'T' };
    return { kind: 'exam', chapter: c.id };
  }
  return null;
}
