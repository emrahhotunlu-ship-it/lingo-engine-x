import { describe, expect, it } from 'vitest';
import { addError, capErrors, dueErrors, errorDue, errorTask, gapFill, reviewError, type ErrorEntry } from '../../src/domain/grammar/errors';
import { selectRound } from '../../src/domain/grammar/tasks';
import { berlin } from './helpers';

const DAY = 86_400_000;
const t0 = berlin('2026-09-20', 10);

describe('Fehler-Boxen 1/3/9 (D1)', () => {
  it('E-01: falsch → nach 1 Tag, dann +3, +9, dann erledigt', () => {
    let list: readonly ErrorEntry[] = addError([], { q: 'I ___ (see) her yesterday.', given: 'have seen', ans: 'saw', t: t0, src: 'seed' });
    expect(errorDue(list[0]!)).toBe(t0 + DAY);
    let t = t0 + DAY;
    const steps: number[] = [];
    for (let i = 0; i < 3; i++) {
      list = reviewError(list, t0, { ok: true, given: 'saw', grade: 3, t }) ?? list;
      const e = list[0]!;
      steps.push(((e.due as number) - t) / DAY);
      t = e.due as number;
    }
    expect(steps).toEqual([3, 9, 9]);
    expect(list[0]!.done).toBe(true);
    expect(list[0]!.box).toBe(3);
  });

  it('E-02: falsch in Box 2 → eine Box zurück (Box 1), fällig morgen, neue Antwort gemerkt', () => {
    const list: ErrorEntry[] = [{ q: 'q', given: 'x', ans: 'y', t: t0, box: 2, due: t0, done: false }];
    const out = reviewError(list, t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })!;
    expect(out[0]).toMatchObject({ box: 1, done: false, due: t0 + 5 + DAY, given: 'z', last: t0 + 5, rh: [[t0 + 5, 2, 0]] });
    // Dieselbe Antwort noch einmal angewendet: nichts.
    expect(reviewError(out, t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })).toBeNull();
  });

  it('E-03: Kappung auf 10 verdrängt nur Erledigte; sind alle offen, bleibt alles stehen', () => {
    const list: ErrorEntry[] = Array.from({ length: 11 }, (_, i) => ({ q: `q${i}`, t: t0 + i, done: i === 5 }));
    const out = capErrors(list);
    expect(out).toHaveLength(10);
    expect(out.some((e) => e.q === 'q5')).toBe(false);
    expect(out[0]!.q).toBe('q0');
    const open = capErrors(Array.from({ length: 11 }, (_, i) => ({ q: `q${i}`, t: t0 + i })));
    expect(open).toHaveLength(11);
    expect(open[0]!.q).toBe('q0');
  });

  it('E-04: dieselbe Frage wird nur einmal wiederholt', () => {
    const docs = new Map([
      ['past-simple-perfect', { errors: [{ q: 'I ___ (see) her yesterday.', given: 'seen', ans: 'saw', t: t0 }] }],
      ['pres-simple-cont', { errors: [{ q: 'I  ___ (see) her YESTERDAY', given: 'see', ans: 'saw', t: t0 + 1 }] }],
    ]);
    expect(dueErrors(docs, t0 + 2 * DAY)).toHaveLength(1);
  });

  it('E-05: ab Box 1 kommt bevorzugt eine ungesehene Variante gleichen Themas und Typs', () => {
    const err = { q: 'I ___ (see) her yesterday.', given: 'have seen', ans: 'saw', t: t0, box: 1, due: t0 + DAY };
    const docs = new Map([['past-simple-perfect', { p: 0.5, n: 5, errors: [err], seen: [] }]]);
    const round = selectRound({ mode: 'errors', grammarDocs: docs, dailyOpen: [], pool: [], nowMs: t0 + 2 * DAY, size: 8, seed: 'x' });
    expect(round).toHaveLength(1);
    expect(round[0]!.errorT).toBe(t0);
    expect(round[0]!.prompt).not.toBe(err.q);
    expect(round[0]!.type).toBe('gap');
    // Box 0: das Original.
    const docs0 = new Map([['past-simple-perfect', { errors: [{ ...err, box: 0 }] }]]);
    const r0 = selectRound({ mode: 'errors', grammarDocs: docs0, dailyOpen: [], pool: [], nowMs: t0 + 2 * DAY, size: 8, seed: 'x' });
    expect(r0[0]!.prompt).toBe(err.q);
    expect(r0[0]!.hint).toBeNull(); // Der Satz nennt die Grundform schon selbst.
  });

  it('E-06: alter Eintrag ohne box wird gelesen (due = t + 1 Tag) und beim Wiederholen ergänzt', () => {
    const old: ErrorEntry = { q: 'By June I ___ my course.', given: 'finish', ans: 'will have finished', t: t0 };
    expect(errorDue(old)).toBe(t0 + DAY);
    const docs = new Map([['future-perf-cont', { errors: [old] }]]);
    const due = dueErrors(docs, t0 + DAY);
    expect(due).toHaveLength(1);
    expect(due[0]!.task.hint).toBe('(finish)');
    const out = reviewError([old], t0, { ok: true, given: 'will have finished', grade: 3, t: t0 + DAY })!;
    expect(out[0]).toMatchObject({ box: 1, done: false, last: t0 + DAY, q: old.q, given: old.given });
  });

  it('E-07: der FSRS-Schatten steuert due nicht; seine Uhr läuft nie rückwärts', () => {
    const list: ErrorEntry[] = [{ q: 'q', given: 'x', ans: 'y', t: t0, fsrs: undefined }];
    const a = reviewError(list, t0, { ok: true, given: 'y', grade: 4, t: t0 + DAY })!;
    expect(a[0]!.due).toBe(t0 + DAY + 3 * DAY);
    const f = a[0]!.fsrs as { last: number; due: number };
    expect(f.last).toBe(t0 + DAY);
    // Späterer Eintrag mit älterem Zeitstempel (andere Uhr): Schatten nutzt max(jetzt, last).
    const b = reviewError([{ ...a[0]!, last: t0 }], t0, { ok: true, given: 'y', grade: 3, t: t0 + 1000 })!;
    expect((b[0]!.fsrs as { last: number }).last).toBe(t0 + DAY);
    expect(b[0]!.due).toBe(t0 + 1000 + 9 * DAY);
  });
});

