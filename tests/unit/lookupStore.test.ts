import { describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';

// „Als Karte speichern" meldet ehrlich, was passiert ist (data-guard): nur eine neu angelegte
// Karte heißt „gespeichert"; ergänzter Satz → added; nichts geändert → exists.

let writer: Writer | null = null;
vi.mock('../../src/data', () => ({ getWriter: () => writer }));

const { saveLookupCard } = await import('../../src/features/lookup/store');

const input = (word: string) => ({
  word,
  de: 'Eile',
  pos: 'noun',
  def: 'a hurry',
  ex: `Try to avoid driving in ${word} hour.`,
  surface: word,
  src: 'lookup' as const,
  origin: { v: 1 as const, kind: 'trainer' as const, t: 1 },
  today: '2026-09-20',
});

describe('saveLookupCard', () => {
  it('neu → saved; Karte ohne Satz → added; Karte mit Satz oder ausgeblendet → exists', async () => {
    const h = createMemoryDb({
      seed: {
        'vocab/peak': { word: 'peak', de: 'Spitze', ex: '' },
        'vocab/rush': { word: 'rush', de: 'Eile', ex: 'A [rush] job.' },
        'vocab/lull': { word: 'lull', de: 'Flaute', ex: '', hidden: true },
      },
    });
    writer = createWriter(h.db);
    expect(await saveLookupCard(input('commute'))).toBe('saved');
    expect(await saveLookupCard(input('peak'))).toBe('added');
    expect(await saveLookupCard(input('rush'))).toBe('exists');
    expect(await saveLookupCard(input('lull'))).toBe('exists');
    expect((await h.db.doc('vocab/lull').get()).data()).toEqual({ word: 'lull', de: 'Flaute', ex: '', hidden: true });
  });
});
