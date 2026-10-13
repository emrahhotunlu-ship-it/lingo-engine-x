import { describe, expect, it } from 'vitest';
import { rdrDe } from '../../../src/modules/read/i18n/rdReader.de';
import { rdrEn } from '../../../src/modules/read/i18n/rdReader.en';
import { rdrText, topicKey } from '../../../src/modules/read/domain/readerText';
import { TOPIC_KEYS } from '../../../src/modules/read/schemas';

const keys = (o: object): string[] => Object.keys(o).sort();
const vars = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

describe('Leser: Texte DE und EN', () => {
  it('beide Sprachen haben dieselben Schlüssel, alle mit Präfix rdr', () => {
    expect(keys(rdrEn)).toEqual(keys(rdrDe));
    expect(keys(rdrDe).every((k) => k.startsWith('rdr'))).toBe(true);
  });

  it('kein Text ist leer; Platzhalter sind in beiden Sprachen gleich', () => {
    for (const k of Object.keys(rdrDe) as Array<keyof typeof rdrDe>) {
      expect(rdrDe[k].trim().length, k).toBeGreaterThan(0);
      expect(rdrEn[k].trim().length, k).toBeGreaterThan(0);
      expect(vars(rdrEn[k]), k).toEqual(vars(rdrDe[k]));
    }
  });

  it('Englisch ist amerikanisch geschrieben (keine britischen Formen)', () => {
    const text = Object.values(rdrEn).join(' ');
    expect(text).not.toMatch(/\b(colour|favour|organis|practis|centre|behaviour)/i);
  });

  it('setzt Platzhalter ein und formatiert Zahlen je Sprache', () => {
    expect(rdrText('de', 'rdrShowDeN', { n: 7 })).toBe('Deutsch zu Satz 7 anzeigen');
    expect(rdrText('en', 'rdrShowDeN', { n: 7 })).toBe('Show German for sentence 7');
    expect(rdrText('de', 'rdrMeta', { min: 5, words: 1234 })).toBe('≈ 5 Min · 1.234 Wörter');
    expect(rdrText('en', 'rdrMeta', { min: 5, words: 1234 })).toBe('≈ 5 min · 1,234 words');
    expect(rdrText('de', 'rdrAsOf', {})).toBe('Stand: {asOf}');
  });

  it('jedes Thema des Moduls hat einen Namen; Unbekanntes heißt „Eigenes Thema“', () => {
    for (const t of TOPIC_KEYS) expect(rdrDe[topicKey(t)].length).toBeGreaterThan(0);
    expect(topicKey('nonsense')).toBe('rdrTopic_custom');
    expect(topicKey(null)).toBe('rdrTopic_custom');
  });
});
