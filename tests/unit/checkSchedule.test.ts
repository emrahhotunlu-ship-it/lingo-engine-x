import { describe, expect, it } from 'vitest';
import { checkPlanned, CHECK_GAP_DAYS, FORMAT_MIN, FORMAT_N, inCheckWindow, isLastSaturday, step3Format } from '../../src/domain/c1/checkSchedule';
import { addDays } from '../../src/domain/date';

// Wochenrhythmus von Schritt 3 und Check-Tag (Lernplattform 3.0 §2.1, P23): Testuhr = feste Tage, nichts hängt von der Systemzeit ab.

const ALL = { kindOn: () => true, tempoOn: true };
// Oktober 2026: Montag 5., Dienstag 6., … Samstag 10., Sonntag 11.; letzter Samstag 31.
const DAYS = { mo: '2026-10-05', di: '2026-10-06', mi: '2026-10-07', do: '2026-10-08', fr: '2026-10-09', sa: '2026-10-10', so: '2026-10-11' };

describe('step3Format: Wochentag bestimmt das Format', () => {
  it('Mo Satzbau, Di Kleines Wort, Mi Wort umbauen, Do Umformen, Fr Passendes Wort, Sa Tempo-Runde, So nichts', () => {
    expect(step3Format(DAYS.mo, ALL)).toBeNull();
    expect(step3Format(DAYS.di, ALL)).toEqual({ mode: 'format', fmt: 'ocl' });
    expect(step3Format(DAYS.mi, ALL)).toEqual({ mode: 'format', fmt: 'wf' });
    expect(step3Format(DAYS.do, ALL)).toEqual({ mode: 'format', fmt: 'kwt' });
    expect(step3Format(DAYS.fr, ALL)).toEqual({ mode: 'format', fmt: 'mcc' });
    expect(step3Format(DAYS.sa, ALL)).toEqual({ mode: 'tempo' });
    expect(step3Format(DAYS.so, ALL)).toBeNull();
  });
  it('eine nicht angebotene Art oder Tempo-Runde fällt auf den Satzbau zurück', () => {
    expect(step3Format(DAYS.mi, { kindOn: (k) => k !== 'wf', tempoOn: true })).toBeNull();
    expect(step3Format(DAYS.sa, { kindOn: () => true, tempoOn: false })).toBeNull();
    expect(step3Format(DAYS.di, { kindOn: (k) => k !== 'wf', tempoOn: false })).toEqual({ mode: 'format', fmt: 'ocl' });
  });
  it('Mengen je Art und Mindestzahl', () => {
    expect(FORMAT_N).toEqual({ ocl: 8, wf: 6, kwt: 4, mcc: 8 });
    expect(FORMAT_MIN).toBe(4);
  });
});

describe('Check-Fenster und letzter Samstag', () => {
  it('die letzten 7 Tage des Monats', () => {
    expect(inCheckWindow('2026-10-24')).toBe(false);
    expect(inCheckWindow('2026-10-25')).toBe(true);
    expect(inCheckWindow('2026-10-31')).toBe(true);
    expect(inCheckWindow('2026-02-22')).toBe(true);
    expect(inCheckWindow('2026-02-21')).toBe(false);
  });
  it('der letzte Samstag ist in jedem Monat des Jahres genau einer', () => {
    for (let m = 1; m <= 12; m++) {
      const first = `2026-${String(m).padStart(2, '0')}-01`;
      const sats: string[] = [];
      for (let i = 0; i < 31; i++) {
        const d = addDays(first, i);
        if (d.slice(0, 7) === first.slice(0, 7) && isLastSaturday(d)) sats.push(d);
      }
      expect(sats, `Monat ${m}`).toHaveLength(1);
    }
    expect(isLastSaturday('2026-10-31')).toBe(true);
    expect(isLastSaturday('2026-10-24')).toBe(false);
  });
});

describe('checkPlanned: Voraussetzungen', () => {
  const ok = { programStarted: true, lastCheck: null, formAvailable: true };
  it('letzter Samstag, voller Tag, Programm, freie Form: ja', () => {
    expect(checkPlanned('2026-10-31', 'sat', ok)).toBe(true);
  });
  it('nein ohne eine der Voraussetzungen', () => {
    expect(checkPlanned('2026-10-31', 'sat', { ...ok, programStarted: false })).toBe(false);
    expect(checkPlanned('2026-10-31', 'sat', { ...ok, formAvailable: false })).toBe(false);
    expect(checkPlanned('2026-10-31', 'short', ok)).toBe(false);
    expect(checkPlanned('2026-10-24', 'sat', ok)).toBe(false);
  });
  it('Abstand von mindestens 21 Tagen zum letzten Check', () => {
    expect(checkPlanned('2026-10-31', 'sat', { ...ok, lastCheck: addDays('2026-10-31', -(CHECK_GAP_DAYS - 1)) })).toBe(false);
    expect(checkPlanned('2026-10-31', 'sat', { ...ok, lastCheck: addDays('2026-10-31', -CHECK_GAP_DAYS) })).toBe(true);
  });
});
