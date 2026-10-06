import { describe, expect, it } from 'vitest';
import { GRADE_TABLE, TOUCH_FACTOR, gradeAnswer, type GradeKey } from '../../src/domain/grade';
import { learnGrade } from '../../src/domain/learn/grade';
import { autoGrade } from '../../src/domain/srs/grade';
import type { ExerciseId } from '../../src/domain/srs/types';

// Eine Notentabelle: dieselbe Eingabe ergibt über Wörter-Weg, Grammatik-Weg und direkt dieselbe Note.
describe('Notentabelle (domain/grade)', () => {
  it('gleiche Eingabe → gleiche Note (Wörter und Grammatik)', () => {
    const verdicts = ['correct', 'near', 'wrong'] as const;
    const times = [500, 2000, 3500, 7000, 9500, 15_000, 30_000];
    const pairs: Array<[ExerciseId, 'cloze' | 'gap' | 'dictate']> = [
      ['cloze', 'cloze'],
      ['cloze', 'gap'],
      ['dictation', 'dictate'],
    ];
    for (const [ex, kind] of pairs) {
      for (const v of verdicts) {
        for (const ms of times) {
          for (const level of [0, 1, 2] as const) {
            const w = autoGrade(ex, { verdict: v }, { submitMs: ms, firstKeyMs: ms, hintLevel: level });
            const g = learnGrade(kind, v, { submitMs: ms, firstKeyMs: ms }, { level });
            expect(g, `${ex}/${kind} ${v} ${ms} H${level}`).toBe(w);
          }
        }
      }
    }
  });

  it('Hinweisleiter: H1 höchstens 3, H2 höchstens 2, H3 immer 1', () => {
    const base = { key: 'type', verdict: 'correct', timeMs: 500, firstKeyMs: 500 } as const;
    expect(gradeAnswer({ ...base, help: 0 })).toBe(4);
    expect(gradeAnswer({ ...base, help: 1 })).toBe(3);
    expect(gradeAnswer({ ...base, help: 2 })).toBe(2);
    expect(gradeAnswer({ ...base, help: 3 })).toBe(1);
  });

  it('Auswahl und Bausteine nie „Leicht“; Tippen und Umformen schon', () => {
    for (const [key, row] of Object.entries(GRADE_TABLE) as Array<[GradeKey, (typeof GRADE_TABLE)[GradeKey]]>) {
      if (row.form === 'choice' || row.form === 'tiles') expect(gradeAnswer({ key, verdict: 'correct', timeMs: 1, firstKeyMs: 1 }), key).toBeLessThanOrEqual(3);
    }
    expect(gradeAnswer({ key: 'transform', verdict: 'correct', timeMs: 2000 })).toBe(4);
  });

  it('mehr als zwei Wiederholungen des Vorlesens zählen als Hilfe 1', () => {
    expect(gradeAnswer({ key: 'dictate', verdict: 'correct', timeMs: 500, firstKeyMs: 500, replays: 3 })).toBe(3);
  });
});

