import { beforeEach, describe, expect, it } from 'vitest';
import type { LearnerModel } from '../../src/domain/tutor/learner';
import type { AnswerFact } from '../../src/domain/tutor/policy';
import { lessonSuccess, markOf, markTask, plantedOf, resetTutorSession, tutorPreview, tutorRecord, tutorRoundStart, useTutorSession } from '../../src/features/tutor/sessionStore';

// Sitzung der Tutor-Engine im Speicher: nichts wird geschrieben. Über den Tag bleiben Fenster und Verschiebung, je Runde beginnt der Rest neu.

const fact = (f: Partial<AnswerFact>): AnswerFact => ({ typed: true, wrong: false, ok: true, fresh: true, pat: 'a', cause: null, blind: false, ...f });
const m: LearnerModel = {
  asOf: 0,
  day: '2026-10-19',
  patterns: new Map([['k', { pat: 'k', p: 0.9, certainty: 4, q28: { n: 0, ok: 0 }, freeDays: 0, lastWrong: null, state: 'safe' }]]),
  uses: new Map(),
  words: new Map(),
  hyps: [],
  pace: {},
  goals: { chapter: null, c1: [], ctx: null },
};

describe('sessionStore', () => {
  beforeEach(() => resetTutorSession());

  it('gleicher Tag: Fenster und Verschiebung bleiben, Serie und Gründe beginnen neu', () => {
    tutorRoundStart('2026-10-19', true);
    for (let i = 0; i < 5; i++) tutorRecord(fact({}), m, () => true);
    expect(useTutorSession.getState().s.shift).toBe(1);
    tutorRecord(fact({ wrong: true, ok: false }), m, () => true);
    markTask({ topic: 't', key: 'k1' }, 'known');
    tutorRoundStart('2026-10-19', false);
    const s = useTutorSession.getState().s;
    expect(s.shift).toBe(1);
    expect(s.lastNew20).toHaveLength(6);
    expect(s.wrongRun).toBe(0);
    expect(markOf({ topic: 't', key: 'k1' })).toBeNull();
    tutorRoundStart('2026-10-20', true);
    expect(useTutorSession.getState().s.lastNew20).toHaveLength(0);
    expect(useTutorSession.getState().s.shift).toBe(0);
  });

  it('nicht umsetzbarer Zug wird nicht gemerkt (win ohne Aufgabe → ask)', () => {
    tutorRoundStart('2026-10-19', true);
    tutorRecord(fact({ wrong: true, ok: false }), m, () => true);
    tutorRecord(fact({ wrong: true, ok: false }), m, () => true);
    expect(tutorPreview(fact({ wrong: true, ok: false }), m).move).toBe('win');
    const d = tutorRecord(fact({ wrong: true, ok: false }), m, (x) => x.move !== 'win');
    expect(d).toEqual({ move: 'ask', why: 'mix' });
    expect(useTutorSession.getState().s.wrongRun).toBe(3);
    const d2 = tutorRecord(fact({ wrong: true, ok: false }), m, () => true);
    expect(d2.move).toBe('win');
    expect(useTutorSession.getState().s.wrongRun).toBe(0);
  });

  it('win nicht umsetzbar: die nächste Regel entscheidet (Stufe), nicht pauschal ask/mix', () => {
    tutorRoundStart('2026-10-19', true);
    // Fünf neu gestellte, alle falsch → Quote 0 % → „gestützter“, sobald win nicht geht.
    for (let i = 0; i < 2; i++) tutorRecord(fact({ wrong: true, ok: false, typed: false }), m, () => true);
    tutorRecord(fact({ wrong: true, ok: false }), m, () => true);
    tutorRecord(fact({ wrong: true, ok: false }), m, () => true);
    const d = tutorRecord(fact({ wrong: true, ok: false }), m, (x) => x.move !== 'win');
    expect(d).toEqual({ move: 'ask', why: 'supported' });
    expect(useTutorSession.getState().s.won).toBe(false);
  });

  it('eingesetzte Aufgaben merken (K1), Erfolg nach Mini-Lektion bleibt über den Tag', () => {
    tutorRoundStart('2026-10-19', true);
    markTask({ topic: 't', key: 'k1' }, 'known', true);
    markTask({ topic: 't', key: 'k2' }, 'freer');
    expect(plantedOf({ topic: 't', key: 'k1' })).toBe(true);
    expect(plantedOf({ topic: 't', key: 'k2' })).toBe(false);
    useTutorSession.setState((x) => ({ s: { ...x.s, afterLesson: { n: 2, ok: 1 } } }));
    tutorRoundStart('2026-10-19', false);
    expect(plantedOf({ topic: 't', key: 'k1' })).toBe(false);
    expect(lessonSuccess()).toEqual({ n: 2, ok: 1 });
    tutorRoundStart('2026-10-20', false);
    expect(lessonSuccess()).toEqual({ n: 0, ok: 0 });
  });

  it('Vorschau bucht nichts', () => {
    tutorRoundStart('2026-10-19', true);
    const before = useTutorSession.getState().s;
    tutorPreview(fact({ wrong: true, cause: 'tense' }), m);
    expect(useTutorSession.getState().s).toBe(before);
  });
});
