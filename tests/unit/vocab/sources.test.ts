import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { reportEvidence } from '../../../src/modules/vocab/api';
import { Catalog, type Item } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';
import { applyAnswer, emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import { bandPool, colPool, jobPool, nextSrc, plainEx, refillNeed, type Src, SRC_WEIGHTS, splitQuota, srcOf, weightsOf } from '../../../src/modules/vocab/domain/sources';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { readPlace, refillFresh, type SourceData } from '../../../src/modules/vocab/data/refill';
import { LearnRun } from '../../../src/modules/vocab/ui/learnRun';
import { dayKey } from '../../../src/domain/date';

// Großpaket A Schritt 7b (vokabeln/s7-bau.md, Emrah 01.11.2026: 30/30/25/15): Herkunft, Mischung, Nachfüllen aus den Quellen.

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const ZERO: Record<Src, number> = { col: 0, job: 0, own: 0, band: 0 };
const ALL = (n: number): Record<Src, number> => ({ col: n, job: n, own: n, band: n });

function learned(t: number): Lex {
  const ctx = { cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set<number>() };
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx).lex;
  return applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx).lex;
}

const SRC: SourceData = {
  job: [
    { id: 'b-1', en: 'stakeholder buy-in', k: 'col', de: 'Rückhalt der Beteiligten', ex: 'We need [stakeholder buy-in] before launch.' },
    { id: 'b-2', en: 'to circle back', k: 'ch', de: 'nochmal darauf zurückkommen', ex: "Let's [circle back] on this tomorrow." },
    { id: 'b-3', en: 'scope', k: 'w', de: 'Umfang', ex: 'The [scope] is clear.' },
  ],
  col: [
    { word: 'scope', pos: 'noun', col: [{ p: 'narrow the scope', de: 'den Umfang eingrenzen', ex: 'We had to [narrow the scope] of the audit.' }, { p: 'scope creep', de: 'schleichende Ausweitung', ex: 'Watch out for [scope creep].' }] },
    { word: 'budget', pos: 'noun', col: [{ p: 'tight budget', de: 'knappes Budget', ex: 'We work on a [tight budget].' }] },
  ],
  band: [
    { w: 'ubiquitous', p: 'adj', d: 'allgegenwärtig', x: 'Phones are ubiquitous.', r: 5200 },
    { w: 'tenuous', p: 'adj', d: 'dürftig', x: 'The link is tenuous.', r: 4800 },
    { w: 'the', p: 'det', d: 'der', x: 'The end.', r: 4600, basic: 1 },
    { w: 'wane', p: 'verb', d: 'nachlassen', x: '', r: 4700 },
    { w: 'erode', p: 'verb', d: 'aushöhlen', x: 'Trust can erode.', r: 3000 },
    { w: 'mitigate', p: 'verb', d: 'abmildern', x: 'We mitigate risk.', r: 6000, hidden: 1 },
  ],
};

describe('Herkunft und Gewichte', () => {
  it('srcOf: nur v5-Herkünfte zählen als Modul-Quelle, alles andere ist ein eigener Fund', () => {
    expect([srcOf('v5:col'), srcOf('v5:job'), srcOf('v5:band'), srcOf('lookup'), srcOf(undefined), srcOf('teacher')]).toEqual(['col', 'job', 'band', 'own', 'own', 'own']);
  });
  it('weightsOf: Startgewichte 30/30/25/15; gesetzte Gewichte gelten, alle 0 → Start', () => {
    expect(weightsOf(null)).toEqual(SRC_WEIGHTS);
    expect(weightsOf({ col: 0, job: 1, own: 0, band: 0 })).toEqual({ col: 0, job: 1, own: 0, band: 0 });
    expect(weightsOf({ col: 0, job: 0, own: 0, band: 0 })).toEqual(SRC_WEIGHTS);
  });
  it('splitQuota: 10 Plätze → 3/3/3/1 bzw. nach größtem Rest; leere Quelle gibt ihren Anteil ab; nie mehr als n', () => {
    const a = splitQuota(10, ALL(99));
    expect(a.col + a.job + a.own + a.band).toBe(10);
    expect(a.col).toBe(3);
    expect(a.job).toBe(3);
    expect(a.band).toBeGreaterThanOrEqual(1);
    const b = splitQuota(10, { col: 0, job: 99, own: 1, band: 99 });
    expect(b.col).toBe(0);
    expect(b.own).toBe(1);
    expect(b.job + b.band).toBe(9);
    expect(splitQuota(5, ZERO)).toEqual(ZERO);
    expect(splitQuota(0, ALL(9))).toEqual(ZERO);
  });
  it('nextSrc: gleichmäßig gewichtet; über 20 Züge ≈ 6/6/5/3; ohne offene Quelle null', () => {
    const n = { ...ZERO };
    const open = new Set<Src>(['col', 'job', 'own', 'band']);
    const seq: Src[] = [];
    for (let i = 0; i < 20; i++) {
      const s = nextSrc(n, open)!;
      seq.push(s);
      n[s]++;
    }
    expect(n).toEqual({ col: 6, job: 6, own: 5, band: 3 });
    // Gemischt, nicht blockweise: in den ersten vier Zügen kommen mindestens drei Quellen vor.
    expect(new Set(seq.slice(0, 4)).size).toBeGreaterThanOrEqual(3);
    expect(nextSrc(n, new Set())).toBeNull();
    expect(nextSrc(ZERO, new Set<Src>(['band']))).toBe('band');
  });
  it('refillNeed: Bestand zählt mit, nur Fehlendes wird nachgefüllt', () => {
    expect(refillNeed(10, { ...ZERO, own: 9 }, { col: 99, job: 99, band: 99 })).toEqual({ col: 3, job: 3, band: 1 });
    expect(refillNeed(10, { col: 5, job: 5, own: 5, band: 5 }, { col: 99, job: 99, band: 99 })).toEqual({ col: 0, job: 0, band: 0 });
    // Keine eigenen Funde: ihr Anteil geht an die Modul-Quellen.
    expect(refillNeed(10, ZERO, { col: 99, job: 99, band: 99 })).toEqual({ col: 4, job: 4, band: 2 });
  });
});

