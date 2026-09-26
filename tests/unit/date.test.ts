import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween, isDayKey, isoWeek, legacyDayKey } from '../../src/domain/date';
import { berlin } from './helpers';

describe('Datumsschlüssel mit Tageswechsel um 04:00', () => {
  it('läuft in Europe/Berlin', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Berlin');
  });

  it.each([
    ['2026-09-20', 12, '2026-09-20'],
    ['2026-09-21', 0, '2026-09-20'],
    ['2026-09-21', 3, '2026-09-20'],
    ['2026-09-21', 4, '2026-09-21'],
    ['2026-03-01', 2, '2026-02-28'],
    ['2027-01-01', 1, '2026-12-31'],
  ])('%s %i Uhr gehört zum Lerntag %s', (day, hour, expected) => {
    expect(dayKey(berlin(day, hour))).toBe(expected);
  });

  it('die alte Regel wechselt um Mitternacht', () => {
    expect(legacyDayKey(berlin('2026-09-21', 0, 30))).toBe('2026-09-21');
  });

  it('rechnet Kalendertage ohne Sommerzeit-Sprung', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-09-01', '2026-09-20')).toBe(19);
  });

  it.each([
    ['2026-09-20', '2026-W38'],
    ['2026-09-21', '2026-W39'],
    ['2021-01-03', '2020-W53'],
    ['2026-01-01', '2026-W01'],
    ['2024-12-30', '2025-W01'],
  ])('ISO-Woche von %s ist %s', (key, week) => {
    expect(isoWeek(key)).toBe(week);
  });

  it('erkennt gültige Schlüssel', () => {
    expect(isDayKey('2026-09-20')).toBe(true);
    expect(isDayKey('2026-9-20')).toBe(false);
    expect(isDayKey(20260920)).toBe(false);
  });
});
