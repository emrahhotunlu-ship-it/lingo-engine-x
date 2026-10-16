import { describe, expect, it } from 'vitest';
import { patternOf, patternsOf } from '../../src/domain/grammar/patterns';
import { grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';

// Kontrastsatz mit Signalen zweier Muster („yet“ → psp.result-now, „on Monday“ → psp.finished-time):
// Erzeugung und Anzeige müssen das Muster des Signals nehmen, das die Lücke erzwingt.

const topic = 'past-simple-perfect';
const tp = patternsOf(topic);
const patterns = (tp?.patterns ?? []).map((p) => ({ id: p.id, name: p.name.en, form: p.form.en, signals: [...p.signals] }));
const vars: GrammarItemsVars = { topic, nameEn: 'Past Simple vs Present Perfect', ruleEn: 'x', examples: [], p: 0.5, types: ['gap'], seenText: [], errors: [], count: 4, patterns };
const PROMPT = 'We ___ the signed contract yet, although we sent it on Monday.';
const item = (o: object) => ({
  topic,
  type: 'gap',
  prompt: PROMPT,
  answer: "haven't received",
  accepted: [],
  options: null,
  hint_de: '(not / receive)',
  explanation_de: '„yet“ zeigt, dass es jetzt noch zählt, deshalb Present Perfect.',
  explanation_en: '“yet” shows it still matters now, so Present Perfect.',
  src: 'ai',
  pat: 'psp.result-now',
  ...o,
});
const clean = (pat: string) => item({ prompt: 'They ___ the invoice yet.', answer: "haven't paid", pat });
const run = (items: unknown[]) => {
  const r = grammarItems.schema(vars).safeParse({ items });
  return r.success ? (r.data as { items: Array<Record<string, unknown>> }).items : null;
};

describe('grammar-items@4: Kontrastsätze', () => {
  it('Prompt verbietet Kontrastsätze', () => {
    const p = grammarItems.build(vars);
    expect(p.split('\n')[0]).toBe('[grammar-items@4]');
    expect(p).toContain('Never combine signals of two patterns');
  });

  it('Satz mit „yet“ + „on Monday“: falsches Muster (finished-time) fällt weg, das der Lücke nahe (result-now) bleibt', () => {
    const good = [clean('psp.result-now'), clean('psp.result-now'), clean('psp.result-now')];
    expect(run([...good, item({ pat: 'psp.finished-time' })])).toHaveLength(3);
    expect(run([...good, item({ pat: 'psp.result-now' })])).toHaveLength(4);
  });
});

describe('Anzeige-Wächter patternOf', () => {
  const task = { topic, prompt: PROMPT, answer: "haven't received", src: 'ai' };

  it('gespeichertes, falsches `pat` (finished-time) wird auf das Muster der Lücke (result-now) umgeleitet', () => {
    expect(patternOf({ ...task, pat: 'psp.finished-time' })?.id).toBe('psp.result-now');
  });

  it('richtiges `pat` bleibt', () => {
    expect(patternOf({ ...task, pat: 'psp.result-now' })?.id).toBe('psp.result-now');
  });

  it('ohne Signalwort-Konflikt bleibt auch ein gespeichertes `pat` unverändert', () => {
    expect(patternOf({ topic, prompt: 'We signed the contract on Monday, so we ___ it.', answer: 'shipped', src: 'ai', pat: 'psp.finished-time' })?.id).toBe('psp.finished-time');
  });

  it('kuratierte Aufgaben (src seed) fasst der Wächter nicht an', () => {
    expect(patternOf({ ...task, src: 'seed', pat: 'psp.finished-time' })?.id).toBe('psp.finished-time');
  });
});
