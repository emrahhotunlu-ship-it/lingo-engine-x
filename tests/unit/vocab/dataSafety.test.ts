import { describe, expect, it } from 'vitest';
import { dayKey } from '../../../src/domain/date';
import { countDocuments } from '../../../src/data/reads';
import { EAGER_COLLECTION_NAMES, LAZY_COLLECTIONS } from '../../../src/data/paths';
import { loadSnapshot, loadVlogBackup } from '../../../src/data/snapshot';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';
import { applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { vlogDocId } from '../../../src/modules/vocab/domain/vlog';
import { nextVlogPart, VLOG_INDEX_PATH, vlogIdsOf, vlogProbeIds } from '../../../src/modules/vocab/domain/vlogIndex';
import { freezeDay, writeAnswer, writeVlog } from '../../../src/modules/vocab/data/store';
import { tuple } from '../../../src/modules/vocab/domain/vlog';
import { VMOD_DAY_PATH } from '../../../src/modules/vocab/registry';

// V3 Schritt 1 (Daten absichern, data-guard V1 B2): `vlog` träge mit Verzeichnis `vmod/ix`, vollständige Sicherung, Tagesplan zuerst,
// Verschiebungen in Gruppen und nie doppelt, kein Schreiben über ungültige oder künftige Lexeme, `update` auf fehlendem Dokument scheitert.

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set(), ...over });

function learned(t: number): Lex {
  let l = introduce(emptyLex('w', 'edge', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'x#0' }, ctx()).lex;
  return applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'x#0' }, ctx()).lex;
}
const tp = (t: number, path = 'vocab/x') => tuple({ t, path, track: 1, form: 'gap', note: 3, outcome: 'ok', ms: 9000, fk: 2000, hint: 0, sentence: null, lv: 2, flags: 0 });

