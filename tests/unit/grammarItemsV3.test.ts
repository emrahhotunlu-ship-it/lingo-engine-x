import { describe, expect, it } from 'vitest';
import { grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';
import { grammarItemsReplyV3 } from '../../src/platform/dev/canned/lp2/p5';

// grammar-items@3 (Lernplattform 2.0 §10.4 P5 Schritt 8): Musterliste rein, `pat` aus der Liste, Signalwort im Satz, `why_not` für falsche Optionen.

const patterns = [
  { id: 'ca.unless', name: 'unless', form: 'unless + present', signals: ['unless'] },
  { id: 'ca.otherwise', name: 'otherwise', form: 'otherwise + clause', signals: ['otherwise'] },
];
const vars: GrammarItemsVars = { topic: 'cond-alt', nameEn: 'Alternatives to if', ruleEn: 'unless = if not', examples: [], p: 0.5, types: ['gap', 'mc'], seenText: [], errors: [], count: 4, patterns };
const base = { topic: 'cond-alt', type: 'gap', accepted: [], options: null, hint_de: '', explanation_de: 'Unless heißt „wenn nicht“, deshalb steht kein not mehr im Satz.', explanation_en: 'Unless means “if not”, so no second negation is needed in the clause.', src: 'ai' };
const item = (o: object) => ({ ...base, prompt: 'We will cancel the event unless 20 people ___ (sign) up.', answer: 'sign', pat: 'ca.unless', ...o });
const run = (items: unknown[]) => {
  const r = grammarItems.schema(vars).safeParse({ items });
  return r.success ? (r.data as { items: Array<Record<string, unknown>> }).items : null;
};

describe('grammar-items@3', () => {
  it('Prompt nennt die Muster und verlangt `pat`', () => {
    const p = grammarItems.build(vars);
    expect(p.split('\n')[0]).toBe('[grammar-items@3]');
    expect(p).toContain('- ca.unless | unless | unless + present | signals: unless');
    expect(p).toContain('"pat"');
  });

  it('gültige Aufgaben behalten `pat`; falsches Muster, fehlendes Muster oder fehlendes Signalwort fallen weg', () => {
    const good = [item({}), item({}), item({})];
    expect(run([...good, item({ pat: 'ca.nope' })])).toHaveLength(3);
    expect(run([...good, item({ pat: undefined })])).toHaveLength(3);
    expect(run([...good, item({ prompt: 'We will cancel the event if 20 people ___ (sign) up.' })])).toHaveLength(3);
    expect(run(good)?.every((i) => i.pat === 'ca.unless')).toBe(true);
  });

  it('why_not wird zu why.wrong, nur für falsche Optionen', () => {
    const mc = (extra: object) => item({ type: 'mc', prompt: 'We will cancel the event ___ 20 people sign up.', answer: 'unless', options: ['unless', 'if', 'otherwise'], ...extra });
    const good = [mc({}), mc({}), mc({})];
    const out = run([...good, mc({ why_not: [{ opt: 'if', de: 'if dreht die Bedingung um.', en: 'if reverses the condition.' }] })]);
    expect(out).toHaveLength(4);
    expect(out?.[3]?.why).toMatchObject({ wrong: [{ opt: 'if' }], ok: { de: 'Unless heißt „wenn nicht“, deshalb steht kein not mehr im Satz.' } });
    expect(run([...good, mc({ why_not: [{ opt: 'unless', de: 'zu kurz hier', en: 'too short here' }] })])).toHaveLength(3);
  });

  it('ohne Musterliste (Thema ohne Musterdatei) gilt wie bisher, kein `pat`', () => {
    const r = grammarItems.schema({ ...vars, patterns: [] }).safeParse({ items: [item({ pat: undefined }), item({ pat: undefined }), item({ pat: undefined })] });
    expect(r.success).toBe(true);
  });

  it('Testantwort passt zur Prüfung', () => {
    const input = grammarItems.build(vars);
    const reply: unknown = JSON.parse(grammarItemsReplyV3(input));
    const r = grammarItems.schema(vars).safeParse(reply);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });
});
