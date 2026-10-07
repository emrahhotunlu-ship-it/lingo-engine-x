import { describe, expect, it } from 'vitest';
import { dowOf } from '../../src/domain/unit/planFor';
import { fixLimitFor, fixMinutes, FIX_LIMIT, SUNDAY_FIX } from '../../src/domain/unit/planFor';
import { buildUnitStored, PLAN_RV, planRvOf, unitGrammarArgs, unitPlanOf, unitStepArgs } from '../../src/domain/unit/plan';
import { ERRORS_PER_ROUND } from '../../src/domain/grammar/tasks';
import { AGAIN_OLD } from '../../src/domain/repair/unit';
import { readPlan } from '../../src/domain/plan/buildPlan';
import { fixAll, fixToday } from '../../src/domain/metrics';
import type { StoredPlan } from '../../src/domain/plan/types';

// Plan v2 (Lernplattform 2.0 §2.3, P4): Regelversion `u.rv`, Schritt-Argumente, Grenze von Schritt 4. Alle rv-2-Fälle übergeben `rv: 2`
// ausdrücklich; mit dem Standardwert `PLAN_RV = 1` ändert sich an keinem Plan etwas.

const MON = '2026-10-05';
const SAT = '2026-10-10';
const SUN = '2026-10-11';
const NOW = Date.parse(`${MON}T10:00:00+02:00`);
const review = { goal: 30, due: 25, fresh: 3, repairs: 0, sec: 470, overdue: 4 };

const plan = (day: string, o: { goalMin?: number; fixDue?: number; rv?: 1 | 2; comeback?: 'reduced' | 'restart' } = {}): StoredPlan =>
  buildUnitStored({ day, nowMs: NOW, week: null, goalMin: o.goalMin ?? 25, review, ...(o.fixDue !== undefined ? { fixDue: o.fixDue } : {}), ...(o.rv ? { rv: o.rv } : {}), ...(o.comeback ? { comeback: o.comeback } : {}) });
const kinds = (p: StoredPlan): string[] => p.u!.b.map(([, k]) => k);
const arg = (p: StoredPlan, block: number) => p.u!.b.find(([b]) => b === block)?.[3];

describe('Wochentage der Testtage', () => {
  it('Montag, Samstag, Sonntag', () => {
    expect([dowOf(MON), dowOf(SAT), dowOf(SUN)]).toEqual([1, 6, 7]);
  });
});

describe('rv: 1 bleibt die alte Regel (Rückweg); Standardwert PLAN_RV = 2', () => {
  it('der Schalter steht auf 2, ohne rv gilt Plan v2', () => {
    expect(PLAN_RV).toBe(2);
    expect(plan(MON, { fixDue: 12 }).u!.rv).toBe(2);
  });

  it('mit rv: 1: kein u.rv, keine Argumente, Sonntag ohne Schritt 4', () => {
    for (const day of [MON, SAT, SUN]) {
      for (const goalMin of [10, 15, 25]) {
        const p = plan(day, { rv: 1, goalMin, fixDue: 12 });
        expect(p.u!.rv).toBeUndefined();
        for (const b of p.u!.b) expect(b).toHaveLength(3);
      }
    }
    expect(kinds(plan(SUN, { rv: 1, fixDue: 12 }))).toEqual(['review', 'task.check']);
    expect(plan(SUN, { rv: 1, fixDue: 12 }).duty).toEqual(['review', 'ch:u-check']);
  });

  it('alte Regel: die Minuten von Schritt 4 sind der Grundwert (3 am vollen Tag)', () => {
    expect(plan(MON, { rv: 1, fixDue: 20 }).u!.b.find(([, k]) => k === 'again')?.[2]).toBe(3);
  });
});

