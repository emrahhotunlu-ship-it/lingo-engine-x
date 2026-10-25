import { describe, expect, it } from 'vitest';
import { dictPosOf } from '../../src/domain/lexicon/dict';
import { resolveWord, type CardInfo } from '../../src/domain/lookup/resolve';
import { guessPos, inferCardPos, rankSenses, targetPart, type SenseCand } from '../../src/domain/lookup/sense';
import { locate } from '../../src/domain/srs/context';
import { tokenize } from '../../src/domain/text/tokenize';

// Sinn-Auswahl beim Wort-Antippen (Emrahs Meldung 25.10.2026): die zur Verwendung im Satz passende Wortart/Bedeutung zuerst.

const deps = { cards: new Map<string, CardInfo>(), cache: undefined, uiLang: 'de' as const };

/** Löst das (n-te) Vorkommen von `word` im Satz mit Satzbezug auf. */
function inSentence(sentence: string, word: string, extra: Partial<Parameters<typeof resolveWord>[2]> = {}, nth = 0) {
  const tokens = tokenize(sentence);
  const hits = tokens.flatMap((t, i) => (t.text.toLowerCase() === word.toLowerCase() ? [i] : []));
  const index = hits[nth] ?? -1;
  expect(index).toBeGreaterThanOrEqual(0);
  const tk = tokens[index]!;
  return resolveWord(tk.text, null, { ...deps, ...extra, context: { tokens, index } });
}

const guessIn = (sentence: string, word: string, nth = 0) => {
  const tokens = tokenize(sentence);
  const hits = tokens.flatMap((t, i) => (t.text.toLowerCase() === word.toLowerCase() ? [i] : []));
  return guessPos(tokens, hits[nth] ?? -1, dictPosOf);
};

describe('Sinn-Auswahl: decline (Emrahs Meldung)', () => {
  const S = 'The candidate declined to commit to the start date until she reviewed the contract.';
  it('„declined“ nach dem Subjekt ist ein Verb – Verb-Bedeutung zuerst, Nomen als „Auch“', () => {
    const r = inSentence(S, 'declined');
    expect(r.headword).toBe('decline');
    expect(r.pos).toBe('verb');
    expect(r.de).toMatch(/ablehnen/);
    expect(r.also?.pos).toBe('noun');
    expect(r.also?.de).toMatch(/Rückgang/);
    expect(r.fit).toBe('pos');
  });
  it('eine eigene Nomen-Karte „decline“ verdrängt die Verb-Bedeutung im Verb-Satz nicht', () => {
    const cards = new Map<string, CardInfo>([['decline', { id: 'decline', word: 'decline', de: 'Rückgang, Niedergang', def: 'decrease', pos: 'noun', stage: 3, hidden: false }]]);
    const r = inSentence(S, 'declined', { cards });
    expect(r.pos).toBe('verb');
    expect(r.de).toMatch(/ablehnen/);
    expect(r.also).toMatchObject({ from: 'card', pos: 'noun' });
    expect(r.card?.id).toBe('decline');
  });
  it('dieselbe Karte ohne Wortart wird über die Übersetzung als Nomen erkannt', () => {
    const cards = new Map<string, CardInfo>([['decline', { id: 'decline', word: 'decline', de: 'Rückgang, Niedergang', def: null, pos: null, stage: 3, hidden: false }]]);
    expect(inSentence(S, 'declined', { cards }).pos).toBe('verb');
  });
  it('„a sharp decline in sales“ bleibt Nomen', () => {
    const r = inSentence('Sales saw a sharp decline in March.', 'decline');
    expect(r.pos).toBe('noun');
    expect(r.de).toMatch(/Rückgang/);
    expect(r.also?.pos).toBe('verb');
  });
  it('Teil der Ziel-Wendung: Bedeutung der Wendung, das Wort als Teil davon', () => {
    const target = targetPart(S, 4 + 'candidate '.length, 4 + 'candidate declined'.length, undefined, { word: 'to decline to commit to', de: 'sich nicht festlegen wollen auf', def: 'refuse to promise', pos: 'phrase' }, locate);
    expect(target).toMatchObject({ phrase: 'to decline to commit to', de: 'sich nicht festlegen wollen auf', single: false });
    const r = inSentence(S, 'declined', { target });
    expect(r.part?.de).toBe('sich nicht festlegen wollen auf');
    expect(r.pos).toBe('verb');
  });
  it('in einer offenen Aufgabe (Lücke im Satz) nie die Ziel-Wendung', () => {
    const t = { word: 'to decline to commit to', de: 'sich nicht festlegen wollen auf', def: null, pos: null };
    expect(targetPart(S, 14, 22, [[14, 40]], t, locate)).toBeNull();
    // Wort außerhalb der Wendung
    expect(targetPart(S, 0, 3, undefined, t, locate)).toBeNull();
  });
});

