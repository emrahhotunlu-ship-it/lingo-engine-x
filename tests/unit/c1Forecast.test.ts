import { describe, expect, it } from 'vitest';
import type { C1Check, C1Doc } from '../../src/domain/c1/c1doc';
import { c1Criteria, type CriteriaInput } from '../../src/domain/c1/criteria';
import { FC_MIN_MONTHS, fcOf, forecastAllowed, forecastCalc, forecastFrom, forecastView, freezeIndex, nextCheckDay, withFc } from '../../src/domain/c1/forecast';
import type { K1Measure, K4Measure } from '../../src/domain/metrics/c1';

// Prognose (Lernplattform 3.0 §4.6, P44): nur Zeitraum, erst ab 3 Checks und 6 Wochen, nur im Check-Fenster gerechnet und eingefroren.

const base = (over: Partial<C1Doc> = {}): C1Doc => ({ v: 1, place: { d: '2026-10-01', se: 1, n: 12, skip: [] }, checks: [], gates: [], prod: [], bad: [], ...over });
const check = (d: string, pts: number, inp: 'desk' | 'touch' = 'desk', fc?: C1Check['fc']): C1Check => {
  const q = Math.round(pts / 4);
  return { d, f: 'A', inp, p: [q, q, q, pts - 3 * q], pts, max: 36, ...(fc !== undefined ? { fc } : {}) };
};

const k1: K1Measure = { gates: 2, safe: 40, total: 100, free: { ok: 30, n: 40 }, newSafe56: 16 };
const k4: K4Measure = { fest: 450, learned: 900, retention: { rate: 0.9, n: 60, enough: true, band: 'in' }, growth: { delta: 56, days: 56 } };
const input = (c1: C1Doc, today: string, o: Partial<CriteriaInput> = {}): CriteriaInput => ({
  today,
  c1,
  k1,
  k2: { relapses: 3, prev: 5, traps: 6 },
  k3: { view: { state: 'valid', t: 0, passive: 3500, lo: 3200, hi: 3800 }, series: [] },
  k4,
  k6: { n: 25, ok: 18, clean: 8, cleanOk: 7, older: 0.6, recent: 0.8 },
  ...o,
});

describe('Ab wann gezeigt (0, 2, 3 Checks)', () => {
  it('0 Checks: „noch nicht abschätzbar, ab <Datum des 3. Checks>“ (letzte Samstage mit Abstand)', () => {
    const c1 = base();
    expect(forecastAllowed(c1, '2026-10-08')).toBe(false);
    expect(nextCheckDay('2026-10-08', null)).toBe('2026-10-31');
    expect(forecastFrom(c1, '2026-10-08')).toBe('2026-12-26');
    expect(forecastView(c1, '2026-10-08', false)).toEqual({ kind: 'wait', from: '2026-12-26' });
  });
  it('2 Checks: weiter warten bis zum 3. Check', () => {
    const c1 = base({ checks: [check('2026-10-31', 15), check('2026-11-28', 18)] });
    expect(forecastAllowed(c1, '2026-12-01')).toBe(false);
    expect(forecastView(c1, '2026-12-01', false)).toEqual({ kind: 'wait', from: '2026-12-26' });
  });
  it('3 Checks, aber unter 6 Wochen Programm: warten bis zum ersten Check nach 6 Wochen', () => {
    const c1 = base({ place: { d: '2026-10-20', se: 1, n: 12, skip: [] }, checks: [check('2026-10-24', 15), check('2026-10-25', 16), check('2026-10-26', 17)] });
    expect(forecastAllowed(c1, '2026-10-27')).toBe(false);
    expect(forecastFrom(c1, '2026-10-27')).toBe('2026-12-26');
  });
  it('3 Checks und 6 Wochen: erlaubt; ohne eingefrorenen Wert „beim nächsten Check“', () => {
    const c1 = base({ checks: [check('2026-10-31', 15), check('2026-11-28', 18), check('2026-12-26', 20)] });
    expect(forecastAllowed(c1, '2026-12-27')).toBe(true);
    expect(forecastView(c1, '2027-01-05', false)).toEqual({ kind: 'pending', next: '2027-01-30' });
  });
  it('ohne Programm: kein Datum', () => {
    expect(forecastFrom({ ...base(), place: undefined }, '2026-10-08')).toBeNull();
  });
});

