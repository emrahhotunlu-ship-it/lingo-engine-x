import { describe, expect, it } from 'vitest';
import { asAlsoRight, checkGrammar, fitAskable, fitAskableReplace } from '../../src/domain/grammar/check';
import { shortWhy } from '../../src/domain/grammar/alsoRight';
import { grammarWrite } from '../../src/domain/grammar/write';
import { defaultTopic } from '../../src/domain/content';
import { topicById } from '../../src/domain/content';
import { answer } from './learnHelpers';
import { grammarFit } from '../../src/prompts/grammarFit';
import { abandonFit, fitAccepts, fitErrOf, fitKey, runFit, type FitResult, type FitRun } from '../../src/features/grammar/fit';
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

  it('Prompt grammar-fit@2: Kopf, Beispiele-Satz, Ziel und Regel, Schema mit Kappen statt Neufragen', () => {
    const v = {
      topic: 'Used to',
      pattern: 'used to + verb',
      rule: 'used to + base form',
      goal: 'past habit',
      accepted: ['used to keep'],
      mode: 'gap' as const,
      task: 'We ___ a paper archive.',
      sentence: 'We had a paper archive.',
      expected: 'We used to have a paper archive.',
      given: 'had',
      uiLang: 'de' as const,
    };
    const p = grammarFit.build(v);
    expect(p.startsWith('[grammar-fit@2]')).toBe(true);
    expect(p).toContain('The listed answers are examples, not exhaustive.');
    expect(p).toContain('Pattern rule: used to + base form');
    expect(p).toContain('Goal of the exercise: past habit');
    expect(p).toContain('Other accepted answers: used to keep');
    expect(p).toContain('fitsGoal');
    expect(new TextEncoder().encode(p).length).toBeLessThan(60_000);
    const s = grammarFit.schema(v);
    const why = { de: 'Der ganze Satz ist richtig.', en: 'The whole sentence is correct.' };
    const ok = s.safeParse({ fits: true, certain: true, fitsGoal: false, why, edits: [], vs: 'ut.past-simple', retryHint: null });
    expect(ok.success).toBe(true);
    // Tolerant: Wahrheitswerte als Text, zu lange Liste gekappt, unbekannte Kennung → null, fehlendes fitsGoal → false.
    const loose = s.safeParse({ fits: 'yes', certain: 'true', why, edits: [1, 2, 3, 4].map((i) => ({ from: `a${i}`, to: `b${i}`, sev: 'upgrade' })), vs: 'nonsense id', retryHint: 7 });
    expect(loose.success).toBe(true);
    if (loose.success) expect([loose.data.edits.length, loose.data.vs, loose.data.fitsGoal, loose.data.retryHint]).toEqual([3, null, false, null]);
    // „passt“ mit echter Fehlerkorrektur ist nicht sicher.
    const err = s.safeParse({ fits: true, certain: true, fitsGoal: true, why, edits: [{ from: 'had', to: 'used to have', sev: 'error' }], vs: null, retryHint: null });
    expect(err.success && err.data.certain).toBe(false);
    // Ohne zweisprachige Begründung ungültig (das KI-Tor fragt höchstens einmal neu, A6.3).
    expect(s.safeParse({ fits: true, certain: true, why: 'x' }).success).toBe(false);
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

  it('shortWhy: ohne „: Lösung“ und mit großem Anfang', () => {
    expect(shortWhy('Richtig: früher so, heute nicht mehr: used to + Grundform (have).')).toBe('Früher so, heute nicht mehr');
  });

  it('fitAskableReplace: nur lokal falsche, kurze Ersetzungen', () => {
    expect(fitAskableReplace({ verdict: 'wrong' }, 'When I headed to work,')).toBe(true);
    expect(fitAskableReplace({ verdict: 'correct' }, 'x')).toBe(false);
    expect(fitAskableReplace({ verdict: 'wrong', kind: 'form' }, 'x')).toBe(false);
    expect(fitAskableReplace({ verdict: 'wrong' }, 'a b c d e f g h i')).toBe(false);
  });

  it('runFit: genau eine Auswertung (Claude, Überspringen und Verwerfen schließen sich aus)', async () => {
    const calls: string[] = [];
    const ctl: { current: FitRun | null } = { current: null };
    const out = { fits: true, certain: true, fitsGoal: false, why: { de: 'x', en: 'x' }, edits: [], vs: null, retryHint: null };
    let resolve: (v: FitResult) => void = () => undefined;
    runFit(ctl, new Promise<FitResult>((r) => (resolve = r)), () => calls.push('accept'), () => calls.push('local'));
    ctl.current?.skip();
    resolve({ out, err: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(['local']);
    const ctl2: { current: FitRun | null } = { current: null };
    runFit(ctl2, Promise.resolve({ out, err: null }), () => calls.push('accept2'), () => calls.push('local2'));
    abandonFit(ctl2);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(['local']);
    // Fehler: das lokale Urteil bekommt die Fehlerart (§6.4).
    const ctl3: { current: FitRun | null } = { current: null };
    const got: Array<FitResult | null> = [];
    runFit(ctl3, Promise.resolve({ out: null, err: 'busy' }), () => calls.push('accept3'), (r) => got.push(r));
    await Promise.resolve();
    await Promise.resolve();
    expect(got).toEqual([{ out: null, err: 'busy' }]);
  });

  it('Fehlerarten des KI-Tors → Folge in der Übung (§6.4)', () => {
    expect(fitErrOf('cancelled')).toBeNull();
    expect(fitErrOf('unavailable')).toBe('off');
    expect(fitErrOf('busy')).toBe('busy');
    expect(fitErrOf('signin')).toBe('signin');
    expect(fitErrOf('refused')).toBe('final');
    expect(fitErrOf('empty')).toBe('final');
    expect(fitErrOf('invalid')).toBe('retry');
    expect(fitErrOf('failed')).toBe('retry');
    expect(fitErrOf('bug')).toBe('bug');
    expect(fitErrOf('too_large')).toBe('bug');
  });
});
