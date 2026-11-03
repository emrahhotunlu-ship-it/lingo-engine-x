import { describe, expect, it } from 'vitest';
import { splitPath } from '../../src/features/learn/TopicPath';
import { testVoidOpen } from '../../src/features/grammar/session';

const ch = { de: 'Zeiten', en: 'Tenses' };
const row = (id: string, state: 'new' | 'learning' | 'safe' | 'firm') => ({ id, state, patSafe: 0, patTotal: 0, due: 0, chapter: ch });

describe('Großpaket G5: Themen-Weg (Als Nächstes / Sitzt schon)', () => {
  const rows = [row('a', 'firm'), row('b', 'learning'), row('c', 'safe'), row('d', 'new'), row('e', 'learning'), row('f', 'new'), row('g', 'new')];

  it('sitzt = sicher oder fest; als Nächstes = höchstens 3 offene Themen nach dem aktuellen, ohne das aktuelle', () => {
    const r = splitPath(rows, 'b');
    expect(r.safe.map((x) => x.id)).toEqual(['a', 'c']);
    expect(r.next.map((x) => x.id)).toEqual(['d', 'e', 'f']);
    expect(r.current).toBe('b');
  });

  it('ohne aktuelles Thema gilt das erste offene', () => {
    const r = splitPath(rows, null);
    expect(r.current).toBe('b');
    expect(r.next.map((x) => x.id)).toEqual(['d', 'e', 'f']);
  });

  it('unbekanntes aktuelles Thema: wie ohne; am Ende des Wegs ist „Als Nächstes“ leer', () => {
    expect(splitPath(rows, 'zz').current).toBe('b');
    expect(splitPath(rows, 'g').next).toEqual([]);
  });

  it('G8 (LS-B5): sitzt das aktuelle Thema schon, steht es nicht zusätzlich unter „Sitzt schon“', () => {
    const r = splitPath(rows, 'c');
    expect(r.current).toBe('c');
    expect(r.safe.map((x) => x.id)).toEqual(['a']);
  });
});

describe('G8 (LS-B2): gemeldete Aufgabe im Themen-Test', () => {
  const res = (xt: boolean) => ({ key: 'k', topic: 't', ok: true, verdict: 'correct' as const, ...(xt ? { xt: true as const } : {}) });
  it('fällt aus dem Ergebnis, solange danach mindestens TT_MIN Aufgaben bleiben', () => {
    const test = { topic: 't', n: 6, result: null };
    expect(testVoidOpen({ test, pos: 0, results: [] })).toBe(true);
    expect(testVoidOpen({ test, pos: 3, results: [res(true), res(false), res(false)] })).toBe(true);
    expect(testVoidOpen({ test, pos: 4, results: [res(true), res(true), res(false), res(false)] })).toBe(false);
    expect(testVoidOpen({ test: null, pos: 0, results: [] })).toBe(false);
    expect(testVoidOpen({ test, pos: 6, results: [] })).toBe(false);
  });
});
