import { describe, expect, it } from 'vitest';
import bank from '../../../src/content/wt/bsl.json';
import { Catalog, type Item } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';
import { planMed } from '../../../src/modules/vocab/domain/pace';
import { pickOptions } from '../../../src/modules/vocab/domain/pick';
import { applyAnswer, emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import { SessionRun } from '../../../src/modules/vocab/domain/session';
import { type WtRaw, wtPool } from '../../../src/modules/vocab/domain/sources';
import { countCfg, DEFAULT_CFG, type Lex, WORDS_PER_DAY } from '../../../src/modules/vocab/domain/types';
import { freshDoc } from '../../../src/modules/vocab/data/refill';
import { exDeKey } from '../../../src/modules/vocab/domain/card';

// Großpaket WT „Wörter-Trainer C1“ Schritt 1 (Emrah 10.11.2026): geprüfte Wortliste, Tagesziel in Wörtern, Auswählen nach der Einführung,
// Schnellstart 10/20/30.

const T0 = Date.parse('2026-11-10T18:00:00Z');
const D = 86_400_000;
const items = (bank as { items: WtRaw[] }).items;

/** Gelerntes Wort (Tag 0 mit Schritt A und B), dessen Benutzen-Spur auf `due` gelegt wird. */
function learnedDue(t: number, due: number, lv = 3): Lex {
  const ctx = { cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set<number>() };
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx).lex;
  const b = l.b ?? l.u;
  return { ...l, lv, step: null, b: { ...b, due, sd: Math.max(b.sd, 5) }, u: { ...l.u, due: Math.max(l.u.due, due) } };
}

describe('geprüfte Wortliste (src/content/wt/bsl.json)', () => {
  it('jede Karte vollständig, Satz 6–20 Wörter, keine Klammern, keine doppelten Wörter', () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const e of items) {
      const n = e.x.split(/\s+/).length;
      if (!e.w || !e.p || !e.d || !e.g || !e.x || !e.xd || !e.lvl || !(e.r > 0)) bad.push(`${e.w}: Feld fehlt`);
      if (n < 6 || n > 20) bad.push(`${e.w}: Satzlänge ${n}`);
      if (/[[\]()]/.test(e.x)) bad.push(`${e.w}: Klammer im Satz`);
      if (seen.has(e.w)) bad.push(`${e.w}: doppelt`);
      seen.add(e.w);
    }
    expect(bad).toEqual([]);
    expect(items.length).toBeGreaterThan(1500);
  });
  it('wtPool: ohne Grundwortschatz (B1), ohne Vorhandenes, nach Rang; Satzübersetzung und Erklärung gehen mit', () => {
    const raw: WtRaw[] = [
      { w: 'allocate', p: 'verb', d: 'zuteilen', g: 'give for a purpose', x: 'We allocate budget every quarter.', xd: 'Wir teilen das Budget zu.', lvl: 'B2', r: 5 },
      { w: 'airport', p: 'noun', d: 'Flughafen', g: 'place for planes', x: 'The airport is close.', xd: 'Der Flughafen ist nah.', lvl: 'B1', r: 1 },
      { w: 'leverage', p: 'verb', d: 'nutzen', g: 'use to advantage', x: 'We leverage our network.', xd: 'Wir nutzen unser Netzwerk.', lvl: 'C1', r: 3 },
    ];
    const p = wtPool(raw, new Set(['leverage']), new Set());
    expect(p.map((f) => f.word)).toEqual(['allocate']);
    expect(p[0]).toMatchObject({ src: 'band', exDe: 'Wir teilen das Budget zu.', def: 'give for a purpose', ref: 'wt/bsl#5' });
    const nd = freshDoc(p[0]!, T0, 1)!;
    expect(nd.path).toBe('vocab/allocate');
    expect(nd.doc).toMatchObject({ word: 'allocate', de: 'zuteilen', def: 'give for a purpose', src: 'v5:band', exDe: { [exDeKey('We allocate budget every quarter.')]: 'Wir teilen das Budget zu.' } });
  });
});

