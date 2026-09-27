import { describe, expect, it } from 'vitest';
import { roundProgress } from '../../src/features/vocab/session';

// Emrahs Befund 27.09.: „Obwohl 15/15 erledigt, kommen weitere Fragen“.
describe('Trainer: Fortschritt zählt, was wirklich noch kommt', () => {
  const base = { status: 'running' as const, round: 'pflicht' as const, doneBefore: 0, target: 15, repairs: [], repairPos: 0 };
  const q = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}` })) as never[];
  it('normaler Verlauf: n von 15', () => {
    expect(roundProgress({ ...base, queue: q(15), pos: 0, answered: [] })).toEqual({ n: 1, total: 15 });
    expect(roundProgress({ ...base, queue: q(15), pos: 14, answered: q(14) })).toEqual({ n: 15, total: 15 });
  });
  it('wieder eingereihte Karten und Reparatur-Sätze erhöhen das Gesamt statt über 15/15 hinauszulaufen', () => {
    const p = roundProgress({ ...base, queue: q(18), pos: 15, answered: q(15), repairs: [{}, {}] as never[], repairPos: 0 });
    expect(p).toEqual({ n: 16, total: 20 });
  });
  it('Zusammenfassung: kein Fortschritt', () => {
    expect(roundProgress({ ...base, status: 'summary', queue: q(1), pos: 1, answered: q(1) })).toBeNull();
  });
});