describe('Kandidaten je Quelle', () => {
  it('plainEx entfernt die Zielmarke', () => {
    expect(plainEx('We need [stakeholder buy-in]  before launch.')).toBe('We need stakeholder buy-in before launch.');
  });
  it('jobPool: ohne Vorhandenes, Wendung wird chunk', () => {
    const p = jobPool(SRC.job, new Set(['scope']));
    expect(p.map((f) => [f.word, f.kind])).toEqual([
      ['stakeholder buy-in', 'vocab'],
      ['to circle back', 'chunk'],
    ]);
    expect(p[1]!.ex).toBe("Let's circle back on this tomorrow.");
  });
  it('colPool: nur Partner eingeführter Wörter, nie am Einführungstag, Kernwort als core', () => {
    const base = new Map([
      ['scope', { path: 'vocab/scope', intro: '2026-10-20' }],
      ['budget', { path: 'vocab/budget', intro: '2026-11-02' }],
    ]);
    const p = colPool(SRC.col, base, new Set(['scope creep']), '2026-11-02');
    expect(p.map((f) => [f.word, f.core])).toEqual([['narrow the scope', 'vocab/scope']]);
  });
  it('bandPool: ab der Grenze, ohne Grundwortschatz, ohne Satz, ausgeblendet oder im Test gekonnt; nach Rang', () => {
    expect(bandPool(SRC.band, 4500, new Set(), new Set()).map((f) => f.word)).toEqual(['tenuous', 'ubiquitous']);
    expect(bandPool(SRC.band, 4500, new Set(), new Set(['tenuous'])).map((f) => f.word)).toEqual(['ubiquitous']);
    expect(bandPool(SRC.band, 2500, new Set(['erode']), new Set()).map((f) => f.word)).toEqual(['tenuous', 'ubiquitous']);
  });
});

