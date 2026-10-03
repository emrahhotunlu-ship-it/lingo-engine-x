import { describe, expect, it } from 'vitest';
import { COL_MAX, COL_RETRY_DAYS, acceptCollocations, collocPatch, hasCol, needsCollocs } from '../../src/domain/srs/collocs';
import { toTrainCard } from '../../src/domain/srs/cards';
import { parseCollocs } from '../../src/domain/srs/context';
import { wantsEnrichment } from '../../src/domain/srs/examples';
import { supports } from '../../src/domain/srs/modes';
import type { TrainCard } from '../../src/domain/srs/types';
import { CARD_EXAMPLES_EXAMPLE, cardExamples as template } from '../../src/prompts/cardExamples';
import { cardExamplesReply } from '../../src/platform/dev/cannedReplies';
import { berlin } from './helpers';

// Wortpartner von Claude (Englischlehrer 02.10.2026): streng geprüft, nur ergänzend gespeichert, ehrlich gekennzeichnet.

const NOW = berlin('2026-10-02', 9);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;
const good = (over: Doc = {}): Doc => ({ p: 'highly reliable', de: 'äußerst zuverlässig', gap: 'highly', opts: ['strongly', 'heavily', 'deeply'], ex: 'The new archive system has proven [highly reliable] in daily use.', ...over });
const accept = (raw: unknown, word = 'reliable') => acceptCollocations(word, raw);

describe('acceptCollocations', () => {
  it('gültiger Eintrag: gespeichert mit ai: 1, Beispiel aus dem Prompt besteht', () => {
    const out = accept([good()]);
    expect(out).toEqual([{ p: 'highly reliable', de: 'äußerst zuverlässig', gap: 'highly', opts: ['strongly', 'heavily', 'deeply'], ex: 'The new archive system has proven [highly reliable] in daily use.', ai: 1 }]);
    const ex = JSON.parse(CARD_EXAMPLES_EXAMPLE) as { collocations: unknown[] };
    expect(accept(ex.collocations)).toHaveLength(1);
  });

  it('das Ergebnis lässt sich als Wortpartner-Übung lesen (parseCollocs, supports colloc)', () => {
    const stored = accept([good()]);
    const col = parseCollocs(stored);
    expect(col[0]).toMatchObject({ p: 'highly reliable', gap: 'highly', ai: true });
    expect(col[0]?.ctx?.gap).toBe('highly');
    const card = toTrainCard('reliable', { word: 'reliable', de: 'zuverlässig', def: 'can be trusted', ex: 'Our [reliable] team.', col: stored, state: 'review', S: 5, D: 5, due: NOW, last: NOW - 5 * DAY, reps: 3, lapses: 0, stage: 4 }, true, NOW) as TrainCard;
    expect(supports(card, 'colloc', 'de', 10)).toBe(true);
    expect(card.col[0]?.ai).toBe(true);
  });

  it.each([
    ['ohne eckige Klammern', good({ ex: 'The new archive system has proven highly reliable in daily use.' })],
    ['zwei Klammern', good({ ex: 'The [new] archive system has proven [highly reliable] in daily use.' })],
    ['Kartenwort nicht in der Klammer', good({ ex: 'The new [archive] system has proven highly reliable in daily use.' })],
    ['Lücke steht nicht in der Klammer', good({ gap: 'strongly' })],
    ['Lücke ist das Kartenwort', good({ p: 'reliable partner', gap: 'reliable', ex: 'She is a [reliable partner] for us every day.' })],
    ['Lücke mit Leerzeichen', good({ gap: 'highly reliable' })],
    ['Wendung zu kurz', good({ p: 'reliable' })],
    ['Wendung ohne Kartenwort', good({ p: 'highly trusted', ex: 'The new archive system has proven [highly trusted] in daily use.' })],
    ['Bedeutung auf Englisch', good({ de: 'the thing you can rely on and that is trusted by all of the customers' })],
    ['Satz auf Deutsch', good({ ex: 'Das neue Archivsystem hat sich im täglichen Einsatz als [highly reliable] erwiesen und überzeugt.' })],
    ['Anführungszeichen im Satz', good({ ex: 'The system has proven "[highly reliable]" in use.' })],
    ['Satz zu kurz (weniger als fünf Wörter)', good({ ex: 'It is [highly reliable].' })],
    ['nur ein brauchbarer Ablenker', good({ opts: ['strongly', 'highly', 'reliable'] })],
    ['Ablenker stehen schon in der Wendung', good({ opts: ['highly', 'reliable', 'archive'] })],
    ['Ablenker mit Leerzeichen oder Ziffern', good({ opts: ['very much', '3x', 'a'] })],
    ['kein Objekt', 'highly reliable'],
  ])('verworfen: %s', (_why, item) => {
    expect(accept([item])).toEqual([]);
  });

  it('Ablenker: doppelte, die Lösung und Wörter aus der Wendung fallen weg, höchstens drei bleiben', () => {
    const out = accept([good({ opts: ['highly', 'Strongly', 'strongly', 'reliable', 'heavily', 'deeply', 'truly'] })]);
    expect(out[0]?.opts).toEqual(['Strongly', 'heavily', 'deeply']);
  });

  it('höchstens zwei, Dubletten der Wendung nur einmal; ein schlechter Eintrag reißt die anderen nicht mit', () => {
    const second = good({ p: 'rather reliable', de: 'ziemlich zuverlässig', gap: 'rather', opts: ['quite', 'fairly', 'pretty'], ex: 'This supplier has been [rather reliable] so far.' });
    const third = good({ p: 'very reliable', de: 'sehr zuverlässig', gap: 'very', opts: ['much', 'many', 'big'], ex: 'We need a [very reliable] partner here.' });
    expect(accept([{ nope: 1 }, good(), good(), second, third])).toHaveLength(COL_MAX);
    expect(accept([good(), good()])).toHaveLength(1);
    expect(accept([{ nope: 1 }, second]).map((c) => c.p)).toEqual(['rather reliable']);
  });

  it('Wendung als Karte (mehrere Wörter) und gebeugtes Kartenwort', () => {
    const out = accept([{ p: 'push back the launch', de: 'den Start verschieben', gap: 'launch', opts: ['start', 'trip', 'party'], ex: 'We had to [push back the launch] by two weeks.' }], 'push back');
    expect(out).toHaveLength(1);
    const inflected = acceptCollocations('meet', [{ p: 'meet a deadline', de: 'eine Frist einhalten', gap: 'deadline', opts: ['date', 'term', 'limit'], ex: 'They [met the deadline] with two days to spare.' }]);
    expect(inflected).toHaveLength(1);
  });

  it('kein Feld, keine Liste, kein Wort', () => {
    expect(acceptCollocations('reliable', undefined)).toEqual([]);
    expect(acceptCollocations('reliable', 'x')).toEqual([]);
    expect(acceptCollocations('', [good()])).toEqual([]);
  });
});

