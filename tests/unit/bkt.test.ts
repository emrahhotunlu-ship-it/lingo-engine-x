import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { bktStep, certainty, displayP, nextDue } from '../../src/domain/grammar/bkt';
import { berlin } from './helpers';

const DAY = 86_400_000;
const base = { anchor: null, anchorD: null, day: '2026-09-27', helpLevel: 0 } as const;

describe('gedämpftes BKT', () => {
  it('B-01: |Δ| ≤ .06, mit Hilfe ≤ .03', () => {
    for (const p of [0.05, 0.2, 0.4, 0.5, 0.7, 0.9, 0.98]) {
      for (const ok of [true, false]) {
        for (const type of ['mc', 'gap', 'transform', 'correct'] as const) {
          const r = bktStep({ ...base, p, ok, type, nOptions: 4 });
          expect(Math.abs(r.p - p)).toBeLessThanOrEqual(0.06 + 1e-9);
          const h = bktStep({ ...base, p, ok, type, nOptions: 4, helpLevel: 1 });
          expect(Math.abs(h.p - p)).toBeLessThanOrEqual(0.03 + 1e-9);
        }
      }
    }
  });

  it('B-02: Tagesanker ±.12; eine Antwort um 03:30 gehört zum Vortag', () => {
    const day = dayKey(berlin('2026-09-28', 3, 30));
    expect(day).toBe('2026-09-27');
    let st = { p: 0.5, anchor: null as number | null, anchorD: null as string | null };
    for (let i = 0; i < 30; i++) {
      const r = bktStep({ ...base, p: st.p, anchor: st.anchor, anchorD: st.anchorD, day, ok: true, type: 'gap' });
      st = { p: r.p, anchor: r.anchor, anchorD: r.anchorD };
    }
    expect(st.anchor).toBe(0.5);
    expect(st.p).toBeCloseTo(0.62, 6);
    // Neuer Lerntag: neuer Anker, weiter nach oben.
    const next = bktStep({ ...base, p: st.p, anchor: st.anchor, anchorD: st.anchorD, day: '2026-09-28', ok: true, type: 'gap' });
    expect(next.anchorChanged).toBe(true);
    expect(next.p).toBeGreaterThan(st.p);
  });

  it('B-03: p bleibt in [.02, .99]', () => {
    let p = 0.03;
    for (let i = 0; i < 50; i++) p = bktStep({ ...base, p, ok: false, type: 'gap', anchorD: `d${i}` }).p;
    expect(p).toBeGreaterThanOrEqual(0.02);
    p = 0.97;
    for (let i = 0; i < 50; i++) p = bktStep({ ...base, p, ok: true, type: 'gap', anchorD: `d${i}` }).p;
    expect(p).toBeLessThanOrEqual(0.99);
  });

  it('B-04: ein Treffer im Multiple Choice (4 Optionen) wiegt weniger als eine getippte Lücke', () => {
    for (const p of [0.3, 0.5, 0.8]) {
      const mc = bktStep({ ...base, p, ok: true, type: 'mc', nOptions: 4 }).delta;
      const gap = bktStep({ ...base, p, ok: true, type: 'gap' }).delta;
      expect(mc).toBeLessThan(gap);
    }
  });

  it('B-05: Anzeige mit p = .9, p0 = .4 nach 45 Tagen = .584', () => {
    const now = berlin('2026-09-27', 10);
    expect(displayP(0.9, 0.4, now - 45 * DAY, now)).toBeCloseTo(0.584, 3);
    expect(displayP(0.3, 0.4, now - 45 * DAY, now)).toBe(0.3);
    expect(displayP(0.9, 0.4, null, now)).toBe(0.9);
  });

  it('B-06: due bei p = .5 +6 Tage, falsch +1, immer in [1, 21]', () => {
    const now = berlin('2026-09-27', 10);
    expect(nextDue(true, 0.5, now)).toBe(now + 6 * DAY);
    expect(nextDue(false, 0.9, now)).toBe(now + DAY);
    for (const p of [0, 0.2, 0.99, 1]) {
      const d = (nextDue(true, p, now) - now) / DAY;
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(21);
    }
  });

  it('Sicherheit 0–5 widerspricht nie der Quote der letzten Aufgaben', () => {
    expect(certainty(0.5, { n: 0 }).word).toBe(0);
    expect(certainty(0.9, { n: 2 }).word).toBe(1);
    expect(certainty(0.95, { n: 10, recent: [1, 0, 0, 1, 0, 1] }).word).toBeLessThanOrEqual(3);
    expect(certainty(0.3, { n: 10, recent: [1, 1, 1, 1, 1, 1, 1] }).word).toBeGreaterThanOrEqual(4);
    expect(certainty(0.99).dots).toBe(5);
  });
});
