import { describe, expect, it } from 'vitest';
import { c1Schema } from '../../src/data/schemas';
import { APP_DOC_PATHS, schemaForPath } from '../../src/data/paths';
import { C1_LIMITS, c1Readable, c1Update, compactC1, compactProd, emptyC1, markBad, readC1, weekStart, type C1Doc } from '../../src/domain/c1/c1doc';
import { jsonBytes } from '../../src/domain/monthDoc';

// `app/c1` (P31): nur ergänzen, nie löschen, nie in ein ungültiges Dokument, nur bei Änderung, Größe < 30 KB.

const TODAY = '2026-10-07';

describe('app/c1 Schema und Register', () => {
  it('ist ein bekannter Pfad mit Schema, das leere und volle Dokumente liest', () => {
    expect(APP_DOC_PATHS).toContain('app/c1');
    expect(schemaForPath('app/c1')).toBe(c1Schema);
    expect(c1Schema.safeParse({ v: 1, checks: [], gates: [], prod: [], bad: [] }).success).toBe(true);
    expect(c1Schema.safeParse({ v: 1, future: { x: 1 } }).success).toBe(true);
    expect(c1Schema.safeParse({ v: 1, bad: [1, 2] }).success).toBe(false);
  });
  it('c1Readable: fehlt = ja, unerwarteter Aufbau oder neuere Fassung = nein', () => {
    expect(c1Readable(undefined)).toBe(true);
    expect(c1Readable({ v: 1 })).toBe(true);
    expect(c1Readable({ v: 2 })).toBe(false);
    expect(c1Readable({ v: 1, checks: 'x' })).toBe(false);
    expect(c1Readable([])).toBe(false);
  });
});

describe('c1Update', () => {
  it('legt das Dokument an, wenn es fehlt und etwas zu schreiben ist', () => {
    const op = c1Update(undefined, (d) => markBad(d, 'a1'), TODAY);
    expect(op).toEqual({ set: { v: 1, checks: [], gates: [], prod: [], bad: ['a1'] } });
  });
  it('schreibt nichts, wenn sich nichts ändert (auch nicht das leere Dokument)', () => {
    expect(c1Update(undefined, () => emptyC1(), TODAY)).toBeNull();
    expect(c1Update({ v: 1, bad: ['a1'] }, (d) => markBad(d, 'a1'), TODAY)).toBeNull();
    expect(c1Update({ v: 1, bad: ['a1'] }, () => null, TODAY)).toBeNull();
  });
  it('ergänzt nur die geänderten Felder; fremde Felder und der Rest bleiben unberührt', () => {
    const cur = { v: 1, bad: ['a1'], zukunft: { x: 1 }, checks: [{ d: '2026-09-30', f: 'A', inp: 'desk', p: [5, 5, 5, 3], pts: 26, max: 36 }] };
    const op = c1Update(cur, (d) => markBad(d, 'a2'), TODAY);
    expect(op).toEqual({ update: { bad: ['a1', 'a2'] } });
  });
  it('fasst ein Dokument mit unerwartetem Aufbau nie an', () => {
    expect(c1Update({ v: 1, checks: 'kaputt' }, (d) => markBad(d, 'x'), TODAY)).toBeNull();
    expect(c1Update({ v: 7 }, (d) => markBad(d, 'x'), TODAY)).toBeNull();
  });
  it('nichts gelöscht: ein Eintrag, den die Änderung nicht berührt, bleibt mit allen Feldern erhalten', () => {
    const gate = { d: '2026-09-01', ch: 1, g: [17, 20], w: [7, 8], ok: true, extra: 'bleibt' };
    const op = c1Update({ v: 1, gates: [gate] }, (d) => ({ ...d, gates: [...d.gates, { d: '2026-10-01', ch: 2, g: [10, 20], w: [5, 8], ok: false }] }), TODAY);
    expect(op).toMatchObject({ update: { gates: [gate, { ch: 2 }] } });
  });
  it('schreibt nicht, wenn das Ergebnis über 30 KB läge', () => {
    const big = 'x'.repeat(2000);
    const op = c1Update(undefined, (d) => ({ ...d, bad: Array.from({ length: 20 }, (_, i) => `${big}${i}`) }), TODAY);
    expect(op).toBeNull();
  });
});