describe('Tagesplan mischt nach Herkunft (day.ts)', () => {
  const fresh = (src: Src, n: number, from: number): Item[] => Array.from({ length: n }, (_, i) => ({ path: `vocab/${src}-${i}`, lex: emptyLex('w', 'edge', T0), order: from + i, src }));
  const ids = (cat: Catalog, cfg = { ...DEFAULT_CFG, min: 60, newPerDay: 10 }) => buildDayPlan(cat, T0, cfg, {}).plan.plan.filter((e) => e[1] === 'n').map((e) => e[0]);

  it('10 neue aus vier vollen Quellen: 3 Wortpartner, 3 Beruf, Rest eigene Funde und Liste; gemischt', () => {
    const cat = new Catalog([...fresh('own', 10, 0), ...fresh('col', 10, 100), ...fresh('job', 10, 200), ...fresh('band', 10, 300)]);
    const got = ids(cat);
    expect(got).toHaveLength(10);
    const n = (s: string) => got.filter((p) => p.startsWith(`vocab/${s}-`)).length;
    expect([n('col'), n('job')]).toEqual([3, 3]);
    expect(n('own') + n('band')).toBe(4);
    expect(n('band')).toBeGreaterThanOrEqual(1);
    // Innerhalb einer Quelle nach Reihenfolge.
    expect(got.filter((p) => p.startsWith('vocab/col-'))).toEqual(['vocab/col-0', 'vocab/col-1', 'vocab/col-2']);
  });
  it('nur eigene Funde (Bestand vor S7): wie bisher nach Reihenfolge', () => {
    const cat = new Catalog(fresh('own', 8, 0).map((it) => ({ ...it, src: undefined })));
    expect(ids(cat, { ...DEFAULT_CFG, min: 60, newPerDay: 5 })).toEqual(['vocab/own-0', 'vocab/own-1', 'vocab/own-2', 'vocab/own-3', 'vocab/own-4']);
  });
  it('erschöpfte Quelle: die übrigen füllen auf', () => {
    const cat = new Catalog([...fresh('col', 1, 0), ...fresh('own', 20, 100)]);
    const got = ids(cat);
    expect(got).toHaveLength(10);
    expect(got.filter((p) => p.startsWith('vocab/col-'))).toEqual(['vocab/col-0']);
  });
  it('Gewichte aus den Einstellungen: nur Beruf', () => {
    const cat = new Catalog([...fresh('own', 10, 0), ...fresh('job', 10, 100)]);
    const got = ids(cat, { ...DEFAULT_CFG, min: 60, newPerDay: 4, w: { col: 0, job: 1, own: 0, band: 0 } });
    expect(got.every((p) => p.startsWith('vocab/job-'))).toBe(true);
  });
});

describe('Nachfüllen (refill.ts)', () => {
  const scope: Doc = { word: 'scope', de: 'Umfang', ex: 'The scope is clear.', lex: learned(T0 - 10 * D) };
  const items = (): Item[] => [{ path: 'vocab/scope', lex: scope.lex as Lex, order: 0 }];

  it('readPlace: nur gültige Einstufung', () => {
    expect(readPlace({ v: 1, t: 1, edge: 6000, bands: [], ok: ['tenuous'] })).toEqual({ edge: 6000, ok: ['tenuous'] });
    expect(readPlace({ v: 2, edge: 6000, ok: [] })).toBeNull();
    expect(readPlace(null)).toBeNull();
  });
  it('legt neue Lexeme mit Ursprungssatz und Herkunft an, nie doppelt, überschreibt nie', async () => {
    const h = createMemoryDb({ seed: { 'vocab/scope': scope, 'vocab/tenuous': { word: 'tenuous', ex: 'alt', reps: 2 } } });
    const w = createWriter(h.db);
    const docs = new Map(Object.entries(h.dump()) as [string, Doc][]);
    const out = await refillFresh(w, { docs, items: items(), quota: 10, nowMs: T0, place: null, w: SRC_WEIGHTS, load: () => Promise.resolve(SRC) });
    const paths = out.map(([p]) => p).sort();
    expect(paths).toEqual(['chunk/to-circle-back', 'vocab/narrow-the-scope', 'vocab/scope-creep', 'vocab/stakeholder-buy-in', 'vocab/ubiquitous']);
    const dump = h.dump();
    expect(dump['vocab/tenuous']).toEqual({ word: 'tenuous', ex: 'alt', reps: 2 });
    expect(dump['vocab/scope']).toEqual(scope);
    const col = dump['vocab/narrow-the-scope'] as Doc;
    expect(col).toMatchObject({ word: 'narrow the scope', de: 'den Umfang eingrenzen', ex: 'We had to narrow the scope of the audit.', src: 'v5:col', state: 'new' });
    expect((col.lex as Lex).core).toBe('vocab/scope');
    expect((col.lex as Lex).intro).toBeNull();
    expect(dump['chunk/to-circle-back']).toMatchObject({ en: 'to circle back', src: 'v5:job', ex: "Let's circle back on this tomorrow." });
    expect(((dump['vocab/stakeholder-buy-in'] as Doc).lex as Lex).pri).toBe('core');
    for (const [, d] of out) expect(typeof d.ex === 'string' && d.ex.length > 0).toBe(true);
    // Zweiter Lauf mit dem neuen Bestand: nichts mehr zu tun (alles schon vorhanden oder Pools leer).
    const docs2 = new Map(Object.entries(h.dump()) as [string, Doc][]);
    const items2: Item[] = [...docs2].filter(([, d]) => d.lex).map(([p, d], i) => ({ path: p, lex: d.lex as Lex, order: i, src: srcOf(d.src) }));
    expect(await refillFresh(w, { docs: docs2, items: items2, quota: 10, nowMs: T0, place: null, w: SRC_WEIGHTS, load: () => Promise.resolve(SRC) })).toEqual([]);
  });
  it('genug Bestand je Quelle: lädt die Quellen gar nicht', async () => {
    const h = createMemoryDb({ seed: {} });
    const many: Item[] = (['col', 'job', 'own', 'band'] as const).flatMap((s) => Array.from({ length: 5 }, (_, i) => ({ path: `vocab/${s}${i}`, lex: emptyLex('w', 'edge', T0), order: i, src: s })));
    let loaded = 0;
    const out = await refillFresh(createWriter(h.db), { docs: new Map(), items: many, quota: 5, nowMs: T0, place: null, w: SRC_WEIGHTS, load: () => (loaded++, Promise.resolve(SRC)) });
    expect(out).toEqual([]);
    expect(loaded).toBe(0);
  });
  it('Ladefehler: nichts angelegt, kein Wurf', async () => {
    const h = createMemoryDb({ seed: {} });
    const out = await refillFresh(createWriter(h.db), { docs: new Map(), items: [], quota: 5, nowMs: T0, place: null, w: SRC_WEIGHTS, load: () => Promise.reject(new Error('weg')) });
    expect(out).toEqual([]);
    expect(Object.keys(h.dump())).toEqual([]);
  });
  it('Einstufung verschiebt die Grenze der Liste', async () => {
    const h = createMemoryDb({ seed: {} });
    const out = await refillFresh(createWriter(h.db), { docs: new Map(), items: [], quota: 2, nowMs: T0, place: { edge: 5000, ok: [] }, w: { col: 0, job: 0, own: 0, band: 1 }, load: () => Promise.resolve(SRC) });
    expect(out.map(([p]) => p)).toEqual(['vocab/ubiquitous']);
  });
});

