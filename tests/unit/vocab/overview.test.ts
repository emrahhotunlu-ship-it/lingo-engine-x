import { describe, expect, it } from 'vitest';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { newCostMs } from '../../../src/modules/vocab/domain/day';
import { planMed } from '../../../src/modules/vocab/domain/pace';
import { outlook } from '../../../src/modules/vocab/domain/overview';
import { emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import type { Lex } from '../../../src/modules/vocab/domain/types';

// Großpaket A S6: Vorschau „Die nächsten 14 Tage“ (Wiederholungen + neue Wörter nach der Regel des Tagesplans).

const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const learned = (due: number): Lex => ({ ...introduce(emptyLex('w', 'core', T0 - 9 * D), T0 - 9 * D), lv: 4, step: null, u: { ...emptyLex('w', 'core', T0).u, due, st: 2, s: 5, last: T0 - D } });
const fresh = (): Lex => emptyLex('w', 'core', T0);

describe('Übersicht: 14-Tage-Vorschau', () => {
  it('ohne Wiederholungen: so viele neue, wie Zielzeit und Tempo erlauben; Vorrat wird aufgebraucht; realistische Zeiten wie der Plan', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ path: `vocab/n${i}`, lex: fresh(), order: i }));
    const o = outlook(new Catalog(items), {}, T0, { min: 15, newPerDay: 5 }, 4);
    expect(o.days.map((d) => d.d)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(o.days.map((d) => d.nFresh)).toEqual([5, 5, 2, 0]);
    // Politur P2: dieselben Zeiten wie der Tagesplan (ohne Messwerte Startwert × 3 = 156 s je neues Wort), nicht die bloße Antwortzeit.
    expect(newCostMs(planMed({}))).toBe(156_000);
    expect(o.days[0]!.fresh).toBeCloseTo((5 * newCostMs(planMed({}))) / 60_000, 1);
    expect(o.days[0]!.review).toBe(0);
    // Mehr Tempo als Zeit: 15 Minuten fassen 5 neue (je 2,6 Min.).
    expect(outlook(new Catalog(items), {}, T0, { min: 15, newPerDay: 10 }, 1).days[0]!.nFresh).toBe(5);
  });
  it('Tempo 0: keine neuen; volle Wiederholungstage bekommen nur die Mindestzahl (Politur P2, E3 „Wiederholungen zuerst“)', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ path: `vocab/r${i}`, lex: learned(T0 + D), order: i }));
    const news = Array.from({ length: 5 }, (_, i) => ({ path: `vocab/n${i}`, lex: fresh(), order: 100 + i }));
    const cat = new Catalog([...many, ...news]);
    expect(outlook(cat, {}, T0, { min: 15, newPerDay: 0 }, 2).days.map((d) => d.nFresh)).toEqual([0, 0]);
    const o = outlook(cat, {}, T0, { min: 15, newPerDay: 5 }, 2);
    expect(o.days[0]!.review).toBeGreaterThan(15);
    expect(o.days[0]!.nFresh).toBe(2);
    // Am Tag ohne Wiederholungen füllen die neuen den Rest (höchstens der Vorrat).
    expect(o.days[1]!.nFresh).toBe(3);
    expect(o.peak).toBeGreaterThanOrEqual(Math.round(o.days[0]!.review));
    expect(o.avg).toBe(Math.round((o.days[0]!.review + o.days[0]!.fresh + o.days[1]!.review + o.days[1]!.fresh) / 2));
  });
});