describe('vlog ist träge (Verzeichnis vmod/ix)', () => {
  it('vlog steht in LAZY_COLLECTIONS; Voll-Lesen (Umstellung, Export) fragt die Sammlung nie ab', async () => {
    expect(LAZY_COLLECTIONS).toContain('vlog');
    expect(EAGER_COLLECTION_NAMES).not.toContain('vlog');
    expect(EAGER_COLLECTION_NAMES).toContain('vmod');
    const h = createMemoryDb({ seed: { 'vlog/2026-11-a': { v: 1, e: {} } } });
    const asked: string[] = [];
    const db = { ...h.db, collection: (n: string) => (asked.push(n), h.db.collection(n)) };
    const snap = await loadSnapshot(db);
    expect(asked).not.toContain('vlog');
    expect([...snap.raw.keys()].some((p) => p.startsWith('vlog/'))).toBe(false);
  });

  it('writeVlog trägt jedes Dokument (auch Fortsetzungen) ins Verzeichnis ein; Zählung kommt aus dem Verzeichnis', async () => {
    const h = createMemoryDb({ seed: {} });
    const w = createWriter(h.db);
    await writeVlog({ writer: w, device: 'phone' }, [tp(T0), tp(T0 + 1000), tp(T0 + 20 * D)], 'phone');
    const ix = h.dump()[VLOG_INDEX_PATH] as Doc;
    expect(vlogIdsOf(ix)).toEqual([vlogDocId(T0).slice(5), vlogDocId(T0 + 20 * D).slice(5)].sort());
    // Fortsetzung: Teil 1 fast voll → `-a2` wird angelegt und eingetragen.
    const big = { v: 1, e: Object.fromEntries(Array.from({ length: 3500 }, (_, i) => [`k${i}`, tp(T0 - 1000 - i)])) };
    const h2 = createMemoryDb({ seed: { [vlogDocId(T0)]: big } });
    const w2 = createWriter(h2.db);
    await writeVlog({ writer: w2, device: 'phone' }, [tp(T0)], 'phone');
    expect(vlogIdsOf(h2.dump()[VLOG_INDEX_PATH])).toEqual([`${vlogDocId(T0).slice(5)}`, `${vlogDocId(T0).slice(5)}2`]);
    const counts = await countDocuments(h2.db);
    expect(counts.byCollection.vlog).toBe(2);
  });

  it('Verzeichnis-Hilfen: ungültige Kennungen zählen nicht; Suchliste mit/ohne Verzeichnis; Fortsetzung bis 9', () => {
    expect(vlogIdsOf({ v: 1, docs: { '2026-11-a': 1, '2026-13-a': 1, x: 1, '2026-10-b3': 1 } })).toEqual(['2026-10-b3', '2026-11-a']);
    expect(vlogIdsOf(null)).toEqual([]);
    // Immer 24 Monate (48 Halbmonate), dazu Eingetragenes und Teil 1 jeder eingetragenen Fortsetzung (W4).
    const ids = vlogProbeIds(['2022-01-a', '2021-05-b3'], '2026-01-05');
    expect(ids).toHaveLength(48 + 3);
    expect(ids).toEqual(expect.arrayContaining(['2022-01-a', '2021-05-b3', '2021-05-b', '2024-02-a', '2026-01-b']));
    expect(vlogProbeIds([], '2026-11-01')).toHaveLength(48);
    expect(nextVlogPart('2026-11-a')).toBe('2026-11-a2');
    expect(nextVlogPart('2026-11-a8')).toBe('2026-11-a9');
    expect(nextVlogPart('2026-11-a9')).toBeNull();
  });

  it('Sicherung: vollständig aus dem Verzeichnis plus Suche; findet auch nicht eingetragene und Fortsetzungen', async () => {
    const seed: Record<string, Doc> = {
      [VLOG_INDEX_PATH]: { v: 1, docs: { '2025-03-a': 1 } },
      'vlog/2025-03-a': { v: 1, e: { a: 1 } },
      'vlog/2025-03-a2': { v: 1, e: { b: 1 } }, // nicht eingetragen, aber Fortsetzung eines eingetragenen
      'vlog/2026-11-a': { v: 1, e: { c: 1 } }, // nicht eingetragen (Absturz zwischen Dokument und Verzeichnis), aktueller Monat
    };
    const h = createMemoryDb({ seed });
    const r = await loadVlogBackup(h.db, '2026-11-01');
    expect(Object.keys(r.docs).sort()).toEqual(['vlog/2025-03-a', 'vlog/2025-03-a2', 'vlog/2026-11-a']);
    expect(r.unlisted.sort()).toEqual(['vlog/2025-03-a2', 'vlog/2026-11-a']);
    expect(r.indexMissing).toBe(false);
  });

  it('Sicherung: verlorener Eintrag eines alten Monats und Fortsetzung ohne eingetragenen Teil 1 werden trotzdem gesichert (W1, W4)', async () => {
    const seed: Record<string, Doc> = {
      [VLOG_INDEX_PATH]: { v: 1, docs: { '2022-04-b2': 1 } },
      'vlog/2022-04-b': { v: 1, e: { a: 1 } }, // Teil 1 nicht eingetragen, nur seine Fortsetzung, älter als 24 Monate
      'vlog/2022-04-b2': { v: 1, e: { b: 1 } },
      'vlog/2025-06-a': { v: 1, e: { c: 1 } }, // Eintrag verloren (gleichzeitiges erstes Anlegen), 17 Monate alt
    };
    const h = createMemoryDb({ seed });
    const r = await loadVlogBackup(h.db, '2026-11-01');
    expect(Object.keys(r.docs).sort()).toEqual(['vlog/2022-04-b', 'vlog/2022-04-b2', 'vlog/2025-06-a']);
  });

  it('Sicherung ohne Verzeichnis: sucht die letzten 24 Monate', async () => {
    const h = createMemoryDb({ seed: { 'vlog/2025-01-b': { v: 1, e: {} }, 'vlog/2024-06-a': { v: 1, e: {} } } });
    const r = await loadVlogBackup(h.db, '2026-11-01');
    expect(Object.keys(r.docs)).toEqual(['vlog/2025-01-b']); // 2024-06 liegt außerhalb der 24 Monate
    expect(r.indexMissing).toBe(true); // der Export vermerkt das im Kopf
  });
});

