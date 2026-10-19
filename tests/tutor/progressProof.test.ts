import { describe, expect, it } from 'vitest';
import { PROOF_MAX, PROOF_MIN, progressProof } from '../../src/domain/tutor/learner';

// Fortschrittsbeleg (Tutor-Engine v3 S2): nur aus Daten, nie erfunden. Alle Daten sind erfunden.

const TODAY = '2026-10-19';
const at = (day: string, h = 12): number => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime();
const row = (day: string, ok: boolean, typed = true, h = 12) => ({ t: at(day, h), day, ok, typed });
const many = (day: string, oks: boolean[]) => oks.map((ok, i) => row(day, ok, true, 8 + i));

describe('progressProof', () => {
  it('vor 3 Wochen 4 von 9, jetzt 8 von 9', () => {
    const rows = [...many('2026-09-28', [true, true, true, true, false, false, false, false, false]), ...many('2026-10-17', [true, true, true, true, true, true, true, true, false])];
    expect(progressProof(rows, TODAY)).toEqual({ thenOk: 4, thenN: 9, nowOk: 8, nowN: 9, weeks: 3, trend: 'up' });
  });

  it('zu wenige Antworten in einem Fenster: kein Beleg (nie erfunden)', () => {
    const then = many('2026-09-28', [true, false, false, false]);
    expect(progressProof([...then, ...many('2026-10-18', [true, true, true])], TODAY)).toBeNull();
    expect(progressProof([...many('2026-09-28', [true, false, false]), ...many('2026-10-18', [true, true, true, true])], TODAY)).toBeNull();
    expect(progressProof([], TODAY)).toBeNull();
    expect(PROOF_MIN).toBe(4);
  });

  it('nur getippte Antworten zählen', () => {
    const rows = [...many('2026-09-28', [false, false, false, false]), ...many('2026-10-18', [true, true, true]), row('2026-10-18', true, false, 20)];
    expect(progressProof(rows, TODAY)).toBeNull();
  });

  it('die Lücke (8–13 Tage zurück) zählt in keinem Fenster', () => {
    const rows = [...many('2026-10-08', [false, false, false, false, false]), ...many('2026-10-18', [true, true, true, true])];
    expect(progressProof(rows, TODAY)).toBeNull();
  });

  it('je Fenster höchstens die jüngsten 9', () => {
    const rows = [...many('2026-09-20', Array<boolean>(12).fill(false)), ...many('2026-09-30', [true, true, true]), ...many('2026-10-19', Array<boolean>(15).fill(true))];
    const p = progressProof(rows, TODAY);
    expect(p?.thenN).toBe(PROOF_MAX);
    expect(p?.thenOk).toBe(3);
    expect(p?.nowN).toBe(PROOF_MAX);
    expect(p?.weeks).toBe(3);
  });

  it('Zeilen nach heute zählen nicht; Wochen mindestens 2', () => {
    const rows = [...many('2026-10-05', [true, true, true, true]), ...many('2026-10-19', [true, true, true, true]), ...many('2026-10-20', [false, false, false, false])];
    expect(progressProof(rows, TODAY)).toEqual({ thenOk: 4, thenN: 4, nowOk: 4, nowN: 4, weeks: 2, trend: 'flat' });
  });

  it('Verschlechterung heißt „down“', () => {
    const rows = [...many('2026-09-28', [true, true, true, true]), ...many('2026-10-17', [true, false, false, false])];
    expect(progressProof(rows, TODAY)?.trend).toBe('down');
  });

  it('Reihenfolge der Eingabe egal', () => {
    const rows = [...many('2026-09-28', [true, false, false, false, true]), ...many('2026-10-17', [true, true, true, true, false])];
    expect(progressProof([...rows].reverse(), TODAY)).toEqual(progressProof(rows, TODAY));
  });
});
