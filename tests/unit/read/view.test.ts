import { describe, expect, it } from 'vitest';
import type { IndexItem } from '../../../src/modules/read/schemas';
import { earlierEntries, entriesOfDay, entryState, fetchCount, monthsToLoad, nextNumber, nextToRead, recentTitles, weekStats } from '../../../src/modules/read/domain/view';

// Aufbereitung des Monatsindex für den Bildschirm „Lesen“ (rein, erfundene Daten).

const e = (id: string, day: string, st?: IndexItem['st'], title = `T ${id}`): IndexItem => ({ id, day, title, topic: 'ai', mins: 5, words: 600, st: st ?? null });

describe('Zustand eines Artikels', () => {
  it('offen → angefangen → gelesen (Zustand, kein Knopf)', () => {
    expect(entryState(e('a', 'x'))).toBe('open');
    expect(entryState(e('a', 'x', { sec: 0, pos: 0, open: 0, done: false }))).toBe('open');
    expect(entryState(e('a', 'x', { sec: 12 }))).toBe('started');
    expect(entryState(e('a', 'x', { pos: 3 }))).toBe('started');
    expect(entryState(e('a', 'x', { open: 1 }))).toBe('started');
    expect(entryState(e('a', 'x', { done: true, sec: 5 }))).toBe('done');
  });
});

describe('Heute-Liste und Hauptknopf', () => {
  const items = [e('1', '2026-10-01', { done: true }), e('2', '2026-10-02', { sec: 30 }), e('3', '2026-10-02'), e('4', '2026-10-02', { done: true })];

  it('Artikel des Tages in der Reihenfolge des Erzeugens', () => {
    expect(entriesOfDay(items, '2026-10-02').map((x) => x.id)).toEqual(['2', '3', '4']);
    expect(nextNumber(items, '2026-10-02')).toBe(4);
    expect(nextNumber(items, '2026-10-05')).toBe(1);
  });

  it('nextToRead: zuerst ein angefangener, sonst der erste offene, sonst nichts', () => {
    expect(nextToRead(entriesOfDay(items, '2026-10-02'))?.id).toBe('2');
    expect(nextToRead([e('3', 'x'), e('5', 'x', { sec: 1 })])?.id).toBe('5');
    expect(nextToRead([e('3', 'x'), e('5', 'x')])?.id).toBe('3');
    expect(nextToRead([e('4', 'x', { done: true })])).toBeNull();
    expect(nextToRead([])).toBeNull();
  });

  it('fetchCount: fehlende bis perDay, danach einer mehr, nie über das Tageslimit', () => {
    expect(fetchCount(0, 3, 8)).toBe(3);
    expect(fetchCount(1, 3, 8)).toBe(2);
    expect(fetchCount(3, 3, 8)).toBe(1);
    expect(fetchCount(7, 3, 8)).toBe(1);
    expect(fetchCount(8, 3, 8)).toBe(0);
    expect(fetchCount(0, 8, 8)).toBe(8);
    expect(fetchCount(5, 8, 8)).toBe(3);
  });
});

describe('Woche, Verlauf, frühere Artikel', () => {
  // 2026-10-02 ist ein Freitag (KW 40: 28.09.–04.10.); 2026-09-27 ist der Sonntag davor (KW 39).
  const items = [e('w1', '2026-09-27', { done: true, sec: 600 }), e('a', '2026-09-29', { done: true, sec: 300 }), e('b', '2026-10-01', { done: false, sec: 90 }), e('c', '2026-10-02', { done: true, sec: 400 })];

  it('weekStats: nur diese Kalenderwoche (Montag bis Sonntag), über den Monatswechsel; Minuten aus Sekunden', () => {
    expect(weekStats(items, '2026-10-02')).toEqual({ articles: 2, minutes: Math.round((300 + 90 + 400) / 60) });
    expect(weekStats(items, '2026-09-27')).toEqual({ articles: 1, minutes: 10 });
    expect(weekStats([], '2026-10-02')).toEqual({ articles: 0, minutes: 0 });
  });

  it('recentTitles: neueste zuerst, höchstens 30, ohne leere Titel', () => {
    const many = Array.from({ length: 40 }, (_, i) => e(`x${i}`, `2026-08-${String(1 + (i % 28)).padStart(2, '0')}`, null, `Titel ${i}`));
    const r = recentTitles([...many, e('leer', '2026-10-09', null, '')]);
    expect(r).toHaveLength(30);
    expect(r.every((x) => x.title.length > 0)).toBe(true);
    expect(recentTitles(items)[0]?.title).toBe('T c');
    // Gleicher Tag: der später Erzeugte zuerst
    expect(recentTitles([e('1', '2026-10-02', null, 'Erster'), e('2', '2026-10-02', null, 'Zweiter')]).map((x) => x.title)).toEqual(['Zweiter', 'Erster']);
  });

  it('earlierEntries: nicht heute, neueste Tage zuerst, begrenzt', () => {
    expect(earlierEntries(items, '2026-10-02').map((x) => x.id)).toEqual(['b', 'a', 'w1']);
    expect(earlierEntries(items, '2026-10-02', 2)).toHaveLength(2);
    expect(earlierEntries([e('z', '', null)], '2026-10-02')).toEqual([]);
  });

  it('monthsToLoad: aktueller Monat und Vormonat (auch über den Jahreswechsel)', () => {
    expect(monthsToLoad('2026-10-02')).toEqual(['2026-10', '2026-09']);
    expect(monthsToLoad('2027-01-15')).toEqual(['2027-01', '2026-12']);
  });
});