describe('LearnRun: Nachfüllen vor dem ersten Pflicht-Plan', () => {
  it('Pflicht ohne heutigen Plan legt neue Wörter an und plant sie mit; „Noch 5“ / freies Üben füllen nicht nach', async () => {
    const scope: Doc = { word: 'scope', de: 'Umfang', ex: 'The scope is clear.', lex: learned(T0 - 10 * D) };
    const h = createMemoryDb({ seed: { 'vocab/scope': scope } });
    const dict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (x: string) => x };
    const drafts = { get: () => null, set: () => undefined, remove: () => undefined };
    const run = new LearnRun({ deps: { writer: createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts, readDay: () => Promise.resolve(h.dump()['vmod/day'] ?? null), now: () => T0, loadSources: () => Promise.resolve(SRC) });
    const PROFILE: Doc = { vcfg: { min: 15, ret: 0.9, mod: 1 }, newPerDay: 5 };
    const SCHEMA: Doc = { vocabModule: { v: 1, t: 1, state: 'done' } };
    await run.start({ kind: 'free', docs: [['vocab/scope', scope]], profile: PROFILE, schema: SCHEMA });
    expect(Object.keys(h.dump()).filter((p) => p !== 'vocab/scope' && /^(vocab|chunk)\//.test(p))).toEqual([]);
    const run2 = new LearnRun({ deps: { writer: createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts, readDay: () => Promise.resolve(h.dump()['vmod/day'] ?? null), now: () => T0, loadSources: () => Promise.resolve(SRC) });
    await run2.start({ kind: 'pflicht', docs: [['vocab/scope', scope]], profile: PROFILE, schema: SCHEMA });
    const made = Object.entries(h.dump()).filter(([p]) => p !== 'vocab/scope' && /^(vocab|chunk)\//.test(p));
    expect(made.length).toBeGreaterThan(0);
    expect(made.every(([, d]) => typeof d.src === 'string' && d.src.startsWith('v5:'))).toBe(true);
    const day = h.dump()['vmod/day'] as { d: string; plan: [string, string, string][] };
    expect(day.d).toBe(dayKey(T0));
    const planned = day.plan.filter((e) => e[1] === 'n').map((e) => e[0]);
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => made.some(([q]) => q === p))).toBe(true);
  });
});

describe('Begegnung im Lesen ändert den Lernstand nicht (plan.md §2.2)', () => {
  it('reportEvidence „seen“: kein FSRS-Wert ändert sich, nur ein Beleg im Verlauf', async () => {
    const scope: Doc = { word: 'scope', ex: 'The scope is clear.', lex: learned(T0 - 40 * D) };
    const h = createMemoryDb({ seed: { 'vocab/scope': scope } });
    const r = await reportEvidence({ lexeme: 'vocab/scope', kind: 'seen', src: 'read', ok: true, typed: false, cued: false, t: T0 }, { writer: createWriter(h.db), device: 'phone', docs: [['vocab/scope', scope]], profile: null });
    expect(r).toBe(false);
    expect((h.dump()['vocab/scope'] as Doc).lex).toEqual(scope.lex);
  });
});
