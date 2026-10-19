import { describe, expect, it } from 'vitest';
import { asAlsoRight, checkGrammar, fitAskable } from '../../src/domain/grammar/check';
import { shortWhy } from '../../src/domain/grammar/alsoRight';
import { grammarWrite } from '../../src/domain/grammar/write';
import { defaultTopic } from '../../src/domain/content';
import { topicById } from '../../src/domain/content';
import { answer } from './learnHelpers';
import { grammarFit } from '../../src/prompts/grammarFit';
import { fitAccepts, fitKey } from '../../src/features/grammar/fit';
import { task } from './learnHelpers';
import { fromV2 } from '../../src/domain/grammar/tasks';
import { V2TaskSchema } from '../../src/domain/grammar/patternTypes';
import { normalizeTask } from '../../src/domain/grammar/tasks';

const used = () => task({ topic: 'used-to', prompt: 'We ___ (have) a paper archive, but now everything is in the cloud.', answer: 'used to have', pat: 'used-to-past', alt: ['had'] });

describe('„Auch richtig“ (Art other)', () => {
  it('had statt used to have: richtig, Art other, nie falsch', () => {
    const c = checkGrammar(used(), 'had');
    expect(c).toMatchObject({ verdict: 'correct', kind: 'other' });
    expect(checkGrammar(used(), 'Had.').kind).toBe('other');
    expect(checkGrammar(used(), 'used to have')).toMatchObject({ verdict: 'correct' });
    expect(checkGrammar(used(), 'used to have').kind).toBeUndefined();
  });

  it('ohne alt-Liste bleibt „had“ lokal falsch, ist aber für Claude fragbar', () => {
    const t = task({ topic: 'used-to', prompt: 'We ___ (have) a paper archive, but now everything is in the cloud.', answer: 'used to have', pat: 'used-to-past' });
    const c = checkGrammar(t, 'had');
    expect(c.verdict).toBe('wrong');
    expect(fitAskable(t, c, 'had')).toBe(true);
    const ok = asAlsoRight(c);
    expect(ok).toMatchObject({ verdict: 'correct', kind: 'other', needsJudge: false });
  });

  it('nicht fragbar: Schlüsselwort, Formfehler, Auswahl, kein Muster, leer, lange Antwort', () => {
    const wrong = { verdict: 'wrong' as const };
    expect(fitAskable({ type: 'kwt', prompt: 'We ___ a handbook.', pat: 'x' }, wrong, 'had')).toBe(false);
    expect(fitAskable({ type: 'mc', prompt: 'We ___ a handbook.', pat: 'x' }, wrong, 'had')).toBe(false);
    expect(fitAskable({ type: 'gap', prompt: 'We ___ a handbook.', pat: null }, wrong, 'had')).toBe(false);
    expect(fitAskable({ type: 'gap', prompt: 'We ___ a handbook.', pat: 'x' }, { verdict: 'wrong', kind: 'form' }, 'had')).toBe(false);
    expect(fitAskable({ type: 'gap', prompt: 'We ___ a handbook.', pat: 'x' }, { verdict: 'correct' }, 'had')).toBe(false);
    expect(fitAskable({ type: 'gap', prompt: 'We ___ a handbook.', pat: 'x' }, wrong, '')).toBe(false);
    expect(fitAskable({ type: 'gap', prompt: 'No gap here.', pat: 'x' }, wrong, 'had')).toBe(false);
  });

  it('Urteil von Claude: nur fits UND certain zählt', () => {
    expect(fitAccepts({ fits: true, certain: true, why: 'x' })).toBe(true);
    expect(fitAccepts({ fits: true, certain: false, why: 'x' })).toBe(false);
    expect(fitAccepts({ fits: false, certain: true, why: 'x' })).toBe(false);
    expect(fitAccepts(null)).toBe(false);
    expect(fitKey('t|k', ' Had. ')).toBe(fitKey('t|k', 'had'));
  });

  it('Prompt grammar-fit@1: Schema, Sprachtreue, Regeln', () => {
    const v = { topic: 'Used to', pattern: 'used to + verb', mode: 'gap' as const, task: 'We ___ a paper archive.', sentence: 'We had a paper archive.', expected: 'We used to have a paper archive.', given: 'had', uiLang: 'de' as const };
    const p = grammarFit.build(v);
    expect(p.startsWith('[grammar-fit@1]')).toBe(true);
    expect(p).toContain('certain');
    expect(new TextEncoder().encode(p).length).toBeLessThan(60_000);
    const s = grammarFit.schema(v);
    expect(s.safeParse({ fits: true, certain: true, why: 'Der ganze Satz ist grammatisch richtig und passt zum Zusammenhang.' }).success).toBe(true);
    expect(s.safeParse({ fits: 'yes', certain: 'true', why: 'Der Satz ist richtig.' }).success).toBe(true);
    expect(s.safeParse({ fits: true, why: 'x' }).success).toBe(false);
  });

  it('shortWhy: erster Satz, gekürzt', () => {
    expect(shortWhy('Früher so, heute nicht mehr. Dann kommt mehr.')).toBe('Früher so, heute nicht mehr');
    expect(shortWhy('')).toBe('');
    expect(shortWhy('a '.repeat(100), 40).endsWith('…')).toBe(true);
  });

  it('Schreibweg: „Auch richtig“ ändert weder p noch Muster, schreibt aber seen und nie einen Fehler', () => {
    const base = defaultTopic(topicById('used-to') as NonNullable<ReturnType<typeof topicById>>);
    const mk = (alt: boolean) => answer({ t: 5, given: 'had', verdict: 'correct', ...(alt ? { alt: true } : {}) }, { topic: 'used-to', prompt: used().prompt, answer: 'used to have', pat: 'used-to-past' });
    const a = grammarWrite(base, mk(true));
    const b = grammarWrite(base, mk(false));
    if (a.kind !== 'update' || b.kind !== 'update') throw new Error('update erwartet');
    expect(a.patch.pats).toBeUndefined();
    expect(a.patch.p).toBeUndefined();
    expect(a.patch.n).toBeUndefined();
    expect(a.patch.errors).toBeUndefined();
    expect(a.patch.seen).toBeDefined();
    expect(b.patch.n).toBe(1);
  });

  it('Ziel (hint) der Fehler-finden-Aufgabe und alt der Lücke kommen durch die Einlesewege', () => {
    const raw = { id: 'x-f1', type: 'find', topic: 'used-to', pat: 'ut.used-to', prompt: 'Walking to work, my phone rang twice.', err: [0, 2], answer: 'As I walked to work,', fixed: 'As I walked to work, my phone rang twice.', accepted: [], hint: { de: 'Mach daraus einen Nebensatz.', en: 'Turn it into a clause.' }, why: { ok: { de: 'a', en: 'a' }, wrong: [] } };
    const p = V2TaskSchema.safeParse(raw);
    expect(p.success, JSON.stringify(p.error?.issues)).toBe(true);
    if (!p.success) return;
    const t = fromV2(p.data);
    expect(t?.goal?.de).toBe('Mach daraus einen Nebensatz.');
    const g = normalizeTask({ topic: 'used-to', type: 'gap', prompt: 'We ___ a map.', answer: 'used to have', alt: ['had', ' '] }, 'seed');
    expect(g?.alt).toEqual(['had']);
  });
});
