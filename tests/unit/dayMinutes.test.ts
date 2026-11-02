import { describe, expect, it } from 'vitest';
import { dayMinutes, grammarTasksFor, mixedErrorsFor } from '../../src/domain/plan/dayMinutes';

describe('dayMinutes (Tagesweg, eine Quelle)', () => {
  it('Wörter = max(10, 40 % des Tagesziels), Rest ⅔ Grammatik, ⅓ Anwenden', () => {
    expect(dayMinutes(25)).toEqual({ words: 10, grammar: 10, apply: 5, total: 25 });
    expect(dayMinutes(30)).toEqual({ words: 12, grammar: 12, apply: 6, total: 30 });
    expect(dayMinutes(40)).toEqual({ words: 16, grammar: 16, apply: 8, total: 40 });
    expect(dayMinutes(20)).toEqual({ words: 10, grammar: 7, apply: 3, total: 20 });
    expect(dayMinutes(15)).toEqual({ words: 10, grammar: 3, apply: 2, total: 15 });
  });
  it('kleines Tagesziel: immer drei echte Schritte, Wörter nie unter 10', () => {
    const m = dayMinutes(10);
    expect(m.words).toBe(10);
    expect(m.grammar).toBeGreaterThanOrEqual(3);
    expect(m.apply).toBeGreaterThanOrEqual(2);
  });
  it('ungültiges Ziel fällt auf 25 zurück', () => {
    expect(dayMinutes(Number.NaN).total).toBe(25);
  });
  it('Aufgabenzahl und eingemischte Fehlersätze', () => {
    expect(grammarTasksFor(10)).toBe(8);
    expect(grammarTasksFor(3)).toBe(3);
    expect(grammarTasksFor(30)).toBe(12);
    expect(mixedErrorsFor(undefined)).toBe(0);
    expect(mixedErrorsFor(7)).toBe(3);
  });
});

import { unitPlanFor } from '../../src/domain/unit/planFor';

describe('Tagesweg (tw: 1)', () => {
  const day = '2026-11-03'; // Dienstag
  it('drei Schritte Wörter → Grammatik → Anwenden mit den Minuten aus dem Tagesziel', () => {
    const p = unitPlanFor(day, null, { goalMin: 25, tw: 1, reviewCount: 20, fixDue: 5 });
    expect(p.tw).toBe(1);
    expect(p.blocks.map((b) => [b.block, b.kind, b.min])).toEqual([
      [1, 'review', 10],
      [2, 'grammar', 10],
      [3, 'task.apply', 5],
    ]);
    expect(p.blocks[1]!.opts.n).toBe(8);
    expect(p.blocks.some((b) => b.kind === 'task.order')).toBe(false);
  });
  it('Samstag und kleines Tagesziel: weiterhin drei Schritte, Wörter mindestens 10 Minuten', () => {
    const sat = unitPlanFor('2026-11-07', null, { goalMin: 40, tw: 1, reviewCount: 20 });
    expect(sat.blocks.map((b) => b.min)).toEqual([16, 16, 8]);
    const small = unitPlanFor(day, null, { goalMin: 10, tw: 1, reviewCount: 20 });
    expect(small.blocks.map((b) => b.kind)).toEqual(['review', 'grammar', 'task.apply']);
    expect(small.blocks[0]!.min).toBe(10);
  });
  it('Sonntag: Schritt 3 ist der Wochen-Check (ca. 5 Min.) statt Anwenden (Emrah 02.11.2026); Neustart-Woche bleibt bei Anwenden', () => {
    const sun = unitPlanFor('2026-11-08', null, { goalMin: 25, tw: 1, reviewCount: 20 });
    expect(sun.blocks.map((b) => [b.block, b.kind, b.channel, b.min])).toEqual([
      [1, 'review', 'review', 10],
      [2, 'grammar', 'ch:u-focus', 10],
      [3, 'task.check', 'ch:u-check', 5],
    ]);
    const restart = unitPlanFor('2026-11-08', null, { goalMin: 25, tw: 1, reviewCount: 20, comeback: 'restart' });
    expect(restart.blocks[2]!.kind).toBe('task.apply');
  });
  it('ohne tw bleibt der bisherige Plan (Rückweg)', () => {
    const old = unitPlanFor(day, null, { goalMin: 25, rv: 2, reviewCount: 20 });
    expect(old.tw).toBeUndefined();
    expect(old.blocks.some((b) => b.kind === 'task.apply')).toBe(false);
  });
});
