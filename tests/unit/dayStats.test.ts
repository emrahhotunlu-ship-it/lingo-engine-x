import { describe, expect, it } from 'vitest';
import { fixedStats, fixesDue, milestonePatch, newMilestones, truthParts } from '../../src/domain/plan/dayStats';
import { berlin } from './helpers';

// Zahlen für den Tag: fällige Fehlersätze aus beiden Speichern (nie vom Anlegetag), Fehler weg, Wahrheitszeile, Meilensteine.

const TODAY = '2026-10-05';
const NOW = berlin(TODAY, 18);
const DAY = 86_400_000;

type Doc = Record<string, unknown>;
const err = (q: string, t: number, extra: Doc = {}): Doc => ({ q, given: 'x', ans: 'is repaired', t, src: 'test', ...extra });
const grammar = (...errors: Doc[]): ReadonlyMap<string, Doc> => new Map([['passive', { errors }]]);
const repair = (...items: Doc[]): Doc => ({ items });
const rep = (wrong: string, t: number, extra: Doc = {}): Doc => ({ id: `r-${wrong}`, wrong, right: `${wrong} fixed`, src: 'say', t, box: 0, due: t + DAY, ...extra });

describe('fixesDue: fällige Fehlersätze aus beiden Speichern', () => {
  it('zählt Grammatik-Fehler und Reparatur-Sätze früherer Tage', () => {
    const g = grammar(err('The road ___ every year.', NOW - 3 * DAY), err('The bridge ___ last week.', NOW - 2 * DAY));
    const r = repair(rep('I am agree', NOW - 4 * DAY), rep('He go home', NOW - 2 * DAY));
    expect(fixesDue({ grammarDocs: g, repairDoc: r, nowMs: NOW, today: TODAY })).toBe(4);
  });

  it('ein Satz vom Anlegetag zählt nie, auch wenn er schon fällig wäre (Uhrzeit)', () => {
    const early = berlin(TODAY, 6);
    const g = grammar(err('The road ___ every year.', early, { due: early }));
    const r = repair(rep('I am agree', early, { due: early }));
    expect(fixesDue({ grammarDocs: g, repairDoc: r, nowMs: NOW, today: TODAY })).toBe(0);
  });

  it('nichts fällig, erledigt oder noch in der Zukunft: 0; fehlende Speicher stören nicht', () => {
    const g = grammar(err('A ___ b.', NOW - 5 * DAY, { done: true, box: 3 }), err('C ___ d.', NOW - 5 * DAY, { due: NOW + DAY }));
    const r = repair(rep('x', NOW - 5 * DAY, { done: true }), rep('y', NOW - 5 * DAY, { due: NOW + DAY }));
    expect(fixesDue({ grammarDocs: g, repairDoc: r, nowMs: NOW, today: TODAY })).toBe(0);
    expect(fixesDue({ grammarDocs: new Map(), repairDoc: null, nowMs: NOW, today: TODAY })).toBe(0);
    expect(fixesDue({ grammarDocs: new Map(), repairDoc: undefined, nowMs: NOW, today: TODAY })).toBe(0);
  });
});

describe('fixedStats: Fehler weg', () => {
  it('heute erledigt und insgesamt erledigt', () => {
    const g = grammar(err('A ___ b.', NOW - 9 * DAY, { done: true, last: NOW - 2 * 3_600_000 }), err('C ___ d.', NOW - 9 * DAY, { done: true, last: NOW - 3 * DAY }), err('E ___ f.', NOW - 9 * DAY));
    const r = repair(rep('x', NOW - 9 * DAY, { done: true, last: NOW - 3_600_000 }), rep('y', NOW - 9 * DAY));
    expect(fixedStats({ grammarDocs: g, repairDoc: r, today: TODAY })).toEqual({ today: 2, total: 3 });
  });
});

describe('Wahrheitszeile: nur Teile, die stimmen und größer als 0 sind', () => {
  it('zeigt Zuwachs, entfällt bei 0, bei Rückgang oder ohne Morgenwert', () => {
    expect(truthParts({ sure: 45, sure0: 42, fixed: 1, overdue: 3, overdue0: 15 })).toEqual({ sure: 3, fixed: 1, over: 12 });
    expect(truthParts({ sure: 42, sure0: 42, fixed: 0, overdue: 15, overdue0: 15 })).toEqual({ sure: null, fixed: null, over: null });
    expect(truthParts({ sure: 40, sure0: 42, fixed: 0, overdue: 20, overdue0: 15 })).toEqual({ sure: null, fixed: null, over: null });
    expect(truthParts({ sure: 45, sure0: null, fixed: 2, overdue: 3, overdue0: null })).toEqual({ sure: null, fixed: 2, over: null });
  });
});

describe('Meilensteine: einmalig, ein Satz', () => {
  const base = { fest: 0, topicsFest: 0, fixTotal: 0, overdue0: null, overdue: null, seen: {} };

  it('höchste Fest-Marke zuerst; alle erreichten werden zurückgegeben (zum Merken)', () => {
    const ms = newMilestones({ ...base, fest: 300 });
    expect(ms.map((m) => m.id)).toEqual(['fest250', 'fest100']);
    expect(ms[0]?.n).toBe(250);
    expect(newMilestones({ ...base, fest: 99 })).toEqual([]);
  });

  it('gemerkte Marken kommen nie wieder', () => {
    expect(newMilestones({ ...base, fest: 300, seen: { fest250: '2026-10-01', fest100: '2026-09-01' } })).toEqual([]);
    expect(newMilestones({ ...base, fest: 600, seen: { fest250: '2026-10-01', fest100: '2026-09-01' } }).map((m) => m.id)).toEqual(['fest500']);
  });

  it('erstes Thema fest, 10 Fehlersätze fest, überfällig 0 nach einer Pause', () => {
    expect(newMilestones({ ...base, topicsFest: 1 }).map((m) => m.id)).toEqual(['topic1']);
    expect(newMilestones({ ...base, fixTotal: 10 }).map((m) => m.id)).toEqual(['fix10']);
    expect(newMilestones({ ...base, overdue0: 20, overdue: 0 }).map((m) => m.id)).toEqual(['overdue0']);
    // ohne vorherigen Rückstand kein Meilenstein
    expect(newMilestones({ ...base, overdue0: 3, overdue: 0 })).toEqual([]);
    expect(newMilestones({ ...base, overdue0: null, overdue: 0 })).toEqual([]);
  });

  it('Merker: nur ergänzend, nichts überschrieben', () => {
    expect(milestonePatch({}, ['fest100'], TODAY)).toEqual({ ms: { fest100: TODAY } });
    expect(milestonePatch({ ms: { fest100: '2026-09-01' } }, ['fest100'], TODAY)).toBeNull();
    expect(milestonePatch({ ms: { fest100: '2026-09-01' } }, ['fest100', 'topic1'], TODAY)).toEqual({ ms: { topic1: TODAY } });
  });
});
