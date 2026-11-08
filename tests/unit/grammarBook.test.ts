import { describe, expect, it } from 'vitest';
import { bookChapters, bookTasks, examGrade, examTasks, EXAM_N, LESSON_TEST_N, pageTasks, weakTopics } from '../../src/domain/grammar/book';
import { patternsOf, whyFor } from '../../src/domain/grammar/patterns';
import { checkGrammar } from '../../src/domain/grammar/check';

// Grammatik-Buch (Emrah 08.11.2026): Inhalte A/B, Seiten, Lektionstest, Klausur, Note.

describe('Buch-Inhalte (content/grammar/book.json)', () => {
  const chapters = bookChapters();
  it('7 Kapitel; jede Lektion hat 6 × A (Lücke) und 6 × B (Auswahl)', () => {
    expect(chapters).toHaveLength(7);
    for (const c of chapters)
      for (const t of c.topics) {
        const own = bookTasks(t);
        expect(own.filter((x) => x.part === 'A' && x.type === 'gap'), t).toHaveLength(6);
        expect(own.filter((x) => x.part === 'B' && x.type === 'mc'), t).toHaveLength(6);
      }
  });
  it('jede Aufgabe: Muster des Themas, genau eine Lücke, Lösung in den Optionen, jeder Ablenker mit Erklärung', () => {
    const ids = new Set<string>();
    for (const b of bookTasks()) {
      expect(ids.has(b.id), b.id).toBe(false);
      ids.add(b.id);
      expect(patternsOf(b.topic)?.patterns.some((p) => p.id === b.pat), b.id).toBe(true);
      expect(b.prompt.match(/_{3,}/g)?.length, b.id).toBe(1);
      if (b.type === 'mc') {
        expect(b.options, b.id).toContain(b.answer);
        for (const o of b.options!.filter((x) => x !== b.answer)) expect(b.why.wrong.some((r) => r.opt === o), `${b.id} ${o}`).toBe(true);
      }
    }
  });
  it('die Lösung jeder Aufgabe wird als richtig erkannt (auch jede Lösung aus accepted)', () => {
    for (const t of chapters.flatMap((c) => c.topics).flatMap((tp) => [...pageTasks(tp, 'A'), ...pageTasks(tp, 'B')])) {
      expect(checkGrammar(t, t.answer).verdict, `${t.ref} ${t.answer}`).toBe('correct');
      for (const a of t.accepted) expect(checkGrammar(t, a).verdict, `${t.ref} ${a}`).toBe('correct');
    }
  });
  it('Auswahl: jeder Ablenker trifft genau seine Erklärung (für die Fehler-Karte ohne Claude)', () => {
    for (const t of chapters.flatMap((c) => c.topics).flatMap((tp) => pageTasks(tp, 'B')))
      for (const o of (t.options ?? []).filter((x) => x !== t.answer)) expect(whyFor(t, { given: o, picked: o }).rule?.opt, `${t.ref} ${o}`).toBe(o);
  });
});

describe('Seiten, Lektionstest, Klausur', () => {
  it('Übungen A/B mit 6 Aufgaben, Übung C mit Umformungen/Fehlersätzen, Lektionstest mit 8 Aufgaben ohne Doppel', () => {
    for (const tp of ['past-simple-perfect', 'articles', 'inversion']) {
      expect(pageTasks(tp, 'A')).toHaveLength(6);
      expect(pageTasks(tp, 'B')).toHaveLength(6);
      const c = pageTasks(tp, 'C');
      expect(c.length).toBeGreaterThan(0);
      expect(c.every((x) => x.type === 'kwt' || x.type === 'find')).toBe(true);
      const t = pageTasks(tp, 'T');
      expect(t).toHaveLength(LESSON_TEST_N);
      expect(new Set(t.map((x) => x.key)).size).toBe(t.length);
    }
  });
  it('ein neuer Versuch mischt den Lektionstest anders', () => {
    const a = pageTasks('past-simple-perfect', 'T', 0).map((x) => x.key);
    const b = pageTasks('past-simple-perfect', 'T', 1).map((x) => x.key);
    expect(a).not.toEqual(b);
  });
  it('Klausur: 20 Aufgaben, jede Lektion des Kapitels kommt vor, keine Doppel', () => {
    for (const c of bookChapters()) {
      const x = examTasks(c.id, 0);
      expect(x, c.id).toHaveLength(EXAM_N);
      expect(new Set(x.map((t) => `${t.topic}|${t.key}`)).size).toBe(EXAM_N);
      for (const tp of c.topics) expect(x.some((t) => t.topic === tp), `${c.id} ${tp}`).toBe(true);
    }
    expect(examTasks('k1', 1).map((t) => t.key)).not.toEqual(examTasks('k1', 0).map((t) => t.key));
  });
  it('Note 1–6 aus Prozent, bestanden ab Note 3 (70 %)', () => {
    expect(examGrade(19, 20)).toEqual({ pct: 95, grade: 1, passed: true });
    expect(examGrade(17, 20)).toEqual({ pct: 85, grade: 2, passed: true });
    expect(examGrade(14, 20)).toEqual({ pct: 70, grade: 3, passed: true });
    expect(examGrade(13, 20)).toEqual({ pct: 65, grade: 4, passed: false });
    expect(examGrade(6, 20)).toEqual({ pct: 30, grade: 5, passed: false });
    expect(examGrade(0, 20)).toEqual({ pct: 0, grade: 6, passed: false });
    expect(examGrade(0, 0).grade).toBe(6);
  });
  it('schwache Lektionen: weniger als die Hälfte richtig', () => {
    expect(weakTopics([{ topic: 'a', ok: false }, { topic: 'a', ok: true }, { topic: 'b', ok: false }, { topic: 'b', ok: false }, { topic: 'c', ok: true }])).toEqual(['b']);
  });
});
