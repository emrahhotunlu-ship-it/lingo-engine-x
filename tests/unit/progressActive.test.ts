import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { vocabStatistics } from '../../src/domain/srs/retention';
import { berlin } from './helpers';

// „Aktiv fest“ nur mit freiem Abruf (Stufe ≥ 4) und Stabilität ≥ 21 Tage; Aufdecken zählt nie (hebt höchstens bis Stufe 2).
const NOW = berlin('2026-10-05', 9);
const DAY = 86_400_000;
const doc = (i: number, o: Record<string, unknown>) => ({ id: `w${i}`, word: `word${i}`, pos: 'noun', de: `Wort${i}`, def: 'x', ex: `We [word${i}] daily.`, col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 5 * DAY, due: NOW + 5 * DAY, reps: 4, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 3, hist: [], intro: '2026-08-01', ...o });

describe('Fortschritt: aktiv fest / übt / erwartet', () => {
  it('zählt je Stufe und Stabilität getrennt, neue Karten nie', () => {
    const cs = [
      doc(1, { stage: 5, S: 40 }), // aktiv fest
      doc(2, { stage: 4, S: 25 }), // aktiv fest
      doc(3, { stage: 4, S: 10 }), // übt (zu junge Stabilität)
      doc(4, { stage: 3, S: 60 }), // übt (nur mit Stütze belegt)
      doc(5, { stage: 2, S: 90 }), // weder noch (nur Erkennen)
      doc(6, { state: 'new', stage: 0, S: 0, reps: 0 }),
    ].map((d, i) => toTrainCard(`w${i + 1}`, d, true, NOW)!);
    const s = vocabStatistics(cs, NOW);
    expect(s.active).toBe(2);
    expect(s.practicing).toBe(2);
    expect(s.expected).toBeGreaterThan(0);
    expect(s.expected).toBeLessThanOrEqual(5);
  });

  it('erwartete gekonnte Karten sinken, wenn Wiederholungen ausbleiben (später gemessen)', () => {
    const cs = [1, 2, 3].map((i) => toTrainCard(`w${i}`, doc(i, { stage: 4, S: 30 }), true, NOW)!);
    const now = vocabStatistics(cs, NOW).expected;
    const later = vocabStatistics(cs, NOW + 90 * DAY).expected;
    expect(later).toBeLessThan(now);
  });
});
