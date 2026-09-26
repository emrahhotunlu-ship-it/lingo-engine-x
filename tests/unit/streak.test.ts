import { describe, expect, it } from 'vitest';
import { addDays, dayKey, legacyDayKey } from '../../src/domain/date';
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

  it('nachts zwischen 0 und 4 Uhr geht Aktivität der alten App nach Mitternacht nicht verloren', () => {
    const days = map(['2026-09-25', '2026-09-26', '2026-09-27']);
    const now = berlin('2026-09-27', 2); // Lerntag noch 26., Kalendertag der alten App schon 27.
    expect(computeStreak({ days, today: dayKey(now), legacyToday: legacyDayKey(now) }).count).toBe(3);
    expect(legacyStreak(days, {}, now)).toBe(3);
  });

  it('ein noch offener heutiger Tag bricht die Serie nicht', () => {
    const days = map(range('2026-09-10', 5)); // 10.–14.
    expect(computeStreak({ days, today: '2026-09-15' }).count).toBe(5);
    expect(computeStreak({ days, today: '2026-09-15' }).todayDone).toBe(false);
    expect(computeStreak({ days, today: '2026-09-16' }).count).toBe(0);
  });

  it('entspricht auf den Testdaten zu mehreren Zeitpunkten genau der alten Berechnung – auch nachts', () => {
    const seed = loadSeed();
    const p = seed['app/profile'] as { days: Record<string, number>; xpDays: Record<string, number> };
    for (const [day, hour] of [
      [SEED_ANCHOR, 21],
      [addDays(SEED_ANCHOR, 1), 9],
      [addDays(SEED_ANCHOR, 2), 9],
      [addDays(SEED_ANCHOR, -3), 22],
      [addDays(SEED_ANCHOR, -12), 12],
      [addDays(SEED_ANCHOR, -20), 12],
      [addDays(SEED_ANCHOR, 1), 2],
      [SEED_ANCHOR, 1],
    ] as const) {
      const now = berlin(day, hour);
      const expected = legacyStreak(p.days, p.xpDays, now);
      const got = computeStreak({ days: p.days, xpDays: p.xpDays, today: dayKey(now), legacyToday: legacyDayKey(now) }).count;
      expect(got, `${day} ${hour} Uhr`).toBe(expected);
    }
    expect(legacyStreak(p.days, p.xpDays, berlin(SEED_ANCHOR, 21))).toBe(12);
  });
});

describe('Serie – Pflicht-Regel ab pflichtSince (Phase 1)', () => {
  const pflichtSince = '2026-09-07'; // Montag
  const legacy = map(range('2026-09-01', 7)); // 1.–7.

  it('der erste Pflicht-Tag zählt nach alter oder neuer Regel', () => {
    expect(computeStreak({ days: legacy, pflichtSince, today: pflichtSince }).count).toBe(7);
  });

  it('danach zählt nur erledigte Pflicht', () => {
    const pflicht = new Set(range('2026-09-08', 3)); // 8.–10.
    const s = computeStreak({ days: { ...legacy, '2026-09-09': 50 }, pflichtDone: pflicht, pflichtSince, today: '2026-09-10' });
    expect(s.count).toBe(10);
    const without9 = new Set(['2026-09-08', '2026-09-10']);
    // Der 9. ohne Pflicht wird zum Ruhetag der Woche – die Serie hält, zählt ihn aber nicht.
    const r = computeStreak({ days: { ...legacy, '2026-09-09': 50 }, pflichtDone: without9, pflichtSince, today: '2026-09-10' });
    expect(r.count).toBe(9);
    expect(r.restDays).toEqual(['2026-09-09']);
  });

  it('ein Ruhetag je Kalenderwoche, nicht ansparbar', () => {
    // Woche 14.–20.09.: zwei fehlende Tage (16. und 18.) → die Serie reißt am zweiten.
    const pflicht = new Set([...range('2026-09-08', 8), '2026-09-17', '2026-09-19', '2026-09-20']);
    const s = computeStreak({ days: legacy, pflichtDone: pflicht, pflichtSince, today: '2026-09-20' });
    expect(s.restDays).toEqual(['2026-09-18']);
    expect(s.count).toBe(3); // 20., 19., 17. – der 16. bricht (Ruhetag der Woche schon vergeben)
  });

  it('Ruhetage in verschiedenen Wochen halten die Serie jeweils', () => {
    const pflicht = new Set([...range('2026-09-08', 12)].filter((k) => k !== '2026-09-10' && k !== '2026-09-16'));
    const s = computeStreak({ days: legacy, pflichtDone: pflicht, pflichtSince, today: '2026-09-19' });
    expect(s.restDays).toEqual(['2026-09-16', '2026-09-10']);
    expect(s.count).toBe(10 + 7);
  });

  it('auch der erste Pflicht-Tag selbst kann der Ruhetag der Woche sein', () => {
    // alt aktiv 1.–6.9., pflichtSince = 7.9. (Montag) nur geöffnet, 8.9. Pflicht erledigt.
    const s = computeStreak({ days: map(range('2026-09-01', 6)), pflichtSince, pflichtDone: new Set(['2026-09-08']), today: '2026-09-08' });
    expect(s.count).toBe(7);
    expect(s.restDays).toEqual(['2026-09-07']);
  });

  it('vor pflichtSince gibt es keine Ruhetage', () => {
    const days = map(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05']);
    expect(computeStreak({ days, pflichtSince: '2026-09-05', today: '2026-09-05' }).count).toBe(2);
  });
});

describe('Serie – ohne Pflicht-Erfassung läuft die alte Regel weiter', () => {
  it('mehrere Tage nach der Umstellung zählt weiter jede Aktivität (kein Abriss am 3. Tag)', () => {
    const days = map(range('2026-09-01', 30)); // 1.–30.
    for (const today of ['2026-09-21', '2026-09-25', '2026-09-30']) {
      expect(computeStreak({ days, today }).count, today).toBe(Number(today.slice(8)));
    }
  });
});
