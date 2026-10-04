import { describe, expect, it } from 'vitest';
import { buildBriefFacts, briefHasData, briefWeekOf } from '../../src/coach/brief';
import { checkDue, curvePoints } from '../../src/coach/curve';
import { readLegacy } from '../../src/coach/legacy';
import { briefPrompt } from '../../src/prompts/coach';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import type { DayRec, InLog, Placement } from '../../src/coach/types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-14T10:00:00+02:00');
const placement: Placement = { at: NOW - 40 * DAY, size: 4000, bands: [], falseAlarm: 0, grammar: { articles: 0.3, passive: 0.9 }, level: 'B2' };
const rec = (ans: number, ok: number, extra: Partial<DayRec> = {}): DayRec => ({ min: 20, ans, ok, nw: 10, ...extra });
const emptyLog: InLog = { it: {}, own: {} };

describe('Trainer-Brief: Zahlen', () => {
  const days: Record<string, DayRec> = {
    '2026-10-13': rec(40, 32, { core: 1 }),
    '2026-10-12': rec(30, 27, { core: 1 }),
    '2026-10-05': rec(20, 10),
  };
  const profile = { v: 1 as const, created: 0, newPerDay: 10, planStart: '2026-09-01', placement };

  it('fasst die letzten sieben Tage und die Woche davor zusammen', () => {
    const f = buildBriefFacts(profile, new Map(), days, emptyLog, undefined, {}, '2026-10-14');
    expect(f).toMatchObject({ days: 2, coreDays: 2, answers: 70, correctPct: 84, newWords: 20, lastWeekPct: 50, level: 'B2' });
    expect(f.weakGrammar).toHaveLength(3);
    expect(briefHasData(f)).toBe(true);
  });

  it('zu wenig Daten: kein Brief', () => {
    const f = buildBriefFacts(profile, new Map(), { '2026-10-13': rec(4, 4) }, emptyLog, undefined, {}, '2026-10-14');
    expect(briefHasData(f)).toBe(false);
  });

  it('Input der Woche und Check gehen ein', () => {
    const log: InLog = { it: { a: { d: '2026-10-12', m: 12, t: 'x', r: 'great', l: 'hard', topic: 'tech' } }, own: { '2026-10-13': 30 } };
    const f = buildBriefFacts(profile, new Map(), days, log, undefined, { '2026-09': { at: NOW - 30 * DAY, size: 4100, level: 'B2', gOk: 20, gN: 36 } }, '2026-10-14');
    expect(f.inputMinutes).toBe(42);
    expect(f.liked).toEqual(['tech']);
    expect(f.tooHard).toBe(1);
    expect(f.lastCheck).toEqual({ month: '2026-09', size: 4100, level: 'B2' });
  });

  it('Prompt: eine Woche = ein Schlüssel, Sprache und Zahlen drin, nichts über die Wortliste', () => {
    expect(briefWeekOf('2026-10-14')).toBe('2026-W42');
    const p = briefPrompt({ answers: 70 }, 'de');
    expect(p).toContain('German');
    expect(p).toContain('"answers":70');
    expect(p.length).toBeLessThan(1500);
  });
});

describe('Kurve und Monats-Check', () => {
  it('Punkte: Einstufung, dann Checks nach Zeit', () => {
    const pts = curvePoints(placement, { '2026-10': { at: NOW, size: 4300, level: 'B2+', gOk: 25, gN: 36 }, '2026-09': { at: NOW - 20 * DAY, size: 4100, level: 'B2', gOk: 20, gN: 36 } });
    expect(pts.map((p) => p.size)).toEqual([4000, 4100, 4300]);
    expect(curvePoints(undefined, {})).toEqual([]);
  });

  it('fällig erst 20 Tage nach der letzten Messung und nur einmal im Monat', () => {
    expect(checkDue(undefined, {}, NOW, '2026-10')).toBe(false);
    expect(checkDue(placement, {}, NOW, '2026-10')).toBe(true);
    expect(checkDue({ ...placement, at: NOW - 5 * DAY }, {}, NOW, '2026-10')).toBe(false);
    expect(checkDue(placement, { '2026-10': { at: NOW, size: 1, level: 'B2', gOk: 1, gN: 1 } }, NOW, '2026-10')).toBe(false);
  });
});

describe('Datenübernahme: mehr als 1.000 Wörter', () => {
  it('liest eine gekappte Sammlung seitenweise vollständig', async () => {
    const { db } = createMemoryDb();
    for (let i = 0; i < 1250; i++) {
      const w = `word${String(i).padStart(4, '0')}`;
      await db.doc(`vocab/${w}`).set({ word: w, de: 'x', S: 3, D: 5, due: NOW, last: NOW - DAY, state: 'review', stage: 2 });
    }
    const capped = {
      ...db,
      collection: (name: string) => {
        const c = db.collection(name);
        return Object.assign(Object.create(c) as object, { get: () => c.limit(1000).get() }) as typeof c;
      },
    };
    const legacy = await readLegacy(capped);
    expect(legacy.vocab.size).toBe(1250);
    expect(legacy.truncated).toEqual([]);
  }, 30_000);
});