describe('Speichern: nur ergänzen', () => {
  const stored = acceptCollocations('reliable', [good()]);

  it('ohne col: col wird gesetzt', () => {
    expect(collocPatch({ word: 'reliable' }, stored, NOW)).toEqual({ col: stored });
    expect(collocPatch({ word: 'reliable', col: [] }, stored, NOW)).toEqual({ col: stored });
    expect(collocPatch({ word: 'reliable', col: null }, stored, NOW)).toEqual({ col: stored });
  });

  it('vorhandene col (auch Unerwartetes) wird nie ersetzt', () => {
    expect(collocPatch({ word: 'reliable', col: [{ p: 'x' }] }, stored, NOW)).toBeNull();
    expect(collocPatch({ word: 'reliable', col: 'komisch' }, stored, NOW)).toBeNull();
    expect(collocPatch(undefined, stored, NOW)).toBeNull();
  });

  it('ohne brauchbares Ergebnis nur die Marke colAt; innerhalb von 30 Tagen nicht noch einmal', () => {
    expect(collocPatch({ word: 'reliable' }, [], NOW)).toEqual({ colAt: NOW });
    expect(collocPatch({ word: 'reliable', colAt: NOW - 5 * DAY }, [], NOW)).toBeNull();
    expect(collocPatch({ word: 'reliable', colAt: NOW - (COL_RETRY_DAYS + 1) * DAY }, [], NOW)).toEqual({ colAt: NOW });
  });

  it('hasCol und needsCollocs', () => {
    expect(hasCol({})).toBe(false);
    expect(hasCol({ col: [] })).toBe(false);
    expect(hasCol({ col: [1] })).toBe(true);
    expect(hasCol({ col: 'x' })).toBe(true);
    const card = (over: Doc, inDb = true, kind = 'vocab') => ({ kind, inDb, doc: { word: 'reliable', ...over } });
    expect(needsCollocs(card({}), NOW)).toBe(true);
    expect(needsCollocs(card({ col: stored }), NOW)).toBe(false);
    expect(needsCollocs(card({ colAt: NOW - DAY }), NOW)).toBe(false);
    expect(needsCollocs(card({ colAt: NOW - 40 * DAY }), NOW)).toBe(true);
    expect(needsCollocs(card({}, false), NOW)).toBe(false);
    expect(needsCollocs(card({}, true, 'chunk'), NOW)).toBe(false);
  });
});

