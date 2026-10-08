import { describe, expect, it } from 'vitest';
import type { C1Check, C1Doc, C1Prod } from '../../src/domain/c1/c1doc';
import { C1_GOALS, CRITERIA, c1Criteria, type CriteriaInput } from '../../src/domain/c1/criteria';
import type { ChapterStateResult } from '../../src/domain/c1/state';
import type { C1Item } from '../../src/domain/c1x/types';
import { addDays } from '../../src/domain/date';
import { deskChecks, k1Measure, k2Measure, k3Measure, k6Measure, logEntriesOf, programStart, slopePerDay, type K6Measure } from '../../src/domain/metrics/c1';
import type { PatternsDoc } from '../../src/domain/patterns/patterns';
import { recentWeeks } from '../../src/domain/patterns/patterns';

// Die sieben Kriterien (Lernplattform 3.0 §4.5, P44): eine Quelle je Zahl, Zustandswörter, „C1-Etappe“ erst bei K1–K7.

const TODAY = '2026-10-08';
const doc = (over: Partial<C1Doc> = {}): C1Doc => ({ v: 1, checks: [], gates: [], prod: [], bad: [], ...over });
const check = (d: string, p: [number, number, number, number], inp: 'desk' | 'touch' = 'desk'): C1Check => ({ d, f: 'A', inp, p, pts: p[0] + p[1] + p[2] + p[3], max: 36 });
/** Produktion: `n` Einträge über 4 Wochen bis `end`, Fehlerquote `rate` je 100 Wörter. */
const prod = (end: string, rate: number, n = 8): C1Prod[] => Array.from({ length: n }, (_, k) => ({ d: addDays(end, -(k % 4) * 7), s: 'mail', w: 100, e: rate }));

const allMet = (): CriteriaInput => {
  const c1 = doc({
    gates: [1, 2, 3, 4, 5, 6, 7].map((ch) => ({ d: '2026-09-01', ch, g: [18, 20], w: [8, 8], ok: true })),
    checks: [check('2026-08-29', [6, 6, 6, 8]), check('2026-09-26', [6, 6, 6, 9])],
    prod: [...prod('2026-08-29', 2), ...prod('2026-09-26', 2), ...prod(TODAY, 2)],
  });
  return {
    today: TODAY,
    c1,
    k1: { gates: 7, safe: 85, total: 100, free: { ok: 40, n: 50 }, newSafe56: 5 },
    k2: { relapses: 1, prev: 4, traps: 6 },
    k3: { view: { state: 'valid', t: 1, passive: 4200, lo: 3800, hi: 4600 }, series: [] },
    k4: { fest: 800, learned: 1200, retention: { rate: 0.9, n: 80, enough: true, band: 'in' }, growth: { delta: 40, days: 56 } },
    k6: { n: 30, ok: 26, clean: 10, cleanOk: 9, older: 0.8, recent: 0.9 },
  };
};

describe('Zustandswörter und „C1-Etappe“', () => {
  it('alle sieben erfüllt → Etappe', () => {
    const r = c1Criteria(allMet());
    expect(r.list.map((c) => c.id)).toEqual([...CRITERIA]);
    expect(r.list.map((c) => c.state)).toEqual(['met', 'met', 'met', 'met', 'met', 'met', 'met']);
    expect(r.stage).toBe(true);
    expect(r.met).toBe(7);
  });
  it('ein offenes Kriterium → keine Etappe', () => {
    const i = allMet();
    i.k4 = { ...i.k4, fest: 749 };
    const r = c1Criteria(i);
    expect(r.stage).toBe(false);
    expect(r.met).toBe(6);
  });
  it('auf Kurs = ≥ 50 % des Wegs UND Trend nach vorn; sonst noch offen', () => {
    const i = allMet();
    i.k4 = { ...i.k4, fest: 400, growth: { delta: 30, days: 56 } };
    expect(c1Criteria(i).list[3]?.state).toBe('course');
    i.k4 = { ...i.k4, fest: 400, growth: { delta: 0, days: 56 } };
    expect(c1Criteria(i).list[3]?.state).toBe('open');
    i.k4 = { ...i.k4, fest: 300, growth: { delta: 30, days: 56 } };
    expect(c1Criteria(i).list[3]?.state).toBe('open');
  });
  it('„weniger ist besser“ (K2): höchstens doppelte Schwelle und weniger als zuvor = auf Kurs', () => {
    const i = allMet();
    i.k2 = { relapses: 4, prev: 7, traps: 6 };
    expect(c1Criteria(i).list[1]?.state).toBe('course');
    i.k2 = { relapses: 5, prev: 7, traps: 6 };
    expect(c1Criteria(i).list[1]?.state).toBe('open');
    i.k2 = { relapses: null, prev: null, traps: 0 };
    expect(c1Criteria(i).list[1]?.state).toBe('few');
  });
  it('Kriteriumszeile = Messwert (Invariante „eine Quelle“)', () => {
    const i = allMet();
    const r = c1Criteria(i);
    expect(r.list[3]?.ev).toMatchObject({ fest: i.k4.fest, goal: C1_GOALS.k4.fest, delta: i.k4.growth?.delta });
    expect(r.list[0]?.ev).toMatchObject({ gates: i.k1.gates, safe: i.k1.safe, total: i.k1.total, freeOk: 40, freeN: 50 });
    expect(r.list[5]?.ev).toMatchObject({ ok: 26, n: 30 });
  });
});