describe('Sinn-Auswahl: mehrdeutige Wörter im Satz', () => {
  const cases: Array<[string, string, 'noun' | 'verb' | 'adj', number?]> = [
    ['She will lead the new team.', 'lead', 'verb'],
    ['The police followed a new lead.', 'lead', 'noun'],
    ['We took the lead in the third quarter.', 'lead', 'noun'],
    ['They record every call for training.', 'record', 'verb'],
    ['Sales hit a record high last year.', 'record', 'noun'],
    ['Please keep a record of all expenses.', 'record', 'noun'],
    ['We need to address the issue quickly.', 'address', 'verb'],
    ['Please send it to my new address.', 'address', 'noun'],
    ['Address the complaint before Friday.', 'address', 'verb'],
    ['The CEO gave an address to the staff.', 'address', 'noun'],
    ['We plan to increase prices next year.', 'increase', 'verb'],
    ['There was an increase of ten percent.', 'increase', 'noun'],
    ['Prices increased sharply in March.', 'increased', 'verb'],
    ['The board will support the proposal.', 'support', 'verb'],
    ['Thanks for your support during the launch.', 'support', 'noun'],
    ['We support small suppliers in the region.', 'support', 'verb'],
    ['IT support is available around the clock.', 'support', 'noun'],
    ['They present the results on Monday.', 'present', 'verb'],
    ['She objected to the new schedule.', 'objected', 'verb'],
    ['We reported a decline in revenue.', 'decline', 'noun'],
    ['Demand may decline next quarter.', 'decline', 'verb'],
  ];
  for (const [sentence, word, pos] of cases) {
    it(`${word} in „${sentence}“ → ${pos}`, () => {
      expect(inSentence(sentence, word).pos).toBe(pos);
    });
  }
});

describe('Sinn-Auswahl: Bausteine', () => {
  it('guessPos: Partizip vor einem Hauptwort gilt als Eigenschaftswort', () => {
    const g = guessIn('Adjusted earnings came to $1.08 per share.', 'Adjusted');
    expect(g.attributive).toBe(true);
    expect(g.pos).toBe('adj');
    expect(guessIn('The revised plan is ready.', 'revised').pos).toBe('adj');
    expect(guessIn('We revised the plan.', 'revised').pos).toBe('verb');
  });
  it('guessPos: -ly ist kein Adverb bei supply/reply', () => {
    expect(guessIn('The supply of chips is low.', 'supply').pos).toBe('noun');
    expect(guessIn('She answered quickly.', 'quickly').pos).toBe('adv');
  });
  it('rankSenses ohne Wortart: Karte → Zwischenspeicher → Wörterbuch, mehrere Wortarten = unsicher', () => {
    const c: SenseCand[] = [
      { pos: 'noun', de: 'Rückgang', def: 'decrease', from: 'dict' },
      { pos: 'verb', de: 'ablehnen', def: 'refuse', from: 'dict' },
    ];
    const r = rankSenses(c, null);
    expect(r.primary?.de).toBe('Rückgang');
    expect(r.also?.de).toBe('ablehnen');
    expect(r.fit).toBe('unsure');
    expect(rankSenses([c[0]!], null).fit).toBe('single');
    expect(rankSenses([], null).fit).toBe('none');
  });
  it('rankSenses: klare Verwendung ohne passenden Eintrag = mismatch, keine falsche Bedeutung vorn', () => {
    const r = rankSenses([{ pos: 'noun', de: 'Merkmal', def: 'feature', from: 'dict' }], { pos: 'verb', strength: 'sure', attributive: false, scores: { noun: 0, verb: 3, adj: 0, adv: 0 } });
    expect(r.fit).toBe('mismatch');
    expect(r.primary).toBeNull();
    expect(r.also?.de).toBe('Merkmal');
  });
  it('rankSenses: Partizip vor Hauptwort mit nur einer Verb-Bedeutung = unsicher (Claude anbieten)', () => {
    const r = rankSenses([{ pos: 'verb', de: 'anpassen', def: 'change slightly', from: 'dict' }], { pos: 'adj', strength: 'sure', attributive: true, scores: { noun: 0, verb: 1, adj: 3, adv: 0 } });
    expect(r.fit).toBe('unsure');
    expect(r.primary?.de).toBe('anpassen');
  });
  it('inferCardPos: Karte ohne Wortart über die deutsche Bedeutung', () => {
    const dict: SenseCand[] = [
      { pos: 'noun', de: 'Rückgang, Niedergang', def: '', from: 'dict' },
      { pos: 'verb', de: 'zurückgehen, ablehnen', def: '', from: 'dict' },
    ];
    expect(inferCardPos({ pos: null, de: 'Niedergang', def: null, from: 'card' }, dict)).toBe('noun');
    expect(inferCardPos({ pos: null, de: 'etwas ganz anderes', def: null, from: 'card' }, dict)).toBeNull();
  });
  it('spätere Grundform, wenn nur sie zur Verwendung passt („used“ → use, „lives“ → live), sonst die erste', () => {
    expect(inSentence('Mary used the new template for the report.', 'used')).toMatchObject({ headword: 'use', pos: 'verb' });
    expect(inSentence('We bought a used laptop for the intern.', 'used')).toMatchObject({ headword: 'used', pos: 'adj' });
    expect(inSentence('He lives in Chicago.', 'lives')).toMatchObject({ headword: 'live', pos: 'verb' });
  });
  it('Gerundium meint die Tätigkeit, nicht das Hauptwort der Grundform', () => {
    expect(inSentence('Drinking too much coffee is bad for you.', 'Drinking').pos).toBe('verb');
    expect(inSentence('Her handling of the complaint was excellent.', 'handling').pos).toBe('verb');
    expect(inSentence('The meeting starts at nine.', 'meeting')).toMatchObject({ headword: 'meeting', pos: 'noun' });
  });
  it('Hilfsverb „can“: Verb im Satz, Dose nur nach Artikel', () => {
    expect(inSentence('We can ship the order on Monday.', 'can').de).toMatch(/können/);
    expect(inSentence('She opened a can of soda.', 'can').de).toMatch(/Dose/);
  });
  it('resolveWord ohne Satzbezug bleibt wie bisher (Karte zuerst, posHint als Vorzug)', () => {
    expect(resolveWord('decline', 'verb', deps).pos).toBe('verb');
    expect(resolveWord('decline', null, deps).pos).toBe('noun');
  });
});