describe('Tagesziel in Wörtern', () => {
  it('countCfg: Standard nach Zeit (Emrah 12.11.2026), mit Zahl Zeit-Notbremse 0,8 min je Wort (mindestens die Wörter-Zeit), kurzer Tag nach Minuten', () => {
    expect(WORDS_PER_DAY).toBe(0);
    expect(countCfg(undefined, 21, false)).toEqual({ cnt: 0, min: 21 });
    expect(countCfg(50, 21, false)).toEqual({ cnt: 50, min: 36 });
    expect(countCfg(30, 21, false)).toEqual({ cnt: 30, min: 24 });
    expect(countCfg(60, 30, false)).toEqual({ cnt: 60, min: 45 });
    expect(countCfg(0, 21, false)).toEqual({ cnt: 0, min: 21 });
    expect(countCfg(50, 5, true)).toEqual({ cnt: 0, min: 5 });
  });
  it('Plan mit 50 Wörtern: fällige zuerst, das neue Kontingent kommt immer, zusammen höchstens 50', () => {
    const due: Item[] = Array.from({ length: 80 }, (_, i) => ({ path: `vocab/due-${i}`, lex: learnedDue(T0 - 20 * D, T0 - D), order: i }));
    const fresh: Item[] = Array.from({ length: 30 }, (_, i) => ({ path: `vocab/new-${i}`, lex: emptyLex('w', 'edge', T0), order: 100 + i }));
    const cat = new Catalog([...due, ...fresh]);
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, min: 40, cnt: 50, newPerDay: 10 }, {});
    expect(plan.fresh).toBe(10);
    expect(plan.plan.length).toBeLessThanOrEqual(50);
    expect(plan.due).toBe(40);
    expect(plan.min).toBeGreaterThan(0);
  });
  it('ohne Tagesziel in Wörtern (cnt 0) nach Minuten: Wiederholungen zuerst, neue = Rest, höchstens das Tempo (Politur P2)', () => {
    const fresh: Item[] = Array.from({ length: 30 }, (_, i) => ({ path: `vocab/new-${i}`, lex: emptyLex('w', 'edge', T0), order: i }));
    const due: Item[] = Array.from({ length: 80 }, (_, i) => ({ path: `vocab/due-${i}`, lex: learnedDue(T0 - 20 * D, T0 - D), order: 100 + i }));
    // Nichts fällig: die neuen füllen die Zeit, höchstens das Tempo.
    expect(buildDayPlan(new Catalog(fresh), T0, { ...DEFAULT_CFG, min: 15, cnt: 0, newPerDay: 10 }, {}).plan.fresh).toBe(10);
    expect(buildDayPlan(new Catalog(fresh), T0, { ...DEFAULT_CFG, min: 15, cnt: 0, newPerDay: 10 }, planMed(null)).plan.fresh).toBe(5);
    // Viel fällig: nur die Mindestzahl neuer; im Wörter-Modus (cnt 50) bleibt das ganze Kontingent.
    const full = new Catalog([...due, ...fresh]);
    expect(buildDayPlan(full, T0, { ...DEFAULT_CFG, min: 15, cnt: 0, newPerDay: 10 }, planMed(null)).plan.fresh).toBe(2);
    expect(buildDayPlan(full, T0, { ...DEFAULT_CFG, min: 40, cnt: 50, newPerDay: 10 }, planMed(null)).plan.fresh).toBe(10);
  });
});

