import { describe, expect, it } from 'vitest';
import { SHORT_DAY_WORDS_MIN, vocabCfg, wordsMinutes } from '../../../src/modules/vocab/api';
import { SHORT_DAY_MIN, shrinkDayPlan, type DayPlan } from '../../../src/modules/vocab/domain/day';

// Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026): Wörter-Plan des Moduls.
describe('shrinkDayPlan (Wörter)', () => {
  const day = (n: number, fresh: number): DayPlan => ({
    d: '2026-11-04',
    plan: [...Array.from({ length: n }, (_, i): DayPlan['plan'][number] => [`vocab/w${i}`, 'u', 'gap']), ...Array.from({ length: fresh }, (_, i): DayPlan['plan'][number] => [`vocab/n${i}`, 'n', 'intro'])],
    min: (n + fresh) * 0.5,
    due: n,
    fresh,
    ahead: 0,
    moved: 0,
    why: 'x',
  });
  it('behält die ersten Fälligen bis 5 Minuten und höchstens 2 neue', () => {
    const s = shrinkDayPlan(day(20, 5), 5)!;
    expect(s.plan.filter((e) => e[1] === 'n')).toHaveLength(2);
    expect(s.plan.filter((e) => e[1] !== 'n').map((e) => e[0])).toEqual(Array.from({ length: 8 }, (_, i) => `vocab/w${i}`));
    expect(s.min).toBe(5);
    expect(s.due).toBe(8);
    expect(s.fresh).toBe(2);
    // Die 12 weggefallenen Wiederholungen stehen in der Verteilung am nächsten Tag (Startkarte, learning-scientist 3).
    expect(s.sp).toEqual([['2026-11-05', 12]]);
  });
  it('schon klein genug: null', () => {
    expect(shrinkDayPlan(day(4, 2), 5)).toBeNull();
  });
});

describe('Wörter-Minuten am kurzen Tag', () => {
  it('ein neu eingefrorener Wörter-Plan plant am kurzen Tag 5 Minuten, sonst wie das Tagesziel', () => {
    const now = new Date('2026-11-04T10:00:00+01:00').getTime();
    expect(SHORT_DAY_WORDS_MIN).toBe(SHORT_DAY_MIN);
    expect(wordsMinutes({ goalMin: 25, kt: { '2026-11-04': 1 } }, now)).toBe(5);
    expect(wordsMinutes({ goalMin: 25, kt: { '2026-11-03': 1 } }, now)).toBe(10);
    expect(wordsMinutes({ goalMin: 40 }, now)).toBe(16);
  });
  it('höchstens 2 neue Wörter am kurzen Tag, sonst die Einstellung', () => {
    const day = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(ms - 4 * 3_600_000));
    const key = day(Date.now());
    expect(vocabCfg({ newPerDay: 10, kt: { [key]: 1 } }).newPerDay).toBe(2);
    expect(vocabCfg({ newPerDay: 0, kt: { [key]: 1 } }).newPerDay).toBe(0);
    expect(vocabCfg({ newPerDay: 10 }).newPerDay).toBe(10);
  });
});
