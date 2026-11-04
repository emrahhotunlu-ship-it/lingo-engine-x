import { describe, expect, it } from 'vitest';
import { doneToday, planDoneCount } from '../../../src/modules/vocab/domain/session';

// Wiedereinstieg in die Wörter-Runde (Emrah 04.11.2026: „rausgehen, wieder reingehen – muss von vorne anfangen“).
describe('Wörter-Runde: heute erledigt', () => {
  const day = '2026-11-04';
  it('zählt Abruf (day) UND Erkennen/Aufdecken (dayU) als heute erledigt', () => {
    expect(doneToday({ day, dayU: null }, day)).toBe(true);
    expect(doneToday({ day: null, dayU: day }, day)).toBe(true);
    expect(doneToday({ day: '2026-11-03', dayU: '2026-11-03' }, day)).toBe(false);
  });
  it('zählt erledigte Einträge des eingefrorenen Plans (Wiederholungen gebucht, neue Wörter eingeführt)', () => {
    const lex: Record<string, { day: string | null; dayU: string | null; intro: string | null }> = {
      'vocab/a': { day, dayU: null, intro: '2026-10-01' },
      'vocab/b': { day: null, dayU: day, intro: '2026-10-01' },
      'vocab/c': { day: '2026-11-01', dayU: null, intro: '2026-10-01' },
      'vocab/n1': { day: null, dayU: null, intro: day },
      'vocab/n2': { day: null, dayU: null, intro: null },
    };
    const plan = [
      ['vocab/a', 'b', 'gap'],
      ['vocab/b', 'u', 'meaning'],
      ['vocab/c', 'b', 'gap'],
      ['vocab/n1', 'n', 'intro'],
      ['vocab/n2', 'n', 'intro'],
      ['vocab/gone', 'b', 'gap'],
    ] as const;
    expect(planDoneCount(plan, (p) => lex[p] ?? null, day)).toBe(3);
  });
});
