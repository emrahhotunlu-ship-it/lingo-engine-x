/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Testdaten: freie, realistische KI-Antworten werden gezielt verändert (JSON ohne festen Typ). */
import { describe, expect, it } from 'vitest';
import { reportExample, reportSchema } from '../../src/prompts/roleplayReport';
import { cleanFigureText } from '../../src/prompts/roleplayTurn';
import { countSentences, cut, firstCefr, inputCat } from '../../src/prompts/tolerant';
import { weeklyExample, weeklySchema } from '../../src/prompts/weeklyReport';

// Realistische Modellantworten, an denen die Vorlagen bisher scheiterten (Prüfbefunde W3–W8 und
// Hinweise): Sie werden jetzt normalisiert statt abgelehnt – und das Ergebnis ist geprüft.

type J = Record<string, any>;
const clone = (o: unknown): J => JSON.parse(typeof o === 'string' ? o : JSON.stringify(o)) as J;
const issues = (r: { success: boolean; error?: { issues: unknown[] } }) => (r.success ? [] : (r.error?.issues ?? []));

describe('tolerante Bausteine', () => {
  it('cut, firstCefr, inputCat, countSentences', () => {
    expect(cut('abcdef', 4)).toBe('abc…');
    expect(firstCefr('B2 (B2+ in places)', ['B2', 'B2+'])).toBe('B2');
    expect(firstCefr('B2-C1', ['B2', 'C1'])).toBe('B2');
    expect(firstCefr('b2/c1', ['B2', 'C1'])).toBe('B2');
    expect(firstCefr('C1+', ['B2', 'C1'])).toBe('C1');
    expect(firstCefr('Z9', ['B2'])).toBe('Z9');
    expect(inputCat('prepositions')).toBe('grammar');
    expect(inputCat('Tense')).toBe('grammar');
    expect(inputCat('agreement')).toBe('grammar');
    expect(inputCat('word choice')).toBe('vocabulary');
    expect(inputCat('style')).toBe('register');
    expect(inputCat('something new')).toBe('other');
    expect(countSentences('Thanks for coming in, Mr. Keller. I will be direct. Our budget is 2.5 million, and your offer is above it.')).toBe(3);
    expect(countSentences('One. Two. Three. Four sentences here.')).toBe(4);
    expect(countSentences('No full stop at the end')).toBe(1);
  });
});

describe('W8 weekly-report@2: Verweis tolerant', () => {
  const facts = [...Array.from({ length: 5 }, (_, i) => ({ id: `vw:v${i}`, text: `new word "negotiate${i}" still recalled` })), { id: 'tm:week', text: '210 minutes on 6 days' }];
  for (const lang of ['de', 'en'] as const) {
    it(lang, () => {
      const v = { lang, week: '2026-W39', facts };
      const s = weeklySchema(v);
      const ex = clone(weeklyExample(v));
      for (const [ref, want] of [
        ['vw:v1, vw:v2, vw:v3', 'vw:v1'],
        ['[vw:v2]', 'vw:v2'],
        ['(tm:week)', 'tm:week'],
      ] as const) {
        const r = clone(ex);
        r.learned[0].ref = ref;
        expect(s.parse(r).learned[0]!.ref).toBe(want);
      }
      const arr = clone(ex);
      delete arr.learned[0].ref;
      arr.learned[0].refs = ['vw:x', 'vw:v3'];
      expect(s.parse(arr).learned[0]!.ref).toBe('vw:v3');
      const bad = clone(ex);
      bad.learned[0].ref = 'vw:erfunden';
      expect(s.safeParse(bad).success).toBe(false);
    });
  }
});

describe('Hinweise: roleplay-report@2, roleplay-turn', () => {
  for (const uiLang of ['de', 'en'] as const) {
    it(`roleplay-report ${uiLang}: ohne Fokuspunkt, Kategorie „grammar", gebeugte Wendung im Beispiel`, () => {
      const turns = [{ me: 'What I can offer is a dedicated engineer for your tickets.', persona: 'Hm.', v: 'clean', c: [] }, { me: 'We must delay the start, the exposure is for you.', persona: 'That is your problem.', v: 'errors', c: ['prepositions'] }];
      const s = reportSchema({ turns, uiLang });
      const ex = clone(reportExample(uiLang));
      ex.strengths[0].quote = 'What I can offer is a dedicated engineer';
      const empty = clone(ex);
      empty.focus = [];
      expect(issues(s.safeParse(empty))).toEqual([]);
      const cat = clone(ex);
      cat.focus[0].cat = 'grammar';
      expect(s.parse(cat).focus[0]!.cat).toBe('other');
      const infl = clone(ex);
      infl.phrases[0].en = 'hinge on';
      infl.phrases[0].ex = 'It all hinges on the budget.';
      expect(issues(s.safeParse(infl))).toEqual([]);
      const lead = clone(ex);
      lead.phrases[0].ex = 'That really hinges on your budget.';
      expect(issues(s.safeParse(lead))).toEqual([]);
      const wrong = clone(ex);
      wrong.phrases[0].ex = 'It depends on the budget.';
      expect(s.safeParse(wrong).success).toBe(false);
    });
  }

  it('roleplay-turn: einteiliges Namenspräfix weg, Klammer mitten im Satz bleibt, Regieanweisung geht', () => {
    expect(cleanFigureText('Sandra: Look, I hear you, but my CFO wants numbers, not promises.')).toBe('Look, I hear you, but my CFO wants numbers, not promises.');
    expect(cleanFigureText('We pay roughly 40k a year (about a third of our IT budget) for this.')).toBe('We pay roughly 40k a year (about a third of our IT budget) for this.');
    expect(cleanFigureText('That sounds good (in theory). What exactly would you change?')).toBe('That sounds good (in theory). What exactly would you change?');
    expect(cleanFigureText('Fine. (smiles) What would it cost us?')).toBe('Fine. What would it cost us?');
    expect(cleanFigureText('Fair enough. (leans back)')).toBe('Fair enough.');
    expect(cleanFigureText('Look: This is not theoretical.')).toBe('Look: This is not theoretical.');
    expect(cleanFigureText('Sure, Mr. Keller. What would it cost us?')).toBe('Sure, Mr. Keller. What would it cost us?');
  });
});