describe('Plan rv 2 (ausdrücklich)', () => {
  it('voller Tag: Schritt 1 ohne Reparatur-Sätze, Grammatik ohne Fehlersätze, Schritt 4 mit Grenze', () => {
    const p = plan(MON, { rv: 2, fixDue: 8 });
    expect(p.v).toBe(1);
    expect(p.u!.v).toBe(1);
    expect(p.u!.rv).toBe(2);
    expect(kinds(p)).toEqual(['review', 'grammar', 'task.order', 'again']);
    expect(p.duty).toEqual(['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again']);
    expect(arg(p, 1)).toEqual({ repairs: 0 });
    expect(arg(p, 2)).toEqual({ errs: 0 });
    expect(arg(p, 5)).toEqual({ limit: 6 });
  });

  it('Grenze von Schritt 4: 5 bis 9 nach der Formel, Minuten = max(3, ceil(limit × 25 s / 60))', () => {
    const cases: Array<[number, number, number]> = [
      [1, 5, 3],
      [5, 5, 3],
      [6, 6, 3],
      [8, 6, 3],
      [9, 7, 3],
      [14, 8, 4],
      [17, 9, 4],
      [40, 9, 4],
    ];
    for (const [fixDue, limit, min] of cases) {
      const p = plan(MON, { rv: 2, fixDue });
      expect(arg(p, 5), `fixDue ${fixDue}`).toEqual({ limit });
      expect(p.u!.b.find(([b]) => b === 5)?.[2], `fixDue ${fixDue}`).toBe(min);
    }
    expect(fixLimitFor('full', 40)).toBe(FIX_LIMIT.max);
    expect(fixMinutes(3, 9)).toBe(4);
  });

  it('kurze Tage und Wiedereinstieg: Grenze höchstens 5, Ring 3', () => {
    for (const goalMin of [10, 15, 20]) {
      const p = plan(MON, { rv: 2, goalMin, fixDue: 30 });
      expect(kinds(p)).toEqual(['review', 'grammar', 'again']);
      expect(arg(p, 5)).toEqual({ limit: 5 });
      expect(p.duty).toHaveLength(3);
    }
    const reduced = plan(MON, { rv: 2, fixDue: 30, comeback: 'reduced' });
    expect(kinds(reduced)).toEqual(['review', 'grammar', 'again']);
    expect(arg(reduced, 5)).toEqual({ limit: 5 });
    const restart = plan(SUN, { rv: 2, fixDue: 30, comeback: 'restart' });
    expect(kinds(restart)).toEqual(['review', 'grammar', 'again']);
  });

  it('Sonntag: Wörter, Wochen-Check und – neu – Schritt 4 mit Grenze 3, aber nur bei fälligen Sätzen', () => {
    const p = plan(SUN, { rv: 2, fixDue: 12 });
    expect(kinds(p)).toEqual(['review', 'task.check', 'again']);
    expect(p.duty).toEqual(['review', 'ch:u-check', 'ch:u-again']);
    expect(arg(p, 5)).toEqual({ limit: SUNDAY_FIX });
    expect(p.u!.b.find(([b]) => b === 5)?.[2]).toBe(2);
    expect(kinds(plan(SUN, { rv: 2, fixDue: 0 }))).toEqual(['review', 'task.check']);
    expect(kinds(plan(SUN, { rv: 2 }))).toEqual(['review', 'task.check']);
  });

  it('nichts fällig: Schritt 4 entfällt in jeder Form', () => {
    for (const day of [MON, SAT]) for (const goalMin of [10, 15, 25]) expect(kinds(plan(day, { rv: 2, goalMin, fixDue: 0 }))).not.toContain('again');
  });

  it('Samstag wie voller Tag', () => {
    expect(kinds(plan(SAT, { rv: 2, fixDue: 9 }))).toEqual(['review', 'grammar', 'task.order', 'again']);
  });
});

