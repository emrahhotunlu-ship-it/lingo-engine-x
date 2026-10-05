import { describe, expect, it } from 'vitest';
import { GRADE_TABLE, gradeAnswer, type GradeKey } from '../../src/domain/grade';
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