describe('errorTask: ganzer Satz als Lösung einer Lücke (Prüfbericht H1)', () => {
  const e = (q: string, ans: string): ErrorEntry => ({ q, given: 'x', ans, t: t0, box: 0, due: t0, done: false });
  it('normale Lücke bleibt unverändert', () => {
    expect(errorTask('past-simple-perfect', e('I ___ (see) her yesterday.', 'saw'))?.answer).toBe('saw');
    expect(gapFill('I ___ the report yesterday.', 'finished')).toBe('finished');
  });
  it('Satzanfang und -ende werden abgezogen, nichts doppelt in der Lücke', () => {
    const task = errorTask('past-simple-perfect', e('I ___ the report yesterday.', 'I finished the report yesterday.'));
    expect(task?.type).toBe('gap');
    expect(task?.answer).toBe('finished');
    expect(task!.prompt.replace('___', task!.answer)).toBe('I finished the report yesterday.');
    expect(gapFill('___ is the future.', 'The cloud is the future.')).toBe('The cloud');
  });
  it('unklare Form ergibt keine Aufgabe statt eines doppelten Satzes', () => {
    expect(gapFill('I ___ the report yesterday.', 'I finished it last week.')).toBe('');
    expect(errorTask('past-simple-perfect', e('I ___ the report yesterday.', 'I finished it last week.'))).toBeNull();
  });
});