describe('Auswählen nach der Einführung (pick.ts)', () => {
  const pool = [
    { path: 'vocab/a', de: 'Angebot', pos: 'noun' },
    { path: 'vocab/b', de: 'Lieferung', pos: 'noun' },
    { path: 'vocab/c', de: 'zuteilen, zuweisen', pos: 'verb' },
    { path: 'vocab/d', de: 'Rechnung', pos: 'noun' },
    { path: 'vocab/e', de: 'Vertrag', pos: 'noun' },
  ];
  it('vier Bedeutungen, genau eine richtig, gleiche Wortart zuerst, fest je Startwert', () => {
    const m = pickOptions({ path: 'vocab/x', de: 'Lagerbestand', pos: 'noun' }, pool, 'x|2026-11-10')!;
    expect(m.options).toHaveLength(4);
    expect(m.options[m.right]).toBe('Lagerbestand');
    expect(m.options).not.toContain('zuteilen');
    expect(pickOptions({ path: 'vocab/x', de: 'Lagerbestand', pos: 'noun' }, pool, 'x|2026-11-10')).toEqual(m);
  });
  it('kein Ablenker mit gleicher Bedeutung; zu wenig Ablenker → keine Auswahl', () => {
    const m = pickOptions({ path: 'vocab/x', de: 'Angebot, Offerte', pos: 'noun' }, pool, 's')!;
    expect(m.options[m.right]).toBe('Angebot, Offerte');
    expect(m.options).not.toContain('Angebot');
    expect(pickOptions({ path: 'vocab/x', de: 'Angebot', pos: 'noun' }, pool.slice(0, 2), 's')).toBeNull();
  });
});

describe('Schnellstart 10 · 20 · 30 (freie Runde)', () => {
  const learned = (i: number, dueIn: number): Item => ({ path: `vocab/w${i}`, lex: learnedDue(T0 - 40 * D, T0 + dueIn * D, 4), order: i });
  it('reicht Fälliges nicht, kommen nicht fällige Wörter als Übung (ohne Planwirkung) dazu', () => {
    const cat = new Catalog([learned(1, -1), ...Array.from({ length: 15 }, (_, i) => learned(10 + i, 10))]);
    const run = new SessionRun('free10', cat, null, T0, { cfg: { ...DEFAULT_CFG, newPerDay: 0 } });
    const tasks = [];
    for (let t = run.next(T0); t; t = run.next(T0)) {
      tasks.push(t);
      run.done(t, T0);
    }
    expect(tasks).toHaveLength(10);
    expect(tasks[0]).toMatchObject({ path: 'vocab/w1', planned: true });
    expect(tasks.slice(1).every((t) => !t.planned && t.why === 'practice')).toBe(true);
  });
});

describe('täglich aufbereitete Atlas-Wörter (wtq/m-JJJJ-MM)', () => {
  it('wtqPaths: von November 2026 bis zum aktuellen Monat', async () => {
    const { wtqPaths } = await import('../../../src/modules/vocab/data/refill');
    expect(wtqPaths(Date.parse('2026-11-20T10:00:00Z'))).toEqual(['wtq/m-2026-11']);
    expect(wtqPaths(Date.parse('2027-02-03T10:00:00Z'))).toEqual(['wtq/m-2026-11', 'wtq/m-2026-12', 'wtq/m-2027-01', 'wtq/m-2027-02']);
  });
  it('readWtq: tolerant, ungültige Einträge fallen weg', async () => {
    const { readWtq } = await import('../../../src/modules/vocab/data/refill');
    const ok = { w: 'earnings', p: 'noun', d: 'Gewinn, Ertrag', g: 'money a company makes', x: 'Our quarterly earnings beat the forecast by ten percent.', xd: 'Unser Quartalsgewinn übertraf die Prognose um zehn Prozent.', lvl: 'B2', r: 4521 };
    expect(readWtq({ v: 1, items: [ok, { w: 'x' }, null] })).toEqual([ok]);
    expect(readWtq(null)).toEqual([]);
    expect(readWtq({ items: 'kaputt' })).toEqual([]);
  });
  it('alternate: Atlas und Business-Liste im Wechsel, ohne Doppelte', async () => {
    const { alternate } = await import('../../../src/modules/vocab/domain/sources');
    const f = (w: string) => ({ src: 'band' as const, word: w, de: 'x', ex: 'x', pos: 'noun', kind: 'vocab' as const, core: null, ref: w });
    expect(alternate([f('a1'), f('a2'), f('same')], [f('b1'), f('same')]).map((x) => x.word)).toEqual(['b1', 'a1', 'same', 'a2']);
  });
});