describe('K1 Grammatik-Weg', () => {
  const chapters = { current: 1, chapters: [{ patSafe: 10, patTotal: 20 }, { patSafe: 4, patTotal: 10 }] } as unknown as ChapterStateResult;
  it('zählt bestandene Kapitel (je Kapitel einmal), sichere Muster, freie C1-Aufgaben und neu sichere Muster', () => {
    const c1 = doc({ gates: [{ d: '2026-09-01', ch: 1, g: [10, 20], w: [0, 0], ok: false }, { d: '2026-09-08', ch: 1, g: [18, 20], w: [8, 8], ok: true }, { d: '2026-09-15', ch: 1, g: [18, 20], w: [8, 8], ok: true }] });
    const grammar = new Map([
      ['t1', { pats: { a: { n: 4, s: '2026-09-01' }, b: { n: 4, s: '2026-07-01' }, c: { n: 1 } } }],
      ['t2', { pats: { d: { n: 4, s: TODAY } } }],
    ]);
    const entries = logEntriesOf([{ entries: [{ c1k: 'ocl', free: true, ok: true }, { c1k: 'kwt', free: true, ok: false }, { c1k: 'mcc', ok: true }, { k: 'v', ok: true }] }]);
    expect(k1Measure({ c1, chapters, grammar, entries, today: TODAY })).toEqual({ gates: 1, safe: 14, total: 30, free: { ok: 1, n: 2 }, newSafe56: 2 });
    expect(k1Measure({ c1, chapters, grammar, entries: null, today: TODAY }).free).toBeNull();
  });
  it('unter 20 freien Antworten nie erreicht', () => {
    const i = allMet();
    i.k1 = { ...i.k1, free: { ok: 19, n: 19 } };
    expect(c1Criteria(i).list[0]?.state).not.toBe('met');
  });
});

describe('K2 Deutsch-Fallen', () => {
  it('Rückfälle der letzten 4 Wochen, Vergleich mit den 4 Wochen davor', () => {
    const [w1, , , w4] = recentWeeks(TODAY, 4);
    const [p1] = recentWeeks(addDays(TODAY, -28), 4);
    const patterns = { items: [{ id: 'since' }, { id: 'make-do' }], history: [{ w: w1, counts: { since: 1 } }, { w: w4, counts: { since: 1, 'make-do': 1, other: 9 } }, { w: p1, counts: { since: 3 } }] } as unknown as PatternsDoc;
    expect(k2Measure(patterns, TODAY)).toEqual({ relapses: 3, prev: 3, traps: 2 });
    expect(k2Measure(null, TODAY)).toEqual({ relapses: null, prev: null, traps: 0 });
  });
});

describe('K3 Wörter verstehen', () => {
  const now = Date.parse('2026-10-08T12:00:00+02:00');
  it('Test älter als 90 Tage → zu wenig Daten; Untergrenze unter 3.600 → nicht erreicht', () => {
    const old = { vtests: [{ t: now - 100 * 86_400_000, passive: 4500, pLo: 4000, pHi: 5000 }] };
    const i = allMet();
    i.k3 = k3Measure(old, now, TODAY);
    expect(c1Criteria(i).list[2]?.state).toBe('few');
    i.k3 = k3Measure({ vtests: [{ t: now - 86_400_000, passive: 4100, pLo: 3500, pHi: 4700 }] }, now, TODAY);
    expect(c1Criteria(i).list[2]?.state).not.toBe('met');
    i.k3 = k3Measure({ vtests: [{ t: now - 86_400_000, passive: 4100, pLo: 3700, pHi: 4500 }] }, now, TODAY);
    expect(c1Criteria(i).list[2]?.state).toBe('met');
  });
});

