import { describe, expect, it } from 'vitest';
import { splitHead, splitWhy } from '../../src/ui/exercise/wordParts';

// Wort-Rückmeldung in Blöcken (Design-Lead 07.10.2026): jedes Stück steht wörtlich in der Zeile, nichts geht verloren.

describe('splitHead', () => {
  it('Wort und Chips', () => {
    expect(splitHead('phase out · Verb · neutral')).toEqual({ word: 'phase out', chips: ['Verb', 'neutral'] });
    expect(splitHead('avoid')).toEqual({ word: 'avoid', chips: [] });
  });
});

describe('splitWhy', () => {
  it('Merke mit Hauptverbindung, Register und Gegenstück', () => {
    const w = splitWhy('Merke: phase out a product · neutral. Phase out = schrittweise abschaffen; formeller: discontinue', 'phase out');
    expect(w).toEqual({
      label: 'Merke',
      main: 'phase out a product',
      rest: [
        { label: null, text: 'Phase out = schrittweise abschaffen' },
        { label: 'formeller', text: 'discontinue' },
      ],
    });
  });
  it('Merke mit Bedeutung, ohne Rest', () => {
    expect(splitWhy('Merke: avoid = vermeiden', 'avoid')).toEqual({ label: 'Merke', main: 'avoid = vermeiden', rest: [] });
  });
  it('nur das Wort: kein Doppel', () => {
    expect(splitWhy('avoid', 'avoid')).toEqual({ label: null, main: null, rest: [] });
  });
  it('Rückfall: freier Text bleibt vollständig', () => {
    const t = 'Bedenken „äußern“ heißt raise concerns, nicht say concerns.';
    const w = splitWhy(t, 'raise concerns');
    expect([w.main, ...w.rest.map((r) => r.text)].join(' ')).toBe(t);
  });
  it('Englisch: Remember', () => {
    expect(splitWhy('Remember: make progress · neutral', 'make progress')).toEqual({ label: 'Remember', main: 'make progress', rest: [] });
  });
});
