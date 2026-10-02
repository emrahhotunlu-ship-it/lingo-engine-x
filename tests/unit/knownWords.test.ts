import { describe, expect, it } from 'vitest';
import { keysOf, knownRows, newestWords, wordKey } from '../../src/domain/srs/known';
import { mergedVocab } from '../../src/domain/overview';

// „Nicht vorschlagen“-Liste für Claude (Prüfung Englischlehrer 02.10.2026): neueste zuerst, mit Startwortschatz und
// Wendungen, ohne Doppelte; und der Schlüssel zum Ausblenden von Vorgeschlagenem, das schon da ist.

type Doc = Record<string, unknown>;
const vocab = (n: number, added: (i: number) => string): Map<string, Doc> => new Map(Array.from({ length: n }, (_, i) => [`w${String(i).padStart(3, '0')}`, { word: `word${String(i).padStart(3, '0')}`, de: 'x', added: added(i) }]));

describe('bekannte Wörter für „nicht vorschlagen“', () => {
  it('die zuletzt hinzugefügten kommen zuerst – nicht die alphabetisch letzten', () => {
    // Die niedrigen Nummern sind die neuesten (September), die hohen die ältesten (Juli): Alphabet ≠ Alter. Die alte Liste
    // nahm die Nummern vom Ende der Kennungsreihe, also genau die ältesten.
    const v = vocab(300, (i) => `2026-0${9 - Math.floor(i / 100) * 1}-15`);
    const out = newestWords(knownRows(v, new Map()), 50);
    expect(out).toHaveLength(50);
    expect(out.every((w) => Number(w.slice(4)) < 100)).toBe(true);
  });

  it('enthält Startwortschatz (ohne eigenes Dokument) und Wendungen; Doppelte nur einmal', () => {
    const rows = knownRows(new Map([['own', { word: 'Leverage', de: 'x', added: '2026-09-01' }]]), new Map([['c-push-back', { en: 'push back', created: Date.parse('2026-09-20') }]]));
    const all = newestWords(rows, 1000);
    expect(all).toContain('push back');
    expect(all).toContain('Leverage');
    // Startwortschatz der alten App gehört dazu (mergedVocab überlagert ihn).
    const starter = [...mergedVocab(new Map()).values()].map((d) => String(d.word)).filter(Boolean);
    expect(starter.length).toBeGreaterThan(20);
    for (const w of starter.slice(0, 5)) expect(all).toContain(w);
    const dup = newestWords([{ w: 'Alpha', at: 2 }, { w: 'alpha', at: 1 }, { w: 'beta', at: 3 }], 10);
    expect(dup).toEqual(['beta', 'Alpha']);
  });

  it('Obergrenze wird eingehalten, der Schlüsselsatz hat keine', () => {
    const v = vocab(700, () => '2026-09-01');
    const rows = knownRows(v, new Map());
    expect(newestWords(rows, 600)).toHaveLength(600);
    expect(keysOf(rows).size).toBeGreaterThanOrEqual(700);
  });

  it('wordKey: Grundform, ohne „to“, Groß/klein egal; Vorschläge mit gleichem Schlüssel gelten als bekannt', () => {
    expect(wordKey('to Leverage')).toBe(wordKey('leverage'));
    expect(wordKey('push back')).toBe('push-back');
    const have = keysOf(knownRows(new Map([['x', { word: 'stakeholder', de: 'x' }]]), new Map()));
    expect(have.has(wordKey('Stakeholder'))).toBe(true);
    expect(have.has(wordKey('mitigate'))).toBe(false);
  });
});
