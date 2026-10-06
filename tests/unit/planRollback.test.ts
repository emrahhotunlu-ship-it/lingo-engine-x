import { describe, expect, it } from 'vitest';
import { readPlan } from '../../src/domain/plan/buildPlan';
import { forFocus } from '../../src/domain/plan/retire';
import { buildUnitStored, isUnitPlan } from '../../src/domain/unit/plan';
import { isUnitPlan8d8f3a3, readPlan8d8f3a3 } from './fixtures/plan8d8f3a3';

// Rückweg (Lernplattform 2.0 §2.3, §8 Regel 7): Der Leser der Live-Version 67 (Commit 8d8f3a3) liest JEDEN Plan, den der neue Code schreibt,
// vollständig – auch rv 2, auch den Sonntagsplan mit Schritt 4. So reißt beim Zurückstellen der Live-Version weder die Tageskarte (`today-legacy`)
// noch die Serie. Die Planversion `p.v` und `u.v` bleiben dafür immer 1.

const NOW = Date.parse('2026-10-05T10:00:00+02:00');
const review = { goal: 30, due: 25, fresh: 3, repairs: 0, sec: 470, overdue: 4 };
const GT = { intro: 'conditionals', pats: ['cond.zero'], topics: ['conditionals', 'passive', 'reported'] };
const PS = { 'cond.zero': 0 as const, 'cond.first': 2 as const };

const FORMS: Array<[string, string, number, 'reduced' | 'restart' | undefined]> = [
  ['voller Tag', '2026-10-05', 25, undefined],
  ['Samstag', '2026-10-10', 25, undefined],
  ['Sonntag', '2026-10-11', 25, undefined],
  ['kurzer Tag', '2026-10-06', 15, undefined],
  ['kleiner Tag', '2026-10-06', 10, undefined],
  ['Wiedereinstieg', '2026-10-06', 25, 'reduced'],
  ['Neustart-Woche', '2026-10-06', 25, 'restart'],
];

describe('Rückweg: der alte Leser (8d8f3a3) liest neue Pläne vollständig', () => {
  for (const [name, day, goalMin, comeback] of FORMS) {
    for (const rv of [1, 2] as const) {
      it(`${name}, rv ${rv}`, () => {
        const plan = buildUnitStored({ day, nowMs: NOW, week: null, goalMin, review, fixDue: 12, rv, gt: GT, ps: PS, ...(comeback ? { comeback } : {}) });
        const stored = JSON.parse(JSON.stringify(plan)) as unknown;
        const old = readPlan8d8f3a3(stored, day);
        expect(old, 'alter Leser verwirft den Plan').not.toBeNull();
        expect(isUnitPlan8d8f3a3(old)).toBe(true);
        // Dieselben Blöcke, Minuten, Pflichtpunkte und Mengen wie im neuen Plan.
        expect(old!.u!.b).toEqual(plan.u!.b.map(([b, k, m]) => [b, k, m]));
        expect(old!.u!.min).toBe(plan.u!.min);
        expect(old!.u!.shape).toBe(plan.u!.shape);
        expect(old!.duty).toEqual(plan.duty);
        expect(old!.goal).toEqual(plan.goal);
        expect(old!.v).toBe(1);
        expect(old!.u!.v).toBe(1);
        // Der neue Leser gibt denselben Plan zurück, samt neuer Felder.
        const now = readPlan(stored, day)!;
        expect(now.u).toEqual(plan.u);
        expect(isUnitPlan(now)).toBe(true);
        // Heute zeigt die Tageskarte, nie `today-legacy`: `today-legacy` erscheint nur ohne `u` (TodayScreen: `!unit && plan`).
        expect(isUnitPlan(forFocus(now))).toBe(true);
      });
    }
  }

  it('Sonntagsplan mit Schritt 4 hat drei Pflichtpunkte, der alte Leser kennt alle', () => {
    const plan = buildUnitStored({ day: '2026-10-11', nowMs: NOW, week: null, goalMin: 25, review, fixDue: 12, rv: 2 });
    const old = readPlan8d8f3a3(JSON.parse(JSON.stringify(plan)), '2026-10-11')!;
    expect(old.duty).toEqual(['review', 'ch:u-check', 'ch:u-again']);
    expect(old.u!.b.map(([b]) => b)).toEqual([1, 3, 5]);
  });

  it('ein Plan der alten Regel liest der alte und der neue Leser gleich', () => {
    const plan = buildUnitStored({ day: '2026-10-05', nowMs: NOW, week: null, goalMin: 25, review, fixDue: 12 });
    const stored = JSON.parse(JSON.stringify(plan)) as unknown;
    expect(readPlan(stored, '2026-10-05')!.u).toEqual(readPlan8d8f3a3(stored, '2026-10-05')!.u);
  });

  it('ohne u.rv und ohne 4. Element ist das gespeicherte Dokument byte-gleich zu dem der alten Regel (nur gt/ps sind neu)', () => {
    const plan = buildUnitStored({ day: '2026-10-05', nowMs: NOW, week: null, goalMin: 25, review, fixDue: 12 });
    expect(Object.keys(plan.u!).sort()).toEqual(['b', 'goalMin', 'min', 'ov', 'shape', 'sure', 'theme', 'v'].filter((k) => k in plan.u!).sort());
    expect(plan.u!.rv).toBeUndefined();
  });
});
