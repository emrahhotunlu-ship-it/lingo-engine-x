import { describe, expect, it } from 'vitest';
import { PHRASES_MAX, WEAK_MAX, unitPhrases, weakWords, type WeakCardLike } from '../../src/domain/unit/phrases';
import { weekTargets } from '../../src/domain/week';

// Schwache Wörter in der Aufgabe des Tages (Englischlehrer 02.10.2026): bis zu zwei Wörter, die immer wieder entfallen,
// ersetzen die letzten Plätze der Wendungsliste von Block 3 – Produktion als zweite Methode neben dem Wiederholen.

const MON = '2026-09-28';
const targets = weekTargets('t01', { day: MON });
const card = (word: string, over: { lapses?: number; reps?: number; stage?: number; isNew?: boolean; hidden?: boolean } = {}): WeakCardLike => ({
  word,
  src: 'lookup',
  added: '2026-08-01',
  hidden: over.hidden ?? false,
  isNew: over.isNew ?? false,
  stage: over.stage ?? 4,
  doc: { lapses: over.lapses ?? 0, reps: over.reps ?? 5 },
});

describe('weakWords', () => {
  it('Karten mit mindestens zwei Fehlern, die schlimmsten zuerst; nur zwei', () => {
    const cards = [card('a', { lapses: 2 }), card('b', { lapses: 5 }), card('c', { lapses: 3 }), card('d', { lapses: 1 })];
    expect(weakWords(cards)).toEqual(['b', 'c']);
    expect(WEAK_MAX).toBe(2);
  });

  it('auch junge Karten, die trotz drei Wiederholungen auf Stufe 1–2 hängen', () => {
    expect(weakWords([card('stuck', { stage: 2, reps: 3 }), card('young', { stage: 1, reps: 1 }), card('fine', { stage: 4 })])).toEqual(['stuck']);
  });

  it('neue, ausgeblendete und leere Karten zählen nie; gleiche Wörter nur einmal; Reihenfolge fest', () => {
    const cards = [card('n', { lapses: 9, isNew: true }), card('h', { lapses: 9, hidden: true }), card(' ', { lapses: 9 }), card('x', { lapses: 4 }), card('x', { lapses: 4 }), card('y', { lapses: 4 })];
    expect(weakWords(cards)).toEqual(['x', 'y']);
    expect(weakWords([...cards].reverse())).toEqual(['x', 'y']);
    expect(weakWords(cards, 0)).toEqual([]);
  });
});

describe('unitPhrases mit schwachen Wörtern', () => {
  it('ohne schwache Wörter unverändert (5 Wendungen der Woche)', () => {
    expect(unitPhrases([], MON, targets)).toEqual(targets.phrases.slice(0, PHRASES_MAX));
    expect(unitPhrases([], MON, targets, [])).toEqual(targets.phrases.slice(0, PHRASES_MAX));
  });

  it('schwache Wörter ersetzen die letzten Plätze, insgesamt bleibt es bei fünf', () => {
    const out = unitPhrases([], MON, targets, ['leverage', 'mitigate']);
    expect(out).toHaveLength(PHRASES_MAX);
    expect(out.slice(0, 3)).toEqual(targets.phrases.slice(0, 3));
    expect(out.slice(3)).toEqual(['leverage', 'mitigate']);
    expect(unitPhrases([], MON, targets, ['leverage'])).toEqual([...targets.phrases.slice(0, 4), 'leverage']);
  });

  it('Wörter von heute (Lesen/Hören) bleiben vorn; ein schwaches Wort, das schon dasteht, kommt nicht doppelt', () => {
    const cards = [
      { word: 'pain point', src: 'read', added: MON },
      { word: 'Leverage', src: 'listen', added: MON },
    ];
    expect(unitPhrases(cards, MON, targets, ['leverage', 'mitigate'])).toEqual(['pain point', 'Leverage', 'mitigate']);
  });

  it('mehr als zwei schwache Wörter: nur die ersten zwei', () => {
    expect(unitPhrases([], MON, targets, ['a', 'b', 'c'])).toEqual([...targets.phrases.slice(0, 3), 'a', 'b']);
  });
});
