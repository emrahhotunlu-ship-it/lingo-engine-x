import { describe, expect, it } from 'vitest';
import { PACK, PACK_CATS } from '../../src/domain/c1pack/pack';
import { allGroups, groupMastery } from '../../src/domain/metrics/groups';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// P22: Meisterschaft je Wortgruppe: die vier Zustände ergeben immer die Gruppengröße.

const NOW = berlin('2026-10-05', 10);
const D = 86_400_000;
const mk = (id: string, ref: string, over: Record<string, unknown> = {}): TrainCard =>
  toTrainCard(id, { word: id, de: 'x', def: 'x y', ex: `We [${id}] it.`, pos: 'verb', state: 'review', S: 30, D: 5, due: NOW + D, last: NOW - D, stage: 4, reps: 6, lapses: 0, src: 'lookup', added: '2026-06-01', origin: { v: 1, kind: 'pack', ref }, ...over }, true, NOW)!;

describe('groupMastery', () => {
  const entries = [
    { id: 'colloc-01', cat: 'colloc' as const },
    { id: 'colloc-02', cat: 'colloc' as const },
    { id: 'colloc-03', cat: 'colloc' as const },
    { id: 'colloc-04', cat: 'colloc' as const },
    { id: 'word-01', cat: 'word' as const },
  ];
  it('Summe der Zustände = Gruppengröße; fehlende Einträge zählen als Neu', () => {
    const cards = [
      mk('a', 'c1pack/colloc-01'),
      mk('b', 'c1pack/colloc-02', { stage: 3, S: 10 }),
      mk('c', 'c1pack/colloc-03', { stage: 1, S: 2 }),
      mk('z', 'c1pack/word-01'),
    ];
    const g = groupMastery('colloc', cards, entries);
    expect(g).toMatchObject({ size: 4, firm: 1, safe: 1, learning: 1, new: 1 });
    expect(g.new + g.learning + g.safe + g.firm).toBe(g.size);
  });
  it('ausgeblendete und doppelte Karten ändern die Summe nicht', () => {
    const cards = [mk('a', 'c1pack/colloc-01', { hidden: true }), mk('b', 'c1pack/colloc-02'), mk('b2', 'c1pack/colloc-02')];
    const g = groupMastery('colloc', cards, entries);
    expect(g).toMatchObject({ size: 4, firm: 1, new: 3 });
  });
  it('erkennt auch `src.ref`; echte Gruppen summieren sich zu 443 Paket-Einträgen', () => {
    const c = mk('a', 'x', { origin: undefined, src: { ref: 'c1pack/colloc-01' } });
    expect(groupMastery('colloc', [c], entries).firm).toBe(1);
    const all = allGroups([]);
    expect(all.map((g) => g.group)).toEqual([...PACK_CATS]);
    expect(all.reduce((a, g) => a + g.size, 0)).toBe(PACK.length);
    for (const g of all) expect(g.new).toBe(g.size);
  });
});