// Lernplattform 2.0 §4.10: neue Schlüssel und der Touch-Faktor.
describe('Neue Notenschlüssel (§4.10)', () => {
  const ok = (key: GradeKey, ms: number, extra: object = {}) => gradeAnswer({ key, verdict: 'correct', timeMs: ms, firstKeyMs: ms, ...extra });

  it('Tabelle: Gut bis, Leicht bis und Messung je Schlüssel wie im Plan', () => {
    const t = GRADE_TABLE;
    expect(t.ctx_mc).toMatchObject({ form: 'choice', good: 9000, easy: null });
    expect(t.colloc_gap).toMatchObject({ form: 'typed', good: 7000, easy: 2500, measure: 'firstKey' });
    expect(t.wordfam).toMatchObject({ form: 'typed', good: 8000, easy: 3000, measure: 'firstKey' });
    expect(t.find_trap).toMatchObject({ form: 'typed', good: 9000, easy: 3500 });
    expect(t.find).toMatchObject({ form: 'typed', good: 9000, easy: 3500 });
    expect(t.kwt).toMatchObject({ form: 'transform', good: 14_000, easy: 6000, measure: 'submit' });
    expect(t.meaning).toMatchObject({ form: 'choice', good: 10_000, easy: null });
    expect(t.correct_tap).toMatchObject({ form: 'typed', good: 9000, easy: 3500 });
    expect(t.complete.form).toBe('free');
  });

  it('Noten an den Grenzen: Auswahl nie Leicht, Tippen Gut bis / Leicht bis', () => {
    expect(ok('ctx_mc', 9000)).toBe(3);
    expect(ok('ctx_mc', 9001)).toBe(2);
    expect(ok('ctx_mc', 1)).toBe(3);
    expect(ok('meaning', 10_000)).toBe(3);
    expect(ok('meaning', 10_001)).toBe(2);
    expect(ok('colloc_gap', 2500)).toBe(4);
    expect(ok('colloc_gap', 2501)).toBe(3);
    expect(ok('colloc_gap', 7000)).toBe(3);
    expect(ok('colloc_gap', 7001)).toBe(2);
    expect(ok('wordfam', 3000)).toBe(4);
    expect(ok('wordfam', 8001)).toBe(2);
    expect(ok('find', 3500)).toBe(4);
    expect(ok('find_trap', 9000)).toBe(3);
    expect(ok('correct_tap', 9001)).toBe(2);
    expect(ok('kwt', 6000)).toBe(4);
    expect(ok('kwt', 14_000)).toBe(3);
    expect(ok('kwt', 14_001)).toBe(2);
  });

  it('falsch 1, fast richtig 2, Hilfe deckelt wie bei den alten Schlüsseln', () => {
    for (const key of ['ctx_mc', 'colloc_gap', 'complete', 'wordfam', 'find_trap', 'find', 'kwt', 'meaning', 'correct_tap'] as const) {
      expect(gradeAnswer({ key, verdict: 'wrong', timeMs: 100 }), key).toBe(1);
      expect(gradeAnswer({ key, verdict: 'near', timeMs: 100 }), key).toBe(2);
      expect(gradeAnswer({ key, verdict: 'correct', timeMs: 100, firstKeyMs: 100, help: 3 }), key).toBe(1);
      expect(gradeAnswer({ key, verdict: 'correct', timeMs: 100, firstKeyMs: 100, help: 2 }), key).toBeLessThanOrEqual(2);
      expect(gradeAnswer({ key, verdict: 'correct', timeMs: 100, firstKeyMs: 100, help: 1, claude: undefined } as never), key).toBeLessThanOrEqual(3);
    }
  });

  it('complete: lokal höchstens „Schwer“, „Gut“ nur nach der Claude-Kurzprüfung', () => {
    expect(ok('complete', 500)).toBe(2);
    expect(ok('complete', 500, { aiChecked: false })).toBe(2);
    expect(ok('complete', 500, { aiChecked: true })).toBe(3);
    expect(ok('complete', 500, { aiChecked: true, help: 2 })).toBe(2);
    expect(gradeAnswer({ key: 'complete', verdict: 'wrong', timeMs: 500, aiChecked: true })).toBe(1);
    expect(gradeAnswer({ key: 'complete', verdict: 'near', timeMs: 500 })).toBe(2);
  });

  it('Touch-Faktor 1,4: getippte Formen bekommen mehr Zeit, Auswahl und Bausteine nicht', () => {
    expect(TOUCH_FACTOR).toBe(1.4);
    // gap: Gut bis 8000 → 11 200, Leicht bis 3000 → 4200
    expect(ok('gap', 11_000, { profile: 'touch' })).toBe(3);
    expect(ok('gap', 11_300, { profile: 'touch' })).toBe(2);
    expect(ok('gap', 11_000, { profile: 'keys' })).toBe(2);
    expect(ok('gap', 4000, { profile: 'touch' })).toBe(4);
    expect(ok('gap', 4000)).toBe(3);
    // kwt: Gut bis 14 000 → 19 600
    expect(ok('kwt', 19_000, { profile: 'touch' })).toBe(3);
    expect(ok('kwt', 19_000, { profile: 'keys' })).toBe(2);
    // Auswahl und Bausteine ändern sich nicht
    expect(ok('mc', 8001, { profile: 'touch' })).toBe(2);
    expect(ok('order', 14_000, { profile: 'touch', units: 0 })).toBe(2);
    // ohne Angabe wie bisher
    for (const key of ['cloze', 'type', 'gap', 'transform', 'correct'] as const) for (const ms of [500, 3500, 9500, 25_000]) expect(ok(key, ms)).toBe(ok(key, ms, { profile: 'keys' }));
  });
});

