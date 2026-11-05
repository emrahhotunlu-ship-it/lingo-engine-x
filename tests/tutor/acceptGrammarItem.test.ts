import { describe, expect, it } from 'vitest';
import { acceptGrammarItem, acceptGrammarItems } from '../../src/domain/tutor/acceptGrammarItem';
import { GRAMMAR_ITEMS_EXAMPLE, grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';

// E5 (Tutor-Engine v3 §6.3): Claude-Aufgaben werden lokal mit `judge` und `lintTask` gegengeprüft; ohne eindeutige Lösung oder mit Lint-Befund
// fallen sie weg. Gutes Englisch (britische Form, gelistete Varianten) gilt nie als falsch.

const base = { topic: 'passive', accepted: [] as string[], options: null, hint_de: '(organize)', explanation_de: 'Der Workshop organisiert sich nicht selbst, deshalb Passiv.', explanation_en: 'The workshop does not organize itself, so we use the passive.', src: 'ai' };
const gap = (o: object = {}) => ({ ...base, type: 'gap', prompt: 'The workshop ___ (organize) by our team last spring.', answer: 'was organized', self: { solved: 'was organized', also: [] as string[] }, ...o });
const mc = (o: object = {}) => ({ ...base, hint_de: '', type: 'mc', prompt: 'The quarterly report ___ by the finance team every Monday.', answer: 'is checked', options: ['checks', 'is checked', 'is checking'], self: { solved: 'is checked', also: [] }, ...o });
const fix = (o: object = {}) => ({
  ...base,
  hint_de: '',
  type: 'correct',
  prompt: 'The invoices was sent to the client last Friday.',
  answer: 'The invoices were sent to the client last Friday.',
  goal: { de: 'Die Rechnungen gingen letzten Freitag an den Kunden.', en: 'The invoices went to the client last Friday.' },
  self: { solved: 'The invoices were sent to the client last Friday.', also: [] },
  ...o,
});

describe('acceptGrammarItem: eindeutige Aufgaben werden angenommen', () => {
  it('Lücke, Auswahl und Satz verbessern ohne Befund', () => {
    for (const raw of [gap(), mc(), fix()]) {
      const r = acceptGrammarItem(raw, { requireSelf: true });
      expect(r.reasons).toEqual([]);
      expect(r.task?.src).toBe('ai');
    }
    expect(acceptGrammarItem(fix()).task?.goal?.en).toBe('The invoices went to the client last Friday.');
  });

  it('britische Schreibweise und gelistete Varianten sind gedeckt (kein falsches Falsch)', () => {
    expect(acceptGrammarItem(gap({ self: { solved: 'was organised', also: ['was organised'] } })).reasons).toEqual([]);
    expect(acceptGrammarItem(gap({ accepted: ['got organized'], self: { solved: 'was organized', also: ['got organized'] } })).reasons).toEqual([]);
  });
});

describe('acceptGrammarItem: verworfen, mit Grund', () => {
  it('weitere gültige Antwort nicht in accepted → also_uncovered', () => {
    expect(acceptGrammarItem(gap({ self: { solved: 'was organized', also: ['got organized'] } })).reasons).toContain('also_uncovered');
  });

  it('blinde Lösung passt nicht → self_wrong; ohne Selbstprüfung nur mit Pflicht verworfen', () => {
    expect(acceptGrammarItem(gap({ self: { solved: 'organized', also: [] } })).reasons).toContain('self_wrong');
    const noSelf: Record<string, unknown> = gap();
    delete noSelf.self;
    expect(acceptGrammarItem(noSelf, { requireSelf: true }).reasons).toEqual(['self_missing']);
    expect(acceptGrammarItem(noSelf).task).not.toBeNull();
  });

  it('zweite richtige Option in der Auswahl → verworfen', () => {
    // Gleiche Antwort in britischer Schreibweise als „Ablenker“: wäre auch richtig.
    const uk = mc({ prompt: 'The quarterly meeting ___ by the finance team every year.', answer: 'is organized', options: ['organizes', 'is organized', 'is organised'], self: { solved: 'is organized', also: [] } });
    expect(acceptGrammarItem(uk).reasons).toContain('distractor_ok');
    // Eine Option als `accepted` bei einer Auswahlaufgabe: das lokale Urteil nimmt sie nicht an.
    expect(acceptGrammarItem(mc({ accepted: ['checks'] })).task).toBeNull();
  });

  it('Lint-Befund verwirft: Verb-Lücke ohne Grundform, Satz verbessern ohne Ziel, zwei Lücken', () => {
    expect(acceptGrammarItem(gap({ prompt: 'The workshop ___ by our team last spring.', hint_de: '' })).reasons).toContain('lint:no_verb');
    expect(acceptGrammarItem(fix({ goal: undefined })).reasons).toContain('lint:no_goal');
    expect(acceptGrammarItem(gap({ prompt: 'The workshop ___ (organize) by ___ last spring.' })).reasons).toEqual(['shape']);
  });

  it('grammar-items@6: self.plain weicht vom gelösten Satz ab → unnatural; ohne plain kein Grund; Kurzformen und Satzzeichen zählen nicht', () => {
    expect(acceptGrammarItem(gap({ self: { solved: 'was organized', also: [], plain: 'Our team organized the workshop last spring.' } })).reasons).toEqual(['unnatural']);
    expect(acceptGrammarItem(gap({ self: { solved: 'was organized', also: [], plain: 'the workshop was organized by our team last spring' } })).reasons).toEqual([]);
    expect(acceptGrammarItem(gap()).reasons).toEqual([]);
    // Satz verbessern: plain wird mit der Lösung verglichen.
    expect(acceptGrammarItem(fix({ self: { solved: 'The invoices were sent to the client last Friday.', also: [], plain: 'We sent the invoices to the client last Friday.' } })).reasons).toEqual(['unnatural']);
    expect(acceptGrammarItem(fix({ self: { solved: 'The invoices were sent to the client last Friday.', also: [], plain: 'The invoices were sent to the client last Friday.' } })).reasons).toEqual([]);
    // Eine gelistete Variante (eingesetzt) gilt auch.
    expect(acceptGrammarItem(gap({ accepted: ['got organized'], self: { solved: 'was organized', also: ['got organized'], plain: 'The workshop got organized by our team last spring.' } })).reasons).toEqual([]);
  });

  it('grammar-items@6: Satz verbessern mit mehr als einem Fehler → multi_error; Wortstellung ist EIN Fehler', () => {
    // Zwei Stellen geändert (Verb und Präposition).
    const two = acceptGrammarItem(fix({ prompt: 'The invoices was sent at the client last Friday.' }));
    expect(two.reasons).toContain('multi_error');
    // Mehr als drei Wörter an einer Stelle.
    const many = acceptGrammarItem(fix({ prompt: 'The invoices was being had sent off to the client last Friday.' }));
    expect(many.reasons).toContain('multi_error');
    // Ein verschobenes Wort (Wortstellung) ist ein Fehler.
    const moved = acceptGrammarItem({
      ...fix(),
      topic: 'word-order',
      prompt: 'We sent yesterday the invoices to the client.',
      answer: 'We sent the invoices to the client yesterday.',
      self: { solved: 'We sent the invoices to the client yesterday.', also: [] },
    });
    expect(moved.reasons).not.toContain('multi_error');
  });

  it('Satz verbessern: gezeigter Satz ist schon richtig → error_kept', () => {
    const r = acceptGrammarItem(fix({ prompt: 'The invoices were sent to the client last Friday.' }));
    expect(r.task).toBeNull();
    expect(r.reasons).toContain('error_kept');
  });

  it('Lösung, die das lokale Urteil nicht annimmt → answer_not_correct / accepted_not_correct', () => {
    expect(acceptGrammarItem(mc({ answer: 'is checked', options: ['checks', 'is checking', 'checked'] })).reasons).toEqual(['shape']);
    expect(acceptGrammarItem(gap({ accepted: [''] })).reasons).toEqual([]);
  });
});

describe('acceptGrammarItem: zweiter Löser solve-check@1', () => {
  it('Lösung fehlt, mehrdeutig oder ungedeckte Antwort → verworfen', () => {
    expect(acceptGrammarItem(gap(), { solve: { answers: ['was organized'], ambiguous: false } }).reasons).toEqual([]);
    expect(acceptGrammarItem(gap(), { solve: { answers: ['had been organized'], ambiguous: false } }).reasons).toEqual(['solve_missing', 'solve_uncovered']);
    expect(acceptGrammarItem(gap(), { solve: { answers: ['was organized', 'got organized'], ambiguous: false } }).reasons).toEqual(['solve_uncovered']);
    expect(acceptGrammarItem(gap(), { solve: { answers: ['was organized'], ambiguous: true } }).reasons).toEqual(['solve_ambiguous']);
  });

  it('Stapel: jede Aufgabe für sich, Dubletten fallen weg', () => {
    const r = acceptGrammarItems([gap(), gap(), mc({ accepted: ['checks'] }), fix()], { requireSelf: true });
    expect(r.tasks).toHaveLength(2);
    expect(r.dropped.map((d) => d.i)).toEqual([1, 2]);
  });
});

describe('grammar-items@5: Selbstprüfung im Schema', () => {
  const vars: GrammarItemsVars = { topic: 'passive', nameEn: 'Passive voice', ruleEn: 'be + past participle', examples: [], p: 0.5, types: ['gap', 'mc', 'correct'], seenText: [], errors: [], count: 3 };
  const run = (items: unknown[]) => grammarItems.schema(vars).safeParse({ items });

  it('Kopfzeile, Hintergrund-Budget, Regeln zur Selbstprüfung im Prompt', () => {
    const p = grammarItems.build(vars);
    expect(p.split('\n')[0]).toBe('[grammar-items@6]');
    expect(p).toContain('"self.solved"');
    expect(p).toContain('Good English is never wrong.');
    expect(grammarItems.budget).toEqual({ bgPerDay: 2 });
    expect(grammarItems.tier).toBe('default');
  });

  it('das Beispiel im Prompt besteht das Schema', () => {
    const ex = JSON.parse(GRAMMAR_ITEMS_EXAMPLE) as { items: unknown[] };
    const r = grammarItems.schema({ ...vars, count: 2 }).safeParse(ex);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it('Aufgabe mit ungedeckter Alternative fällt einzeln weg, `self` wird nicht weitergereicht, `goal` schon', () => {
    const r = run([gap(), mc(), fix(), gap({ prompt: 'The new office ___ (open) by the mayor last week.', answer: 'was opened', hint_de: '(open)', self: { solved: 'was opened', also: ['got opened'] } })]);
    expect(r.success).toBe(true);
    const items = (r.data as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(3);
    expect(items.some((i) => 'self' in i)).toBe(false);
    expect(items[2]?.goal).toBeTruthy();
  });

  it('zu wenige eindeutige Aufgaben → Schemafehler mit Begründung (Grundlage des einen Neuversuchs nach A6.3)', () => {
    const r = run([gap({ self: { solved: 'was organized', also: ['got organized'] } }), mc({ accepted: ['checks'] }), fix({ goal: undefined })]);
    expect(r.success).toBe(false);
    const msg = JSON.stringify(r.error?.issues);
    expect(msg).toContain('also_uncovered');
    expect(msg).toContain('accepted_not_correct');
  });
});
