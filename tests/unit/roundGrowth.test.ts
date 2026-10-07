import { describe, expect, it } from 'vitest';
import { roundGrowth } from '../../src/domain/metrics/round';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// P22: Wachstum einer Runde (Motivation §4.7).

const NOW = berlin('2026-10-05', 10);
const D = 86_400_000;
const doc = (over: Record<string, unknown>) => ({ word: 'w', de: 'x', def: 'x y', ex: 'We [w] it.', pos: 'verb', state: 'review', S: 5, D: 5, due: NOW + 4 * D, last: NOW - 4 * D, stage: 2, reps: 4, lapses: 0, src: 'lookup', added: '2026-06-01', ...over });
const card = (id: string, over: Record<string, unknown> = {}): TrainCard => toTrainCard(id, { ...doc(over), word: id }, true, NOW)!;
/** Stand nach der Antwort: `last` jetzt, `due` nach `days` Tagen, Stufe und Stabilität nach Wunsch. */
const answered = (id: string, days: number, over: Record<string, unknown> = {}): TrainCard => card(id, { last: NOW, due: NOW + days * D, S: days, ...over });

describe('roundGrowth', () => {
  it('Aufgestiegene mit Namen und neuem Zustand, Rückfälle als Zahl', () => {
    const before = [card('a', { stage: 3, S: 10 }), card('b', { stage: 4, S: 30 }), card('c')];
    const after = [answered('a', 40, { stage: 4, S: 40 }), answered('b', 2, { stage: 2, S: 2 }), answered('c', 6)];
    const g = roundGrowth(before, after);
    expect(g.up.map((u) => [u.word, u.to])).toEqual([['a', 'firm']]);
    expect(g.down).toBe(1);
  });

  it('Gedächtnis-Zeit: erst ab 5 Karten und nur wenn der Median steigt', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const before = ids.map((id) => card(id)); // due − last = 8 Tage
    const better = ids.map((id) => answered(id, 18));
    expect(roundGrowth(before, better).memory).toEqual({ n: 5, before: 8, after: 18 });
    expect(roundGrowth(before.slice(0, 4), better.slice(0, 4)).memory).toBeNull();
    const same = ids.map((id) => answered(id, 6));
    expect(roundGrowth(before, same).memory).toBeNull();
  });

  it('Lernschritt-Karten, neue Karten und zweite Antworten am selben Tag zählen nicht', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const learning = ids.map((id) => card(id, { state: 'learning' }));
    expect(roundGrowth(learning, ids.map((id) => answered(id, 18))).memory).toBeNull();
    const today = ids.map((id) => card(id, { last: NOW - 3_600_000, due: NOW + 3 * D }));
    expect(roundGrowth(today, ids.map((id) => answered(id, 18))).memory).toBeNull();
    expect(roundGrowth([], ids.map((id) => answered(id, 18)))).toEqual({ up: [], memory: null, down: 0 });
  });
});