describe('Anzeige nur aus eingefrorenen Werten', () => {
  const frozen = { from: '2027-09', to: '2027-12', late: 'k4' };
  it('zeigt den neuesten eingefrorenen Wert, auch wenn der neueste Check noch keinen hat', () => {
    const c1 = base({ checks: [check('2026-10-31', 15), check('2026-11-28', 18), check('2026-12-26', 20, 'desk', frozen), check('2027-01-30', 22)] });
    expect(forecastView(c1, '2027-02-10', false)).toEqual({ kind: 'range', ...frozen });
  });
  it('`fc: null` = Pause-Satz; erreichte Etappe = keine Prognose mehr', () => {
    const c1 = base({ checks: [check('2026-10-31', 15), check('2026-11-28', 18), check('2026-12-26', 20, 'desk', null)] });
    expect(forecastView(c1, '2027-01-02', false)).toEqual({ kind: 'pause' });
    expect(forecastView(c1, '2027-01-02', true)).toEqual({ kind: 'reached' });
  });
  it('ändert sich nur an Check-Tagen: einfrieren nur im Check-Fenster, nur für den Check dieses Monats, nur einmal', () => {
    const c1 = base({ checks: [check('2026-10-31', 15), check('2026-11-28', 18), check('2026-12-26', 20)] });
    expect(freezeIndex(c1, '2026-12-26')).toBe(2);
    expect(freezeIndex(c1, '2026-12-31')).toBe(2);
    expect(freezeIndex(c1, '2027-01-05')).toBe(-1); // außerhalb des Fensters
    expect(freezeIndex(c1, '2027-01-28')).toBe(-1); // Fenster, aber der letzte Check ist aus dem Vormonat
    const done = withFc(c1, '2026-12-26', frozen);
    expect(done?.checks[2]?.fc).toEqual(frozen);
    expect(freezeIndex(done as C1Doc, '2026-12-27')).toBe(-1);
    expect(withFc(done as C1Doc, '2026-12-26', null)).toBeNull(); // nie überschrieben
  });
});

describe('Rechnung', () => {
  const c1 = base({ checks: [check('2026-10-31', 14), check('2026-11-28', 16), check('2026-12-26', 18)] });
  it('Zeitraum in Monaten, mindestens 3 Monate breit, das späteste Kriterium wird genannt', () => {
    const crit = c1Criteria(input(c1, '2026-12-26'));
    const calc = forecastCalc({ today: '2026-12-26', crit, k1, k4 });
    expect(calc.kind).toBe('range');
    if (calc.kind !== 'range') return;
    const months = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5)) - Number(a.slice(5));
    expect(months(calc.from, calc.to)).toBeGreaterThanOrEqual(FC_MIN_MONTHS - 1);
    expect(calc.from >= '2026-12').toBe(true);
    // K4: 300 fest fehlen bei 1 je Tag = 300 Tage; K1: 40 Muster bei 16/56 je Tag = 140 Tage; K5: 0,1 bei (4/36)/56 je Tag ≈ 50 Tage.
    expect(calc.late).toBe('k4');
    expect(calc.missing).toEqual(['k7']);
    expect(fcOf(calc)).toEqual({ from: calc.from, to: calc.to, late: 'k4' });
  });
  it('gleiche Daten → gleiche Prognose (rein)', () => {
    const a = forecastCalc({ today: '2026-12-26', crit: c1Criteria(input(c1, '2026-12-26')), k1, k4 });
    const b = forecastCalc({ today: '2026-12-26', crit: c1Criteria(input(structuredClone(c1), '2026-12-26')), k1: { ...k1 }, k4: { ...k4 } });
    expect(a).toEqual(b);
  });
  it('Tempo ≤ 0 (Pause): kein Zeitraum, `fc: null`', () => {
    const still = { ...k4, growth: { delta: 0, days: 56 } };
    const calc = forecastCalc({ today: '2026-12-26', crit: c1Criteria(input(c1, '2026-12-26', { k4: still })), k1, k4: still });
    expect(calc).toEqual({ kind: 'pause', ids: ['k4'] });
    expect(fcOf(calc)).toBeNull();
  });
  it('ohne jede Datenbasis: nichts einfrieren', () => {
    const none = { ...k4, growth: null };
    const k1none = { ...k1, total: 0 };
    const calc = forecastCalc({ today: '2026-12-26', crit: c1Criteria(input(base(), '2026-12-26', { k4: none, k1: k1none })), k1: k1none, k4: none });
    expect(calc.kind).toBe('none');
    expect(fcOf(calc)).toBeUndefined();
  });
  it('K5 zählt nur Laptop-Checks: Handy-Checks geben kein Tempo', () => {
    const touch = base({ checks: [check('2026-10-31', 14, 'touch'), check('2026-11-28', 16, 'touch'), check('2026-12-26', 18, 'touch')] });
    const calc = forecastCalc({ today: '2026-12-26', crit: c1Criteria(input(touch, '2026-12-26')), k1, k4 });
    expect(calc.kind === 'range' && calc.missing).toEqual(['k5', 'k7']);
  });
});
