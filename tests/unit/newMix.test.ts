import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { mixPhrases, newCards } from '../../src/domain/srs/queue';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Tagesmix der neuen Karten (Gesamtkonzept 3.3): ab dem C1-Paket zwei Wendungen und ein Wort im Wechsel;
// Emrahs eigene Funde bleiben vorn; fehlt eine Sorte, bleibt die bisherige Reihenfolge.

const NOW = berlin('2026-10-05', 9);
const mk = (id: string, src: string, added: string, kind: 'vocab' | 'chunk' = 'vocab'): TrainCard => {
  const c = toTrainCard(id, { word: id, de: 'x', ex: `The [${id}] matters.`, state: 'new', src, added, order: 900 }, true, NOW) as TrainCard;
  return kind === 'chunk' ? { ...c, kind: 'chunk' } : c;
};

describe('mixPhrases', () => {
  it('Wendung, Wendung, Wort im Wechsel, Reste hinten in Ursprungsreihenfolge', () => {
    const list = [
      ...['w1', 'w2', 'w3'].map((id) => ({ id, kind: 'vocab' })),
      ...['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => ({ id, kind: 'chunk' })),
    ];
    expect(mixPhrases(list).map((c) => c.id)).toEqual(['p1', 'p2', 'w1', 'p3', 'p4', 'w2', 'p5', 'w3']);
  });
  it('ohne Wendungen oder ohne Wörter unverändert', () => {
    const w = ['a', 'b'].map((id) => ({ id, kind: 'vocab' }));
    const p = ['c', 'd'].map((id) => ({ id, kind: 'chunk' }));
    expect(mixPhrases(w)).toEqual(w);
    expect(mixPhrases(p)).toEqual(p);
    expect(mixPhrases([])).toEqual([]);
  });
});

describe('newCards mit Tagesmix', () => {
  it('die ersten drei neuen Karten ab dem Paket sind zwei Wendungen und ein Wort', () => {
    const cards = [mk('w1', 'ai', '2026-09-01'), mk('w2', 'pack', '2026-09-02'), mk('p1', 'pack', '2026-09-03', 'chunk'), mk('p2', 'pack', '2026-09-04', 'chunk'), mk('p3', 'pack', '2026-09-05', 'chunk')];
    const first = newCards(cards)
      .slice(0, 3)
      .map((c) => c.kind);
    expect(first).toEqual(['chunk', 'chunk', 'vocab']);
  });
  it('eigene Funde (lookup) bleiben vor dem Mix', () => {
    const cards = [mk('p1', 'pack', '2026-09-03', 'chunk'), mk('p2', 'pack', '2026-09-04', 'chunk'), mk('own', 'lookup', '2026-10-01'), mk('w1', 'ai', '2026-09-01')];
    expect(newCards(cards).map((c) => c.id)).toEqual(['own', 'p1', 'p2', 'w1']);
  });
  it('ohne Wendungen bleibt die bisherige Reihenfolge', () => {
    const cards = [mk('ai1', 'ai', '2026-09-01'), mk('pk1', 'pack', '2026-10-04'), mk('lk1', 'lookup', '2026-10-05'), mk('ls1', 'lesson', '2026-09-02')];
    expect(newCards(cards).map((c) => c.id)).toEqual(['lk1', 'pk1', 'ai1', 'ls1']);
  });
  it('jeder Tag beginnt neu: nach dem Einführen der ersten drei folgen wieder zwei Wendungen und ein Wort', () => {
    const cards = [...['p1', 'p2', 'p3', 'p4'].map((id, i) => mk(id, 'pack', `2026-09-0${i + 1}`, 'chunk')), ...['w1', 'w2'].map((id, i) => mk(id, 'pack', `2026-09-1${i}`))];
    const day1 = newCards(cards).slice(0, 3);
    const rest = cards.filter((c) => !day1.some((d) => d.key === c.key));
    expect(newCards(rest).map((c) => c.kind)).toEqual(['chunk', 'chunk', 'vocab']);
    expect(day1.map((c) => c.kind)).toEqual(['chunk', 'chunk', 'vocab']);
  });
});
