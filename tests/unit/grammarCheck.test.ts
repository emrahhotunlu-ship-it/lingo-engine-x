import { describe, expect, it } from 'vitest';
import { alignWords, countOps } from '../../src/domain/answer/align';
import { checkGrammar } from '../../src/domain/grammar/check';
import { alsoRight, examplesFor, formHint, ruleOf } from '../../src/domain/grammar/rules';
import { learnGrade } from '../../src/domain/learn/grade';
import { task } from './learnHelpers';

describe('checkGrammar', () => {
  it('B-07: Kurzformen ohne accepted richtig', () => {
    const t = task({ topic: 'pres-perf-cont', prompt: 'I ___ (wait) for 20 minutes.', answer: 'have been waiting' });
    expect(checkGrammar(t, "'ve been waiting")).toMatchObject({ verdict: 'correct', kind: 'contraction' });
    const n = task({ topic: 'modals-deduction', prompt: 'She ___ be at home, her car is gone.', answer: 'cannot' });
    expect(checkGrammar(n, "can't").verdict).toBe('correct');
    expect(checkGrammar(task(), 'will have finished')).toMatchObject({ verdict: 'correct' });
    expect(checkGrammar(task(), 'will have finished').kind).toBeUndefined();
  });

  it('britische Schreibweise zählt als richtig, mit US-Hinweis (A7.3)', () => {
    const t = task({ topic: 'past-simple-perfect', prompt: 'We ___ (travel) to Boston last year.', answer: 'traveled' });
    expect(checkGrammar(t, 'travelled')).toMatchObject({ verdict: 'correct', kind: 'uk', us: 'traveled' });
  });

  it('„Auch richtig"-Familien des Regelwerks', () => {
    const t = task({ topic: 'relative', prompt: 'The report ___ you sent was great.', answer: 'that' });
    expect(checkGrammar(t, 'which')).toMatchObject({ verdict: 'correct', kind: 'alt' });
    const w = task({ topic: 'future-forms', prompt: 'Look at the clouds – it ___ rain.', answer: 'is going to' });
    expect(checkGrammar(w, 'will')).toMatchObject({ verdict: 'correct', kind: 'alt' });
  });

  it('Tippfehler → fast richtig; falsche Form → falsch (die Form ist der Lernstoff)', () => {
    expect(checkGrammar(task(), 'will have finsihed')).toMatchObject({ verdict: 'near', kind: 'typo' });
    const t = task({ topic: 'pres-simple-cont', prompt: 'He usually ___ (work) from home.', answer: 'works' });
    expect(checkGrammar(t, 'work').verdict).toBe('wrong');
  });

  it('mc: nur die Option selbst', () => {
    const t = task({ type: 'mc', options: ['snows', 'is snowing'], answer: 'is snowing', prompt: 'Look! It ___ outside.' });
    expect(checkGrammar(t, 'is snowing').verdict).toBe('correct');
    expect(checkGrammar(t, 'snows')).toMatchObject({ verdict: 'wrong', needsJudge: false });
  });

  it('Satzkorrektur: unverändert ist falsch; freie Antwort mit ≥ 3 Wörtern → KI-Urteil möglich (D13)', () => {
    const t = task({ type: 'correct', topic: 'past-simple-perfect', prompt: 'I have seen that film yesterday.', answer: 'I saw that film yesterday.' });
    expect(checkGrammar(t, 'I have seen that film yesterday')).toMatchObject({ verdict: 'wrong', needsJudge: false });
    const r = checkGrammar(t, 'Yesterday I saw that film.');
    expect(r).toMatchObject({ verdict: 'wrong', needsJudge: true });
    expect(checkGrammar(task({ type: 'transform' }), 'finished').needsJudge).toBe(false);
  });

  it('Wort-Diff bei correct', () => {
    const t = task({ type: 'correct', topic: 'past-simple-perfect', prompt: 'x', answer: 'I saw that film yesterday.' });
    const ops = checkGrammar(t, 'I seen that film yesterday').ops;
    expect(ops.map((o) => o.op)).toEqual(['eq', 'sub', 'eq', 'eq', 'eq']);
  });
});

