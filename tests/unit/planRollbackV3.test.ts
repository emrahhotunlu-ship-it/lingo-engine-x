import { describe, expect, it } from 'vitest';
import { readPlan } from '../../src/domain/plan/buildPlan';
import { forFocus } from '../../src/domain/plan/retire';
import { buildUnitStored, isUnitPlan } from '../../src/domain/unit/plan';
import type { Step3Fmt } from '../../src/domain/plan/types';
import { isUnitPlan8d8f3a3, readPlan8d8f3a3 } from './fixtures/plan8d8f3a3';
import { readUnitMetaLp2 } from './fixtures/planLp2';

// Rückweg Plan 3.0 (Lernplattform 3.0 §2.4, P23): Der Leser der Live-Version (8d8f3a3) und der LP2-Leser lesen JEDEN Plan mit den neuen Feldern
// (`u.c1`, `u.nx`, Format im 4. Tupel-Element) vollständig; `p.v`, `u.v` bleiben 1, `u.rv` bleibt 2.

const NOW = Date.parse('2026-10-05T10:00:00+02:00');
const review = { goal: 30, due: 25, fresh: 3, repairs: 0, sec: 470, overdue: 4 };
const GT = { intro: 'conditionals', pats: ['cond.zero'], topics: ['conditionals', 'passive', 'reported'] };
const base = { nowMs: NOW, week: null, goalMin: 25, review, fixDue: 12, rv: 2 as const, gt: GT, nx: 'fest250' };

const FORMS: Array<[string, string, number, Parameters<typeof buildUnitStored>[0]['step3'], 'check' | undefined]> = [
  ['Montag', '2026-10-05', 25, null, undefined],
  ['Dienstag ocl', '2026-10-06', 25, { mode: 'format', fmt: 'ocl' }, undefined],
  ['Mittwoch wf', '2026-10-07', 25, { mode: 'format', fmt: 'wf' }, undefined],
  ['Donnerstag kwt', '2026-10-08', 25, { mode: 'format', fmt: 'kwt' }, undefined],
  ['Freitag mcc', '2026-10-09', 25, { mode: 'format', fmt: 'mcc' }, undefined],
  ['Samstag Tempo', '2026-10-10', 25, { mode: 'tempo' }, undefined],
  ['letzter Samstag mit Check', '2026-10-31', 25, { mode: 'tempo' }, 'check'],
  ['Sonntag', '2026-10-11', 25, null, undefined],
  ['kurzer Tag', '2026-10-06', 15, { mode: 'format', fmt: 'ocl' }, undefined],
];

describe('Rückweg: alte Leser lesen Pläne 3.0 vollständig', () => {
  for (const [name, day, goalMin, step3, c1] of FORMS) {
    it(name, () => {
      const plan = buildUnitStored({ ...base, day, goalMin, ...(step3 ? { step3 } : {}), ...(c1 ? { c1 } : {}) });
      const stored = JSON.parse(JSON.stringify(plan)) as unknown;
      // Live-Version 8d8f3a3
      const old = readPlan8d8f3a3(stored, day);
      expect(old, 'alter Leser verwirft den Plan').not.toBeNull();
      expect(isUnitPlan8d8f3a3(old)).toBe(true);
      expect(old!.u!.b).toEqual(plan.u!.b.map(([b, k, m]) => [b, k, m]));
      expect(old!.u!.min).toBe(plan.u!.min);
      expect(old!.duty).toEqual(plan.duty);
      expect(old!.goal).toEqual(plan.goal);
      // LP2-Leser: dieselben Blöcke und Minuten, nur die neuen Felder sind ihm unbekannt.
      const lp2 = readUnitMetaLp2((stored as { u: unknown }).u)!;
      expect(lp2).not.toBeNull();
      expect(lp2.b.map(([b, k, m]) => [b, k, m])).toEqual(plan.u!.b.map(([b, k, m]) => [b, k, m]));
      expect(lp2.rv).toBe(2);
      expect(lp2.min).toBe(plan.u!.min);
      expect(lp2.shape).toBe(plan.u!.shape);
      // Versionen bleiben 1, Regelversion 2.
      expect(plan.v).toBe(1);
      expect(plan.u!.v).toBe(1);
      expect(plan.u!.rv).toBe(2);
      // Der neue Leser gibt den Plan samt neuer Felder zurück; Heute zeigt die Tageskarte.
      const now = readPlan(stored, day)!;
      expect(now.u).toEqual(plan.u);
      expect(isUnitPlan(forFocus(now))).toBe(true);
    });
  }

  it('Format und Check stehen nie in Pflicht, Mengen oder Minuten: der Plan ohne Format ist Punkt für Punkt gleich bis auf die neuen Felder', () => {
    for (const fmt of ['ocl', 'wf', 'kwt', 'mcc'] as Step3Fmt[]) {
      const a = buildUnitStored({ ...base, day: '2026-10-06' });
      const b = buildUnitStored({ ...base, day: '2026-10-06', step3: { mode: 'format', fmt } });
      expect(b.duty).toEqual(a.duty);
      expect(b.goal).toEqual(a.goal);
      expect(b.u!.min).toBe(a.u!.min);
      expect(b.u!.b.map(([n, k, m]) => [n, k, m])).toEqual(a.u!.b.map(([n, k, m]) => [n, k, m]));
    }
  });
});