describe('wann gefragt wird (wantsEnrichment)', () => {
  const mk = (over: Doc): TrainCard => toTrainCard('reliable', { word: 'reliable', de: 'zuverlässig', def: 'can be trusted', ex: 'Our [reliable] team.', state: 'review', S: 5, D: 5, due: NOW, last: NOW - 5 * DAY, reps: 3, lapses: 0, stage: 4, ...over }, true, NOW) as TrainCard;
  const ownTwo = [{ p: 'highly reliable', de: 'x', gap: 'highly', opts: ['a', 'b'], ex: 'We [highly reliable] ok.' }, { p: 'prove reliable', de: 'y', gap: 'prove', opts: ['c', 'd'], ex: 'It will [prove reliable] soon.' }];

  it('Karte ohne Sätze und ohne Wortpartner: ja', () => {
    expect(wantsEnrichment(mk({}), null, NOW)).toBe(true);
  });
  it('genug eigene Sätze, aber keine Wortpartner: ja (nur wegen der Wortpartner)', () => {
    expect(wantsEnrichment(mk({ xEx: [{ en: 'This is a reliable partner for us.', t: 1 }, { en: 'We need reliable data today.', t: 1 }] }), null, NOW)).toBe(true);
  });
  it('Wortpartner da und Sätze genug: nein', () => {
    expect(wantsEnrichment(mk({ col: ownTwo }), null, NOW)).toBe(false);
  });
  it('Versuch ohne Ergebnis vor kurzem und genug Sätze: nein', () => {
    expect(wantsEnrichment(mk({ colAt: NOW - DAY, xEx: [{ en: 'This is a reliable partner for us.', t: 1 }] }), null, NOW)).toBe(false);
  });
});

describe('Vorlage card-examples@2', () => {
  const vars = { word: 'reliable', pos: 'adj', meaning: 'can be trusted', sentence: '' };
  it('Beispielantwort und Testantwort bestehen das Schema; Antworten ohne Wortpartner auch (leer)', () => {
    const schema = template.schema(vars);
    expect(template.version).toBe(2);
    expect(schema.safeParse(JSON.parse(CARD_EXAMPLES_EXAMPLE)).success).toBe(true);
    const out = schema.safeParse({ examples: ['This is a reliable partner for us.', 'We need reliable data today.'] });
    expect(out.success && out.data.collocations).toEqual([]);
    const canned = schema.safeParse(JSON.parse(cardExamplesReply(template.build(vars))));
    expect(canned.success && canned.data.collocations).toEqual([]);
  });
  it('schlechte Wortpartner machen die Antwort nicht ungültig (sie werden einzeln geprüft)', () => {
    const r = template.schema(vars).safeParse({ examples: ['This is a reliable partner for us.', 'We need reliable data today.'], collocations: [{ kaputt: true }, 5, null] });
    expect(r.success).toBe(true);
    expect(r.success && acceptCollocations('reliable', r.data.collocations)).toEqual([]);
  });
  it('Testantwort mit colq: ein gültiger Wortpartner', () => {
    const prompt = template.build({ ...vars, word: 'colqrun' });
    const r = template.schema(vars).safeParse(JSON.parse(cardExamplesReply(prompt)));
    expect(r.success && acceptCollocations('colqrun', r.data.collocations)).toHaveLength(1);
  });
  it('der Prompt nennt die Regeln für Wortpartner', () => {
    const p = template.build(vars);
    for (const k of ['collocations', 'exactly ONE pair of square brackets', 'NOT work in this collocation']) expect(p).toContain(k);
  });
});
