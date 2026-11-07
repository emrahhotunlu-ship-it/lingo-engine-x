import { describe, expect, it } from 'vitest';
import { isDrillSentence } from '../../../src/domain/text/drillSentence';
import { sentencesOf } from '../../../src/modules/vocab/domain/card';

// Großpaket T (Emrah 07.11.2026): „He ? (feel) tired lately.“ kam als Wort-Abfrage – ein Übungssatz aus der Grammatik mit Lücke und Hinweis.

describe('isDrillSentence', () => {
  it('erkennt Lücke und Verb-Hinweis', () => {
    for (const s of ['He ? (feel) tired [lately].', 'She ___ to the office.', 'They … the report yesterday.', 'We (not / go) there.', 'If it (rain), we stay.'])
      expect(isDrillSentence(s), s).toBe(true);
  });
  it('lässt echte Sätze durch (Frage am Ende, Abkürzung in Klammern, Zahlen)', () => {
    for (const s of ['Have you heard from the pilot customer lately?', 'Our CFO (Anna) approved it.', 'The price rose by 3% (Q3).', 'Wait... are you sure?', 'He has been feeling tired lately.'])
      expect(isDrillSentence(s), s).toBe(false);
  });
});

describe('sentencesOf ohne Übungssätze', () => {
  it('der Übungssatz fällt weg, die anderen Sätze bleiben', () => {
    const doc = {
      word: 'lately',
      ex: 'He ? (feel) tired [lately].',
      sb: [{ en: 'Lately, more prospects have asked us about data residency.', src: 'ai', pv: 'word-know@1', t: 1 }],
    };
    const out = sentencesOf(doc, Date.parse('2026-11-07T10:00:00Z'), null).map((s) => s.en);
    expect(out).toEqual(['Lately, more prospects have asked us about data residency.']);
  });
});
