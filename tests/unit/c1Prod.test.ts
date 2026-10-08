import { describe, expect, it } from 'vitest';
import { C1_LIMITS, c1Update, readC1 } from '../../src/domain/c1/c1doc';
import { addDays } from '../../src/domain/date';
import { PROD_MIN, addProdTo, prodEntry, prodRate } from '../../src/domain/c1/prod';
import type { C1Prod } from '../../src/domain/c1/c1doc';

// `app/c1.prod[]` (P44): der eine Schreiber, Mindestmengen für K7, Verdichtung und Kappung.

const TODAY = '2026-10-08';

/** n Einträge über `weeks` Wochen verteilt (ab heute rückwärts), je `w` Wörter und `e` Fehler. */
function spread(n: number, weeks: number, w: number, e: number, end = TODAY): C1Prod[] {
  return Array.from({ length: n }, (_, k) => ({ d: addDays(end, -((k % weeks) * 7)), s: 'mail' as const, w, e }));
}

describe('prodEntry', () => {
  it('lehnt Paste, Übersetzer und ungültige Werte ab', () => {
    expect(prodEntry({ d: TODAY, s: 'mail', w: 120, e: 2, pasted: true })).toBeNull();
    expect(prodEntry({ d: TODAY, s: 'clinic', w: 120, e: 2, translated: true })).toBeNull();
    expect(prodEntry({ d: 'gestern', s: 'mail', w: 120, e: 2 })).toBeNull();
    expect(prodEntry({ d: TODAY, s: 'chat' as never, w: 120, e: 2 })).toBeNull();
    expect(prodEntry({ d: TODAY, s: 'mail', w: 0, e: 0 })).toBeNull();
    expect(prodEntry({ d: TODAY, s: 'mail', w: 10, e: 11 })).toBeNull();
    expect(prodEntry({ d: TODAY, s: 'mail', w: Number.NaN, e: 1 })).toBeNull();
  });
  it('Mittelwert zweier Zählungen: halbe Fehler bleiben, sonst auf 0,5 gerundet; nur Fehler, keine Stilzahl', () => {
    expect(prodEntry({ d: TODAY, s: 'talk', w: 80.4, e: 2.5 })).toEqual({ d: TODAY, s: 'talk', w: 80, e: 2.5 });
    expect(prodEntry({ d: TODAY, s: 'talk', w: 80, e: 1.3 })).toEqual({ d: TODAY, s: 'talk', w: 80, e: 1.5 });
    expect(Object.keys(prodEntry({ d: TODAY, s: 'mail', w: 50, e: 1 }) ?? {}).sort()).toEqual(['d', 'e', 's', 'w']);
  });
});

describe('prodRate (K7)', () => {
  it('599 Wörter → zu wenig Daten, 600 Wörter mit 6 Einträgen aus 3 Wochen → Zahl', () => {
    const few = [...spread(5, 3, 100, 2), { d: TODAY, s: 'mail' as const, w: 99, e: 1 }];
    expect(prodRate(few, TODAY)).toMatchObject({ state: 'few', words: 599 });
    const ok = spread(6, 3, 100, 2);
    expect(prodRate(ok, TODAY)).toMatchObject({ state: 'ok', words: 600, errors: 12, entries: 6, weeks: 3, rate: 2 });
  });
  it('braucht 6 Einträge und 3 Wochen', () => {
    expect(prodRate(spread(5, 3, 200, 2), TODAY).state).toBe('few');
    expect(prodRate(spread(8, 2, 200, 2), TODAY).state).toBe('few');
  });
  it('zählt nur die letzten 8 Wochen bis zum Bezugstag (auch für vergangene Tage)', () => {
    const old = { d: addDays(TODAY, -60), s: 'mail' as const, w: 1000, e: 100 };
    const list = [...spread(6, 3, 100, 3), old];
    expect(prodRate(list, TODAY).words).toBe(600);
    // Bezugstag in der Vergangenheit: der alte Eintrag zählt, die späteren nicht.
    expect(prodRate(list, addDays(TODAY, -50))).toMatchObject({ words: 1000, entries: 1, state: 'few' });
    // Zukunft: nichts aus der Zukunft des Bezugstags.
    expect(prodRate(list, addDays(TODAY, -61)).words).toBe(0);
  });
  it('gleiche Daten → gleiche Zahl (rein)', () => {
    const list = spread(9, 4, 150, 4);
    expect(prodRate(list, TODAY)).toEqual(prodRate([...list], TODAY));
  });
});

describe('Kappung und Verdichtung (`prod` ≤ 150)', () => {
  it('über 150 Einträge in 8 Wochen: die ältesten fallen weg, nie mehr als 150', () => {
    let cur: Record<string, unknown> | undefined = undefined;
    for (let k = 0; k < 160; k++) {
      const op = c1Update(cur, (doc) => addProdTo(doc, { d: addDays(TODAY, -(k % 50)), s: 'clinic', w: 40 + Math.floor(k / 50), e: 1 }), TODAY);
      expect(op).not.toBeNull();
      cur = op && 'set' in op ? op.set : { ...(cur ?? {}), ...(op as { update: Record<string, unknown> }).update };
    }
    expect(readC1(cur).prod.length).toBe(C1_LIMITS.prod);
  });
  it('Einträge älter als 8 Wochen werden zu Wochensummen (Wörter und Fehler bleiben erhalten)', () => {
    const old = Array.from({ length: 10 }, (_, k) => ({ d: addDays('2026-07-06', k % 5), s: 'mail' as const, w: 50, e: 1 }));
    const op = c1Update({ v: 1, prod: old }, (doc) => addProdTo(doc, { d: TODAY, s: 'mail', w: 100, e: 2 }), TODAY);
    const prod = readC1(op && 'update' in op ? { v: 1, ...op.update } : undefined).prod;
    const sums = prod.filter((p) => p.wk);
    expect(sums.length).toBe(1);
    expect(sums[0]).toMatchObject({ w: 500, e: 10, wk: true });
    expect(prod.reduce((s, p) => s + p.w, 0)).toBe(600);
  });
  it('ein ungültiger Eintrag schreibt nichts', () => {
    expect(c1Update(undefined, (doc) => addProdTo(doc, { d: TODAY, s: 'mail', w: 100, e: 1, pasted: true }), TODAY)).toBeNull();
  });
  it('Mindestmengen stehen als Konstanten fest', () => {
    expect(PROD_MIN).toEqual({ words: 600, entries: 6, weeks: 3 });
  });
});
