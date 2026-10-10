import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { exTextKey } from '../../src/domain/srs/exercise';
import { findContext, hasGapPlaceholder } from '../../src/domain/srs/context';
import { bracketExample } from '../../src/domain/srs/newCard';
import { cardExamples, acceptExamples } from '../../src/domain/srs/examples';
import { toTrainCard } from '../../src/domain/srs/cards';
import { explainWord } from '../../src/domain/srs/explainWord';
import { isPatternGap, partnerOf } from '../../src/domain/srs/partner';
import { acceptCollocations } from '../../src/domain/srs/collocs';

// Emrahs Rückmeldungen 1, 2 und 3 (10.10.2026).

const NOW = Date.parse('2026-10-10T10:00:00+02:00');

describe('Rückmeldung 1: „Satz vervollständigen“ ohne Satzanfang', () => {
  it('ohne Satzanfang lautet die Aufgabe „Schreib einen eigenen Satz …“ (DE + EN), mit Satzanfang wie bisher', () => {
    expect(exTextKey({ ex: 'complete', start: null })).toBe('complete_free');
    expect(exTextKey({ ex: 'complete', start: '  ' })).toBe('complete_free');
    expect(exTextKey({ ex: 'complete', start: 'Before we sign,' })).toBe('complete');
    expect(exTextKey({ ex: 'cloze', start: null })).toBe('cloze');
    const dict = (d: unknown) => d as Record<string, string>;
    for (const k of ['task_complete_free', 'exName_complete_free']) {
      expect(dict(de)[k]).toBeTruthy();
      expect(dict(en)[k]).toBeTruthy();
    }
    expect(dict(de).task_complete_free).toMatch(/eigenen Satz/);
    expect(dict(en).task_complete_free).toMatch(/your own sentence/);
  });
});

const EMRAH = "The report clearly shows 200 new contracts in December, so Tom ? have missed them - it's ____ now.";

describe('Rückmeldung 2: Übungssätze mit Lücke sind nie Beispielsatz eines Worts', () => {
  it('erkennt Platzhalter, lässt normale Sätze in Ruhe', () => {
    expect(hasGapPlaceholder(EMRAH)).toBe(true);
    expect(hasGapPlaceholder('We ___ (have) a paper archive.')).toBe(true);
    expect(hasGapPlaceholder('Tom (?) have missed them.')).toBe(true);
    expect(hasGapPlaceholder('Did you see the report? It shows 200 new contracts.')).toBe(false);
    expect(hasGapPlaceholder('Why? Because the client asked for it.')).toBe(false);
    expect(hasGapPlaceholder('We sent the offer… and waited.')).toBe(false);
  });
  it('Wort antippen in einer Grammatik-Aufgabe: der Satz mit Lücken wird nicht gespeichert; ein normaler Satz bekommt den Gedankenstrich', () => {
    expect(bracketExample(EMRAH, 'contracts', 'contract')).toBe('');
    expect(bracketExample('The report shows new contracts - all from December.', 'contracts', 'contract')).toBe('The report shows new [contracts] – all from December.');
  });
  it('alte Karte mit so einem Satz: kein Lückensatz in der Übung, Ersatz aus einem sauberen Beispiel; Dokument bleibt unverändert', () => {
    const doc = { word: 'contract', de: 'Vertrag', pos: 'noun', ex: EMRAH.replace('contracts', '[contracts]'), xEx: [{ en: 'We signed the contract on Monday.', t: 1 }], state: 'review', stage: 2, S: 4, D: 5, reps: 2, last: 1, due: 2 };
    const before = JSON.stringify(doc);
    expect(findContext(doc.ex, 'contract')).toBeNull();
    const card = toTrainCard('contract', doc, true, NOW)!;
    expect(card.context?.sentence).toBe('We signed the contract on Monday.');
    const ex = cardExamples(card, null).map((e) => e.en);
    expect(ex.some((s) => hasGapPlaceholder(s))).toBe(false);
    expect(JSON.stringify(doc)).toBe(before);
    // Ohne sauberen Ersatz: lieber kein Satz als ein Lückensatz.
    const bare = toTrainCard('contract', { ...doc, xEx: undefined }, true, NOW)!;
    expect(bare.context).toBeNull();
    expect(cardExamples(bare, null)).toEqual([]);
  });
  it('KI-Beispiele mit Platzhalter werden nicht übernommen; „ - “ wird zu „ – “', () => {
    const out = acceptExamples('contract', ['Tom ? signed the contract yesterday.', 'The contract is ready - please sign it today.'], NOW).map((x) => x.en);
    expect(out).toEqual(['The contract is ready – please sign it today.']);
  });
  it('Inhaltsprüfung: kein Beispielsatz-Feld im Bestand (Atlas, C1-Paket, Startwörter, Testdaten) enthält Platzhalter oder „ - “', () => {
    const EXAMPLE_KEYS = new Set(['ex', 'x', 'xEx', 'en', 'example', 'examples']);
    const files = [...globSync('src/content/atlas/*.json'), 'src/content/c1/pack.json', ...globSync('src/content/legacy/*.json'), 'seed/sample-data.json'];
    const bad: string[] = [];
    const walk = (o: unknown, k: string, f: string): void => {
      if (Array.isArray(o)) o.forEach((v) => walk(v, k, f));
      else if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) walk(v, kk, f);
      else if (typeof o === 'string' && EXAMPLE_KEYS.has(k) && (hasGapPlaceholder(o) || / - /.test(o))) bad.push(`${f} ${k}: ${o.slice(0, 80)}`);
    };
    for (const f of files) walk(JSON.parse(readFileSync(f, 'utf8')), '', f);
    expect(bad).toEqual([]);
  });
});

