import { describe, expect, it } from 'vitest';
import { flaggedWords } from '../../src/features/preply/FlaggedCards';

describe('Preply: markierte Karten (N80/N33)', () => {
  it('liest app/decks.flagged tolerant, nur vorhandene Karten, ohne Doppelte, höchstens max', () => {
    const vocab = new Map<string, Record<string, unknown>>([
      ['a', { word: 'leverage' }],
      ['b', { word: 'leverage' }],
      ['c', { word: 'phase out' }],
    ]);
    expect(flaggedWords({ flagged: ['a', 'x', 'b', 'c', 7] }, vocab)).toEqual(['leverage', 'phase out']);
    expect(flaggedWords({ flagged: ['a', 'c'] }, vocab, 1)).toEqual(['leverage']);
    expect(flaggedWords(null, vocab)).toEqual([]);
    expect(flaggedWords({ flagged: 'a' }, undefined)).toEqual([]);
  });
});
