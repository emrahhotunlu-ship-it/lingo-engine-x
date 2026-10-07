import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { collectionForecast, collectionRate, docForecast, docRate, earliest, monthsUntil } from '../../src/domain/capacity/forecast';

// P29: Kapazitätsanzeige. Nur Rechnen; geschrieben wird nichts.

const today = '2026-10-07';
const hist = (n: number, start: number, perDay: number, extra: Record<string, unknown> = {}) =>
  Array.from({ length: n }, (_, i) => ({ d: addDays(today, -(n - 1 - i)), dc: Math.round(start + perDay * i), ...extra }));

describe('docRate', () => {
  it('lineare Anpassung der letzten 28 Tage', () => {
    const r = docRate(hist(28, 1000, 3), today);
    expect(r?.perDay).toBeCloseTo(3, 0);
    expect(r?.points).toBe(28);
  });
  it('zu wenig Daten: weniger als 5 Tagesbilder, kürzer als 14 Tage, ohne dc → keine Rate', () => {
    expect(docRate(hist(4, 1000, 3), today)).toBeNull();
    expect(docRate(hist(10, 1000, 3), today)).toBeNull();
    expect(docRate([{ d: today, va: 5 }], today)).toBeNull();
    expect(docRate(undefined, today)).toBeNull();
    expect(docRate('x', today)).toBeNull();
  });
  it('Einträge älter als 28 Tage zählen nicht', () => {
    const old = hist(40, 100, 10).slice(0, 12);
    expect(docRate(old.map((h) => ({ ...h, d: addDays(h.d, -60) })), today)).toBeNull();
  });
});

describe('monthsUntil', () => {
  it('Zeitraum ±30 %; erreicht → reached; ohne Zuwachs → null', () => {
    const m = monthsUntil(3500, 1234, 3);
    expect(m).not.toBe('reached');
    expect(m).not.toBeNull();
    if (m && m !== 'reached') {
      expect(m.lo).toBeLessThanOrEqual(m.hi);
      expect(m.lo).toBeGreaterThanOrEqual(1);
      // 2.266 fehlen bei 3/Tag: ≈ 25 Monate; die Spanne enthält das, ±30 %.
      expect(m.lo).toBeLessThanOrEqual(25);
      expect(m.hi).toBeGreaterThanOrEqual(25);
    }
    expect(monthsUntil(3500, 3600, 3)).toBe('reached');
    expect(monthsUntil(3500, 1234, 0)).toBeNull();
    expect(monthsUntil(3500, 1234, null)).toBeNull();
    expect(monthsUntil(3500, 1234, -2)).toBeNull();
  });
});

describe('docForecast', () => {
  it('zu wenig Daten: „noch keine Prognose“ (months null), Zustand aus dem Bestand', () => {
    expect(docForecast({ total: 1234, history: [], today })).toMatchObject({ total: 1234, limit: 5000, warnAt: 3500, state: 'ok', months: null });
    expect(docForecast({ total: 3600, history: [], today }).state).toBe('warn');
    expect(docForecast({ total: 4400, history: [], today }).state).toBe('full');
  });
  it('mit Verlauf: Zeitraum bis zur Warnschwelle', () => {
    const f = docForecast({ total: 1234, history: hist(28, 1150, 3), today });
    expect(f.rate?.perDay).toBeCloseTo(3, 0);
    expect(f.months).not.toBeNull();
  });
  it('nichts wird verändert (reine Funktion)', () => {
    const h = hist(28, 1150, 3);
    const copy = JSON.stringify(h);
    docForecast({ total: 1234, history: h, today });
    expect(JSON.stringify(h)).toBe(copy);
  });
});

describe('je Sammlung: Vorwarnung bei 900, hartes Fenster bei 1.000', () => {
  it('Zustände', () => {
    expect(collectionForecast({ name: 'vocab', count: 899, perDay: 3 }).state).toBe('ok');
    expect(collectionForecast({ name: 'vocab', count: 900, perDay: 3 }).state).toBe('prewarn');
    expect(collectionForecast({ name: 'vocab', count: 1000, perDay: 3 }).state).toBe('full');
  });
  it('Prognose bis zur Vorwarnung; erreicht → reached', () => {
    const c = collectionForecast({ name: 'vocab', count: 800, perDay: 3 });
    expect(c.months).not.toBeNull();
    expect(c.months).not.toBe('reached');
    expect(collectionForecast({ name: 'chunk', count: 950, perDay: 1 }).months).toBe('reached');
    expect(collectionForecast({ name: 'log', count: 100, perDay: null }).months).toBeNull();
  });
  it('Zuwachs je Tag aus den Anlage-Tagen der letzten 28 Tage', () => {
    const days = [addDays(today, -1), addDays(today, -2), addDays(today, -27), addDays(today, -28), addDays(today, -90), 'kaputt'];
    expect(collectionRate(days, today)).toBeCloseTo(3 / 28, 5);
  });
  it('die frühere der Schwellen', () => {
    const doc = docForecast({ total: 1234, history: hist(28, 1150, 3), today });
    const vocab = collectionForecast({ name: 'vocab', count: 850, perDay: 3 });
    const first = earliest([{ label: 'doc', months: doc.months }, { label: 'vocab', months: vocab.months }]);
    expect(first?.label).toBe('vocab');
    expect(earliest([{ label: 'a', months: null }])).toBeNull();
    expect(earliest([{ label: 'a', months: { lo: 5, hi: 8 } }, { label: 'b', months: 'reached' }])?.label).toBe('b');
  });
});
