import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { computeStreak, legacyActive, legacyStreak } from '../../src/domain/streak';
import { berlin, loadSeed, SEED_ANCHOR } from './helpers';

const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));
const map = (keys: string[], v = 10) => Object.fromEntries(keys.map((k) => [k, v]));

describe('Serie – alte Regel', () => {
  it('zählt Tage mit Antworten oder XP', () => {
    expect(legacyActive({ '2026-09-01': 3 }, {}, '2026-09-01')).toBe(true);
    expect(legacyActive({}, { '2026-09-01': 40 }, '2026-09-01')).toBe(true);
    expect(legacyActive({ '2026-09-01': 0 }, { '2026-09-01': 0 }, '2026-09-01')).toBe(false);
  });

  it('ein noch offener heutiger Tag bricht die Serie nicht', () => {
    const days = map(range('2026-09-10', 5)); // 10.–14.
    expect(computeStreak({ days, today: '2026-09-15' }).count).toBe(5);
    expect(computeStreak({ days, today: '2026-09-15' }).todayDone).toBe(false);
    expect(computeStreak({ days, today: '2026-09-16' }).count).toBe(0);
  });

  it('entspricht auf den Testdaten zu mehreren Zeitpunkten genau der alten Berechnung', () => {
    const seed = loadSeed();
    const p = seed['app/profile'] as { days: Record<string, number>; xpDays: Record<string, number> };
    for (const [day, hour] of [
      [SEED_ANCHOR, 21],
      [addDays(SEED_ANCHOR, 1), 9],
      [addDays(SEED_ANCHOR, 2), 9],
      [addDays(SEED_ANCHOR, -3), 22],
      [addDays(SEED_ANCHOR, -12), 12],
      [addDays(SEED_ANCHOR, -20), 12],
    ] as const) {
      const now = berlin(day, hour);
      const expected = legacyStreak(p.days, p.xpDays, now);
      expect(computeStreak({ days: p.days, xpDays: p.xpDays, today: day, cutover: day }).count, `${day} ${hour} Uhr`).toBe(expected);
    }
    expect(legacyStreak(p.days, p.xpDays, berlin(SEED_ANCHOR, 21))).toBe(12);
  });
});

describe('Serie – neue Regel ab der Umstellung', () => {
  const cutover = '2026-09-07'; // Montag
  const legacy = map(range('2026-09-01', 7)); // 1.–7.

  it('der Umstellungstag zählt nach alter oder neuer Regel', () => {
    expect(computeStreak({ days: legacy, cutover, today: cutover }).count).toBe(7);
  });

  it('nach der Umstellung zählt nur erledigte Pflicht', () => {
    const pflicht = new Set(range('2026-09-08', 3)); // 8.–10.
    const s = computeStreak({ days: { ...legacy, '2026-09-09': 50 }, pflichtDone: pflicht, cutover, today: '2026-09-10' });
    expect(s.count).toBe(10);
    const without9 = new Set(['2026-09-08', '2026-09-10']);
    // Der 9. ohne Pflicht wird zum Ruhetag der Woche – die Serie hält, zählt ihn aber nicht.
    const r = computeStreak({ days: { ...legacy, '2026-09-09': 50 }, pflichtDone: without9, cutover, today: '2026-09-10' });
    expect(r.count).toBe(9);
    expect(r.restDays).toEqual(['2026-09-09']);
  });

  it('ein Ruhetag je Kalenderwoche, nicht ansparbar', () => {
    // Woche 14.–20.09.: zwei fehlende Tage (16. und 18.) → die Serie reißt am zweiten.
    const pflicht = new Set([...range('2026-09-08', 8), '2026-09-17', '2026-09-19', '2026-09-20']);
    const s = computeStreak({ days: legacy, pflichtDone: pflicht, cutover, today: '2026-09-20' });
    expect(s.restDays).toEqual(['2026-09-18']);
    expect(s.count).toBe(3); // 20., 19., 17. – der 16. bricht (Ruhetag der Woche schon vergeben)
  });

  it('Ruhetage in verschiedenen Wochen halten die Serie jeweils', () => {
    const pflicht = new Set([...range('2026-09-08', 12)].filter((k) => k !== '2026-09-10' && k !== '2026-09-16'));
    const s = computeStreak({ days: legacy, pflichtDone: pflicht, cutover, today: '2026-09-19' });
    expect(s.restDays).toEqual(['2026-09-16', '2026-09-10']);
    expect(s.count).toBe(10 + 7);
  });

  it('vor der Umstellung gibt es keine Ruhetage', () => {
    const days = map(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05']);
    expect(computeStreak({ days, cutover: '2026-09-05', today: '2026-09-05' }).count).toBe(2);
  });
});
