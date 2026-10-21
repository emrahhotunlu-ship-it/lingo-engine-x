import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { vocabStatistics } from '../../src/domain/srs/retention';
import { berlin } from './helpers';

// „Aktiv fest“ nur mit freiem Abruf (Stufe ≥ 4) und Stabilität ≥ 21 Tage; Aufdecken zählt nie (hebt höchstens bis Stufe 2).
const NOW = berlin('2026-10-05', 9);
const DAY = 86_400_000;
const doc = (i: number, o: Record<string, unknown>) => ({ id: `w${i}`, word: `word${i}`, pos: 'noun', de: `Wort${i}`, def: 'x', ex: `We [word${i}] daily.`, col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 5 * DAY, due: NOW + 5 * DAY, reps: 4, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 3, hist: [], intro: '2026-08-01', ...o });

// Fest braucht Stufe 5, Stabilität ≥ 21 Tage UND einen Beleg im neuen Satz (Paket ST). Im neuen Satz = richtig frei in mindestens 2 verschiedenen Sätzen.
const free = (dt: number, x: string, s: string, g = 3) => ({ t: NOW - dt * DAY, g, x, s });

describe('Fortschritt: fest / sicher / erwartet', () => {
  it('Fest nur mit Stufe 5, 21 Tagen und Beleg im neuen Satz; neue Karten nie', () => {
    const cs = [
      // Wort-Lernen 2: Fest verlangt einen freien Abruf nach ≥ 21 Tagen Pause (`free(30)` → `free(6)` = 24 Tage).
      doc(1, { stage: 5, S: 40, hist: [free(30, 'mc_en', 'sNEW0'), free(6, 'cloze', 'sNEW1'), free(4, 'cloze', 'sNEW2'), free(2, 'cloze', 'sNEW3')] }), // fest
      doc(2, { stage: 5, S: 25, hist: [free(30, 'mc_en', 'sNEW0'), free(6, 'cloze', 'sNEW1'), free(4, 'cloze', 'sNEW2')] }), // fest
      doc(3, { stage: 4, S: 30, hist: [free(6, 'cloze', 'sNEW1'), free(4, 'cloze', 'sNEW2')] }), // sicher (Stufe 4 ist nie fest)
      doc(4, { stage: 5, S: 10, hist: [free(6, 'cloze', 'sNEW1'), free(4, 'cloze', 'sNEW2')] }), // sicher (Stabilität zu jung)
      doc(5, { stage: 5, S: 90, hist: [] }), // lernt (kein Beleg, nur alte Stufe)
      doc(6, { state: 'new', stage: 0, S: 0, reps: 0 }),
    ].map((d, i) => toTrainCard(`w${i + 1}`, d, true, NOW)!);
    const s = vocabStatistics(cs, NOW);
    expect(s.byState.firm).toBe(2);
    expect(s.byState.safe).toBe(2);
    expect(s.byState.learning).toBe(1);
    expect(s.byState.new).toBe(1);
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