describe('alignWords', () => {
  it('fehlend, zu viel, ersetzt, vertauscht, Tippfehler', () => {
    expect(alignWords('we been working', 'We have been working').map((o) => o.op)).toEqual(['eq', 'del', 'eq', 'eq']);
    expect(countOps(alignWords('we have have been', 'we have been'))).toMatchObject({ ins: 1, eq: 3 });
    expect(alignWords('I seen it', 'I saw it').map((o) => o.op)).toEqual(['eq', 'sub', 'eq']);
    expect(countOps(alignWords('it is how', 'how is it'))).toMatchObject({ eq: 1 });
    const typo = (a: string, b: string) => a.length > 3 && a.slice(0, 3) === b.slice(0, 3);
    expect(alignWords('the migraton', 'the migration', { typo }).map((o) => o.op)).toEqual(['eq', 'typo']);
    expect(alignWords('', 'a b')).toEqual([
      { op: 'del', expected: 'a' },
      { op: 'del', expected: 'b' },
    ]);
  });
});

describe('Regelwerk und Hilfen', () => {
  it('Form-Hinweis in der Oberflächensprache, sonst der Kernsatz des Regelwerks', () => {
    const t = task({ topic: 'passive', expl: { de: 'Hier steht das Passiv, weil der Vertrag nicht selbst handelt.', en: null } });
    expect(formHint(t, 'de')).toBe('Hier steht das Passiv, weil der Vertrag nicht selbst handelt.');
    expect(formHint(t, 'en')).toBe(ruleOf('passive', 'en')!.core);
    // Falsche Sprache im gespeicherten Text → Regelwerk statt gemischter Sprache.
    const wrong = task({ topic: 'passive', expl: { de: 'The passive uses be plus the past participle here.', en: null } });
    expect(formHint(wrong, 'de')).toBe(ruleOf('passive', 'de')!.core);
  });

  it('2–3 Beispiele ohne den Aufgabensatz', () => {
    const ex = examplesFor('passive', { exclude: 'The contract has been signed.' });
    expect(ex.length).toBeGreaterThanOrEqual(2);
    expect(ex.length).toBeLessThanOrEqual(3);
    expect(ex).not.toContain('The contract has been signed.');
  });

  it('Auch richtig: accepted und Hinweise', () => {
    const r = alsoRight(task({ topic: 'relative', answer: 'who', accepted: ['that', 'who'] }), 'de');
    expect(r.answers).toEqual(['that']);
    expect(r.notes.length).toBeGreaterThan(0);
  });
});

describe('learnGrade (keine Selbstbewertung)', () => {
  it('falsch 1, fast 2, richtig nach Zeit; Hilfe deckelt', () => {
    expect(learnGrade('gap', 'wrong', { submitMs: 1000 }, { level: 0 })).toBe(1);
    expect(learnGrade('gap', 'near', { submitMs: 1000 }, { level: 0 })).toBe(2);
    expect(learnGrade('gap', 'correct', { submitMs: 9000, firstKeyMs: 2000 }, { level: 0 })).toBe(4);
    expect(learnGrade('gap', 'correct', { submitMs: 9000, firstKeyMs: 7000 }, { level: 0 })).toBe(3);
    expect(learnGrade('gap', 'correct', { submitMs: 9000, firstKeyMs: 9000 }, { level: 0 })).toBe(2);
    expect(learnGrade('mc', 'correct', { submitMs: 500 }, { level: 0 })).toBe(3);
    expect(learnGrade('transform', 'correct', { submitMs: 7000 }, { level: 0 })).toBe(4);
    expect(learnGrade('order', 'correct', { submitMs: 13000, units: 8 }, { level: 0 })).toBe(3);
    expect(learnGrade('order', 'correct', { submitMs: 15000, units: 8 }, { level: 0 })).toBe(2);
  });

  it('C-03: nach Tipp höchstens 3, nach zweitem Tipp höchstens 2; Diktat: mehr als 2× hören = Hilfe', () => {
    expect(learnGrade('cloze', 'correct', { submitMs: 1000, firstKeyMs: 500 }, { level: 1 })).toBe(3);
    expect(learnGrade('cloze', 'correct', { submitMs: 1000, firstKeyMs: 500 }, { level: 2 })).toBe(2);
    expect(learnGrade('dictate', 'correct', { submitMs: 1000, firstKeyMs: 500 }, { level: 0, replays: 2 })).toBe(4);
    expect(learnGrade('dictate', 'correct', { submitMs: 1000, firstKeyMs: 500 }, { level: 0, replays: 3 })).toBe(3);
  });
});
