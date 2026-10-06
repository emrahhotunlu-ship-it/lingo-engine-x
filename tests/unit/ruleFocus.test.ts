import { describe, expect, it } from 'vitest';
import { focusRule, splitSentences } from '../../src/domain/grammar/ruleFocus';
import { ruleOf } from '../../src/domain/grammar/rules';

describe('Kurz erklärt passend zur Aufgabe', () => {
  const core = ruleOf('mixed-cond', 'de')?.core ?? '';
  it('zerlegt den Text in Sätze, auch mit Beispielen in Anführungszeichen', () => {
    expect(splitSentences(core).length).toBeGreaterThanOrEqual(3);
  });
  it('wish-Aufgabe: der wish-Teil steht vorn, der Mixed-Conditional-Teil dahinter', () => {
    const r = focusRule(core, { prompt: 'I wish the rollout schedule ___ (be) more realistic right now.', answer: 'were', hint: '(be, Wunsch über die Gegenwart)' });
    expect(r.focus).toContain('wish');
    expect(r.focus).toContain('were');
    expect(r.rest).toContain('Past Perfect, would');
  });
  it('ohne Treffer oder zu kurzem Text bleibt alles vorn', () => {
    expect(focusRule('Ein Satz. Zwei Sätze.', { prompt: 'x ___' })).toEqual({ focus: 'Ein Satz. Zwei Sätze.', rest: '' });
    expect(focusRule(core, { prompt: 'Zzz qqq ___', answer: 'yyy' }).rest).toBe('');
  });
});