describe('Tagesplan zuerst, Verschiebungen gebündelt (freezeDay)', () => {
  const mk = (n: number, pri: Lex['pri']) =>
    Array.from({ length: n }, (_, i) => {
      const l = learned(T0 - 10 * D);
      return [`vocab/${pri}-${i}`, { word: `${pri}${i}`, ex: 'x', lex: { ...l, pri, u: { ...l.u, due: T0 - 3 * D }, b: { ...l.b!, due: T0 - 3 * D } } }] as const;
    });
  const setup = () => {
    const docs = Object.fromEntries([...mk(60, 'core'), ...mk(140, 'edge')]) as Record<string, Doc>;
    const h = createMemoryDb({ seed: docs });
    const items = () => Object.entries(h.dump()).filter(([p]) => p.startsWith('vocab/')).map(([path, d], order) => ({ path, lex: (d as { lex: Lex }).lex, order }));
    return { h, w: createWriter(h.db), items };
  };

  it('speichert den Plan und verschiebt jedes Randwort genau einmal', async () => {
    const { h, w, items } = setup();
    const expected = buildDayPlan(new Catalog(items()), T0, DEFAULT_CFG, {});
    expect(expected.moves.length).toBeGreaterThan(6);
    const plan = await freezeDay({ writer: w, device: 'phone' }, new Catalog(items()), T0, DEFAULT_CFG, {}, null);
    expect((h.dump()[VMOD_DAY_PATH] as Doc).d).toBe(dayKey(T0));
    expect(plan.plan).toEqual(expected.plan.plan);
    for (const m of expected.moves) expect((h.dump()[m.path] as { lex: Lex }).lex.mv).toBe(1);
  });

  it('zweites Gerät mit veraltetem Stand: übernimmt den gespeicherten Plan und verschiebt nichts doppelt', async () => {
    const { h, w, items } = setup();
    const staleCat = new Catalog(items());
    const first = await freezeDay({ writer: w, device: 'phone' }, new Catalog(items()), T0, DEFAULT_CFG, {}, null);
    const second = await freezeDay({ writer: createWriter(h.db), device: 'lapt' }, staleCat, T0 + 60_000, DEFAULT_CFG, {}, null);
    expect((second as { plan: unknown }).plan).toEqual(first.plan);
    const mvs = Object.entries(h.dump()).filter(([p]) => p.startsWith('vocab/')).map(([, d]) => (d as { lex: Lex }).lex.mv);
    expect(Math.max(...mvs)).toBe(1);
  });

  it('zwei Geräte gleichzeitig (beide sahen keinen Plan): die zweite Runde verschiebt nichts noch einmal (W2a)', async () => {
    const { h, w, items } = setup();
    const staleCat = new Catalog(items());
    await freezeDay({ writer: w, device: 'phone' }, new Catalog(items()), T0, DEFAULT_CFG, {}, null);
    // Simuliert das Rennen: das zweite Gerät hat den Plan nicht gesehen (Plan-Dokument fehlt bei seinem Lesen).
    await w.set(VMOD_DAY_PATH, { v: 1, d: '2000-01-01', plan: [] });
    await freezeDay({ writer: createWriter(h.db), device: 'lapt' }, staleCat, T0 + 60_000, DEFAULT_CFG, {}, null);
    const mvs = Object.entries(h.dump()).filter(([p]) => p.startsWith('vocab/')).map(([, d]) => (d as { lex: Lex }).lex.mv);
    expect(Math.max(...mvs)).toBe(1);
  });

  it('beschädigter heutiger Plan (ohne Liste) wird ersetzt statt jeden Start neu gerechnet (W2b)', async () => {
    const { h, w, items } = setup();
    await w.set(VMOD_DAY_PATH, { v: 1, d: dayKey(T0), plan: 'kaputt' });
    const plan = await freezeDay({ writer: w, device: 'phone' }, new Catalog(items()), T0, DEFAULT_CFG, {}, null);
    expect(Array.isArray((h.dump()[VMOD_DAY_PATH] as Doc).plan)).toBe(true);
    expect((h.dump()[VMOD_DAY_PATH] as Doc).plan).toEqual(plan.plan);
  });

  it('künftige Lex-Version wird nie verschoben (bleibt unverändert)', async () => {
    const { h, w, items } = setup();
    const moves = buildDayPlan(new Catalog(items()), T0, DEFAULT_CFG, {}).moves;
    const target = moves[0]!.path;
    const before = { ...(h.dump()[target] as Doc), lex: { ...((h.dump()[target] as Doc).lex as Doc), v: 2 } };
    await w.set(target, before);
    await freezeDay({ writer: w, device: 'phone' }, new Catalog(items().map((it) => (it.path === target ? { ...it, lex: { ...it.lex } } : it))), T0, DEFAULT_CFG, {}, null);
    expect(h.dump()[target]).toEqual(before);
  });
});

describe('Kein Schreiben über ungültige oder künftige Lexeme (writeAnswer)', () => {
  const answer = { t: T0, form: 'gap' as const, outcome: 'ok' as const, hint: 0, ms: 9000, fk: 2000, sentence: 'x#0' };
  for (const [name, lex] of [
    ['künftige Version', { ...learned(T0 - 10 * D), v: 2 }],
    ['ungültig', { v: 1, kaputt: true }],
  ] as const) {
    it(`${name}: Ergebnis null, Dokument unverändert, kein Verlaufseintrag`, async () => {
      const doc = { word: 'scope', ex: 'Define the scope.', lex };
      const h = createMemoryDb({ seed: { 'vocab/scope': doc } });
      const w = createWriter(h.db);
      const cat = new Catalog([]);
      const r = await writeAnswer({ writer: w, device: 'phone' }, 'vocab/scope', answer, { cfg: DEFAULT_CFG, cat, med: {}, planned: true });
      expect(r).toBeNull();
      expect(h.dump()['vocab/scope']).toEqual(doc);
      expect(Object.keys(h.dump()).some((p) => p.startsWith('vlog/') || p === VLOG_INDEX_PATH)).toBe(false);
    });
  }
});

describe('Writer.update auf fehlendem Dokument', () => {
  it('scheitert (db.update verlangt ein bestehendes Dokument) und legt nichts an', async () => {
    const h = createMemoryDb({ seed: {} });
    const w = createWriter(h.db);
    await expect(w.update('vmod/stats', { v: 1 })).rejects.toBeTruthy();
    expect(h.dump()['vmod/stats']).toBeUndefined();
  });
});