describe('K5 Prüfungsformate', () => {
  it('Handy-Checks zählen nie für K5', () => {
    const i = allMet();
    i.c1 = { ...i.c1, checks: [check('2026-08-29', [7, 7, 7, 10], 'touch'), check('2026-09-26', [7, 7, 7, 10], 'touch')] };
    expect(deskChecks(i.c1.checks)).toEqual([]);
    expect(c1Criteria(i).list[4]?.state).toBe('few');
  });
  it('≥ 60 % in zwei Laptop-Checks hintereinander und kein Teil unter 40 %', () => {
    const i = allMet();
    i.c1 = { ...i.c1, checks: [check('2026-08-29', [8, 8, 8, 0]), check('2026-09-26', [6, 6, 6, 9])] };
    expect(c1Criteria(i).list[4]?.state).not.toBe('met'); // Teil 4 bei 0 %
    i.c1 = { ...i.c1, checks: [check('2026-09-26', [6, 6, 6, 9])] };
    expect(c1Criteria(i).list[4]?.state).not.toBe('met'); // nur ein Check
    i.c1 = { ...i.c1, checks: [check('2026-08-29', [6, 6, 6, 4]), check('2026-09-26', [6, 6, 6, 5])] };
    expect(c1Criteria(i).list[4]?.state).toBe('course'); // 23/36 < 60 %, aber steigend
  });
});

describe('K6 Selbstkorrektur', () => {
  const items: Record<string, C1Item> = {
    e1: { kind: 'err', id: 'e1', pat: 'p', bad: { span: 'x', fix: ['y'] } } as unknown as C1Item,
    c1: { kind: 'err', id: 'c1', pat: 'p', bad: null } as unknown as C1Item,
  };
  const itemOf = (id: string) => items[id] ?? null;
  const now = Date.parse('2026-10-08T12:00:00+02:00');
  it('nur Sätze mit Fehler und getippter Korrektur; Fehlalarm aus fehlerfreien Sätzen getrennt', () => {
    const entries = logEntriesOf([
      {
        entries: [
          { c1k: 'err', cid: 'e1', free: true, pts: [2, 2], t: now },
          { c1k: 'err', cid: 'e1', free: true, pts: [1, 2], t: now - 20 * 86_400_000 },
          { c1k: 'err', cid: 'e1', pts: [2, 2], t: now }, // Chips: zählt nicht
          { c1k: 'err', cid: 'c1', pts: [2, 2], t: now },
          { c1k: 'err', cid: 'c1', free: true, pts: [0, 2], t: now },
          { c1k: 'err', cid: 'zz', free: true, pts: [2, 2], t: now }, // unbekannt
        ],
      },
    ]);
    const m = k6Measure(entries, itemOf, now);
    expect(m).toEqual({ n: 2, ok: 1, clean: 2, cleanOk: 1, older: 0, recent: 1 });
  });
  it('unter 20 Antworten → zu wenig Daten; Fehlalarm-Untergrenze verfehlt → nicht erreicht', () => {
    const i = allMet();
    i.k6 = { n: 19, ok: 19, clean: 10, cleanOk: 10, older: 1, recent: 1 };
    expect(c1Criteria(i).list[5]?.state).toBe('few');
    i.k6 = { n: 30, ok: 28, clean: 10, cleanOk: 7, older: 1, recent: 1 } satisfies K6Measure;
    expect(c1Criteria(i).list[5]?.state).not.toBe('met');
    i.k6 = null;
    expect(c1Criteria(i).list[5]?.state).toBe('few');
  });
});

describe('K7 Genauigkeit in eigener Produktion', () => {
  it('599 Wörter → zu wenig Daten', () => {
    const i = allMet();
    i.c1 = { ...i.c1, prod: [{ d: TODAY, s: 'mail', w: 599, e: 1 }] };
    expect(c1Criteria(i).list[6]).toMatchObject({ state: 'few', ev: { words: 599 } });
  });
  it('erfüllt erst, wenn die Schwelle an zwei Check-Tagen hintereinander gilt', () => {
    const i = allMet();
    i.c1 = { ...i.c1, prod: [...prod('2026-08-29', 5), ...prod('2026-09-26', 2), ...prod(TODAY, 2)] };
    const r = c1Criteria(i);
    expect(r.k7Days.map((x) => x.r.rate)).toEqual([5, 3.2]); // 8-Wochen-Fenster je Check-Tag
    expect(r.list[6]?.state).not.toBe('met');
  });
  it('Handy-Checks zählen als Check-Tag für K7 (K7 misst das Schreiben, nicht den Check)', () => {
    const i = allMet();
    i.c1 = { ...i.c1, checks: [check('2026-08-29', [6, 6, 6, 8], 'touch'), check('2026-09-26', [6, 6, 6, 8], 'touch')] };
    expect(c1Criteria(i).list[6]?.state).toBe('met');
  });
});

describe('Hilfen', () => {
  it('Programmstart = frühester Tag aus Einstufung, Checks und Prüfungen', () => {
    expect(programStart(doc())).toBeNull();
    expect(programStart(doc({ place: { d: '2026-09-10', se: 1, n: 1, skip: [] }, checks: [check('2026-09-01', [1, 1, 1, 1])] }))).toBe('2026-09-01');
  });
  it('Steigung je Tag nach kleinsten Quadraten', () => {
    expect(slopePerDay([['2026-01-01', 1]])).toBeNull();
    expect(slopePerDay([['2026-01-01', 1], ['2026-01-11', 2]])).toBeCloseTo(0.1);
  });
});
