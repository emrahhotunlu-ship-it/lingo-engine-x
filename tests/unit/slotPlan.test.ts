import { describe, expect, it } from 'vitest';
import { currentChapter, slotPlan, type PatInfo, type SlotInput } from '../../src/domain/grammar/slotPlan';
import { mixPick } from '../../src/domain/grammar/mix';

const TODAY = '2026-10-07'; // Mittwoch
const DAY = 86_400_000;
const at = (daysAgo: number): number => Date.parse(`${TODAY}T12:00:00Z`) - daysAgo * DAY;
// Zustand „Lernt“: eingeführt, ein Treffer ohne Hilfe.
const learning = (daysAgo: number, i = '2026-09-01'): PatInfo['entry'] => ({ n: 3, c: 1, last: at(daysAgo), h: 0, r: 1, k: 1, dd: [], i });
// Zustand „Sicher“: 3 richtige ohne Hilfe an 2 Tagen, erst kürzlich.
const safe = (daysAgo: number): PatInfo['entry'] => ({ n: 6, c: 6, last: at(daysAgo), h: 0, r: 7, k: 3, dd: ['2026-10-01', '2026-10-03'], s: '2026-10-03', i: '2026-08-01' });
const firm = (daysAgo: number): PatInfo['entry'] => ({ n: 9, c: 9, last: at(daysAgo), h: 0, r: 31, k: 5, dd: ['2026-08-01', '2026-08-03'], s: '2026-08-03', i: '2026-07-01' });

const pat = (id: string, chapter: number, entry?: PatInfo['entry']): PatInfo => ({ id, chapter, entry });
const PATS: PatInfo[] = [
  pat('aa.one', 0, safe(2)),
  pat('aa.two', 0, learning(9)),
  pat('bb.one', 1, learning(3)),
  pat('bb.two', 1, learning(20)),
  pat('cc.one', 2, safe(15)),
  pat('dd.one', 3, learning(5)),
  pat('ee.one', 4, firm(40)),
  pat('ff.new', 5), // nicht eingeführt
];
const base = (o: Partial<SlotInput> = {}): SlotInput => ({ n: 6, ctx: 'duty', weekday: 3, today: TODAY, pats: PATS, seed: 's', ...o });

describe('currentChapter', () => {
  it('erstes Kapitel mit einem eingeführten Muster unter „Sicher“', () => expect(currentChapter(PATS, TODAY)).toBe(0));
  it('ohne Muster unter Sicher: Kapitel der jüngsten Einführung', () => {
    const all = [pat('a.x', 0, safe(2)), pat('b.y', 3, { ...safe(2), i: '2026-10-05' })];
    expect(currentChapter(all, TODAY)).toBe(3);
  });
  it('nichts eingeführt: 0', () => expect(currentChapter([pat('a.x', 2)], TODAY)).toBe(0));
});

describe('slotPlan: Normaltag', () => {
  it('2 chapter · 1 focus · 3 due', () => {
    const s = slotPlan(base());
    expect(s.map((x) => x.role)).toEqual(['chapter', 'chapter', 'focus', 'due', 'due', 'due']);
    expect(s.every((x) => x.pat)).toBe(true);
  });
  it('chapter-Plätze stammen aus dem aktuellen Kapitel, nicht eingeführte Muster kommen nie vor', () => {
    const s = slotPlan(base());
    expect(s.slice(0, 2).every((x) => x.pat?.startsWith('aa.'))).toBe(true);
    expect(s.some((x) => x.pat === 'ff.new')).toBe(false);
  });
  it('Wochenfokus belegt Platz 3', () => expect(slotPlan(base({ focus: 'cc.one' }))[2]?.pat).toBe('cc.one'));
  it('Fokus null fällt auf den Fehler-Radar, dann auf due', () => {
    expect(slotPlan(base({ errorsByPat: { 'dd.one': 3, 'bb.one': 1 } }))[2]?.pat).toBe('dd.one');
    expect(slotPlan(base())[2]?.role).toBe('focus');
    expect(slotPlan(base())[2]?.pat).toBeTruthy();
  });
  it('kein Muster zweimal direkt hintereinander in den Plätzen 1–3', () => {
    const s = slotPlan(base({ pats: [pat('aa.one', 0, learning(2)), pat('aa.two', 0, learning(3))], focus: 'aa.one' }));
    for (let k = 1; k < 3; k++) expect(s[k]?.pat).not.toBe(s[k - 1]?.pat);
  });
  it('kürzere Tage nehmen die ersten n Plätze', () => {
    expect(slotPlan(base({ n: 4 })).map((x) => x.role)).toEqual(['chapter', 'chapter', 'focus', 'due']);
    expect(slotPlan(base({ n: 3 })).map((x) => x.role)).toEqual(['chapter', 'chapter', 'focus']);
  });
  it('Fest-Muster belegen höchstens einen Platz und erst nach 28 Tagen', () => {
    const many = [pat('aa.one', 0, learning(2)), pat('f.1', 1, firm(40)), pat('f.2', 2, firm(45)), pat('f.3', 3, firm(50)), pat('f.4', 4, firm(10))];
    const s = slotPlan(base({ pats: many }));
    const firmIds = s.filter((x) => x.pat?.startsWith('f.'));
    expect(firmIds.some((x) => x.pat === 'f.4' && x.role === 'due')).toBe(false);
    expect(s.filter((x) => x.role === 'due' && x.pat?.startsWith('f.')).length).toBeLessThanOrEqual(1);
  });
});

