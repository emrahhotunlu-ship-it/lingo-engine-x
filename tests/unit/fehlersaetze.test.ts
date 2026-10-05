import { describe, expect, it } from 'vitest';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { againSource } from '../../src/domain/repair/unit';
import { berlin } from './helpers';

// Schritt „Fehler korrigieren“: EINE Liste aus `app/repair` und `grammar/<thema>.errors` (Auftrag 2b). Nie vom Anlegetag, nichts doppelt.

const TODAY = '2026-10-05';
const NOW = berlin(TODAY, 18);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;
const err = (q: string, ans: string, t: number, extra: Doc = {}): Doc => ({ q, given: 'are repaired', ans, t, src: 'test', ...extra });
const grammar = (...errors: Doc[]): ReadonlyMap<string, Doc> => new Map([['passive', { errors }]]);
const rep = (wrong: string, t: number, extra: Doc = {}): Doc => ({ id: `r-${wrong}`, wrong, right: `${wrong} fixed`, src: 'say', t, box: 0, due: t + DAY, ...extra });

describe('dueFehlersaetze', () => {
  it('nur Grammatik-Fehler fällig: die Runde ist nicht leer, mit Sätzen „falsch → richtig“ und Speicher grammar', () => {
    const g = grammar(err('The roads ___ every year.', 'are checked', NOW - 3 * DAY), err('The report was send yesterday.', 'The report was sent yesterday.', NOW - 2 * DAY));
    const list = dueFehlersaetze({ grammarDocs: g, repairDoc: null, nowMs: NOW, today: TODAY });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ store: 'grammar', topic: 'passive', wrong: 'The roads are repaired every year.', right: 'The roads are checked every year.' });
    expect(list[0]?.errorT).toBe(NOW - 3 * DAY);
    expect(list[1]).toMatchObject({ wrong: 'The report was send yesterday.', right: 'The report was sent yesterday.' });
  });

  it('beide Speicher in einer Liste, älteste Fälligkeit zuerst, Sätze vom Anlegetag nie, nichts doppelt', () => {
    const early = berlin(TODAY, 6);
    const g = grammar(err('A report ___ daily.', 'is checked', NOW - 2 * DAY), err('Fresh ___ today.', 'is made', early, { due: early }));
    const r = { items: [rep('I am agree', NOW - 4 * DAY), rep('He go home', early, { due: early }), rep('I am agree', NOW - 4 * DAY, { id: 'r-dup' })] };
    const list = dueFehlersaetze({ grammarDocs: g, repairDoc: r, nowMs: NOW, today: TODAY });
    expect(list.map((x) => x.store)).toEqual(['repair', 'grammar']);
    expect(list.map((x) => x.wrong)).toEqual(['I am agree', 'A report are repaired daily.']);
  });

  it('Schritt „Fehler korrigieren“ (againSource) übernimmt Grammatik-Fehler samt Speicher-Angabe; limit schneidet ab', () => {
    const g = grammar(err('A report ___ daily.', 'is checked', NOW - 2 * DAY));
    const src = againSource({ day: TODAY, task: null, repairDoc: { items: [rep('I am agree', NOW - 4 * DAY)] }, grammarDocs: g, now: NOW });
    expect(src.olds?.map((o) => [o.store, o.topic ?? null])).toEqual([
      ['repair', null],
      ['grammar', 'passive'],
    ]);
    expect(src.fixes).toHaveLength(2);
    expect(src.fixes[1]).toMatchObject({ right: 'A report is checked daily.' });
    expect(dueFehlersaetze({ grammarDocs: g, repairDoc: null, nowMs: NOW, today: TODAY, limit: 0 })).toEqual([]);
  });
});
