import { describe, expect, it } from 'vitest';
import { gradeGrammar } from '../../src/coach/gradeGrammar';

const gap = { type: 'gap', prompt: 'She ___ (work) here since 2019.', answer: 'has been working', accepted: ["has worked"] };

describe('gradeGrammar', () => {
  it('akzeptiert exakte Form, Groß-/Kleinschreibung, Satzzeichen, Leerzeichen', () => {
    expect(gradeGrammar('has been working', gap)).toBe(true);
    expect(gradeGrammar('  Has  been working. ', gap)).toBe(true);
    expect(gradeGrammar('has worked', gap)).toBe(true);
  });
  it('lehnt falsche Formen ab, auch bei 1–2 Zeichen Abstand', () => {
    expect(gradeGrammar('have been working', gap)).toBe(false);
    expect(gradeGrammar('has been workin', gap)).toBe(false);
    expect(gradeGrammar('', gap)).toBe(false);
  });
  it('Kurz- und Langformen sind gleich', () => {
    const t = { type: 'gap', prompt: 'x', answer: "hasn't finished" };
    expect(gradeGrammar('has not finished', t)).toBe(true);
    expect(gradeGrammar("hasn't finished", { ...t, answer: 'has not finished' })).toBe(true);
    expect(gradeGrammar("can't", { type: 'gap', prompt: 'x', answer: 'cannot' })).toBe(true);
  });
  it('US-/UK-Schreibweise gilt als gleich', () => {
    expect(gradeGrammar('organised', { type: 'gap', prompt: 'x', answer: 'organized' })).toBe(true);
  });
  it('correct: unveränderter Originalsatz ist falsch', () => {
    const c = { type: 'correct', prompt: 'She have been working here.', answer: 'She has been working here.' };
    expect(gradeGrammar('She have been working here.', c)).toBe(false);
    expect(gradeGrammar('she has been working here', c)).toBe(true);
  });
});