describe('slotPlan: Claude-Plätze', () => {
  const none = new Set(PATS.map((p) => p.id));
  it('höchstens 2 in der Pflicht, keine in den Plätzen 1–3, nur wenn keine feste Aufgabe mehr da ist', () => {
    const s = slotPlan(base({ noFixedLeft: none }));
    expect(s.filter((x) => x.aiOk).length).toBeLessThanOrEqual(2);
    expect(s.slice(0, 3).some((x) => x.aiOk)).toBe(false);
    expect(slotPlan(base()).some((x) => x.aiOk)).toBe(false);
  });
  it('Extra: bis 3, nicht in den Plätzen 1–3', () => {
    const s = slotPlan(base({ ctx: 'xtra', noFixedLeft: none, chosen: ['aa.one', 'bb.one'] }));
    expect(s.filter((x) => x.aiOk).length).toBeLessThanOrEqual(3);
    expect(s.slice(0, 3).some((x) => x.aiOk)).toBe(false);
    expect(s.every((x) => x.role === 'xtra' && (x.pat === 'aa.one' || x.pat === 'bb.one'))).toBe(true);
  });
});

describe('slotPlan: Samstag, Einführung', () => {
  it('Samstag: nur mix aus mindestens 3 Kapiteln, nie Claude', () => {
    const s = slotPlan(base({ weekday: 6, noFixedLeft: new Set(PATS.map((p) => p.id)) }));
    expect(s.every((x) => x.role === 'mix' && !x.aiOk)).toBe(true);
    const chapters = new Set(s.map((x) => PATS.find((p) => p.id === x.pat)?.chapter));
    expect(chapters.size).toBeGreaterThanOrEqual(3);
  });
  it('Einführungstag: 2 Vortest, danach die Muster des Tages, nie Claude', () => {
    const s = slotPlan(base({ intro: { pats: ['ff.new', 'ff.two'] }, noFixedLeft: new Set(PATS.map((p) => p.id)) }));
    expect(s.map((x) => x.role)).toEqual(['vortest', 'vortest', 'intro', 'intro', 'intro', 'intro']);
    expect(s.slice(2).map((x) => x.pat)).toEqual(['ff.new', 'ff.two', 'ff.new', 'ff.two']);
    expect(s.some((x) => x.aiOk)).toBe(false);
  });
});

describe('mixPick', () => {
  it('fälligste zuerst, mindestens 3 Kapitel wenn möglich', () => {
    const c = [
      { pat: 'a1', chapter: 0, last: 1 },
      { pat: 'a2', chapter: 0, last: 2 },
      { pat: 'a3', chapter: 0, last: 3 },
      { pat: 'b1', chapter: 1, last: 10 },
      { pat: 'c1', chapter: 2, last: 20 },
    ];
    const r = mixPick(c, 4, 's');
    expect(new Set(r.map((p) => c.find((x) => x.pat === p)?.chapter)).size).toBeGreaterThanOrEqual(3);
    expect(r).toHaveLength(4);
  });
});
