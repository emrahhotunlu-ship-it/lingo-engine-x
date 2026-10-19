import { beforeEach, describe, expect, it } from 'vitest';
import type { LearnerModel } from '../../src/domain/tutor/learner';
import type { AnswerFact } from '../../src/domain/tutor/policy';
import { markOf, markTask, resetTutorSession, tutorPreview, tutorRecord, tutorRoundStart, useTutorSession } from '../../src/features/tutor/sessionStore';

// Sitzung der Tutor-Engine im Speicher: nichts wird geschrieben. Über den Tag bleiben Fenster und Verschiebung, je Runde beginnt der Rest neu.

const fact = (f: Partial<AnswerFact>): AnswerFact => ({ typed: true, wrong: false, ok: true, fresh: true, pat: 'a', cause: null, ...f });
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

  it('Vorschau bucht nichts', () => {
    tutorRoundStart('2026-10-19', true);
    const before = useTutorSession.getState().s;
    tutorPreview(fact({ wrong: true, cause: 'tense' }), m);
    expect(useTutorSession.getState().s).toBe(before);
  });
});
