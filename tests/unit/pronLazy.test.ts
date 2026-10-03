import { describe, expect, it } from 'vitest';
import { ipaOf } from '../../src/domain/lexicon/pron';

// Lautschrift nicht im Startpfad (plan.md N29): die ersten Nachschlagungen suchen im Text,
// danach die Tabelle – beide Wege liefern dasselbe.
const WORDS = ['a', 'abandon', 'reliable', 'analyse', 'carry out', 'take over', 'colour', 'negotiate', 'leverage', 'zzzqqq', "don't", 'well-known'];

describe('Lautschrift: Text-Suche = Tabelle', () => {
  it('gleiche Ergebnisse vor und nach dem Umschalten', () => {
    const first = WORDS.map((w) => ipaOf(w));
    // Genug Nachschlagungen, damit die Tabelle gebaut wird.
    for (let i = 0; i < 80; i++) ipaOf('ability');
    const second = WORDS.map((w) => ipaOf(w));
    expect(first).toEqual(second);
    expect(first[1]).toBe('əˈbændən');
    expect(first[9]).toBeNull();
  });
});