const overcome = (over: Record<string, unknown> = {}) =>
  toTrainCard('overcome', { word: 'overcome', de: 'überwinden', def: 'to deal with a difficulty', pos: 'verb', state: 'review', stage: 3, S: 4, D: 5, reps: 3, last: 1, due: 2, ex: 'We [overcome] problems together.', ...over }, true, NOW)!;
const COL = { p: 'overcome objections', de: 'Einwände ausräumen', gap: 'objections', opts: ['proposals', 'meetings'] };
const lineText = (m: ReturnType<typeof explainWord>, k: string): string => JSON.stringify(m.lines.filter((l) => l.k === k));

describe('Rückmeldung 3: Wortpartner-Ergebnis zeigt die geübte Verbindung', () => {
  it('richtig: Kopf und Merke nennen die Verbindung, die Begründung steht trotzdem; Kartenwort nur als Zusatz', () => {
    const m = explainWord({ card: overcome(), ex: 'colloc_gap', verdict: 'correct', given: 'objections', check: { verdict: 'correct' }, lang: 'de', solution: 'objections', colloc: COL });
    expect(m.lines[0]).toMatchObject({ k: 'pattern', name: 'overcome objections · overcome' });
    const why = lineText(m, 'why');
    expect(why).toContain('Merke: overcome objections = Einwände ausräumen');
    expect(why).toContain('fester Partner');
    expect(m.mark[0]).toBe('overcome objections');
    const mEn = explainWord({ card: overcome(), ex: 'colloc_gap', verdict: 'correct', given: 'objections', check: { verdict: 'correct' }, lang: 'en', solution: 'objections', colloc: COL });
    expect(lineText(mEn, 'why')).toContain('Remember: overcome objections');
  });
  it('falsch: nennt die gewählte und die übrigen Optionen als Verbindung und warum sie nicht passen', () => {
    const m = explainWord({ card: overcome(), ex: 'colloc_gap', verdict: 'wrong', given: 'proposals', check: { verdict: 'wrong' }, lang: 'de', solution: 'objections', colloc: COL });
    const yours = lineText(m, 'yours');
    expect(yours).toContain('overcome objections');
    expect(yours).toContain('overcome proposals');
    expect(yours).toContain('overcome meetings');
    expect(yours).toContain('keine feste Verbindung');
  });
  it('Beispiele zeigen die Verbindung (ein Satz ohne Partnerwort fällt weg)', () => {
    const examples = [
      { en: 'We overcome many problems every week.', de: null, ctx: null },
      { en: 'She helped us overcome objections from the board.', de: null, ctx: null },
    ];
    const m = explainWord({ card: overcome(), ex: 'colloc_gap', verdict: 'correct', given: 'objections', check: { verdict: 'correct' }, lang: 'de', solution: 'objections', colloc: COL, examples });
    expect(m.examples.map((e) => e.en)).toEqual(['She helped us overcome objections from the board.']);
  });
  it('„afford to + Verb“ ist ein Satzmuster, keine Wortpartner-Aufgabe', () => {
    expect(isPatternGap('afford', 'afford to lose', null)).toBe(true);
    expect(isPatternGap('afford', 'afford the risk', { sentence: "We can't afford the risk.", start: 16 })).toBe(false);
    expect(isPatternGap('afford', 'x', { sentence: "We can't afford to lose this customer.", start: 19 })).toBe(true);
    expect(isPatternGap('overcome', 'overcome objections', null)).toBe(false);
    const raw = [
      { p: 'afford to lose', de: 'sich leisten zu verlieren', gap: 'lose', opts: ['miss', 'drop', 'leave'], ex: "We can't [afford to lose] this customer." },
      { p: 'afford the risk', de: 'sich das Risiko leisten', gap: 'risk', opts: ['danger', 'chance', 'threat'], ex: "We can't [afford the risk] of a delay." },
    ];
    expect(acceptCollocations('afford', raw).map((c) => c.p)).toEqual(['afford the risk']);
    const card = toTrainCard('afford', { word: 'afford', de: 'sich leisten', pos: 'verb', state: 'review', stage: 3, S: 4, D: 5, reps: 3, last: 1, due: 2, ex: "We can't [afford] it.", col: [raw[0]] }, true, NOW)!;
    expect(partnerOf(card)).toBeNull();
  });
});
