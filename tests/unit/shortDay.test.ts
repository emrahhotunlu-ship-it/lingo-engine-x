import { describe, expect, it } from 'vitest';
import { readPlan } from '../../src/domain/plan/buildPlan';
import { shortDayAllowed, shortDayPlan, shortDaysInWeek, shortDaysLeft } from '../../src/domain/plan/shortDay';

// Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026).
const raw = (over: Record<string, unknown> = {}) => ({
  d: '2026-11-04',
  v: 1,
  ids: [],
  why: [],
  duty: ['review', 'ch:u-focus', 'ch:u-task'],
  goal: { review: 40, due: 30, new: 5, ahead: 0 },
  lesson: null,
  at: 7,
  extra: 'bleibt',
  u: { v: 1, shape: 'unit', goalMin: 25, theme: '', min: 25, rv: 2, tw: 1, b: [[1, 'review', 10, { repairs: 0 }], [2, 'grammar', 10, { n: 8, errs: 2 }], [3, 'task.apply', 5]], gt: { ch: 1 }, ...over },
});

describe('shortDayPlan', () => {
  it('verkleinert die drei Schritte, setzt goalMin 10, behält Pflicht, Themen und Unbekanntes (keine Markierung im Plan)', () => {
    const p = shortDayPlan(raw())!;
    const u = p.u as Record<string, unknown>;
    expect(u.b).toEqual([[1, 'review', 5, { repairs: 0 }], [2, 'grammar', 3, { n: 8, errs: 1 }], [3, 'task.apply', 3]]);
    expect(u.goalMin).toBe(10);
    expect(u.min).toBe(11);
    expect(u.kt).toBeUndefined();
    expect(u.gt).toEqual({ ch: 1 });
    expect(p.duty).toEqual(['review', 'ch:u-focus', 'ch:u-task']);
    expect(p.extra).toBe('bleibt');
    expect((p.goal as Record<string, number>).review).toBe(20);
    expect(readPlan(p, '2026-11-04')?.u?.min).toBe(11);
  });
  it('der Wochen-Check am Sonntag behält seine Minuten', () => {
    const p = shortDayPlan(raw({ b: [[1, 'review', 10], [2, 'grammar', 10], [3, 'task.check', 5]] }))!;
    expect((p.u as Record<string, unknown>).b).toEqual([[1, 'review', 5], [2, 'grammar', 3], [3, 'task.check', 5]]);
    expect((p.u as Record<string, unknown>).min).toBe(13);
  });
  it('ohne Tageseinheit: null', () => {
    expect(shortDayPlan({ d: '2026-11-04' })).toBeNull();
  });
});

describe('shortDayAllowed', () => {
  const plan = readPlan(raw(), '2026-11-04');
  it('nur unberührt, nur Tagesweg, nicht doppelt, höchstens zweimal je Kalenderwoche', () => {
    expect(shortDayAllowed({ plan, today: '2026-11-04', kt: undefined, untouched: true })).toBe(true);
    expect(shortDayAllowed({ plan, today: '2026-11-04', kt: undefined, untouched: false })).toBe(false);
    // Heute schon kurz: allein `kt[heute]` zählt; ein altes `u.kt` aus der Mischung mit dem Plan von gestern stört nicht (data-guard B1).
    expect(shortDayAllowed({ plan, today: '2026-11-04', kt: { '2026-11-04': 1 }, untouched: true })).toBe(false);
    expect(shortDayAllowed({ plan: readPlan(raw({ kt: 1 }), '2026-11-04'), today: '2026-11-04', kt: { '2026-11-02': 1 }, untouched: true })).toBe(true);
    // Nicht zwei Tage hintereinander, nicht in der Neustart-Woche (learning-scientist 1).
    expect(shortDayAllowed({ plan, today: '2026-11-04', kt: { '2026-11-03': 1 }, untouched: true })).toBe(false);
    expect(shortDayAllowed({ plan: readPlan(raw({ cb: 'reduced' }), '2026-11-04'), today: '2026-11-04', kt: undefined, untouched: true })).toBe(false);
    expect(shortDayAllowed({ plan: readPlan(raw({ tw: undefined }), '2026-11-04'), today: '2026-11-04', kt: undefined, untouched: true })).toBe(false);
    expect(shortDayAllowed({ plan: readPlan(raw({ c1: 'check' }), '2026-11-04'), today: '2026-11-04', kt: undefined, untouched: true })).toBe(false);
    // Woche Mo 02.11.–So 08.11.: zwei schon genommen → nein; Vorwoche zählt nicht.
    expect(shortDayAllowed({ plan, today: '2026-11-05', kt: { '2026-11-02': 1, '2026-11-03': 1 }, untouched: true })).toBe(false);
    expect(shortDayAllowed({ plan, today: '2026-11-04', kt: { '2026-11-01': 1, '2026-10-31': 1, '2026-11-02': 1 }, untouched: true })).toBe(true);
  });
  it('zählt nur gültige Tage derselben Woche', () => {
    expect(shortDaysInWeek({ '2026-11-02': 1, '2026-11-09': 1, kaputt: 1, '2026-11-03': 0 }, '2026-11-04')).toBe(1);
    expect(shortDaysInWeek(['2026-11-02'], '2026-11-04')).toBe(0);
    expect(shortDaysLeft({ '2026-11-02': 1 }, '2026-11-04')).toBe(1);
  });
});