describe('Höchstwerte und Verdichtung', () => {
  it('kappt checks, gates und bad auf ihre Höchstwerte und behält die neuesten', () => {
    const doc: C1Doc = {
      ...emptyC1(),
      checks: Array.from({ length: 30 }, (_, i) => ({ d: `2026-09-${String(i + 1).padStart(2, '0')}`, f: 'A', inp: 'desk' as const, p: [1, 1, 1, 1] as [number, number, number, number], pts: 4, max: 36 as const })),
      gates: Array.from({ length: 40 }, (_, i) => ({ d: '2026-09-01', ch: (i % 7) + 1, g: [1, 2] as [number, number], w: [1, 2] as [number, number], ok: true })),
      bad: Array.from({ length: 400 }, (_, i) => `id${i}`),
    };
    const c = compactC1(doc, TODAY);
    expect(c.checks).toHaveLength(C1_LIMITS.checks);
    expect(c.checks.at(-1)?.d).toBe('2026-09-30');
    expect(c.gates).toHaveLength(C1_LIMITS.gates);
    expect(c.bad).toHaveLength(C1_LIMITS.bad);
    expect(c.bad.at(-1)).toBe('id399');
  });
  it('verdichtet prod älter als 8 Wochen zu Wochensummen, Summe bleibt gleich', () => {
    const prod = [
      { d: '2026-07-06', s: 'mail' as const, w: 100, e: 2 },
      { d: '2026-07-08', s: 'mail' as const, w: 50, e: 1 },
      { d: '2026-07-08', s: 'talk' as const, w: 30, e: 0 },
      { d: '2026-10-05', s: 'mail' as const, w: 80, e: 3 },
    ];
    const c = compactProd(prod, TODAY);
    expect(c).toEqual([
      { d: '2026-07-06', s: 'mail', w: 150, e: 3, wk: true },
      { d: '2026-07-06', s: 'talk', w: 30, e: 0, wk: true },
      { d: '2026-10-05', s: 'mail', w: 80, e: 3 },
    ]);
    expect(compactProd(c, TODAY)).toEqual(c);
    expect(weekStart('2026-07-08')).toBe('2026-07-06');
  });
  it('Höchstwerte zusammen bleiben unter 30 KB', () => {
    const doc: C1Doc = {
      v: 1,
      place: { d: TODAY, se: 0.38, n: 22, skip: Array.from({ length: 12 }, (_, i) => `topic-number-${i}`), it: Array.from({ length: 22 }, (_, i) => [`unit-task-id-${i}`, 1] as [string, 0 | 1]) },
      checks: Array.from({ length: C1_LIMITS.checks }, () => ({
        d: TODAY,
        f: 'L',
        inp: 'desk' as const,
        p: [8, 8, 8, 6] as [number, number, number, number],
        pts: 36,
        max: 36 as const,
        fc: { from: '2027-10', to: '2027-12', late: '2028-02' },
        m: Array.from({ length: 2 }, (_, k) => [`pattern-id-${k}`, 3] as [string, number]),
      })),
      gates: Array.from({ length: C1_LIMITS.gates }, (_, i) => ({ d: TODAY, ch: (i % 7) + 1, g: [20, 20] as [number, number], w: [8, 8] as [number, number], ok: true })),
      prod: Array.from({ length: C1_LIMITS.prod }, () => ({ d: TODAY, s: 'clinic' as const, w: 1234, e: 12 })),
      bad: Array.from({ length: C1_LIMITS.bad }, (_, i) => `c1x-mcc-pattern-long-identifier-${i}`),
    };
    expect(jsonBytes(doc)).toBeLessThan(C1_LIMITS.maxBytes);
    expect(c1Schema.safeParse(doc).success).toBe(true);
    expect(readC1(doc)).toEqual(doc);
  });
});
