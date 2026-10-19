import { describe, expect, it } from 'vitest';
import { cardStatus } from '../../src/domain/metrics';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { sentKey } from '../../src/domain/srs/variety';
import { berlin } from './helpers';

// Paket ST, Runde 3 (Prüfung Lernwissenschaft): Note 3 ist die Schwelle für „frei“, cloze_part ist nur Hilfe, alte Verlaufseinträge ohne `x`
// werden beim Lesen aus `m` zugeordnet, „wackelig“ nicht allein wegen eines alten Fehlers in „Lernt“, Satz-Beleg gegen den Ursprungssatz.
// Hinweis: `hist` hat höchstens 12 Einträge; alle Belege gelten für die letzten 12 Antworten.

const D = 86_400_000;
const NOW = berlin('2026-10-19', 10);
const mk = (id: string, over: Record<string, unknown>): TrainCard =>
  toTrainCard(id, { word: id, de: 'x', def: 'x y', ex: `We [${id}] it.`, pos: 'verb', state: 'review', S: 10, D: 5, due: NOW, last: NOW - 3 * D, stage: 3, reps: 5, lapses: 0, src: 'lookup', added: '2026-06-01', hist: [], ...over }, true, NOW)!;
const e = (dt: number, x: string | null, g: number, extra: Record<string, unknown> = {}) => ({ t: NOW - dt * D, g, ...(x ? { x, m: 'type' } : { m: 'type' }), ...extra });

describe('B1: „frei“ nur ab Note 3, cloze_part nie als freier Tag', () => {
  it('Note 2 („Schwer“) zählt nicht als freier Tag', () => {
    const s = cardStatus(mk('a', { stage: 4, hist: [e(9, 'cloze', 2), e(5, 'cloze', 2)] }), NOW);
    expect(s.freeDays).toBe(0);
    expect(s.tier).toBe('learning');
  });
  it('cloze_part ist nur Hilfe: kein freier Tag, kein Satz-Beleg', () => {
    const s = cardStatus(mk('b', { stage: 4, hist: [e(9, 'cloze_part', 3, { s: 'sA' }), e(5, 'cloze_part', 3, { s: 'sB' })] }), NOW);
    expect(s.freeDays).toBe(0);
    expect(s.helped).toBe(true);
    expect(s.newSentence).toBe(false);
  });
  it('complete zählt wie in variety.ts als frei', () => {
    const s = cardStatus(mk('c', { stage: 4, hist: [e(9, 'complete', 3), e(5, 'complete', 3)] }), NOW);
    expect(s.freeDays).toBe(2);
  });
});

describe('B2: „wackelig“ nicht allein wegen eines alten Fehlers in „Lernt“', () => {
  it('Stufe 2 mit altem Fehler: Lernt, Kopf nicht wackelig', () => {
    const s = cardStatus(mk('d', { stage: 2, S: 30, last: NOW - 3 * D, hist: [e(20, 'mc_en', 3), e(9, 'mc_de', 1), e(3, 'mc_de', 3)] }), NOW);
    expect(s.tier).toBe('learning');
    expect(s.unrecovered).toBe(true);
    expect(s.mind).toBe('good');
  });
});

describe('B3: alte Einträge ohne x werden beim Lesen zugeordnet (nichts wird geschrieben)', () => {
  it('„approach“: Stufe 5, S 22,7, alter Fehler, danach type/produce mit Note 3 → nicht Wackelt', () => {
    const hist = [
      { t: NOW - 40 * D, g: 1, m: 'recog' },
      { t: NOW - 20 * D, g: 3, m: 'type' },
      { t: NOW - 9 * D, g: 3, m: 'produce' },
      { t: NOW - 3 * D, g: 3, m: 'type' },
    ];
    const card = mk('approach', { stage: 5, S: 22.7, last: NOW - 3 * D, hist });
    const before = JSON.stringify(card.doc);
    const s = cardStatus(card, NOW);
    expect(s.freeDays).toBe(3);
    expect(s.unrecovered).toBe(false);
    expect(s.tier).not.toBe('wobbly');
    // produce zählt als eigener Satz → im neuen Satz gekonnt → Fest.
    expect(s.tier).toBe('firm');
    expect(JSON.stringify(card.doc)).toBe(before);
  });
  it('„significant“: S 41,9, 0 Rückfälle, nur alte Einträge → nicht Lernt wegen fehlendem x', () => {
    const hist = [{ t: NOW - 30 * D, g: 3, m: 'type' }, { t: NOW - 3 * D, g: 4, m: 'type' }];
    const s = cardStatus(mk('significant', { stage: 4, S: 41.9, last: NOW - 3 * D, hist }), NOW);
    expect(s.freeDays).toBe(2);
    expect(s.tier).toBe('safe');
  });
  it('recog und listen sind Erkennen, cloze und colloc sind Stütze', () => {
    const s = cardStatus(mk('f', { stage: 3, hist: [{ t: NOW - 9 * D, g: 3, m: 'recog' }, { t: NOW - 6 * D, g: 3, m: 'listen' }, { t: NOW - 3 * D, g: 3, m: 'cloze' }] }), NOW);
    expect(s.freeDays).toBe(0);
    expect(s.recognizes).toBe(true);
    expect(s.helped).toBe(true);
  });
  it('die Stufe gilt weiter als Rückgriff, solange ein alter Eintrag da ist; ein neuer Eintrag mit x blockiert sie nicht', () => {
    const s = cardStatus(mk('g', { stage: 3, hist: [{ t: NOW - 9 * D, g: 3, m: 'colloc' }, { t: NOW - 3 * D, g: 3, m: 'recog', x: 'mc_en' }] }), NOW);
    expect(s.helped).toBe(true);
  });
});

describe('Satz-Beleg gegen den Ursprungssatz', () => {
  const origin = sentKey('We ursprung it.');
  const base = { stage: 5, S: 40, last: NOW - 3 * D };
  it('ein freier Treffer in einem anderen Satz genügt', () => {
    expect(cardStatus(mk('ursprung', { ...base, hist: [e(9, 'cloze', 3, { s: origin }), e(3, 'cloze', 3, { s: 'sX' })] }), NOW).tier).toBe('firm');
  });
  it('nur im Ursprungssatz: kein Beleg', () => {
    expect(cardStatus(mk('ursprung', { ...base, hist: [e(9, 'cloze', 3, { s: origin }), e(3, 'cloze', 3, { s: origin })] }), NOW).newSentence).toBe(false);
  });
  it('Note 2 in einem anderen Satz ist kein Beleg', () => {
    expect(cardStatus(mk('ursprung', { ...base, hist: [e(9, 'cloze', 3, { s: origin }), e(3, 'cloze', 2, { s: 'sX' })] }), NOW).newSentence).toBe(false);
  });
  it('eigener Satz (na > 0) zählt', () => {
    expect(cardStatus(mk('ursprung', { ...base, na: 1, hist: [e(9, 'cloze', 3, { s: origin }), e(3, 'cloze', 3, { s: origin })] }), NOW).own).toBe(true);
  });
});

describe('Texte für Sonderfälle', () => {
  it('Anki-Karte nur mit Aufdecken und Karte ganz ohne Verlauf', () => {
    expect(cardStatus(mk('h', { stage: 2, hist: [{ t: NOW - 5 * D, g: 3, m: 'recog', x: 'flip' }] }), NOW).flipOnly).toBe(true);
    expect(cardStatus(mk('i', { stage: 2, hist: [] }), NOW).noHistory).toBe(true);
  });
});