describe('Lesen eines gespeicherten rv-2-Plans (Rundreise über die Datenbank)', () => {
  it('readPlan behält rv, Argumente, gt und ps; unitPlanOf nimmt Argumente und Minuten aus dem eingefrorenen Plan', () => {
    const stored = buildUnitStored({
      day: MON,
      nowMs: NOW,
      week: null,
      goalMin: 25,
      review,
      fixDue: 14,
      rv: 2,
      gt: { intro: 'conditionals', pats: ['cond.zero', 'cond.first'], topics: ['conditionals', 'passive'] },
      ps: { 'cond.zero': 0, 'cond.first': 1 },
    });
    const back = readPlan(JSON.parse(JSON.stringify(stored)), MON)!;
    expect(back.u).toEqual(stored.u);
    expect(back.u!.gt).toEqual({ intro: 'conditionals', pats: ['cond.zero', 'cond.first'], topics: ['conditionals', 'passive'] });
    expect(back.u!.ps).toEqual({ 'cond.zero': 0, 'cond.first': 1 });
    const up = unitPlanOf(back as StoredPlan & { u: NonNullable<StoredPlan['u']> });
    expect(up.rv).toBe(2);
    expect(up.duty).toEqual(back.duty);
    expect(up.blocks.find((b) => b.block === 5)?.args).toEqual({ limit: 8 });
    expect(up.blocks.find((b) => b.block === 5)?.min).toBe(4);
    expect(up.minutes).toBe(back.u!.min);
    expect(up.blocks.find((b) => b.block === 2)?.opts.n).toBe(6);
  });

  it('die Grenze bleibt eingefroren, auch wenn heute mehr Sätze fällig sind', () => {
    const stored = plan(MON, { rv: 2, fixDue: 6 });
    const up = unitPlanOf(stored as StoredPlan & { u: NonNullable<StoredPlan['u']> });
    expect(up.blocks.find((b) => b.block === 5)?.args).toEqual({ limit: 6 });
  });

  it('Sonntag mit Schritt 4 wird gelesen; ohne Schritt 4 bleibt er ohne', () => {
    for (const [fixDue, n] of [[5, 3], [0, 2]] as const) {
      const stored = plan(SUN, { rv: 2, fixDue });
      const up = unitPlanOf(stored as StoredPlan & { u: NonNullable<StoredPlan['u']> });
      expect(up.duty).toHaveLength(n);
      expect(up.blocks.map((b) => b.block)).toEqual(stored.u!.b.map(([b]) => b));
    }
  });

  it('fehlerhafte Argumente fallen weg, der Plan bleibt lesbar', () => {
    const stored = JSON.parse(JSON.stringify(plan(MON, { rv: 2, fixDue: 8 }))) as { u: { b: unknown[][]; gt?: unknown; ps?: unknown } };
    stored.u.b[0]![3] = { repairs: -4, errs: 'x', limit: 1e9 };
    stored.u.b[3]![3] = 'kaputt';
    stored.u.gt = { intro: 5, pats: [], topics: [] };
    stored.u.ps = { a: 9, b: 2 };
    const back = readPlan(stored, MON)!;
    expect(back.u!.b[0]).toHaveLength(3);
    expect(back.u!.b[3]).toHaveLength(3);
    expect(back.u!.gt).toBeUndefined();
    expect(back.u!.ps).toEqual({ b: 2 });
  });
});

describe('unitStepArgs und unitGrammarArgs', () => {
  it('rv 2 liest die gespeicherten Argumente', () => {
    const p = plan(MON, { rv: 2, fixDue: 8 });
    expect(unitStepArgs(p, 1)).toEqual({ repairs: 0 });
    expect(unitStepArgs(p, 2)).toEqual({ errs: 0 });
    expect(unitStepArgs(p, 5)).toEqual({ limit: 6 });
    expect(unitGrammarArgs(p)).toEqual({ n: 6, errs: 0 });
    expect(planRvOf(p)).toBe(2);
  });

  it('alte Regel: Reparatur-Sätze bis 3, drei Fehlersätze in der Grammatik, drei alte Sätze in Schritt 4', () => {
    const p = plan(MON, { rv: 1, fixDue: 8 });
    expect(planRvOf(p)).toBe(1);
    expect(unitStepArgs(p, 1)).toEqual({ repairs: 3 });
    expect(unitStepArgs(p, 2)).toEqual({ errs: ERRORS_PER_ROUND });
    expect(unitStepArgs(p, 5)).toEqual({ limit: AGAIN_OLD });
    expect(unitGrammarArgs(p)).toEqual({ n: 6, errs: ERRORS_PER_ROUND });
    expect(unitGrammarArgs(null)).toEqual({ n: 6, errs: ERRORS_PER_ROUND });
    expect(unitGrammarArgs(plan(MON, { rv: 1, goalMin: 15 })).n).toBe(4);
    expect(unitGrammarArgs(plan(MON, { goalMin: 10 })).n).toBe(3);
  });
});

describe('Zahl auf dem Knopf von Schritt 4', () => {
  it('fixToday = min(Grenze des Plans, fällig); fixAll = alle', () => {
    expect(fixToday({ plan: plan(MON, { rv: 2, fixDue: 8 }), fixDue: 8 })).toBe(6);
    expect(fixToday({ plan: plan(MON, { rv: 2, fixDue: 30 }), fixDue: 30 })).toBe(9);
    expect(fixToday({ plan: plan(MON, { rv: 2, fixDue: 3 }), fixDue: 3 })).toBe(3);
    expect(fixToday({ plan: plan(SUN, { rv: 2, fixDue: 30 }), fixDue: 30 })).toBe(3);
    expect(fixToday({ plan: plan(MON, { rv: 1, fixDue: 30 }), fixDue: 30 })).toBe(AGAIN_OLD);
    expect(fixToday({ plan: null, fixDue: 30 })).toBe(FIX_LIMIT.min);
    expect(fixToday({ plan: null, fixDue: 0 })).toBe(0);
    expect(fixAll(21)).toBe(21);
    expect(fixAll(-2)).toBe(0);
  });
});
